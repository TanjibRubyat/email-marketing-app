import express from 'express';
import cors from 'cors';
import { contactsRouter } from './routes/contacts';
import { listsRouter } from './routes/lists';
import { campaignsRouter } from './routes/campaigns';

export const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/api/contacts', contactsRouter);
app.use('/api/lists', listsRouter);
app.use('/api/campaigns', campaignsRouter);

// Catch-all error handler. Must have 4 params (including unused ones) for
// Express to recognise it as an error handler rather than a normal route.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});
