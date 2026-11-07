# Backend feature 1 — accounts and private projects

Originally implemented on `phases`; integrated with the current main workspace and
pinned engines after the pre-merge fixes described below. This is the first product
increment after Phase 7.
It adds email/password accounts and durable project save/open using Supabase
Auth and PostgreSQL. Local development remains available; the development checkout
was connected to the hosted Forma project on 2026-11-07.

## Use it

Forma runs at `http://127.0.0.1:4173/`. Ignored `.env.local` selects its backend.
When using the separate local stack, its API is on `55321`, PostgreSQL on `55322`,
and local test mail on `55324`. Existing Supabase projects on the default ports
are unaffected. Local accounts and projects are separate from hosted data.

1. Open **Projects & account**, then create an account or sign in.
2. Work in the existing experiment, cost, measurement and report views.
3. Enter a project name and choose **Save project**. Wait for the saved confirmation.
4. Reload, open Projects & account and choose **Open** beside the saved project.
5. Use **Save a copy** to preserve another named workspace; use **New workspace**
   for a blank start. Unsaved changes require an explicit discard before switching.

Saving includes trial history and current retest, raw quote drafts (even unfinished
inputs), measurement drafts and observations, the captured decision sheet and the
captured assembly pattern. View-only preferences such as force colors are not
persisted. Creating the first project is explicit. After that, edits autosave after
1.5 seconds without another edit. Save project still saves immediately. Reload starts a blank workspace;
accounts remain signed in, and the project list lets you reopen saved work.

The status reads **Unsaved changes**, **Saving…**, **Saved**, or **Save failed —
autosave paused**. Only one save is sent at a time; edits made during a save wait
for its acknowledged version, then save next. Failures and version conflicts pause
automatic saves until an explicit retry succeeds, another project is opened, or a
copy is saved. Editing after a failure never starts a retry loop. Pending timers
are cancelled when switching accounts/workspaces or considering a discard prompt.
The tab-close warning remains active while changes are unsaved or a save is in flight;
there is no promise of saving during tab shutdown. Wait for **Saved** before closing.

Local signup does not require email confirmation. Forgot password sends to the
local test mail server at `http://127.0.0.1:55324/`; no external email is sent by this
local setup. The recovery view accepts a valid recovery session and sets a new
password. Hosted confirmation and mail delivery still need a real-inbox acceptance
check; hosted redirect settings are recorded below.

## Reproduce the local setup

Requirements: the repository's supported Node version, Docker running, Supabase
CLI installed. Tested here with CLI 2.119.0 and Node 20.20.2.

```sh
npm ci
supabase start
npm run backend:configure
npm run dev
```

For a production preview, run `npm run build` then `npm start` instead of `dev`.
The configure helper reads CLI status and writes only the browser-safe URL and
publishable/anon key into ignored `.env.local`. It preserves unrelated settings.
Restart Vite or rebuild after changing these variables. `.env.example` documents
both keys. Never put an admin/service-role key in a `VITE_` variable.

Apply later local migrations with `supabase migration up --local`. Ordinary
`supabase stop` preserves local database data; do not reset the database or remove
its volumes if you need those records. Local volumes are not a backup strategy.

Without Supabase settings the original session-only application still runs.
`npm run release:prepare` explicitly clears backend settings for its build, so the
portable presentation archive remains offline/session-only and never depends on
this Mac's local database. Run `npm run build` again afterward to restore the
configured development preview. No new portable candidate was certified by this
feature; previous Phase 6 manual acceptance gates remain open.

## Data and access boundaries

`public.projects` stores owner, name, version counter, timestamps and one versioned
JSON workspace. A single document makes saving the current cross-module workspace
atomic without prematurely designing an engineering revision/history service.
The numeric counter detects conflicts; it is **not retained revision history**.

- Authenticated users can select only their own rows through row-level security.
- Browser roles have no direct insert, update or delete grants.
- `save_project` is the only client write path. It derives the owner from `auth.uid()`;
  ownership, version counters and timestamps cannot be supplied by the caller.
- A transaction-scoped lock serializes creation and updates for each project ID.
  Updates require the version that was opened. A stale save fails rather than
  overwriting newer work. Save a copy or explicitly reopen the latest version.
- A stable write UUID makes an identical retry safe while that write is the latest
  saved version. Reusing that UUID with different content is rejected. After an
  intervening save, an older retry is rejected as a conflict rather than replayed.
- Sign-out/account changes clear private UI state. Responses belonging to an older
  account cannot replace the current workspace. Sign-out is scoped to this browser.
- The browser validates bounded runtime schemas and cross-record consistency on
  save and load. The database separately enforces ownership, name, document size
  and schema-envelope constraints. It does not validate every nested calculation.

Limits: 120-character names; 2 MB database JSON document limit (client uses a
slightly smaller byte allowance); 100 saved trials and 200 observations per
workspace; latest 100 projects shown. No search/pagination, project deletion,
team sharing, attachment storage or account deletion interface is included.
Unsupported workspace/preset/solver versions fail clearly without replacing the
current work. Schema migration support beyond version 1 remains future work.

**Trust boundary:** saved calculations are client-originated snapshots. Their
shape and associations are checked, but this feature does not certify the numbers
as server-computed. Authoritative calculation endpoints and immutable revisions
are the next feature. No change was made to solver or financial formulas.

## Verification

```sh
npm run check
npm run test:projects:local
```

The regular suite covers runtime data validation, complete workspace restoration,
unfinished drafts, stable JSON comparisons, error/retry behavior, discard prompts,
account-switch races, sign-out clearing, account forms and invalid backend settings.
Autosave tests additionally cover debouncing, explicit first creation, edits during
in-flight saves, acknowledged version sequencing, paused failures/conflicts, retry
token reuse and pending-timer cancellation.
The separate integration test uses the real local Supabase API/database. It:

- creates two disposable accounts and deletes them and their rows afterward;
- round-trips a real solver trial, cost inputs, raw observation, report and pattern;
- reopens from a fresh signed-in client;
- verifies anonymous/cross-account read/write denial and blocked direct mutations;
- checks idempotent retries and simultaneous writes where exactly one version wins;
- rejects invalid envelopes, oversized documents and blank names;
- verifies a recovery token/password update on a disposable account and signed-out denial.

The test refuses any API URL other than Forma's local `127.0.0.1:55321`. Admin
credentials are obtained in memory only for disposable-account cleanup and recovery
fixture setup, never shipped to the browser or written to `.env.local`.

Browser verification covers local signup, saving B1/P2, full reload, session
restoration and reopening the original trial. Native PDF/printer checks remain
with the user as previously agreed. Hosted email delivery and production operations
are not claimed by these local checks.

## Hosted connection — 2026-11-07

The checkout is linked to Forma (`torqdbhhamtbiejevjkg`). The URL and publishable
key are in ignored `.env.local`; CLI credentials and link metadata are not committed.
Both committed migrations were applied after confirming the hosted application
schema was empty. The frontend was rebuilt with the hosted configuration.

Hosted auth uses Site URL `http://127.0.0.1:4173`, exact allowed redirects
`http://127.0.0.1:4173` and `http://127.0.0.1:5173`, and a ten-character minimum
password. Email confirmation remains enabled. These URLs support the local app;
replace/add the actual HTTPS frontend URL when deploying the frontend.

The already-running hosted acceptance script completed successfully: full workspace
round-trip, fresh-session reopen, anonymous/cross-account denial, blocked direct
mutations, concurrent-write conflict protection, database constraints, recovery-token
password update, and signed-out denial. Its two disposable accounts and project rows
were removed. Accounts were admin-confirmed test fixtures; this did not verify email
delivery or the browser confirmation flow. No further tests were run after the user
requested a push; remaining browser and real-inbox acceptance is deferred.

For another checkout, set the two variables documented in `.env.example` to the
hosted URL/publishable key, then rebuild or restart Vite. Do not run
`npm run backend:configure` unless switching back to the local stack. Do not push
`supabase/config.toml` to hosted Auth: it intentionally disables email confirmation
for local tests. Future schema updates should be reviewed with `supabase db push
--linked --dry-run --skip-vault` before applying.

Before inviting users, configure and verify transactional email. Supabase's default
sender is restricted to project-team addresses; see its
[SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).
Hosted frontend deployment, real-inbox signup/recovery, and production operations
(backups, recovery, rate limits and hosting CSP) remain pending.

The implementation uses the official [Supabase local workflow](https://supabase.com/docs/guides/local-development)
and [Auth client](https://supabase.com/docs/reference/javascript/auth-signinwithpassword).


## Main integration and recovery fixes — 2026-11-07

The integrated workspace retains the current single Assembly / Structural viewport,
read-only history inspection, exact draft/retest return and pinned main engines.
The account/save summary remains compact on laptop screens.

- Retry save reconciles the exact pending request: project ID, write token, captured
  content and create/copy intent. A failed copy cannot silently become an update to
  its source. Edits made after that failure remain dirty; after acknowledgement,
  they autosave to the recovered destination using its returned version.
- Opening a project checks whether the workspace changed while loading. If it did,
  the open is cancelled with an explicit message and the edits remain. Opening again
  follows the normal discard confirmation.
- Saved `inspectedTrialId` is validated independently from the active draft/retest.
  Older documents lacking the field default to no history inspection.
- Existing `forma-truss-2d-v1` projects reopen without relabeling or recalculating
  their trials, retests, captured reports or templates. Their saved model scenarios
  are read-only. Start another prediction to use `astra-truss-main-9a9c2d8`; the old
  trial remains in history. New-solver retests of an old-solver trial are blocked at
  both the controller and UI. A workspace may contain trials from both supported
  versions, but each trial/retest/report must retain consistent solver provenance.

An authentic legacy test fixture was generated with the original `bd3cc5a` modules
and is committed at `src/test/legacy-workspace.json`. Regression tests cover its
unchanged restoration, mixed-version rejection, new-round continuation and frozen
report retention, as well as the two reproduced data-loss races.

The main integration changes no SQL migrations, hosted authentication settings or
remote data. Live hosted verification was unavailable in the integration session:
the connector denied project access, and a local Docker/Supabase stack was absent.
Unit and configured production-browser verification do not certify deployed RLS or
real-inbox email delivery; the separately documented live acceptance remains relevant.
