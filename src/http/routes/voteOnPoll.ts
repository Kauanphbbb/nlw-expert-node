import { randomUUID } from 'crypto';
import { FastifyInstance } from 'fastify';
import z from 'zod';
import { prisma } from '../../lib/prisma';
import { redis } from '../../lib/redis';
import { voting } from '../../utils/VotingPubSub';

export async function voteOnPoll(app: FastifyInstance) {
  app.post('/polls/:pollId/votes', async (request, reply) => {
    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid(),
    });
    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const { pollId } = voteOnPollParams.parse(request.params);

    let { sessionId } = request.cookies;

    if (sessionId) {
      const userAlreadyVotedInThisPoll = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            pollId,
            sessionId,
          },
        },
      });

      if (
        userAlreadyVotedInThisPoll &&
        userAlreadyVotedInThisPoll.pollOptionId !== pollOptionId
      ) {
        await prisma.vote.delete({
          where: {
            id: userAlreadyVotedInThisPoll.id,
          },
        });

        const votes = await redis.zincrby(
          pollId,
          -1,
          userAlreadyVotedInThisPoll.pollOptionId
        );

        voting.publish(pollId, {
          pollOptionId: userAlreadyVotedInThisPoll.pollOptionId,
          votes: Number(votes),
        });
      } else if (userAlreadyVotedInThisPoll) {
        return reply
          .status(400)
          .send({ message: 'you already voted on this poll' });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();

      reply.setCookie('sessionId', sessionId, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, //30 days
        signed: true,
        httpOnly: true,
      });
    }

    await prisma.vote.create({
      data: {
        sessionId,
        pollId,
        pollOptionId,
      },
    });

    const votes = await redis.zincrby(pollId, 1, pollOptionId);

    voting.publish(pollId, {
      pollOptionId,
      votes: Number(votes),
    });

    return reply.status(201).send({ sessionId });
  });
}
