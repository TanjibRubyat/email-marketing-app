import { Worker, Job } from 'bullmq';
import dotenv from 'dotenv';
import { redisConnection } from './connection';
import { pool } from '../db/pool';
import { SMTPClient, SMTPError } from '../smtp/client';
import { injectTracking } from '../tracking/injectTracking';
import type { SendJobData } from './sendQueue';

dotenv.config();

const SMTP_HOST = process.env.SMTP_HOST ?? '127.0.0.1';
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 2525;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? 'http://localhost:4000';

interface SendRow {
  id: number;
  tracking_token: string;
  subject: string;
  from_name: string;
  from_email: string;
  html_body: string | null;
  text_body: string | null;
  email: string;
}

async function processSend(job: Job<SendJobData>): Promise<void> {
  const { sendId } = job.data;

  const { rows } = await pool.query<SendRow>(
    `SELECT s.id, s.tracking_token, c.subject, c.from_name, c.from_email, c.html_body, c.text_body, ct.email
     FROM sends s
     JOIN campaigns c ON c.id = s.campaign_id
     JOIN contacts ct ON ct.id = s.contact_id
     WHERE s.id = $1`,
    [sendId]
  );

  const send = rows[0];
  if (!send) {
    console.warn(`Send ${sendId} no longer exists, skipping`);
    return;
  }

  const trackedHtml = send.html_body
    ? injectTracking(send.html_body, send.tracking_token, PUBLIC_BASE_URL)
    : undefined;

  // One fresh connection per send. Fine for a learning project talking to a
  // single local relay; a production worker would pool/reuse connections
  // per destination domain to avoid a handshake-per-email overhead.
  const client = await SMTPClient.connect(SMTP_HOST, SMTP_PORT);

  try {
    const result = await client.sendMail({
      from: send.from_email,
      to: [send.email],
      subject: send.subject,
      body: send.text_body ?? stripHtml(send.html_body ?? ''),
      htmlBody: trackedHtml,
    });
    await client.quit();

    if (result.rejected.length > 0) {
      await pool.query(`UPDATE sends SET status = 'bounced', smtp_response = $1 WHERE id = $2`, [
        result.rejected[0].reason,
        sendId,
      ]);
      return;
    }

    await pool.query(
      `UPDATE sends SET status = 'sent', smtp_response = 'OK', sent_at = now() WHERE id = $1`,
      [sendId]
    );
  } catch (err) {
    await client.quit().catch(() => {});
    const reason = err instanceof SMTPError ? err.message : String(err);
    await pool.query(`UPDATE sends SET status = 'failed', smtp_response = $1 WHERE id = $2`, [
      reason,
      sendId,
    ]);
    throw err; // rethrow so BullMQ applies the retry/backoff policy
  }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

export const sendWorker = new Worker<SendJobData>('campaign-sends', processSend, {
  connection: redisConnection,
  concurrency: 5,
});

sendWorker.on('completed', (job) => console.log(`✓ send ${job.data.sendId} completed`));
sendWorker.on('failed', (job, err) => console.error(`✗ send ${job?.data.sendId} failed: ${err.message}`));

console.log('Send worker running, waiting for jobs...');
