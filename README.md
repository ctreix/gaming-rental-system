# Gaming Rental Reservation System

A gaming-station rental and reservation app built with Next.js 14 (App Router).
It runs fully locally: a SQLite database through Prisma, JWT session auth, and
Next.js route handlers. No external services are required.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Next.js Route Handlers + Prisma |
| Database | SQLite (local file) |
| Auth | httpOnly JWT session cookie (`jose`, HS256) + `bcryptjs` password hashing |
| Validation | Zod (shared between the API routes and the pages) |
| Icons | Lucide React |
| Tests | Vitest (unit + API), Playwright (E2E) |

## Features

### Customer
- Browse gaming stations and filter by type (PC, PS5, VIP).
- View unit details and hardware specifications.
- Check hourly availability (08:00-23:00 WIB) for a chosen date; already-started
  and booked slots are shown as unavailable.
- Select consecutive hourly slots and hold them with a 15-minute booking lock.
- Create a reservation; the price is calculated on the server from the lock and
  the unit's hourly rate (amounts sent by the client are ignored).
- List own reservations and cancel a reservation that is still `PENDING`.

### Admin
- Read-only dashboard: unit counts, pending count, revenue (only `PAID`
  reservations) and a table of all reservations.
- Change a reservation's status through the allowed transitions
  (Confirm / Start / Complete / No-show / Cancel). Confirming a booking marks
  the payment `PAID` and records who verified it; cancelling a confirmed
  booking marks the payment `REFUNDED`.
- User names are masked in list views.

### Authentication
- Register, log in, log out, and view the current user.
- Forgot password: a 30-minute single-use reset link (stored as a sha256 hash)
  is queued in a local `email_outbox` table and printed to the server console.
  In development, `/dev/mail` shows the last 20 outbox messages.
- Input validation is shared between the pages and the API routes.

## Setup

Prerequisites: Node.js 18+ and npm.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET (e.g. openssl rand -base64 32)
npm run db:migrate          # create the SQLite database and apply migrations
npm run db:seed             # insert the demo accounts and units
npm run dev                 # http://localhost:3000
```

Environment variables (see `.env.example`):

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | SQLite file, e.g. `file:./dev.db` |
| `AUTH_SECRET` | Secret used to sign session and reset tokens |
| `APP_URL` | Public base URL, used in password-reset links |

### Seeded demo accounts (local development only)

| Role | Email | Password |
|------|-------|----------|
| ADMIN | `admin@gamerent.local` | `Admin12345` |
| CUSTOMER | `customer@gamerent.local` | `Customer12345` |

The seed also creates 8 units (3 PC, 3 PS5, 2 VIP).

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Start the production server |
| `npm run lint` | Next.js lint |
| `npm run db:migrate` | Create/apply migrations (`prisma migrate dev`) |
| `npm run db:seed` | Run the seed (`prisma db seed`) |
| `npm run db:reset` | Reset the database and re-seed |
| `npm test` | Vitest unit + API tests |
| `npm run test:e2e` | Playwright end-to-end tests |

## Testing

Tests run against a throwaway SQLite copy (`prisma/test.db`), never the
development database. Both suites apply migrations and seed that file first.

```bash
npm test          # unit tests (lib/utils, lib/validation, lib/reservation-status)
                  # + API tests driven against a dev server on port 3210
npm run test:e2e  # Playwright, dev server on port 3000 with DATABASE_URL=file:./test.db
```

- Unit tests live in `tests/unit`, API tests in `tests/api`, E2E specs in
  `tests/e2e`.
- If a dev server is already running on port 3000, Playwright reuses it
  (`reuseExistingServer: true`); make sure it points at `prisma/test.db`.
- Running the E2E suite right after a production build can print a transient
  `Failed to generate static paths` warning from the dev server; deleting
  `.next` clears it.

## Data Model

`prisma/schema.prisma` defines: `User`, `Unit`, `Reservation`,
`ReservationLock` (15-minute booking locks) and `PasswordResetToken`, plus an
`EmailOutbox` table for the local reset links.

## API Endpoints

| Method | Endpoint | Access | Purpose |
|--------|----------|--------|---------|
| POST | `/api/auth/register` | public | Create an account (role is always CUSTOMER) |
| POST | `/api/auth/login` | public | Issue the session cookie |
| POST | `/api/auth/logout` | public | Clear the session cookie |
| GET | `/api/auth/me` | session | Current user |
| POST | `/api/auth/forgot-password` | public | Queue a reset link (always a neutral 200) |
| POST | `/api/auth/reset-password` | public | Consume a reset token and set a new password |
| GET | `/api/units?type=PC\|PS5\|VIP` | public | List units |
| GET | `/api/units/[id]` | public | Unit detail |
| GET | `/api/units/[id]/availability?date=YYYY-MM-DD` | session | Hourly slots for a date |
| POST | `/api/locks` | session | Acquire a 15-minute lock |
| DELETE | `/api/locks/[session_id]` | session (owner) | Release a lock |
| POST | `/api/reservations` | session | Create a reservation from a lock |
| GET | `/api/reservations/mine` | session | Own reservations |
| PATCH | `/api/reservations/[id]` | session (owner or admin) | Change reservation status |
| GET | `/api/admin/reservations` | admin | All reservations |

## Reservation Status Transitions

The single source of truth is `lib/reservation-status.ts`; the UI only offers
buttons for transitions the server will accept.

| From | To | Who | Side effect |
|------|----|-----|-------------|
| PENDING | CONFIRMED | ADMIN | payment → PAID, records verifier |
| PENDING | CANCELLED | owner CUSTOMER or ADMIN | — |
| CONFIRMED | ACTIVE | ADMIN | — |
| ACTIVE | COMPLETED | ADMIN | — |
| CONFIRMED | NO_SHOW | ADMIN | — |
| CONFIRMED | CANCELLED | ADMIN | payment → REFUNDED |

## Not implemented yet

- Payment-proof upload and online payment gateways (payment is tracked only as
  a status; there is no file upload endpoint).
- Admin CRUD for units (create/edit/delete) — the admin dashboard is read-only.
- Real email delivery (reset links go to the `email_outbox` table and the
  console only).
- Multi-instance rate limiting (the forgot-password limiter is in-memory, per
  process).
- Deployment configuration.

## License

MIT License - for educational purposes.
