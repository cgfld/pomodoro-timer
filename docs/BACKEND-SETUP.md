# Connect Tomodo's backend

The implementation runs on Cloudflare Pages **or** Cloudflare Workers. Neither account has been created yet, so sign-in, email delivery, and actual test payments still need to be verified against your services. No production deployment or payment has been performed.

## 1. Create the Supabase project first

1. Create an account at https://supabase.com/dashboard and create a project for Tomodo. Start with a development project; use a separate production project before public launch.
2. In the project's SQL Editor, run the complete contents of `supabase/migrations/202610290001_accounts.sql` once. This creates preferences, versioned activity sources, billing records, and restricted server-only functions.
3. In Authentication, enable email sign-in. The app uses Supabase's default email magic-link flow: entering an email creates an account if needed and sends a sign-in link. Keep email confirmation enabled.
4. Configure the development Site URL as `http://localhost:8788`. Allow `http://localhost:8788/` as a sign-in redirect. For production use `https://tomodo.app` and `https://tomodo.app/` in the production project instead.
5. Find the project URL and publishable key under the project's API settings. A legacy `anon` key also works as the publishable key. These two values are safe for browser use.
6. Find the secret API key (or legacy `service_role` key). This belongs **only** in local ignored configuration or Cloudflare secrets. Do not paste it into chat, frontend files, or Git.
7. Supabase's built-in email service is restricted and is not a public production email service. Configure a custom SMTP provider before inviting public users; test delivery, expired links, and repeat sign-in. See https://supabase.com/docs/guides/auth/auth-smtp.

## 2. Run account sign-in locally

Install Node 22 or newer, then run:

```sh
npm ci
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` privately:

- `APP_ORIGIN=http://localhost:8788`
- `SUPABASE_URL`: project URL
- `SUPABASE_PUBLISHABLE_KEY`: publishable/anon key
- `SUPABASE_SECRET_KEY`: secret/service-role key
- Leave `BILLING_ENABLED=false` until Stripe test configuration is complete.

Then run:

```sh
npm run dev
```

Open http://localhost:8788/, choose Settings, enter your email, and follow the sign-in link. You should see your email, a Sign out button, and an option to import this browser's previous statistics. Accounts without Plus can sync today's statistics; historical import and history reads require Plus.

Use `npm run dev:worker` for the Workers version; its default port is 8787, so change `APP_ORIGIN` and the Supabase redirect URL to match. The Python static server is still usable for theme design, but it does not run account or payment endpoints.

The UI-only local Plus preview remains at `?review=plus`. It never bypasses server authorization, even on localhost. Real server features require a verified paid account.

## 3. Create Stripe in test mode

1. Create a Stripe account and use its sandbox/test environment.
2. Create one product: **Tomodo Plus**.
3. Add two **USD recurring** prices: **$3 every month** and **$24 every year**. No trial or metered pricing is configured by this implementation. The server verifies those amounts, currency, and intervals before checkout.
4. Copy the two price IDs into `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY` in `.dev.vars`.
5. Put the Stripe **test secret key** in `STRIPE_SECRET_KEY`. A Stripe publishable key is not needed because the app redirects to Stripe-hosted Checkout.
6. Enable Stripe's customer portal and allow customers to update payment methods and cancel at the end of the paid period. Configure any plan switching to use only these Tomodo prices.
7. Install the official Stripe CLI and forward signed events to your local endpoint:

```sh
stripe login
stripe listen --forward-to http://localhost:8788/api/stripe-webhook
```

8. Put the CLI's `whsec_...` signing secret in `.dev.vars` as `STRIPE_WEBHOOK_SECRET`.
9. Set `BILLING_ENABLED=true` **with test keys**, restart the local server, sign in, select a plan, and test Checkout. The hosted checkout is test mode; use Stripe's documented test cards, not a real card. See https://docs.stripe.com/testing.
10. The Checkout return URL does not grant access. The signed webhook reconciles Stripe's current subscription state and updates the database. Settings → Refresh account reloads access; the app also refreshes automatically every minute.

Optional tax collection uses `STRIPE_AUTOMATIC_TAX=true`. Configure Stripe Tax and the business's applicable obligations before enabling it. Prices shown by Tomodo are base prices; hosted Checkout displays the final total.

## 4. Confirm whether the existing Cloudflare project is Pages or Workers

Open Cloudflare → Workers & Pages and open the project serving `tomodo.app`.

- **Pages** projects show Pages deployments, a build command, and a build output directory. Use `wrangler.jsonc`. Set the existing project's build command to `npm run build`, output directory to `dist`, and Node version to 22 or newer. Pages compiles `functions/api/[[path]].js` automatically. Match the config's `name` to the existing project name before using deployment commands.
- **Workers** projects show a Worker script and bindings. Use `wrangler.worker.jsonc`, matching its `name` to the existing Worker. `worker.mjs` serves API routes and delegates the website to the `ASSETS` binding. Run `npm run build` before deployment.

Both versions use the same backend; do not create a second production site or change DNS just to add accounts. Do not upload the entire repository as static assets: deploy only the `dist` output and the compiled backend.

## 5. Configure production after test-mode verification

In the existing Cloudflare project's settings, add the corresponding variables/secrets separately for preview and production:

| Name | Value | Visibility |
| --- | --- | --- |
| `APP_ORIGIN` | Exact serving origin, e.g. `https://tomodo.app` | Plain variable |
| `SUPABASE_URL` | Production project URL | Plain variable |
| `SUPABASE_PUBLISHABLE_KEY` | Production publishable/anon key | Plain variable |
| `SUPABASE_SECRET_KEY` | Production secret/service-role key | Secret |
| `STRIPE_SECRET_KEY` | Secret key for the selected Stripe environment | Secret |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for this exact webhook endpoint | Secret |
| `STRIPE_PRICE_MONTHLY` | Monthly price ID for the selected environment | Plain variable |
| `STRIPE_PRICE_YEARLY` | Yearly price ID for the selected environment | Plain variable |
| `BILLING_ENABLED` | `true` only when ready to accept the selected environment's payments | Plain variable |
| `STRIPE_AUTOMATIC_TAX` | `true` only after Stripe Tax configuration, otherwise `false` | Plain variable |

Register `https://tomodo.app/api/stripe-webhook` in Stripe for these events:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`

The signing secret belongs to that endpoint and environment; a local CLI secret is not a production endpoint secret. Preview deployments need their own exact `APP_ORIGIN`, redirect allowlist, and test credentials.

## Behavior and operational boundaries

- Supabase verifies the bearer token for every protected request. A claimed user ID from the browser is never trusted.
- All application tables have RLS enabled and no browser-role grants. Server routes enforce user ownership and paid access; service secrets never enter the browser bundle.
- Verified `active`/`trialing` subscriptions with an approved price and future paid-period end receive Plus. Cancel-at-period-end retains access until that end. `past_due`, unpaid, canceled, or expired access is free; there is no payment-failure grace period yet. Refunds do not themselves cancel subscriptions; handle refund/cancellation policy through Stripe/support.
- Replayed webhook event IDs are deduplicated. Current subscription state is fetched from Stripe, and stale reconciliations cannot overwrite newer ones.
- Source snapshots are scoped to an account and browser. Higher revisions replace prior totals; retrying does not add the same work twice. Cloud aggregates are displayed separately and never uploaded as local work.
- A user explicitly imports prior guest data. Re-importing the same source is idempotent. Switching accounts partitions local data; sign-out restores guest data.
- Reset today resets this browser's contribution only, preserving previous days and other devices.
- Modern browsers use a Web Lock to prevent multiple Tomodo tabs from running a timer simultaneously. Cross-device sessions remain separate contributions.
- Pending local work survives network failure. Today sync is available to signed-in free users; old pending history sync resumes with Plus.
- History API requests support bounded date ranges up to ten years; older data is retained in the database. The current UI has week/month navigation.
- Theme visuals remain browser-delivered assets, not DRM. The backend protects account data, paid preferences, and billing state. The browser's timer/theme gate is a product access rule.

## Verification completed locally

- Node test suite covers HTTP authentication/origin checks, server-enforced paid access, Stripe signature validation and current-state reconciliation, source validation/retry behavior, account switching, and the real app markup.
- A local PostgreSQL engine runs the actual migration and checks browser-role denial, source revision ordering, webhook replay/staleness, and Checkout leases.
- `npm run build` creates only allowlisted public assets.
- Both Cloudflare Pages Functions and Workers bundles compile without deployment.

**Still required before public launch:** actual Supabase email sign-in, real project migration, complete Stripe sandbox purchase/renewal/cancel/failure tests, two-device sync testing, production email delivery, and the business's support/privacy/purchase/refund/tax setup. These require the accounts you will create; local mocks are not a substitute for that final integration test.
