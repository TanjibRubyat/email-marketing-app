-- 003_seed_default_user.sql
-- There's no signup/login flow yet, and the frontend hardcodes user_id=1.
-- Without this, every fresh database (a new Docker volume, a fresh clone,
-- a teammate's machine) starts with zero users, and the very first INSERT
-- into contacts/lists/campaigns fails on the user_id foreign key - exactly
-- what happened when testing against a brand new docker-compose volume.
--
-- Safe to re-run: only inserts if the users table is currently empty, so
-- it won't create a second user once one already exists.
INSERT INTO users (email, password_hash, name)
SELECT 'admin@example.com', 'unset', 'Default user'
WHERE NOT EXISTS (SELECT 1 FROM users);
