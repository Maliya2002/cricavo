# Cricavo — Product requirements and screen flows

Draft 2 · 31 October 2026 · Release sequence, login options and visual direction confirmed; implementation not started.

Tagline: Every ball counts.

## Product direction — agreed

Cricavo is a cricket scoring and tournament platform focused on softball, with hardball support. Organizers can self-register and manage their own tournaments. Start free; paid plans are a later feature. Public scores require no login. Management and scoring require login. Provide Sinhala and English, and a mobile-first installable web app for iOS and Android. Store distribution is not required initially.

The name is selected. Domain purchase and formal trademark clearance remain outstanding.

## Confirmed functional scope

### Organizations and access
- Release 1 includes Google, email and phone-number sign-in. Proposed mechanics: verified email sign-in and SMS OTP for phone numbers; provider and email mechanism remain implementation decisions.
- Link additional login methods only after proof of account ownership; never automatically merge accounts by an unverified email or phone number. Phone verification does not by itself verify ownership of a player profile.
- Separate organizer workspaces with their own teams, tournaments, matches and authorized staff.
- Roles: platform administrator, organization owner/admin, tournament organizer, primary scorer, assisting scorer, player and public viewer. Detailed permission boundaries are proposed below.
- One primary scorer writes match events. An assistant reviews and can take over scoring.
- Player accounts can claim a permanent player profile through verification. Never merge players based on name alone.

### Match setup
- Standalone friendly matches and tournament matches.
- League, knockout and groups followed by knockout.
- Softball and hardball, limited-overs and multiple-innings formats are all in the agreed overall scope.
- Configure team size, overs and balls per over before play.
- Full setup: squad, playing players, captain and wicketkeeper as applicable.
- Quick setup: team names, player count, rules, striker, non-striker and bowler; add further participants as play progresses without requiring a squad.
- Quick-added players may later be linked to verified permanent profiles with an audit trail and duplicate checks.
- Toss, batting order, venue and match schedule.

### Rules and scoring
- Rule presets with explicit per-match overrides for wide/no-ball penalties, whether deliveries count, free hits and bowler limits.
- Save the selected rules as a match-specific snapshot; later template edits must not alter existing matches.
- Ball-by-ball runs, wickets, extras, strike, overs, partnerships, batting and bowling figures, innings and result.
- Configurable tie outcome: shared result, super over or a predefined tournament tie-break. Persist the selected rule before play.
- Ordinary match settings lock when play begins. Authorized interruption revisions record old and new overs/targets, reason, actor and timestamp.
- Manual revised target entry and automatic rain-target calculation are separate capabilities. An automatic calculation method is not yet selected or authorized as a particular standard.
- Undo the last event and correct earlier deliveries. Replay dependent match state and identify downstream entries requiring review. Never silently publish inconsistent innings or results.
- Preserve the original event and correction history.

### Offline and live viewing
- Scoring must work offline after the match has been prepared and saved on the device. First-ever login and downloading a match require connectivity in the proposed initial design.
- Persist each accepted event on the device before showing it as saved; survive refresh or app closure.
- Sync pending events when the app can connect. Do not rely solely on background activity when the mobile OS suspends the app.
- Public pages show the last update time and stale/offline status rather than implying a disconnected score is live.
- Public match links, scorecards, tournament pages, standings and player statistics.
- TV/projector display and transparent livestream browser-source overlay; video streaming itself is not included.

### Player history
- Stable player IDs across teams and tournaments; separate softball and hardball statistics.
- Further split statistics by match format and configurable rules where combining them would mislead.
- Only finalized, eligible match records contribute to career totals. Corrections recompute affected totals.
- Profile ownership does not permit editing official match statistics.

## Confirmed release sequence

The user approved this sequence. All agreed features stay in scope. This is not a delivery-date promise.

### Release 1 — reliable scoring pilot
- Self-registration, organization separation and core roles.
- Google, email and phone-number sign-in.
- Sinhala/English mobile-first PWA.
- Light and dark themes with a sporty visual direction and large, high-contrast scoring controls.
- Softball/hardball limited-overs matches, full and quick setup, custom rules.
- One active scorer with assistant review and controlled handover.
- Offline scoring, durable local saving, reconnect sync and recovery.
- Corrections with history, interruption records and manual revised targets.
- Shared tie results and configurable super-over flow.
- Public live score and scorecards.
- Player IDs, basic career stats and reviewed profile claims.
- Basic league, knockout and groups-to-knockout management, fixtures and standings.

### Release 2 — complete match and broadcast workflows
- Multiple-innings matches: declarations, follow-on, innings victories, draws and time/session management; define detailed rules before implementation.
- TV/projector view and livestream overlay.
- Advanced tournament tie-breaks, scheduling and statistics.
- Stronger player-identity resolution, dispute handling and audited profile merges.
- Automatic rain-target calculations only after choosing and validating the method and any usage requirements.

### Release 3 — commercial and scale expansion
- Optional paid plans and entitlements; retain a defined free offering.
- Advanced organization administration, exports, operational monitoring and capacity expansion.
- Additional integrations and store apps only if later requested.
- Tenant isolation, backups, audit history and core security belong in Release 1, not postponed to this phase.

## Screen map and user flows

### Confirmed visual direction
Use a sporty, uncluttered interface with light and dark themes. Prioritize score readability and large scoring controls on phones. Support a system theme default and a user override. Do not communicate wicket, error or sync status through color alone.

### Sign-in flow
Continue with Google / Continue with email / Continue with phone → provider sign-in or verification → new-user profile or existing dashboard.

Phone flow: country code and number → SMS code → verify → account. Include resend cooldown, expiry, retry limits and a way to correct the number. Preserve pending local scoring data when reauthentication is required. SMS delivery costs and provider setup remain deployment decisions even while the product is free to users.

### Public experience
Home / match discovery → live match → scorecard / innings / ball history.

Tournament page → fixtures / standings / teams / leaders → match or player profile.

No login wall for viewing. A share link lands directly on the requested match.

### Organizer experience
Register / sign in → create organization → dashboard → create tournament → rules and format → teams → fixtures → assign scorers → match readiness.

Standalone shortcut: dashboard → new match → quick/full setup → rules → toss → opening players → score.

Proposed mobile navigation: Home, Matches, Tournaments, Profile. Show a prominent Resume scoring action for authorized users with an active match.

### Scorer workspace
Top: teams, total, wickets, overs, innings, target and sync state.

Middle: striker/non-striker, batting figures, bowler figures and recent balls.

Primary controls: 0, 1, 2, 3, 4, 6; More runs; Extras; Wicket; Undo.

Guided panels: extra details → completed runs/strike details; wicket → dismissal type/player/fielder/replacement; over complete → next bowler; innings complete → review/start next innings.

Secondary actions: correct history, interruption, player changes, share and handover. Destructive or result-changing edits show their consequences before applying.

Never infer every strike change from the total run parity: extras, physical runs, dismissals and the selected rules can differ.

### Assistant and handover
Open assigned match → read-only review → request takeover → current scorer releases ownership → server grants new scoring session.

Proposed rule: ordinary handover requires connectivity. Offline scoring continues on the current owning device. Emergency takeover requires explicit organizer action and conflict review if the previous device returns with unsynced events.

### Player claim
Sign in → find profile → request claim → verify/review → link account. Do not expose other players' private contact information in search.

### End of match
Provisional result → scorer review → finalize → update public result, standings and career stats. Reopening requires permission and a reason; re-evaluate any dependent knockout fixture before advancing teams again.

## Permission proposal

- Public: read published match/tournament/player data only.
- Player: edit permitted personal profile fields; request claims or corrections.
- Assistant scorer: review assigned match and request handover; no concurrent official writes.
- Primary scorer: score and correct assigned match within policy.
- Organizer: configure tournaments, assign staff, approve revisions/finalization and resolve match disputes.
- Organization owner: manage organization membership and access.
- Platform administrator: support/moderation with explicitly logged elevated access; not an unrestricted unlogged scoring role.

## Reliability and acceptance criteria

1. Organization A cannot read or mutate private organization B data through either UI or API.
2. Quick setup can reach the first ball without uploading a squad; configured team size still governs innings completion.
3. Saved offline deliveries survive closing/reopening the app and synchronize exactly once despite retries.
4. A disconnected public scoreboard displays its last confirmed update time.
5. Two devices cannot silently create competing official scoring histories. Rejected or conflicting events remain recoverable for review.
6. Correcting an earlier delivery recalculates scorecards and flags any invalid subsequent player/innings state.
7. Custom balls-per-over use legal deliveries for over notation and calculations. Define the NRR/innings quota policy for mixed-rule tournaments before enabling them.
8. A completed match produces consistent team totals, batter totals, extras, bowler figures and outcome for the selected rules.
9. Claimed profiles do not duplicate historical statistics; merges are reviewed and auditable.
10. Core scoring works on agreed real iOS Safari and Android Chrome versions, including offline/reconnect, storage failure and installation checks.
11. Visible keyboard focus, readable contrast, accessible labels and large touch targets are required.
12. Backups have a tested restore procedure. Collect sync errors and server failures without logging unnecessary personal data.

Performance/capacity targets must be measured against a chosen initial audience. Provisional pilot target for discussion: 20 concurrent matches, 1,000 connected viewers total and connected score propagation within 3 seconds under normal test conditions. These are proposed acceptance targets, not measured capability or an SLA.

## Decisions still needed before implementation

### Immediate review
1. Release sequence approved: multiple-innings and broadcast features remain in Release 2.
2. Login options confirmed: Google, email and phone number in Release 1.
3. Visual direction confirmed: sporty look, large scoring buttons, light and dark themes.
4. Still open: expected first-launch scale; the pilot targets above remain provisional.

### Detailed design work
- Exact allowed team sizes and wicket limits, last-batter rules, substitutions, retired hurt/out, penalty runs and unusual dismissals.
- Super-over player eligibility, tie repetition limits and tournament progression rules.
- Points, NRR, walkovers, forfeits, abandoned matches and tie-break order.
- Claim-verification evidence, minors' public-profile visibility, moderation and retention policies.
- Match finalization authority and emergency handover/conflict-resolution procedure.
- Preferred hosting budget, region and backup/recovery objectives.
- Technology selection and architecture follow scope review; no stack is yet committed.

## Development readiness gate

Review this draft → settle immediate decisions → specify scoring rule examples and state transitions → prepare screen wireframes → select architecture and delivery milestones → begin implementation.

The canvas renderer could not be associated with this workspace during drafting; this Markdown file is the durable review artifact.
