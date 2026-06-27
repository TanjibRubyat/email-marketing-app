import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';
import { TRACKING_PIXEL } from '../tracking/injectTracking';

export const trackingRouter = Router();

// GET /track/open/:token - fired when a mail client loads the pixel image.
trackingRouter.get(
  '/open/:token',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT id FROM sends WHERE tracking_token = $1', [
      req.params.token,
    ]);

    // Always serve the pixel, even for an unrecognised token - a broken
    // image in someone's inbox is a worse failure mode than a missing
    // analytics row, and returning an error here would let someone probe
    // which tokens are valid.
    if (rows[0]) {
      await pool.query(`INSERT INTO events (send_id, type, metadata) VALUES ($1, 'open', $2)`, [
        rows[0].id,
        JSON.stringify({ userAgent: req.headers['user-agent'] ?? null }),
      ]);
    }

    res.set('Content-Type', 'image/gif');
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(TRACKING_PIXEL);
  })
);

// GET /track/click/:token?u=<encoded original URL> - logs the click, then redirects.
trackingRouter.get(
  '/click/:token',
  asyncHandler(async (req, res) => {
    const target = req.query.u;

    // Reject anything that isn't a plain http(s) URL - this endpoint takes
    // a URL from the querystring and redirects to it, which is an
    // open-redirect shape if left unchecked. Blocking javascript:, data:,
    // and other schemes is the minimum bar; a stricter version would also
    // check the URL was one we actually wrote into this specific campaign.
    if (typeof target !== 'string' || !/^https?:\/\//i.test(target)) {
      return res.status(400).send('Invalid redirect target');
    }

    const { rows } = await pool.query('SELECT id FROM sends WHERE tracking_token = $1', [
      req.params.token,
    ]);

    if (rows[0]) {
      await pool.query(`INSERT INTO events (send_id, type, url) VALUES ($1, 'click', $2)`, [
        rows[0].id,
        target,
      ]);
    }

    res.redirect(302, target);
  })
);
