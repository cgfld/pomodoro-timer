# Tomodo Plus rollout

## Phase one: product preview (implemented on feature/tomodo-plus)

- Free: complete timer, Tomato, Desert Oasis, Zen Garden, and today's work/rest/completion totals.
- Plus: other themes, daily goal, weekly/monthly work-by-day views.
- Price proposal approved: $3 monthly or $24 yearly.
- Premium theme selection applies the actual theme to the full page without opening a window. The timer pauses; pressing Start (or Space) opens Plus instead of running it. Free themes remain usable, and Escape restores the previous theme. Browsing a premium theme does not change the saved preference or grant access.
- Existing premium theme preferences and historical data are retained. Free users fall back to Tomato until entitled.
- Local calendar rollover resets today's counters. Lifetime records remain stored for migration.
- Reset today preserves previous days. Existing work recorded for today is migrated; past rest and completion totals cannot reliably be reconstructed as daily activity.

The Free/Plus UI now connects to the backend implementation described in [the setup guide](BACKEND-SETUP.md). Real external accounts, credentials, and end-to-end email/payment verification are still pending. Theme visuals remain public browser assets; paid account data and preferences are checked on the server.

## Review locally

Run `npm ci` and `npm run dev` from the repository. The development runtime serves the app and API together.

- Free: http://localhost:8788/
- Simulated Plus: http://localhost:8788/?review=plus

The review switch works only for localhost, 127.0.0.1, or [::1]. The same query parameter on tomodo.app or a Pages preview domain never grants Plus. There is no persistent paid flag in localStorage.

Check every theme preview, the two locked statistics cards, and the paid views. Test mobile widths and keyboard navigation in a browser. No browser was connected in the implementation environment, so visual QA is still required.

Automated checks: `npm test`, `npm run build`, and `node --check app.js`. See the backend setup guide for completed checks and the remaining external integration tests.

## Phase two: accounts, storage, and checkout

Keep Cloudflare hosting. Use Supabase for managed authentication and PostgreSQL; Stripe for subscription billing.

1. Create separate development and production Supabase projects. Configure email authentication and the allowed sign-in redirect URLs. The project URL and publishable key are public configuration, not credentials that grant administrative access.
2. Create user-owned tables for preferences, daily activity, goals, and server-managed billing entitlements. Enable row-level security. Users must never be able to write their own billing state.
3. Implement authenticated Cloudflare endpoints for Checkout, billing portal, and entitlement reads. Bind secret keys in Cloudflare's environment settings, never in public JavaScript or Git.
4. Import browser-local activity explicitly after sign-in. Use stable IDs and conflict handling so repeated imports and sync retries never double-count. Preserve existing history on upgrade and downgrade.
5. Create monthly and yearly Stripe prices in test mode. Account identity must come from a verified sign-in token. Accept only server-configured price IDs.
6. Verify Stripe webhook signatures, record event IDs, tolerate retries and out-of-order events, and reconcile current subscription state before changing access. Define grace-period and refund behavior explicitly.
7. Replace the localhost access simulation with server-provided entitlements. Premium data requests must be authorized on the server. A successful Checkout redirect alone must not grant access.
8. Add account/billing management and cross-device synchronization. Keep completed daily work available on downgrade, with history views gated.
9. Test the full purchase lifecycle, expiration, account isolation, local-midnight/DST behavior, multiple tabs, and offline sync before enabling live payment.
10. Complete business/payment setup, support contact, privacy/purchase terms, refund policy, and applicable tax configuration before launch.

Official references:
- https://supabase.com/docs/guides/auth
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://developers.cloudflare.com/pages/functions/
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/customer-management
