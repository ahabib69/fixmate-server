# FixMate Server

Express API for FixMate, a device and home-appliance repair marketplace for Bangladesh. It uses the native MongoDB driver, JWT authorization and Stripe test Checkout. Prices are USD. Authentication is hosted by the sibling Next.js app using BetterAuth.

## Run

Node.js 22 LTS and MongoDB 7+ are recommended. Use Atlas or a local replica set for BetterAuth transactions.

```bash
npm ci
cp .env.example .env
# Configure MongoDB, JWT and Stripe test credentials.
npm run dev
```

The default port is 5000. `GET /api/health` is a liveness check; `GET /api/services` additionally confirms database initialization. Both applications explicitly use the `fixmate` database.

## Environment

- `PORT`: local HTTP port.
- `MONGODB_URI`: database connection string, also used by the client authentication server.
- `JWT_SECRET`: same server-only secret as the Next.js project.
- `STRIPE_SECRET_KEY`: your Stripe test secret key.
- `STRIPE_WEBHOOK_SECRET`: signing secret for this webhook endpoint. The local CLI listener and deployed endpoint use different secrets.
- `CLIENT_URL`: exact allowed frontend origin. Comma-separated origins are accepted for CORS; the first origin is used for Stripe redirects.

## Seed

```bash
npm run seed
```

**Use a disposable development database.** Seeding deletes all services, bookings and payments in `fixmate`, replaces the seven demo users and their credential accounts, and clears their sessions. Other users are retained. Back up any existing data first. Never run this command automatically during deployment.

Seeded data: 1 admin, 3 technicians, 3 customers; 19 services (14 approved, 3 pending, 2 rejected); 8 bookings covering every status; and 2 demo payments. Demo payments have synthetic Stripe IDs, not real Stripe sessions. Credential hashes and MongoDB account references match BetterAuth's adapter and are verified by the integration suite.

| Role | Email | Password |
| --- | --- | --- |
| Admin | admin@fixmate.com | Admin123 |
| Technician | rahim@fixmate.com | Rahim123 |
| Technician | sara@fixmate.com | Sara123 |
| Technician | tanvir@fixmate.com | Tanvir123 |
| Customer | customer@fixmate.com | Customer123 |
| Customer | nusrat@fixmate.com | Nusrat123 |
| Customer | mehedi@fixmate.com | Mehedi123 |

## Collections and indexes

BetterAuth uses `user`, `account`, `session`, and `verification`. The application uses `services`, `bookings`, and `payments`. `verification` may not exist until an authentication flow needs it. IDs in application documents are MongoDB ObjectIds; JSON responses serialize them as strings.

Indexes are created on startup and after seed:

- Unique `payments.stripeSessionId` for webhook/verification replay protection.
- Unique `payments.bookingId` for one recorded payment per booking.
- Unique partial `(customerEmail, serviceId)` while booking status is requested, accepted or in-progress. This protects duplicate requests even under concurrency.
- Unique user email, plus listing and technician booking indexes.

Existing databases with duplicates must be backed up and reconciled before these unique indexes can be created. The API fails initialization rather than silently disabling an invariant.

## Authorization and business rules

Every protected endpoint requires `Authorization: Bearer <JWT>`. The JWT comes from the client's `/api/auth/token`. Express verifies HS256 and uses its email to load the current database user. Role/email fields in bodies or query strings never establish identity.

- Public services must be approved and available. Editing a service resets approval to pending.
- Only customers can request repairs; technicians/admins cannot. Own-service requests are rejected.
- An active duplicate returns 409 with `You already have an active request for this service`.
- Customers cancel only requested bookings. Technicians may perform requested → accepted/rejected, accepted → in-progress, in-progress → completed. Completion requires a finite positive final amount. Updates match the prior status to reject stale concurrent actions.
- Checkout requires a completed, unpaid booking owned by the caller. Amount comes from the booking's final amount, never from the request body. Open Checkout sessions are reused; Stripe idempotency keys prevent concurrent creation of different sessions for the same checkout generation. An expired session allows a new generation.
- Recording requires a paid Stripe session matching the booking's currency, amount and customer metadata. Unique indexes protect recording, and retries repair an interrupted booking-payment update.
- Admins cannot change their own role. Booking oversight is read-only; admins cannot bypass the repair workflow.

## API reference

Responses are JSON. Errors use `{ "message": "…" }`. Lists are arrays unless noted. Public listing uses `{ data, total, page, totalPages }`.

### Public services

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/services` | `search`, `category`, `serviceMode`, `sort=price-asc|price-desc|newest`, `page`, `limit` (max 50) |
| GET | `/api/services/latest` | Six newest approved/available listings |
| GET | `/api/services/:id` | Approved/available detail, otherwise 404 |

### Technician services

| Method | Route | Body / result |
| --- | --- | --- |
| GET | `/api/services/mine` | All own listings |
| POST | `/api/services` | title, category, description, image, basePrice, estimatedDuration, serviceMode, serviceArea |
| PATCH | `/api/services/:id` | Editable fields above; approval resets to pending |
| DELETE | `/api/services/:id` | Delete own listing; existing booking snapshots remain |
| PATCH | `/api/services/:id/availability` | `{ isAvailable: boolean }` |

Categories: Smartphone, Laptop & PC, AC, Refrigerator, TV, Washing Machine, Electrical. Modes: Home Visit or Shop Drop-off. Images must use HTTPS on ImgBB, Unsplash or pravatar, matching the Next Image configuration.

### Bookings

| Method | Route | Role / body |
| --- | --- | --- |
| POST | `/api/bookings` | Customer: serviceId, customerPhone, address, preferredDate, problemDescription (20+ characters) |
| GET | `/api/bookings/my` | Customer; optional `status` |
| PATCH | `/api/bookings/:id/cancel` | Customer owner, requested only |
| GET | `/api/bookings/technician` | Assigned technician; optional `status` |
| GET | `/api/bookings/technician/stats` | Technician totals, earnings and status breakdown |
| PATCH | `/api/bookings/:id/status` | Assigned technician: `{ status, finalAmount? }` |

### Payments

| Method | Route | Role / body |
| --- | --- | --- |
| GET | `/api/payments/my` | Customer payment history |
| POST | `/api/payments/create-checkout-session` | Customer: `{ bookingId }`; returns `{ url, id }` |
| GET | `/api/payments/verify?session_id=…` | Customer owner; returns `{ message, payment }` |
| POST | `/api/payments/webhook` | Stripe signature required, not JWT; listens for checkout.session.completed |

The JSON parser retains the raw body before parsing. Do not add a different parser or mutate the webhook payload ahead of signature verification.

### Administration and profile

| Method | Route | Notes |
| --- | --- | --- |
| GET | `/api/admin/stats` | Counts, booking/category breakdowns and latest 12 recorded revenue months |
| GET | `/api/admin/users` | Optional `role`, `search` |
| PATCH | `/api/admin/users/:id/role` | `{ role: customer|technician|admin }` |
| GET | `/api/admin/services` | Optional `approvalStatus`; pending first |
| PATCH | `/api/admin/services/:id/approval` | `{ approvalStatus: approved|rejected }` |
| GET | `/api/admin/bookings` | Optional `status` |
| GET | `/api/admin/payments` | `{ payments, totalRevenue }` |
| PATCH | `/api/users/profile` | Any authenticated user: name, phone, area, bio, image; no email/role changes |

## Tests

```bash
npm test
```

Twenty-six isolated booking transition and payment route tests run without a database. For real temporary-database tests, install both projects, then run `npm run test:integration` in `fixmate-client`. That suite verifies seed authentication, API authorization, concurrent duplicates, workflow transitions, approvals, payment recording and signed webhook retries without connecting to Stripe or a production database.

## Deployment

Deploy this folder as a separate Vercel project using `vercel.json`, or run `npm start` on a Node host. Environment variables must be configured before the app starts. `index.js` exports the Express app without binding a port when imported, and initializes MongoDB before database-backed routes. Connections are shared per warm process.

Set `CLIENT_URL` to the deployed client origin and register `https://<your-api-origin>/api/payments/webhook` in Stripe test mode. Use the real deployment origin in place of the notation; no deployment is included. `RUNBOOK.md` contains the full sequence.

Stripe test mode does not move real money. Before a real launch, review payment-provider business eligibility, use an eligible merchant account, rotate all demo secrets, remove public demo credentials, and add operational monitoring, backups, rate limiting and abuse controls.
