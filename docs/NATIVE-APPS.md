# Tomodo native apps

The first target is a locally bundled macOS app. It shares the web frontend and the existing production accounts, preferences, activity sources, and Plus entitlement. The web build remains `npm run build`; the native frontend is a separate, explicit file allowlist in `scripts/build-native.mjs`. Neither build copies environment files or server credentials.

## macOS development

Install Apple's Command Line Tools and a stable Rust toolchain, then:

```sh
npm ci
npm run mac:dev
npm run mac:build
```

The npm commands also find Rust in its standard `~/.cargo/bin` location without changing your shell profile. The application bundle is generated at `src-tauri/target/release/bundle/macos/Tomodo.app`. `npm run mac:build -- --bundles app` builds only the app; the default also makes a DMG.

The current build is a local development release, ad hoc signed with identity `-`. Override `bundle.macOS.signingIdentity` with your Developer ID identity for public releases. Public distribution still requires an Apple Developer identity, signing, notarization, and an update delivery plan. An Intel build runs on Intel Macs and through Rosetta on Apple silicon; make and test an ARM or universal build before distributing to Apple silicon users.

## Accounts and networking

- The installed frontend calls `https://tomodo.app/api/*` through Tauri's native HTTP bridge. Supabase authentication uses the same bridge. API writes retain the canonical Origin header expected by the existing backend and all protected requests still require a verified bearer token. Browser origin checks and database authorization are unchanged.
- Native network capabilities allow only Tomodo API routes and Supabase auth routes. Narrow the Supabase hostname in `src-tauri/capabilities/main.json` if you change projects.
- Session tokens and PKCE verifiers are stored in Apple Keychain through three fixed-service commands. Activity and preferences remain in the app's local webview storage, separate from browser storage.
- Email/password login uses existing accounts. For email confirmation, magic links, and password recovery, add the exact redirect `tomodo://auth/callback` to **Supabase → Authentication → URL Configuration → Redirect URLs**. Keep existing web redirects. This dashboard configuration is required before native email callbacks can work.
- Native email flows use PKCE: request and finish the link on the same Mac. The bundled app registers the `tomodo` URL scheme; install/open the bundle to register it before testing callbacks. Development mode alone does not register macOS schemes.
- Checkout and subscription management open validated Stripe URLs in the default browser. Return pages remain on the website; returning focus to the app refreshes entitlement. App Store purchases have not been implemented.

## Timer and sync behavior

Countdowns use an absolute wall-clock deadline so Mac sleep does not freeze them. On wake or focus, the app reconciles remaining time and completes at most the current interval. Work/rest credit stops at that interval's deadline; the next interval waits for Start. Changing the system clock during a session can affect the countdown.

A running app sends a native completion notification if permission is granted. No alert can wake a sleeping Mac, and closing/quitting the app does not schedule an operating-system alarm or preserve a running timer. These are separate follow-up features. Existing local statistics remain saved.

Activity sync reuses per-device, revisioned snapshots, offline pending rows, and cloud totals that exclude the current source. Daily goals are free, including account sync. History and default theme selection retain the existing Plus requirements. A running timer does not hand off between devices. The free timer works offline; account access and Plus verification require the backend.

## Verification

```sh
npm test
npm run build
npm run build:native
npm run mac:build -- --bundles app
```

Before a public release, exercise these in the installed app:

1. Sign into the same account as the website and compare today's totals, history, and preferences. Record work on each device and verify neither upload duplicates the other's activity.
2. Restart the app and verify Keychain restores login. Sign out and verify another account never sees the first account's local activity.
3. Disconnect/reconnect networking and verify pending activity uploads once.
4. Test confirmation, magic link, and recovery after configuring Supabase's native redirect.
5. Enable notifications, complete a short interval, and test sleep/wake and midnight boundaries.
6. Test checkout/portal return and refresh without purchasing unless you intend a real charge.

## iPhone/iPad next

Tauri's shared Rust library and frontend build are laid out for an iOS target. Full Xcode, iOS SDK/simulator, an Apple development team, and device signing are needed before `npm run ios:init` and `npm run ios:dev`. This repository does not yet contain a verified iOS project.

Before TestFlight: configure mobile deep links, review mobile layout and safe areas, add native scheduled notifications for suspension, verify Keychain on-device, and choose the App Store purchase/entitlement integration. Android and Windows need platform-specific secure session storage before being enabled; the initial Rust backend targets Apple platforms.
