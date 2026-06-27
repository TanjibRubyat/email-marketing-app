import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';

export const listsRouter = Router();

// GET /api/lists?user_id=1
listsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = Number(req.query.user_id);
    if (!userId) return res.status(400).json({ error: 'user_id query param is required' });

    const { rows } = await pool.query(
      `SELECT l.id, l.name, l.description, l.created_at,
              COUNT(lc.contact_id)::int AS contact_count
       FROM lists l
       LEFT JOIN list_contacts lc ON lc.list_id = l.id
       WHERE l.user_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [userId]
    );
    res.json(rows);
  })
);

// POST /api/lists
listsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { user_id, name, description } = req.body;
    if (!user_id || !name) {
      return res.status(400).json({ error: 'user_id and name are required' });
    }

    const { rows } = await pool.query(
      `INSERT INTO lists (user_id, name, description) VALUES ($1, $2, $3) RETURNING *`,
      [user_id, name, description ?? null]
    );
    res.status(201).json(rows[0]);
  })
);

// POST /api/lists/:id/contacts  { contact_id }
listsRouter.post(
  '/:id/contacts',
  asyncHandler(async (req, res) => {
    const { contact_id } = req.body;
    if (!contact_id) return res.status(400).json({ error: 'contact_id is required' });

    await pool.query(
      `INSERT INTO list_contacts (list_id, contact_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, contact_id]
    );
    res.status(204).send();
  })
);

// DELETE /api/lists/:id/contacts/:contactId
listsRouter.delete(
  '/:id/contacts/:contactId',
  asyncHandler(async (req, res) => {
    await pool.query(
      `DELETE FROM list_contacts WHERE list_id = $1 AND contact_id = $2`,
      [req.params.id, req.params.contactId]
    );
    res.status(204).send();
  })
);

// GET /api/lists/:id/contacts
listsRouter.get(
  '/:id/contacts',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT c.id, c.email, c.first_name, c.last_name, c.status
       FROM contacts c
       JOIN list_contacts lc ON lc.contact_id = c.id
       WHERE lc.list_id = $1
       ORDER BY c.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  })
);
