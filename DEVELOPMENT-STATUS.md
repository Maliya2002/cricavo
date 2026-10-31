# Cricavo development status

Updated: 1 November 2026 (Asia/Colombo).

## Delivered locally

Device-scoring milestone 0.1, not the completed enterprise Release 1. See README for implemented features and limits. The approved product requirements are in `docs/requirements.md`.

Validation: 15 scoring-engine tests and JavaScript syntax checks passed. Browser QA verified quick setup, boundary/wide scoring, persistence after reload, second-innings transition and a successful chase result. Real-device iOS/Android and full offline lifecycle testing remain outstanding. Mobile control ordering was adjusted after that browser session and needs visual reinspection.

## Source control

Local Git repository exists. GitHub upload is authorized by the user; default to a private repository named `cricavo` under the verified user's account. No GitHub remote or successful push has been established yet. Never claim that the private Sites source repository is the user's GitHub repository.

GitHub plugin reports installed, but account/repository calls returned Unknown tool in the current session. GitHub CLI is absent. Browser fallback reports local browser use disabled in Work settings. Resolve one authenticated GitHub access path before creating or pushing the repository. Do not ask for tokens in chat or put credentials in source files.

## Hosting

Retain the existing project ID in `.openai/hosting.json`. Registration previously succeeded, but publication did not. On resuming, the current Sites connection returned project_not_found for that same ID. Resolve the account/workspace connection before retrying; do not create a duplicate project or invent a deployment URL.

## Next work

1. Restore GitHub access, verify account, check for an existing Cricavo repository, create a private repository if absent, upload and verify the remote commit.
2. Reconcile Sites access, complete preview packaging and publication, then inspect the final responsive build.
3. Implement remaining Release 1 capabilities in the approved requirements: server accounts/organizations, authenticated offline sync, public score sharing, tournaments, player identities and advanced match workflows.

Production Google/email/phone login requires provider selection/configuration. SMS costs, hosting budget and expected initial audience remain undecided. Device storage is not a substitute for server persistence or permissions.
