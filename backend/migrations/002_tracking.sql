-- 002_tracking.sql
-- An unguessable token per send, used in pixel/click URLs instead of the
-- sequential `sends.id`. Using the raw incrementing ID would let anyone
-- enumerate tracking URLs (id=1, id=2, id=3...) and pollute another
-- recipient's open/click stats, or probe which IDs exist at all - a classic
-- IDOR pattern. gen_random_uuid() is built into Postgres 13+, no extension
-- needed.

ALTER TABLE sends ADD COLUMN tracking_token UUID NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX idx_sends_tracking_token ON sends(tracking_token);
