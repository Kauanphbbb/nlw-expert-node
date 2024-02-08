import cookie from '@fastify/cookie';
import fastify from 'fastify';
import { createPoll } from './routes/createPoll';
import { getPoll } from './routes/getPoll';
import { voteOnPoll } from './routes/voteOnPoll';

const app = fastify();

app.register(cookie, {
  secret: 'my-secret',
  hook: 'onRequest',
});
app.register(createPoll);
app.register(getPoll);
app.register(voteOnPoll);

app.listen({ port: 3333 }).then(() => {
  console.log('HTTP server running');
});
