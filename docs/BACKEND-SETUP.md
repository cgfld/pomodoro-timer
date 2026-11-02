# Connect Tomodo's backend

Production is Cloudflare Worker **pomodoro-timer**, serving both `tomodo.app` and `www.tomodo.app`. The checked-in `wrangler.jsonc` targets that existing Worker; `www` redirects to the canonical `tomodo.app` origin. The site is deployed, Supabase is connected, and email-link sign-in has been confirmed. Password sign-in, password changes, and recovery callbacks have also been verified against production using disposable accounts. Live Stripe Managed Payments is configured and billing is enabled at $11.99/year.

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

Open http://localhost:8788/, choose Settings, enter your email, and follow the sign-in link. You should see your email and a Sign out button. Password controls are behind the Set or change password button. Accounts without Plus can sync today's statistics; historical import and history reads require Plus.

The local Worker runs on port 8788. `.dev.vars` overrides the production `APP_ORIGIN` with `http://localhost:8788`. The Python static server is still usable for theme design, but it does not run account or payment endpoints.

The UI-only local Plus preview remains at `?review=plus`. It never bypasses server authorization, even on localhost. Real server features require a verified paid account.

### Connect the verified project to production

After filling the three Supabase values in the ignored `.dev.vars` file and applying the migration, run:

```sh
npm run connect:supabase
```

The connector validates the key types, email authentication, and all four database tables before changing production. It passes only the three Supabase values to Wrangler over stdin and then checks `https://tomodo.app/api/config`. It never uploads the localhost `APP_ORIGIN`, prints key values, or changes Stripe settings. Cloudflare login must be active. To validate without uploading, use `node scripts/connect-supabase.mjs --check`.

## 3. Create Stripe in test mode

Sandbox resources verified on 2026-11-02 in **tomodo.app sandbox** (`acct_1UX6pB0vQfdXsfq1`):

- Existing product: `prod_VYWff3rtvcUe7v` (tomodo plus); tax code updated to `txcd_10103100`.
- Existing default price: `price_1UXPc30vQfdXsfq13B4Vurvb`, USD 1199 every year, exclusive of tax. Saved to local `.dev.vars` as `STRIPE_PRICE_YEARLY`.
- Managed Payments sandbox Checkout creation succeeded (`cs_test_a1Tup5Ly7NWR7dPgzwOIxw4MwqPXYJbpJzwH0Kqt96itRIIs7YUU8f4obr`). Payment remains incomplete. This standalone session is not associated with a Tomodo user and cannot verify account activation.
- App integration still needs the sandbox `STRIPE_SECRET_KEY` and endpoint-specific `STRIPE_WEBHOOK_SECRET`. Obtain the secret key from the sandbox Dashboard; never commit it. Billing remains disabled until an authenticated app checkout and signed webhook have been verified.


1. Create a Stripe account and use its sandbox/test environment.
2. Activate Managed Payments in the Stripe Dashboard. Create one product: **Tomodo Plus**, with eligible tax code `txcd_10103100`. The integration uses API version `2026-02-25.preview` from the blueprint.
3. Add one **USD recurring** price: **$11.99 every year**. No trial or metered pricing is configured by this implementation. The server verifies those amounts, currency, and intervals before checkout.
4. Copy the price ID into `STRIPE_PRICE_YEARLY` in `.dev.vars`.
5. Put the Stripe **test secret key** from https://dashboard.stripe.com/test/apikeys in `STRIPE_SECRET_KEY`. A Stripe publishable key is not needed because the app redirects to Stripe-hosted Checkout.
6. Enable Stripe's customer portal and allow customers to update payment methods and cancel at the end of the paid period. Configure any plan switching to use only these Tomodo prices.
7. Install the official Stripe CLI and forward signed events to your local endpoint:

```sh
stripe login
stripe listen --forward-to http://localhost:8788/api/stripe-webhook
```

8. Put the CLI's `whsec_...` signing secret in `.dev.vars` as `STRIPE_WEBHOOK_SECRET`.
9. Set `BILLING_ENABLED=true` **with test keys**, restart the local server, sign in, select a plan, and test Checkout. The hosted checkout is test mode; use Stripe's documented test cards, not a real card. See https://docs.stripe.com/testing.
10. The Checkout return URL does not grant access. The signed webhook reconciles Stripe's current subscription state and updates the database. The app refreshes account access automatically every minute and when the browser window regains focus.

Checkout always sets `managed_payments[enabled]=true`. Stripe handles indirect tax calculation through Managed Payments; do not send `automatic_tax` or `customer_update[address]`. Prices shown by Tomodo are base prices; hosted Checkout displays the final total. Test different billing addresses and complete a sandbox payment using `4242 4242 4242 4242`, a future expiry, and any CVC. Verify the signed `checkout.session.completed` event updates the matching account before treating the integration as verified.

## 4. Deploy to the existing Cloudflare Worker

The production mapping has been verified through Cloudflare: `tomodo.app` and `www.tomodo.app` use Worker `pomodoro-timer`. `wrangler.jsonc` now contains its name and account ID. It preserves dashboard variables and uses the `ASSETS` binding for the built website.

```sh
npm run build
npx wrangler deploy
```

For Git-based Workers Builds use `npm run build` as the build command and `npx wrangler deploy` as the deploy command. Do not create a second site or change DNS. The separate Pages Functions wrapper is available for future migration, but production uses `worker.mjs`.

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
| `STRIPE_PRICE_YEARLY` | Yearly price ID for the selected environment | Plain variable |
| `BILLING_ENABLED` | `true` only when ready to accept the selected environment's payments | Plain variable |

The live webhook is registered at `https://pomodoro-timer.colegreenfield3.workers.dev/api/stripe-webhook` for these events. The direct Worker address avoids the custom domain’s Cloudflare browser challenge; webhook signatures are still required:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`

The signing secret belongs to that endpoint and environment; a local CLI secret is not a production endpoint secret. Preview deployments need their own exact `APP_ORIGIN`, redirect allowlist, and test credentials.

## Behavior and operational boundaries

- Supabase verifies the bearer token for every protected request. A claimed user ID from the browser is never trusted.
- All application tables have RLS enabled and no browser-role grants. Server routes enforce user ownership and paid access; service secrets never enter the browser bundle.
- Verified `active`/`trialing` subscriptions with an approved price and future paid-period end receive Plus. Cancel-at-period-end retains access until that end. `past_due`, unpaid, canceled, or expired access is free; there is no payment-failure grace period yet. Refunds do not themselves cancel subscriptions; handle refund/cancellation policy through Stripe/support.
- Replayed webhook event IDs are deduplicated. Current subscription state is fetched from Stripe, and stale reconciliations cannot overwrite newer ones.
- Source snapshots are scoped to an account and browser. Higher revisions replace prior totals; retrying does not add the same work twice. Cloud aggregates are displayed separately and never uploaded as local work.
- Guest statistics stay local and separate from signed-in account statistics. There is no import button. Switching accounts partitions local data; sign-out restores guest data.
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

**Still required before paid launch:** complete Stripe sandbox purchase/renewal/cancel/failure tests, two-device sync testing, and the business's support/privacy/purchase/refund/tax setup. Supabase sign-in and the database migration are connected; actual signup/password-reset email delivery should be checked alongside the already verified recovery callbacks.

## Password sign-in and recovery

Settings supports email/password sign-in, password account creation with email confirmation, and the existing email-link option. Email addresses act as usernames.

- Tomodo adds no password length or character-composition rules. Passwords are passed unchanged to Supabase, whose project-level policy still applies. Password-manager paste and passphrases are supported.
- Signed-in email-link users can set a password on their existing account, preserving statistics, customer ID, and subscription.
- Forgot password sends a Supabase recovery email to the same allowed root redirect. A verified recovery callback automatically opens Settings and focuses the new-password form.
- Passwords are passed directly to Supabase Auth over HTTPS. Tomodo does not persist them to localStorage, its database, logs, or configuration. Fields clear after success and when Settings closes.
- Supabase handles password verification/hashing, email confirmation, and auth rate limits. Any stricter project-level password or reauthentication policy remains enforced by Supabase.
- `node scripts/diagnose-password.mjs` tests the local build against the live Supabase/API using a disposable account. `--live` tests deployed assets instead. Neither sends email, and the temporary account is removed afterward. Actual signup/recovery email delivery should also be tested by the site owner.

## Live billing verification — 2026-11-02

- Live account `acct_1UXP6z15GQrGdGPl` (tomodo.app) reports charges enabled.
- Product `prod_VYX7VNR9vaoQdL`, price `price_1UXQ3W15GQrGdGPl16XH1iHO`: USD 1199/year, exclusive of applicable tax, eligible tax code `txcd_10103100`.
- Webhook `we_1UXQ3a15GQrGdGPlVWXWA71Z` uses `2026-02-25.preview` and the direct Worker address above.
- Live Stripe secrets and `BILLING_ENABLED=true` uploaded to the existing Worker. Deployed version `98405bce-691e-4ff5-8cb1-c24b72c464ae`.
- All 49 tests and build passed. Deployed Worker config confirms accounts and billing enabled.
- A disposable account verified authenticated checkout through the application handler with real live Stripe/Supabase services, customer persistence, and portal creation. A synthetic signed webhook sent to the deployed Worker verified reconciliation without granting unpaid access. Validation sessions were expired, disposable users/customers cleaned up, and no payment was taken.
- Direct custom-domain HTTP checks receive a Cloudflare browser challenge (403), so a complete customer browser checkout and real Stripe payment-event delivery remain unverified.

`node scripts/connect-stripe.mjs --upload` validates/reuses this live product and configures the webhook and Cloudflare secrets without printing credentials. `node scripts/check-live-billing.mjs` performs the disposable-account checks above without charging a card.
