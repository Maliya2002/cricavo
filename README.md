# Cricavo — scoring and account foundation 0.2

First implementation milestone following the approved wireframes. This is **not the completed enterprise Release 1**.

## Run

Requires Node 22+. Dependencies are locked in package-lock.json.

```sh
npm ci
npm run build
npm start
npm test
npm run check
```

Open http://127.0.0.1:4173. Static deploy directory: `dist`.

## Implemented

- Supabase-ready Google PKCE, email/phone OTP and account screens; disabled until project/provider configuration is supplied.
- Organization SQL migration with tenant isolation, atomic owner creation and executable access-policy tests. See `docs/supabase-setup.md` for deployment and verification steps.

- Responsive Sinhala/English dashboard, match setup, scoring desk, scorecard and match history.
- Light/dark themes; installable web manifest and service worker shell cache.
- Quick setup with softball/hardball, team size, custom overs and balls per over, wide/no-ball penalties, counted-extra rules and optional free hit.
- Two limited-overs innings, strike rotation, boundaries, extras, common dismissals, replacement players, next bowlers, chase and tie/run/wicket results.
- IndexedDB persistence before UI success; optimistic revision checks against conflicting writes from another tab.
- Undo with retained audit entries; downloadable JSON backups and validated restore as a new match.
- All figures reconstructed from delivery history by a pure engine, with automated rule tests.

## Important limits

- Data belongs to this browser. Clearing browser/site data loses matches; export backups. This is not cloud synchronization, multi-device ownership or public live sharing.
- Offline shell requires an initial successful online visit and browser cache support. Real iPhone/Android installation and suspension testing remains necessary.
- Google/email/phone authentication and organization access have implementation foundations but are not connected to a provisioned cloud project or verified with live providers yet. Tournament operations, stable player IDs/claims, public live links, full-squad selection and career statistics are not implemented yet.
- Not a full Laws-of-Cricket engine: no overthrows, retired batters, penalty awards, interruptions/revised targets, super overs, multi-innings formats, scorer handover or historical correction editor. Don't use this pilot for official scoring without validating the applicable playing conditions.
- Run-out entry explicitly records replacement end before the end-of-over swap. Unsupported delivery combinations are rejected.
- Rates use configured balls per over. No tournament NRR is calculated.
- Team/player names identify local match participants only; no cross-match identity merging.
- Google font is an optional online enhancement; system fallbacks work offline.

## Architecture

`dist/engine.js`: pure settings validation and event replay. `dist/storage.js`: IndexedDB transaction boundary and revision checks. `dist/app.js`: UI, routing, localization, backup flows. `dist/sw.js`: versioned app-shell caching. `tests/engine.test.mjs`: executable scoring examples.

Future server work should preserve immutable rule snapshots, authorize every mutation by organization and scorer ownership, deduplicate event IDs and reconcile offline batches. Device revision checks are not a substitute for server permissions.

## Next milestones

1. Add server persistence, organization membership and supported Google/email/phone providers; select provider/budget before SMS configuration. Private Sites preview access is separate from product login.
2. Add offline outbox, authenticated sync, match ownership/handover and public read models.
3. Implement remaining Release 1 tournament, identity, corrections, interruption and super-over workflows.
4. Validate with real match scenarios and real Android/iOS devices before production use.

Rules reference reviewed: [MCC Laws of Cricket](https://www.lords.org/mcc/about-the-laws-of-cricket). Custom playing conditions must be validated separately.
