# Forma — optional physical evidence and assembly checks

Status: **manual checks pending**. No physical measurements or printer calibration
were performed during development. Synthetic test readings verify software only.
Copy this checklist outside the candidate folder before recording results.

## Identify the case

- Candidate ID / source fingerprint / date / tester:
- Physical specimen ID, material, section and joint construction:
- Original or brace ID, design ID and preset version:
- Applied load in N, joint and load-sharing arrangement between physical sides:
- Measured joint, vertical datum, method, instrument and resolution:
- Supports, fixtures, environmental conditions and departures from the ideal model:

The app represents one ideal pin-jointed side with a 10 N downward point load.
Do not associate a different load/specimen with that case merely to fill the form.
If the physical setup differs, document it and leave model agreement unassessed.

## 7.1 — Observations and repeatability

- [ ] Select the correct saved/retest load and original/braced design in Physical evidence.
- [ ] Establish the unloaded datum. Record vertical displacement from that datum:
  downward positive, upward negative. Enter zero only when it was observed.
- [ ] Record repeated readings one per line, in the selected mm/cm/in units; use at
  least three repeats to examine repeatability. Keep individual observations.
- [ ] Enter instrument resolution in those same units, or leave it unknown. Display
  digits are not automatically measurement accuracy. Record calibration and method.
- [ ] Record specimen, supports, actual load/sharing and other test conditions.
- [ ] Save, verify raw values and mean, then repeat for the matched original/braced
  setup using the same joint, instrument, procedure and load. Record any changed conditions.
- [ ] Compare predicted change with resolution and observed spread. For example,
  the B1/P2 ideal-model change is about 0.000475 mm: a 0.01 mm instrument cannot
  resolve that change. Do not claim agreement from a visually similar number.
- [ ] Review systematic error, calibration, repeatability and model assumptions
  before any external agreement claim. The app deliberately never declares agreement.
- [ ] Capture a decision sheet. Retest observations appear only when that retest is
  included. Check design, load, measured joint, units, raw readings and assessment.
- [ ] Save the JSON before reloading; reports and measurements have no import or
  persistent storage. Verify native PDF pagination if printing a report with evidence.

The screen marks a predicted change inconclusive when instrument resolution or
repeat range is at least that change, or the modeled change is effectively zero.
Fine resolution alone cannot establish physical agreement. Sparse/unknown evidence
remains unassessed unless another condition already makes the result inconclusive.

## 7.2 — Actual-size pattern and printer calibration

- [ ] Capture Original assembly template or Braced assembly template from the
  correct saved trial. Check brace, version and geometry before printing.
- [ ] Use **US Letter landscape, 100% / actual size**, browser headers/footers off,
  and no fit-to-page. Confirm one page in the native print dialog. Do not resize
  the drawing to fix pagination; use the separate SVG with its physical units.
- [ ] Print on the actual printer/paper to be used for assembly. With a ruler,
  measure the **100 mm check bar**, **240 mm B0–B4 span** and **40 mm B0–T0 height**.
  Record observed lengths and ruler resolution; choose acceptable tolerances for
  the physical assembly before accepting the print. Screen pixels are not evidence.
- Printer/model, driver, paper and settings:
- Measured check bar / span / height, ruler resolution and acceptable tolerance:
- Pass/fail and corrective settings/reprint:
- [ ] Check member table: horizontals 60 mm, verticals 40 mm, diagonals/brace
  approximately 72.111 mm, all center to center. Joint overlap/cut lengths require
  separate allowance. Only labeled dots are joints; interrupted crossings are not.
- [ ] If using SVG, preserve its 254 × 100 mm physical dimensions and matching
  viewBox. Recheck the actual print after every exporting application/driver change.
- [ ] Restore **portrait** settings before printing the separate decision sheet.

The template positions one side; it is not a complete construction specification.
Neither a dimensioned SVG nor a screen fit check certifies actual printer scale.
Optional physical work may be omitted from the core demo. If included, rerun the
affected Phase 6 checks and rehearse the same final candidate.
