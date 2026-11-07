# Forma — 90-second demo and submission notes

Rehearse twice on the actual presentation laptop using the final verified archive.
This is a script, not a claim that a rehearsal has happened. Start the server and
open the app before timing; do not pre-reveal a ranking.

| Time | Action | Point to make |
| --- | --- | --- |
| 0–15 s | Leave the load at B1. Ask where one brace should go; choose P2. | One fixed load, four legal placements, prediction before results. |
| 15–30 s | Commit. Show the 1.09% reduction and that P1 is best for this load. | A plausible guess is not necessarily the best placement for loaded-joint deflection. |
| 30–45 s | Move the same brace's load to B2. | P2 now ties P3 at 10.46%; the saved B1 prediction remains unchanged. |
| 45–60 s | Open Compare build options and load the visibly fictional example. | Separate equal-scope planning scenario: A fits $20,000 today, B needs $1,000 extra; B's modeled long-term total is lower. |
| 60–75 s | Point to $234.46/year required savings versus $450 expected. Optionally clear B upkeep. | Unknown upkeep leaves affordability known; assumptions determine the long-term comparison. Restore the example if cleared. |
| 75–90 s | Capture the saved trial, optionally include the labeled B2 retest, then Print / Save PDF. Point to one open assumption. | The primary result is still B1/P2/1.09%. Ideal pin joints and unverified upkeep need real-world review. |

If the native save dialog takes too long during rehearsal, simplify the spoken
explanation rather than claiming an unfinished export. Test the actual dialog in
advance. Keep the approved sample PDF available as a disclosed fallback; do not
present it as a newly generated result if printing fails.

## Recovery cues

- Port occupied: stop the older local server or deliberately choose and record
  another port. Do not start multiple unseen servers.
- Reload: session data clears by design; start a new prediction and re-enter/load
  quotes. JSON downloads are archival; there is no import button.
- Analysis error: no active result should remain; retry or restore a valid saved
  trial. Never explain an old result as if it belongs to the failed scenario.
- Invalid cost: correct the field or clear an unknown amount. Do not silently
  substitute zero. Missing common scope blocks capture until declared.
- Sheet too long: shorten notes/source text and recapture; retain the full JSON.
- Model question: this is a linear, pin-jointed tabletop model, not a strength,
  buckling or full-size safety assessment.

## Submission preparation — complete with the team

- Project: Forma — one-brace prediction experiment, independent package comparison,
  and an immutable decision sheet.
- Repository: https://github.com/itsvaibhav2k-alt/forma ; implementation branch `phases`.
- Final tested commit / candidate ID / archive checksum: **pending**.
- Team members and actual contributions: **team to complete**.
- Demo video, screenshots and approved PDF: **team to select**.
- Event-specific category, form, eligibility and deadline: **team to verify**.
- Reused code and assistance: this branch was developed with coding-agent assistance
  from the supplied specification and plan; it uses React, Vite and the dependencies
  recorded in the lockfile. The other agent's `main` implementation has not been
  merged. The team must add any other prior work, third-party assets or assistance
  and verify that this disclosure is complete before submission.

No submission, public release, release tag or merge is performed by this checklist.
