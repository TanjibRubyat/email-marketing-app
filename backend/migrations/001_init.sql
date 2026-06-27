-- 001_init.sql
-- Core schema: users (account owners), contacts, lists, campaigns,
-- the per-recipient send record, tracking events, and a suppression list.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The people being emailed. Scoped per-user so two accounts can both have
-- a contact with the same email address without clashing.
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'subscribed'
    CHECK (status IN ('subscribed', 'unsubscribed', 'bounced', 'complained')),
  custom_fields JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_status ON contacts(status);

-- Lists/audiences. A campaign targets one or more lists.
CREATE TABLE lists (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Many-to-many: a contact can belong to multiple lists.
CREATE TABLE list_contacts (
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, contact_id)
);

CREATE TABLE campaigns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(998) NOT NULL,
  from_name VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  html_body TEXT,
  text_body TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Which lists a given campaign sends to.
CREATE TABLE campaign_lists (
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  list_id INTEGER NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  PRIMARY KEY (campaign_id, list_id)
);

-- One row per recipient per campaign. This is what the future queue worker
-- writes to, and what the SMTP client's accepted/rejected result maps onto.
CREATE TABLE sends (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'bounced', 'failed')),
  smtp_response TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, contact_id)
);
CREATE INDEX idx_sends_campaign_id ON sends(campaign_id);
CREATE INDEX idx_sends_status ON sends(status);

-- Opens, clicks, bounces, unsubscribes, complaints - one per occurrence.
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  send_id INTEGER NOT NULL REFERENCES sends(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL
    CHECK (type IN ('open', 'click', 'bounce', 'unsubscribe', 'complaint')),
  url TEXT, -- only set for 'click' events
  metadata JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_send_id ON events(send_id);
CREATE INDEX idx_events_type ON events(type);

-- Global do-not-email list, independent of list membership. Checked before
-- every send regardless of which lists a contact is still on.
CREATE TABLE suppressions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  reason VARCHAR(20) NOT NULL
    CHECK (reason IN ('unsubscribed', 'bounced', 'complained')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, email)
);
