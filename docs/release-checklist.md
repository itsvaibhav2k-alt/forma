# Forma — presentation-laptop release checklist

Status: **candidate; not approved for release**. The presentation laptop is a
different machine from the development Mac. Record evidence on that actual laptop.
The native PDF check remains assigned to the user; do not infer it from screenshots.
Copy this checklist outside the candidate folder before filling it in, so the
tested payload files and their checksums stay unchanged.

## Identify the candidate and machine

- Candidate ID and archive SHA-256: copy from `candidate.json` / `.tar.gz.sha256`.
- Source commit, dirty-source flag and source fingerprint: copy from the manifest.
- Tester / presenter:
- Date / time / timezone:
- Laptop and operating system:
- Browser and exact version:
- Node version (`node --version`):

A candidate built with uncommitted source is suitable for QA, not the final commit
freeze. Commit the accepted changes, rerun `npm run release:prepare` on a clean
tree, and verify/rehearse that new archive. Checksums detect file differences;
they are not a signature or proof of human acceptance.

## 6.1 — Integrated correctness and usability

- [ ] Automated checks are green for this candidate (see `candidate.json`).
- [ ] From the source checkout, run `npm run test:release:network` where local
  port binding is permitted. The sandbox-safe checks cover the HTTP handler in
  memory; actual loopback startup/port-conflict tests remain separate.
- [ ] A new tester completes both views without coaching. Record friction and fixes.
- [ ] Before commit, no numerical ranking/deflection result is revealed.
- [ ] B1/P2 commits once and shows approximately 1.09% reduction.
- [ ] Moving to B2 keeps P2, shows 10.46%, and ties P2 + P3.
- [ ] Restoring the saved trial returns B1/P2/1.09%; history remains intact.
- [ ] Quote edits change only finances; structural edits leave quotes intact.
- [ ] Blank upkeep is unknown, not zero; upfront and funding gap remain known.
- [ ] Invalid amounts/settings show errors without old calculated totals.
- [ ] A captured sheet preserves its selected saved trial and costs after later edits.
- [ ] Buttons, radios, load slider, quote/source controls, history and report controls
  can be reached and operated with Tab, Shift+Tab, arrows, Space and Enter.
- [ ] Keyboard focus is visible. Confirm units and tension/compression labels in grayscale.
- [ ] Native PDF check from `PDF-CHECKLIST.md` in the bundle (or
  `docs/pdf-checklist.md` in the source checkout) passes; save the sample.

Performance on the actual laptop:

- [ ] From the source checkout (dependencies installed while online), run
  `npm run bench:structures`: record runtime, samples, median and p95. Target p95 <8 ms.
- [ ] Record input-to-painted-result latency with the presentation browser's
  performance tools while moving the load across B1/B2/B3 after commit. Target
  <50 ms. Keep the trace and describe the measurement; a Node solve benchmark is
  not input-to-paint evidence. Do not silently replace the target with automation
  tool round-trip time. Profile any miss before optimizing.

## 6.2 — Cold start and offline flow

Prepare while online: install a compatible Node runtime and copy/extract the
candidate archive. The extracted app has no npm dependencies to install.

```sh
node verify.mjs
node serve.mjs
```

Open `http://127.0.0.1:4173/`. Keep the terminal running. Port conflicts are explicit;
the launcher will not silently change the URL. Use another explicit `PORT` only if
necessary and record it. The server is accessible only on the laptop's loopback.

- [ ] Verify checksums after copying to the presentation laptop.
- [ ] Disable internet connectivity while keeping the local server running.
- [ ] Open a fresh browser session or clear its cache, then reload the local URL.
- [ ] Confirm trials, quotes and captured sheets reset after reload.
- [ ] Use only the keyboard to commit, retest, restore, edit horizon and capture.
- [ ] Print/save the selected trial while disconnected; confirm one Letter page,
  all five sections, complete sources, correct units and no clipping.
- [ ] Inspect the browser's network log: all app resources come from loopback;
  no remote request or CSP error is needed for the flow.
- [ ] Stop and restart the local server; verify a fresh start works.

The candidate includes same-origin CSP and audited local HTML/CSS references.
Those are supporting checks, not a substitute for physically disconnecting on
the actual laptop. Internet disconnection, print inspection and timings are
manual tasks; no network or browser settings are changed automatically.
The new portable launcher has not yet been run on a real socket in this session:
temporary-port approval was declined. Validate its startup and the full flow under
its CSP on the presentation laptop before relying on the archive for the demo.

## 6.3 — Feature freeze, rehearsal and submission

- [ ] All 6.1 and 6.2 checks pass; record failures and repeat affected checks after fixes.
- [ ] Final source tree is committed and clean; package that exact revision.
- [ ] Record the final candidate ID, source commit and archive checksum.
- [ ] Keep two offline copies of the verified archive and the approved sample PDF.
- [ ] Rehearsal 1 completes the script within 90 seconds: duration ___; result ___.
- [ ] Rehearsal 2 completes the script within 90 seconds: duration ___; result ___.
- [ ] Team names, roles, project URL, final branch/commit and demo artifacts are ready.
- [ ] Complete the reused-code/tool assistance disclosure in `DEMO-SCRIPT.md`.
- [ ] Check the event's current submission requirements and deadline independently.

Freeze feature work after acceptance. Fix only correctness or demo-blocking issues,
then repackage and rerun relevant checks. Do not certify a later build based on an
earlier rehearsal. Optional measurements/templates are not release blockers.

## Phase 7 — Optional features in this candidate

- [ ] If demonstrating physical evidence, complete `PHYSICAL-CHECKLIST.md` in the
  bundle (or `docs/physical-checklist.md` in source). Use actual observations only.
- [ ] Check original/braced and saved/retest associations; exclude unrelated readings.
- [ ] Confirm capture freezes readings even after a later removal or new trial.
- [ ] Confirm long readings block overfull report printing while retaining JSON export.
- [ ] Test the measurement controls and separate SVG download offline under the
  portable launcher's CSP. Confirm reload clears observations/drafts/captures.
- [ ] If printing an assembly pattern, use its landscape settings, verify pagination
  and physically measure the 100 mm bar. Restore portrait settings for reports.

Core acceptance still applies after optional changes. Record which optional
features were omitted from the demo; do not describe an uncalibrated print or
synthetic QA readings as physical validation. Repackage after any source changes.
