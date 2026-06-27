import { Queue } from 'bullmq';
import { redisConnection } from './connection';

export interface SendJobData {
  sendId: number;
}

/**
 * One job = one (campaign, contact) pair = one row in the `sends` table.
 * Queuing per-recipient (rather than one big "send campaign X" job) means
 * BullMQ can retry, rate-limit, and report progress on each recipient
 * independently - exactly what you want when 1 bad address out of 5,000
 * shouldn't block or fail the rest.
 */
export const sendQueue = new Queue<SendJobData>('campaign-sends', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 1000,
  },
});
