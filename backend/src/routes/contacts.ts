import { Router } from 'express';
import { pool } from '../db/pool';
import { asyncHandler } from '../utils/asyncHandler';

export const contactsRouter = Router();

// GET /api/contacts?user_id=1
contactsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(400).json({ error: 'user_id query param is required' });
    }

    const { rows } = await pool.query(
      `SELECT id, email, first_name, last_name, status, custom_fields, created_at
       FROM contacts WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    res.json(rows);
  })
);

// POST /api/contacts
contactsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const { user_id, email, first_name, last_name, custom_fields } = req.body;
    if (!user_id || !email) {
      return res.status(400).json({ error: 'user_id and email are required' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO contacts (user_id, email, first_name, last_name, custom_fields)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, first_name, last_name, status, custom_fields, created_at`,
        [user_id, email, first_name ?? null, last_name ?? null, custom_fields ?? {}]
      );
      res.status(201).json(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') {
        // unique_violation - this user already has a contact with this email
        return res.status(409).json({ error: 'Contact with this email already exists' });
      }
      if (err.code === '23503') {
        // foreign_key_violation - the referenced user_id doesn't exist
        return res.status(400).json({ error: `No user with id ${user_id} exists` });
      }
      throw err;
    }
  })
);

// GET /api/contacts/:id
contactsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await pool.query('SELECT * FROM contacts WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  })
);

// PATCH /api/contacts/:id
contactsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { first_name, last_name, status, custom_fields } = req.body;
    const { rows } = await pool.query(
      `UPDATE contacts SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         status = COALESCE($3, status),
         custom_fields = COALESCE($4, custom_fields),
         updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [first_name ?? null, last_name ?? null, status ?? null, custom_fields ?? null, req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Contact not found' });
    res.json(rows[0]);
  })
);

// DELETE /api/contacts/:id
contactsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rowCount } = await pool.query('DELETE FROM contacts WHERE id = $1', [req.params.id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Contact not found' });
    res.status(204).send();
  })
);
