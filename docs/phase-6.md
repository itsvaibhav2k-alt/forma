# Phase 6 — Release preparation and evidence

Status: **candidate tooling and development checks complete; final release gates
pending**. The user confirmed that presentation will use a different laptop and
assigned native PDF inspection to themselves. No release tag, submission or merge
has been performed, and no timed rehearsal is claimed.

## 6.1 — Integrated checks

**Prerequisites: 2.3, 3.3, 4.3 and 5.3.** Automated suites cover the numerical
fixtures, invalid inputs, hidden/revealed states, immutable trials, financial
isolation, frozen selected-trial reporting and report overflow behavior. The native
PDF gate from 5.3 is still pending; preparing 6.1 tooling does not waive it.

`npm run check` now combines:

- 178 application tests across 17 files.
- Six sandbox-safe Node tests for local asset references, missing/remote assets,
  checksums, symlinks, in-memory HTTP responses/MIME/CSP and invalid startup inputs.
- Strict TypeScript checks and the production build.

The separate `npm run test:release:network` checks actual loopback HTTP and
occupied-port behavior. A first attempt to run socket tests failed with sandbox
`EPERM`; escalation was declined. That test is **not passed or silently skipped**
by the ordinary check command. It remains an explicit target-machine check.

Development-host benchmark (Node v20.20.2, macOS arm64; 300 warmups, 3,000 samples):
median **0.421 ms**, p95 **0.688 ms**, p99 **0.784 ms** for baseline plus four
independent candidate solves, validation and immutable ranking. This meets the
proposed 8 ms solver target **on this development host only**. Each packaging run
records its own fresh measurements in `candidate.json`. The <50 ms browser
input-to-painted-result target and both timing targets on the presentation laptop
remain unmeasured; automation tool round trips are not used as latency evidence.

The production preview was rehearsed using only keyboard input after a reload:

1. Tab to the skip link, Enter, then reach the load slider and native radio groups.
2. Select P2 with the right arrow and commit with Enter at B1: 1.09%.
3. Return to the load group with Shift+Tab and move right to B2: P2 + P3 tie at 10.46%.
4. Tab to Show saved result and Enter: restore B1/P2/1.09%.
5. Navigate to Compare build options, load the fictional example with Space, then
   tab to the horizon and change 10 to 5. Required savings updates to $436.71/year.
6. Tab through both package editors and source controls to Decision sheet, then
   Enter. The primary report retains B1/P2/1.09% with the five-year cost scenario.
7. The next Tab reaches Print / Save PDF. Native printing was left to the user.

Reload cleared session trials and the prior captured sheet. This verifies the
development browser's essential keyboard path, not a full accessibility audit,
outside-user test or disconnected target-machine rehearsal.

## 6.2 — Portable production candidate

**Prerequisite: accepted 6.1.** `npm run release:prepare` runs the full automated
check/build, benchmarks the solver, audits asset references, then copies `dist`
into a uniquely named candidate with:

- A dependency-free Node launcher (`serve.mjs`) and integrity checker (`verify.mjs`).
- `candidate.json`: commit, branch, dirty-source flag, source fingerprint, generated
  time, check scope, benchmark, build asset audit and hashes of every payload file.
- Launch instructions, the presentation-laptop checklist and demo/submission notes.
- A self-contained native PDF checklist for the person performing the manual check.
- A `.tar.gz` archive and its adjacent SHA-256 checksum. Earlier candidates remain
  intact; `output/releases/latest.json` points to the newest one.

The launcher binds **127.0.0.1 only**. It has an explicit port (4173 by default),
fails on conflicts, serves correct MIME types, does not turn missing JS files into
HTML, blocks paths outside `dist`, and sends no-store plus same-origin CSP headers.
The app needs no package install on the target once a compatible Node runtime is
available. Internet access is still needed beforehand to obtain that runtime.

The asset audit resolves HTML/CSS references against local files and rejects
remote/missing references. The CSP restricts scripts, fonts and connections to
the local origin. JavaScript is not formally proven network-free by this static
audit. The existing app preview is served by Vite; the new launcher's actual
startup and browser flow under its CSP still need target-machine verification.

`npm run release:verify -- /path/to/extracted/folder` checks file presence, sizes
and hashes, then re-audits assets. Without a path it uses `latest.json`. In the
copied bundle, use `node verify.mjs`. These checks detect changes but are not a
cryptographic signature. Keep downloaded reports and saved PDFs outside the
candidate folder, otherwise extra files intentionally fail integrity verification.
Common Finder/Explorer metadata files are ignored; application and handoff files
are checked. Fill in a separate copy of the checklist, not the hashed original.

Generated candidates are ignored by Git. If source changes are uncommitted, the
manifest says so; the candidate is reproducible only with that source state, not
the HEAD commit alone. A final release requires a clean committed tree and a fresh
package, followed by acceptance of that exact artifact.

## 6.3 — Freeze and rehearse

**Prerequisite: accepted 6.2.** [The checklist](release-checklist.md) records candidate
identity, actual laptop/browser/runtime, a fresh tester, native PDF output,
physical network disconnection, latency, two timed rehearsals and final artifact
identity. [The demo script](demo-script.md) supplies a 90-second sequence, recovery
cues and a submission/disclosure draft with missing human details labeled pending.

The source plan's November 7 clock times are historical targets, not evidence of
completion or a verified current submission window. The team must verify the
event's live requirements before submitting. No external submission action is part
of this implementation.

### Remaining manual gates

1. Outside-tester usability check and actual-laptop solver/render timing.
2. Actual portable-server startup, port-conflict behavior and app flow under CSP.
3. Internet-disconnected cold start, keyboard flow, one-page PDF and sample inspection.
4. Final clean commit/candidate identity and two successful 90-second rehearsals.
5. Team details, complete reused-code disclosure and event submission requirements.

No feature expansion is needed to run these checks. Resolve any correctness or
demo-blocking issue, then rebuild and repeat affected checks. Physical measurements
and assembly templates remain optional later work.
