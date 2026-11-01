# Cricavo development status

Updated: 1 November 2026 (Asia/Colombo).

## Delivered locally

Milestone 0.2 includes auth adapters, account UI, organization schema and tests. On 1 November 2026, created the separate Cricavo Free organization (alodrwfgvaadivfufzms). The user created project iltvriolefvvfhinxagf in Mumbai. Project reports Healthy. Public URL/publishable key are configured in dist/config.json. Applied 202611010001_organizations.sql once via dashboard SQL editor after verifying no Cricavo tables existed; verified both tables have RLS enabled. Remote auth settings respond successfully: email enabled server-side; Google and phone disabled. All app provider flags remain disabled: Free-plan email template editing requires custom SMTP, and the user has no sender domain or SMTP service. No verification messages sent. See docs/supabase-setup.md.

Current validation: 24 tests pass (15 scoring, 8 auth and one PostgreSQL policy suite). Browser bundle build and syntax checks pass. Browser QA and live-provider tests for 0.2 remain pending.

Device-scoring milestone 0.1, not the completed enterprise Release 1. See README for implemented features and limits. The approved product requirements are in `docs/requirements.md`.

Validation: 15 scoring-engine tests and JavaScript syntax checks passed. Browser QA verified quick setup, boundary/wide scoring, persistence after reload, second-innings transition and a successful chase result. Real-device iOS/Android and full offline lifecycle testing remain outstanding. Mobile control ordering was adjusted after that browser session and needs visual reinspection.

## Source control

Local Git repository exists. GitHub upload is authorized by the user; default to a private repository named `cricavo` under the verified user's account. Source is now pushed to the private repository https://github.com/Maliya2002/cricavo on main; origin tracks that repository. Never claim that the private Sites source repository is the user's GitHub repository.

GitHub connector access recovered and verified Maliya2002. Repository creation used the existing Git Credential Manager sign-in without exposing or persisting credentials. The connector lacks repository creation. GitHub CLI remains absent. Do not ask for tokens in chat or put credentials in source files.

## Hosting

Retain the existing project ID in `.openai/hosting.json`. Registration previously succeeded, but publication did not. On resuming, the current Sites connection returned project_not_found for that same ID. Resolve the account/workspace connection before retrying; do not create a duplicate project or invent a deployment URL.

## Next work

1. GitHub repository creation and initial push completed; continue checking CI on subsequent changes.
2. Reconcile Sites access, complete preview packaging and publication, then inspect the final responsive build.
3. Implement remaining Release 1 capabilities in the approved requirements: server accounts/organizations, authenticated offline sync, public score sharing, tournaments, player identities and advanced match workflows.

Production Google/email/phone login requires provider selection/configuration. SMS costs, hosting budget and expected initial audience remain undecided. Device storage is not a substitute for server persistence or permissions.


Google OAuth update: User configured the Google web client and Supabase provider. Public auth settings verified google=true on 1 November 2026. Enabled Google in client config. Email/phone remain disabled in the app. Redirect allowlist and end-to-end login still require verification; do not treat provider enablement as a successful login test.

Cloud backups implementation (pending remote deployment): Added immutable account-private snapshots, manual upload and restore-as-new from Account. Migration 202611010002_match_backups.sql is NOT applied remotely. Browser use remains disabled. Apply migration before testing UI. Latest 50 snapshots listed; no automatic sync, active-scorer coordination, cloud deletion or storage quota management yet. User reported Google login success; organization creation outcome not confirmed.

Remote backup deployment update: User reported SQL execution completed. REST probe now resolves cricavo_match_backups and denies anonymous SELECT with HTTP 401 / PostgreSQL 42501 as intended. Do not grant anon access. Authenticated upload/restore and cross-device browser QA remain pending. Local server verified available.

Automatic backup milestone: User reported manual upload/restore works. Added per-match/account opt-in in Cloud match backups. Every 15 seconds while open and authenticated, changed local matches create immutable cloud snapshots; offline changes remain in IndexedDB and retry online. Content-derived IDs deduplicate retries, owner_id is explicit to prevent cross-account uploads, and acknowledged IDs persist locally. No remote schema change needed. This is automatic backup, not bidirectional scoring sync, background sync after closing, merging, or scorer handover. If opened offline before auth initialization, reopen online to initialize cloud. Browser QA pending. Snapshots consume storage; retention/quota management still pending.

Reconnect reliability update: Failed offline cloud initialization now retries on online events/every 15 seconds without reloading scoring. Concurrent connection attempts share one client. Backup failures are isolated per match, and the status reports pending when any selected upload failed. Added reconnect and refresh-backups controls. This supersedes the earlier requirement to reopen online after offline startup. Syntax checks and 30 automated tests pass; browser/device validation remains pending.

League tournament milestone: Added device-local tournament creation (2-16 teams), single round-robin fixtures with byes, fixture-linked match setup, and derived W/L/tie/points standings (2/0/1). Teams lock at creation; each fixture has a stable match ID, so duplicate setup cannot overwrite the existing match. Points recompute from completed matches and reflect undo. Separate IndexedDB database leaves match storage version unchanged. No NRR, knockout, group stages, scheduling, tournament export/cloud backup or editing yet; match backups do not restore the tournament schedule. Syntax checks and 33 tests pass. Browser UI verification blocked by Local browser use disabled.

Knockout milestone: Tournament form now supports league or knockout for 2-16 teams. Entry-order byes fill the next power-of-two bracket; completed winners resolve later rounds and champion. Ties block advancement (tie-break decisions/super overs remain unsupported). If an upstream result changes, downstream stored matches are preserved and marked conflicted; scoring is blocked until prerequisite results are restored. No cloud tournament sharing. Syntax checks and 35 tests pass, including all supported bracket sizes and undone/tied results. Browser QA remains pending.

Knockout advancement decisions: Completed tied matches accept a locally recorded advancing team, required reason and self-reported recorder name. Score remains tied. Append-only decision history supports revocation; decisions bind to exact match revision/settings/events and expire after score corrections. Tournament writes use optimistic revision checks across tabs. Downstream conflict handling remains active when a decision changes. No authenticated organizer role enforcement or super-over scoring; local feature only. Browser QA pending.

League NRR milestone: Standings now aggregate completed-match runs and decimal overs, using full match quota for all-out innings and actual balls otherwise. Custom balls-per-over settings are respected per match. Table order is the explicit Cricavo rule: points, then unrounded NRR, then alphabetical display for exact ties; this is not a claim to implement every ICC competition tie-break hierarchy. Zero denominator returns unavailable rather than infinity. DLS/revised targets and no-result scoring remain unsupported. Syntax checks and 39 tests pass; browser QA pending. Reference for base NRR/full-quota calculation: https://www.icc-cricket.com/news/mens-odi-match-clause-16-the-result .
