import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { sendQueue } from '../queue/sendQueue';

export const campaignsRouter = Router();

// GET /api/campaigns?user_id=1
campaignsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = Number(req.query.user_id);
    if (!userId) return res.status(400).json({ error: 'user_id query param is required' });

    const { rows } = await pool.query(
      `SELECT id, name, subject, status, scheduled_at, sent_at, created_at
       FROM campaigns WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  })
);

// POST /api/campaigns
campaignsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { user_id, name, subject, from_name, from_email, html_body, text_body, list_ids } = req.body;
    if (!user_id || !name || !subject || !from_name || !from_email) {
      return res.status(400).json({
        error: 'user_id, name, subject, from_name, and from_email are required',
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `INSERT INTO campaigns (user_id, name, subject, from_name, from_email, html_body, text_body)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [user_id, name, subject, from_name, from_email, html_body ?? null, text_body ?? null]
      );
      const campaign = rows[0];

      if (Array.isArray(list_ids)) {
        for (const listId of list_ids) {
          await client.query(
            `INSERT INTO campaign_lists (campaign_id, list_id) VALUES ($1, $2)`,
            [campaign.id, listId]
          );
        }
      }

      await client.query('COMMIT');
      res.status(201).json(campaign);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// GET /api/campaigns/:id
campaignsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM campaigns WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json(rows[0]);
  })
);

// PATCH /api/campaigns/:id
campaignsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { name, subject, from_name, from_email, html_body, text_body, status } = req.body;
    const { rows } = await pool.query(
      `UPDATE campaigns SET
         name = COALESCE($1, name),
         subject = COALESCE($2, subject),
         from_name = COALESCE($3, from_name),
         from_email = COALESCE($4, from_email),
         html_body = COALESCE($5, html_body),
         text_body = COALESCE($6, text_body),
         status = COALESCE($7, status),
         updated_at = now()
       WHERE id = $8
       RETURNING *`,
      [
        name ?? null,
        subject ?? null,
        from_name ?? null,
        from_email ?? null,
        html_body ?? null,
        text_body ?? null,
        status ?? null,
        req.params.id,
      ]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.json(rows[0]);
  })
);

// DELETE /api/campaigns/:id
campaignsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Campaign not found' });
    res.status(204).send();
  })
);

// POST /api/campaigns/:id/send
// Fans out: finds every eligible contact across the campaign's target lists,
// creates a `sends` row per recipient, and enqueues one job per row.
campaignsRouter.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    const campaignId = req.params.id;

    const { rows: recipients } = await pool.query(
      `SELECT DISTINCT ct.id, ct.email, ct.user_id
       FROM campaign_lists cl
       JOIN list_contacts lc ON lc.list_id = cl.list_id
       JOIN contacts ct ON ct.id = lc.contact_id
       WHERE cl.campaign_id = $1
         AND ct.status = 'subscribed'
         AND NOT EXISTS (
           SELECT 1 FROM suppressions sup
           WHERE sup.user_id = ct.user_id AND sup.email = ct.email
         )`,
      [campaignId]
    );

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'No eligible recipients found for this campaign' });
    }

    const client = await pool.connect();
    const sendIds: number[] = [];
    try {
      await client.query('BEGIN');

      for (const recipient of recipients) {
        const { rows } = await client.query(
          `INSERT INTO sends (campaign_id, contact_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (campaign_id, contact_id) DO NOTHING
           RETURNING id`,
          [campaignId, recipient.id]
        );
        if (rows[0]) sendIds.push(rows[0].id);
      }

      await client.query(`UPDATE campaigns SET status = 'sending' WHERE id = $1`, [campaignId]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await Promise.all(sendIds.map((id) => sendQueue.add('send', { sendId: id })));

    res.status(202).json({ queued: sendIds.length });
  })
);

// GET /api/campaigns/:id/sends - per-recipient status for this campaign
campaignsRouter.get(
  '/:id/sends',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT s.id, s.status, s.smtp_response, s.sent_at, ct.email
       FROM sends s
       JOIN contacts ct ON ct.id = s.contact_id
       WHERE s.campaign_id = $1
       ORDER BY s.id`,
      [req.params.id]
    );
    res.json(rows);
  })
);

// GET /api/campaigns/:id/stats - send outcomes plus open/click counts
campaignsRouter.get(
  '/:id/stats',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'sent')    AS sent,
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'bounced') AS bounced,
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'failed')  AS failed,
         COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'pending') AS pending,
         COUNT(DISTINCT e.send_id) FILTER (WHERE e.type = 'open')  AS unique_opens,
         COUNT(*)                 FILTER (WHERE e.type = 'open')  AS total_opens,
         COUNT(DISTINCT e.send_id) FILTER (WHERE e.type = 'click') AS unique_clicks,
         COUNT(*)                 FILTER (WHERE e.type = 'click') AS total_clicks
       FROM sends s
       LEFT JOIN events e ON e.send_id = s.id
       WHERE s.campaign_id = $1`,
      [req.params.id]
    );
    res.json(rows[0]);
  })
);
