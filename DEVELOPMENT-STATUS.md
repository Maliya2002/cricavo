# Cricavo development status

Updated: 1 November 2026 (Asia/Colombo).

## Delivered locally

Milestone 0.2 adds Supabase auth adapters and account UI, an organization migration and tests. The project is not provisioned: the user clarified they need a new Supabase project. The integration is installed but project/organization calls return Unknown tool. No cloud migration, provider enablement, email or SMS delivery has taken place. See `docs/supabase-setup.md`.

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
