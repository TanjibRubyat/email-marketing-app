# Email Marketing Platform (from scratch)

A full email marketing application built from the ground up, including a
hand-rolled **SMTP server and client implemented on raw TCP sockets** - no
SMTP library, no third-party transactional email API. Built as a learning
project to go deep on the SMTP protocol, Node.js/TypeScript backend
engineering, and message queue architecture.

## Why build SMTP from scratch?

Most "send an email" tutorials reach for SendGrid/SES/Postmark and never
touch the protocol underneath. This project does the opposite: the server
implements the SMTP command state machine (`EHLO`/`MAIL FROM`/`RCPT TO`/
`DATA`) directly over `net.Socket`, including dot-stuffing, multi-line
response parsing, and per-recipient bounce handling - the same mechanics
that govern real-world mail delivery and deliverability.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐
│  Express API │────▶│   Postgres   │     │  BullMQ      │────▶│  SMTP Client │
│  (contacts,  │     │  (contacts,  │◀────│  Queue +     │     │  (raw TCP)   │
│  lists,      │     │  campaigns,  │     │  Worker      │     └──────┬───────┘
│  campaigns)  │     │  sends,      │     │              │            │
└─────────────┘     │  events)     │     └──────────────┘            ▼
                     └──────────────┘                          ┌──────────────┐
                                                                 │ SMTP Server  │
                                                                 │  (raw TCP)   │
                                                                 └──────────────┘
```

1. The API stores contacts, lists, and campaigns in Postgres.
2. Triggering a send fans out one `sends` row per eligible recipient and
   queues one BullMQ job per row.
3. A worker picks up each job, sends the message through the hand-rolled
   SMTP client, and writes the result (`sent` / `bounced` / `failed`) back.

## Stack

- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Queue:** Redis + BullMQ
- **SMTP:** Hand-rolled client and server, raw `net` sockets (no `nodemailer`,
  no `smtp-server` package)
- **Frontend:** Vue 3 + TypeScript *(planned)*

## Project structure

```
smtp-server/    Standalone SMTP protocol implementation (server + client),
                kept as a readable reference for the protocol itself.
backend/        The actual application: REST API, Postgres schema,
                BullMQ queue/worker (uses its own copy of the SMTP client).
docker-compose.yml   Local Postgres + Redis.
```

## Running locally

Requires Docker Desktop, Node.js 20+.

```bash
docker compose up -d              # starts Postgres + Redis

cd backend
cp .env.example .env
npm install
npm run migrate                   # applies the database schema
```

Then, in three separate terminals:

```bash
# Terminal 1 - the SMTP relay
cd smtp-server && npm install && npm run dev

# Terminal 2 - the API
cd backend && npm run dev

# Terminal 3 - the queue worker
cd backend && npm run worker
```

API available at `http://localhost:4000`. See `backend/src/routes/` for
available endpoints (contacts, lists, campaigns, send triggering).

## Status

- [x] SMTP server - protocol state machine over raw sockets
- [x] SMTP client - multi-line responses, per-recipient bounce handling
- [x] Postgres schema - contacts, lists, campaigns, sends, events, suppressions
- [x] REST API - contacts/lists/campaigns CRUD
- [x] BullMQ queue + worker wired to the SMTP client
- [ ] Open/click tracking
- [ ] Vue 3 frontend
- [ ] Automation sequences

## Author

Built by Tanjib as a learning and portfolio project alongside an MSc in
Computer Networking and Cybersecurity.
