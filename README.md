# FixMate Server

Express and MongoDB REST API for FixMate, a repair service booking platform. It handles JWT authentication, role based access, the booking status pipeline and Stripe test-mode payments.

## Live Links
- Live API: https://fixmate-server.vercel.app/api
- Live site: https://fixmate-asad.vercel.app
- Client repo: https://github.com/ahabib69/fixmate-client
- Server repo: https://github.com/ahabib69/fixmate-server

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@fixmate.com | Admin123 |
| Technician | rahim@fixmate.com | Rahim123 |
| Customer | customer@fixmate.com | Customer123 |

Stripe test card: `4242 4242 4242 4242`, any future expiry date, any CVC.

## Features
- Collections: users, services, bookings, payments
- Services: server-side search, category filter, sort and pagination; only approved and available services are public
- JWT middlewares for roles (verifyToken, verifyCustomer, verifyTechnician, verifyAdmin) returning 401 and 403
- Booking status pipeline enforced on the server: requested, accepted, in-progress, completed (no skipping steps)
- Duplicate active requests blocked (409) and past dates rejected
- Payment gate: Stripe Checkout is allowed only for completed and unpaid bookings, using the final amount in USD
- Stripe webhook (checkout.session.completed) with an idempotent handler that marks the booking as paid
- Admin routes: approve or reject services, users, payments and stats
- CORS limited to the client origin (CLIENT_URL) and localhost

## Main API Routes
| Method | Route | Access |
|--------|-------|--------|
| GET | /api/services, /api/services/latest | Public |
| POST, PATCH | /api/services | Technician |
| POST | /api/bookings | Customer |
| GET | /api/bookings/my | Customer |
| GET | /api/bookings/technician | Technician |
| PATCH | /api/bookings/:id/status | Technician |
| PATCH | /api/bookings/:id/cancel | Customer |
| POST | /api/payments/create-checkout-session | Customer |
| GET | /api/payments/my | Customer |
| POST | /api/payments/webhook | Stripe |
| GET | /api/admin/stats, /api/admin/users, /api/admin/payments | Admin |
| PATCH | /api/admin/services/:id/approval | Admin |

## npm Packages
- express (server framework)
- mongodb (native MongoDB driver)
- jsonwebtoken (JWT)
- stripe (payments)
- cors (cross-origin requests)
- dotenv (environment variables)
- nodemon (development only)

## Run Locally
```bash
npm install
cp .env.example .env
npm run seed
npm run dev
```
The API runs on http://localhost:5000.

## Environment Variables
Create `.env` (never commit it):

| Name | Purpose |
|------|---------|
| PORT | Server port (5000) |
| MONGODB_URI | MongoDB connection string (database fixmate) |
| JWT_SECRET | Must be identical to the client value |
| STRIPE_SECRET_KEY | Stripe secret key (sk_test_...) |
| STRIPE_WEBHOOK_SECRET | Stripe webhook signing secret (whsec_...) |
| CLIENT_URL | Client origin, comma separated if more than one |

## Stripe Webhook
In Stripe test mode, add the endpoint https://fixmate-server.vercel.app/api/payments/webhook for the event checkout.session.completed and copy its signing secret into STRIPE_WEBHOOK_SECRET.

## Deployment
Deployed on Vercel. Environment variables are set in the Vercel project settings.
