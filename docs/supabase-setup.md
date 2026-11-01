# Supabase account and organization setup

## Current state

Version 0.2 contains Google OAuth (PKCE), email OTP, phone OTP, device-local sign-out and organization creation/listing. Public client configuration now points to project iltvriolefvvfhinxagf (Mumbai). App login providers remain disabled until their delivery/configuration is complete. This is not a completed production login deployment. Local scoring remains independent of the account.

The Cricavo Free organization and project are now provisioned. The organization migration was applied once through the dashboard SQL editor, and both tables report RLS enabled. The public auth settings endpoint responded successfully. Email is enabled on the server, but the default template sends a magic link; this app expects an OTP. The dashboard requires custom SMTP or Pro to edit the template. The user requested SMTP setup but has no sender domain. No paid upgrade, SMTP service, Google OAuth setup, SMS delivery, or email verification has been completed.

## Provision and connect

1. In the user's verified Supabase account, choose the organization and a suitable region (Singapore or Mumbai are candidates for the Sri Lankan audience). Check the actual plan and project cost before creation.
2. Inspect existing tables before applying `supabase/migrations/202611010001_organizations.sql`. It creates namespaced tables, policies and an atomic organization bootstrap RPC. Do not apply the migration twice.
3. Obtain the HTTPS project URL and the `sb_publishable_...` API key. Set them in `dist/config.json`. These are public client configuration, not secrets. Never use `sb_secret_...`, service-role keys or database credentials in this file or the browser bundle.
4. Enable only the configured auth methods in `config.json`. The UI hides disabled methods; these flags are not security controls. Configure actual provider permissions in Supabase.
5. For email OTP, change the confirmation email template to include `{{ .Token }}` instead of requiring a magic-link click. Configure the desired OTP lifetime, resend/rate limits, and production email delivery. Use the user's chosen sender/SMTP service; do not invent credentials.
6. For Google, configure a Google OAuth client and the callback URL shown by Supabase. Store the OAuth secret in Supabase only. Enable Google in Supabase and then in `config.json`.
7. For phone, configure an SMS provider and delivery/rate-limit protections in Supabase before enabling phone in `config.json`. No SMS was sent during development. Server rate limits remain authoritative; the UI additionally enforces a one-minute resend cooldown.
8. Set Supabase Site URL and redirect allowlist for the actual deployed Cricavo origin. For development allow `http://127.0.0.1:4173/`. OAuth returns to the same app path with `#account`; the client uses the provider's PKCE handling rather than constructing tokens.
9. Run `npm ci`, `npm run build`, `npm run check`, `npm test`. The vendored client is built locally rather than loaded from a third-party CDN at sign-in time.

## Authorization model

- Organization bootstrap reads `auth.uid()` server-side and creates owner membership atomically. The browser cannot choose another owner.
- Authenticated users can select only organizations they belong to and their own membership records.
- Anonymous access and direct client writes to organization/membership tables are denied.
- The bootstrap function uses a fixed search path, qualified tables and a per-user transaction lock; it limits a user to 10 owned organizations in this initial build.
- Invitations, role changes, account linking and player-profile claims are not implemented. Being signed in is not proof of ownership of an existing player profile.
- Device match records are not sent to Supabase. Match synchronization, active-scorer ownership and public read models require their own server authorization layer.

## Verification

Automated tests exercise auth request wiring and failures with mocks, plus actual SQL migrations/RLS against an in-memory PostgreSQL engine (PGlite) with a minimal Supabase auth shim. They cover cross-tenant reads, direct writes, anonymous calls, empty identities and organization limits. These are not live-provider integration tests.

Before production, verify real Google redirects, email/SMS delivery and expiry, account changes, logout, refresh, RLS with two real users, offline/reconnect and iOS/Android behavior. Do not send verification messages until the user initiates sign-in. Browser control has recovered; full app login QA remains pending provider configuration.

## Sources

- [Supabase auth](https://supabase.com/docs/guides/auth)
- [OTP requests](https://supabase.com/docs/reference/javascript/auth-signinwithotp)
- [OTP verification](https://supabase.com/docs/reference/javascript/auth-verifyotp)
- [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

