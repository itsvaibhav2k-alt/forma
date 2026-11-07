# Forma NOVA Hackathon Build Plan

**Where should we add one brace?** A judge drags a fixed load along a preset tabletop bridge, commits to one of four brace placements, and sees the results of a linear-elastic analysis. The judge can keep the same brace and move the load to test whether the intervention helps elsewhere. Hacking closes at 5:00 PM ET on Saturday, November 7. Ship the prediction experiment, a secondary **Compare build options** view, and a one-page decision sheet.

## The interaction to ship

1. **Predict.** Start with fixed geometry, supports, material and member cross-section. Drag the downward load along the deck; it snaps to the three interior deck joints. Offer keyboard-accessible positions. Preview one standardized opposite diagonal. The first round opens with all rankings hidden.
2. **Commit and test.** The judge presses **Commit prediction**. Save the selected panel, load joint, magnitude, and preset version. Compare the original baseline with that one-brace intervention and with the other three one-brace alternatives. Show loaded-joint deflection in mm, signed member forces in N, percentage improvement over baseline, and all tied best placements. Here baseline means the original bridge, which already has its preset diagonals.
3. **Challenge the result.** Keep the committed brace in place as the judge drags the load to another joint. Recompute the original and modified designs under this same new load. Keep the first prediction and result available. A new prediction round at the new load hides its ranking until commit. The judge can always toggle the original and modified overlays.
4. **Compare and explain.** In **Compare build options**, enter or edit two packages, see cash needed now and over the chosen maintenance horizon, then export a one-page decision sheet. Optionally enter actual physical measurements and print the separate assembly template.

## First 15 minutes

Vaibhav owns integration and the clock. Put the four human names next to the roles below. Start one React + TypeScript app in one repo. Use SVG for the editable drawing, pure TypeScript for calculations, and the browser print dialog for the report. Each owner works on a branch. Agree on millimeters, newtons, US dollars, the shared example, and the three interface contracts before handing work to coding agents. Choose one machine that can run the complete demo locally.

Check for matching strips, joints, supports, a light test mass, and a ruler while the software work starts. Physical measurements and the 1:1 assembly template are optional. When a reading is entered, associate it with the design, load position and magnitude, measured joint, units, and method.

## Owners and first assignments

**Vaibhav — integration, evidence, and release.** Use Hermes on GPT-6 Astra for shared types, fixture data, and integration checks. Own the prediction snapshot, the decision sheet, the demo branch, and submission. Generate the plain-English comparison directly from solver output. A model-assisted wording pass is optional after the offline judging flow works.

**Structures teammate — solver and redesign.** Use Codex to implement the 2D direct stiffness calculation, identify unstable layouts, and enumerate the permitted opposite diagonal in each of four panels. Rank by downward displacement at the loaded joint under the same load and one-brace allowance. Show ties. Use Claude independently to audit unit conversions, support constraints, signs, and fixture calculations. Commit the math before polishing the explanation.

**Studio teammate — prediction and comparison.** Use Codex to build the preset SVG bridge, snapped load dragging, brace selection, commit/reveal, and original/modified overlays. Keep supports, material, and joint geometry fixed. Make predicted deflection, tension/compression, and any deformation magnification explicit. Retain the original committed result while the judge moves the load.

**Community cost and prototype teammate — Compare build options and optional measurements.** Have a coding agent implement budget, delivery, installation, donations, annual upkeep, horizon, rate, and source labels. Keep fictional demo packages visibly labeled. Test the break-even calculation below. Own the physical evidence fields and try a repeatable tabletop measurement. Add an assembly template after the main decision sheet works.

## Shared interfaces

**Design and structural result.** `analyze(design, loadCase)` takes node coordinates in mm, member endpoints and stock IDs, stock area and modulus, fixed directions, and a point load in N at a joint. It returns status, signed axial forces, reactions, and joint displacements. Positive member force means tension. An unstable model produces a visible message and clears previous performance results.

**Brace search and trial history.** `rankBraces(design, loadCase)` runs the same analyzer on the baseline and all four standardized diagonal additions. `commitPrediction(presetVersion, loadCase, panelId)` stores an immutable trial. The current load and chosen panel are separate UI state. Rank by the absolute downward movement of the loaded joint. Display joint deflection reduction as 100 × (baseline − revised) / baseline; if baseline is zero, show the absolute difference only. Use a numerical tolerance on unrounded values to preserve ties. Optional `cutList(design)` and the assembly template use the same geometry.

**Community scenario.** `compareQuotes(quoteA, quoteB, budget, years, rate)` returns upfront cost, funding gap, discounted cost over the selected horizon, and the annual maintenance savings required to justify the higher upfront cost. For constant year-end savings, divide the upfront premium by the annuity factor `[1 − (1+r)^(-n)] / r`; at zero rate the factor is `n`. Require a positive horizon. Compare packages for the same scope and level of service. Source every price from a user entry, quote, or labeled demonstration assumption. Project costs are independent of the tabletop solver.

## Coding agent handoffs

Use one writer per module. Vaibhav owns the app shell, shared types, and merges. Put structural code in `src/structures`, the editor in `src/studio`, and costs and exports in `src/community`. Use separate branches and merge small changes at each checkpoint. Pass Hermes, Claude, or Codex the same fixture and ask them to return changed files, test results, and assumptions. Use Grok only if someone wants a fresh critique of the demo or a stubborn bug.

**Hermes / integration prompt.** Scaffold the manual flow, define design, load case and immutable prediction trial, then print the one-page decision sheet. Add an end-to-end check for commit, reveal, drag with the same brace, and retrieval of the first result. Verify that editing a quote changes only financial outputs.

**Solver prompt.** Implement planar pin-jointed truss analysis and four possible one-brace edits. Run the analytic triangle, unstable square, and four-panel regression examples below. Sign tension positive, retain ties, and return an invalid state for zero-length bars or a singular system.

**Studio prompt.** Build a responsive SVG with fixed bridge geometry. Support dragging the load to one of three interior joints, previewing one of four brace locations, committing before reveal, preserving ties, and retesting the same brace at a second load position. Keep the original design and first prediction accessible.

**Community prompt.** Build the secondary Compare build options view with editable same-scope packages, upfront funding gap, discounted total over the selected horizon, and annual break-even maintenance savings. Test 3% and 0% rates. Label inputs as quoted, user-entered, demonstration, or unknown. Provide optional measurement fields and a clear empty state.

## Regression examples

**Analytic triangle.** Use a left pin at (0,0), right roller with vertical restraint at (200,0), and apex at (100,100), with a member on each side. Use EA = 1,000 N per member and a 1 N downward apex load. Each vertical support reaction is 0.5 N, the two inclined members each carry 0.7071 N compression, the bottom tie carries 0.5 N tension, and the apex moves 0.1914 mm downward. Target 1% agreement. An unbraced pin-jointed square must report instability.

**Judge’s bridge.** Use four 60 mm bays, 40 mm height, top and bottom chords, one vertical at every station, and one diagonal per panel. From left to right use two rising then two falling diagonals. Left bottom pin, right bottom roller, all members have equal EA. Test the four opposite diagonals as equal-length alternatives. With a downward load at the first interior bottom joint, adding the first-panel brace reduces downward movement by about 26%; the second-panel brace gains about 1%. With a center load the two middle options tie at about 10.5%. These are ideal-model reference results. Record physical readings independently.

**Community budget.** Seed clearly fictional quotes for an equal-scope comparison. At a $20,000 upfront cap, an option with $19,000 installed cost and $900 annual upkeep has no funding gap. A second with $21,000 installed cost and $450 upkeep has a $1,000 gap. At a 3% real discount rate over ten years, with upkeep paid at year end, the present costs round to $26,677 and $24,839. Changing the budget to $21,000 closes the second option’s gap without changing its cost. Missing prices stay unknown. Let the organization set priorities, enter local quotes, and see which input drives the difference. With a $2,000 upfront premium, break-even maintenance savings are $234.46 per year at 3% over ten years, or $200 per year at 0%. At exactly the break-even amount the present-value totals agree. Updating the horizon must recalculate the threshold and totals while the engineering outputs stay identical.

## Decision sheet acceptance check

Print one page with five labeled sections: **what changed** (load and brace selected, original and revised sketch), **predicted** (joint deflection, percentage change, and relevant forces), **measured** (actual readings and conditions, or “No measurement recorded”), **cost comparison** (package sources, budget, funding gap, horizon, total, break-even), and **open assumptions** (ideal pin joints, experimental uncertainties, unverified price or upkeep inputs). Give each scenario its own label. Add a 1:1 template as a separate optional export. The decision sheet supports a constrained design discussion and supplier or engineering review.

## Checkpoints in Eastern Time

| Deadline | What everyone should be able to see |
|---|---|
| 11:45 AM | Owners, shared data contracts, test fixtures, materials check, and app shell. |
| 12:30 PM | Known triangle solves. Preset draws. Both sample quotes calculate. First physical load and unload trial attempted. Stagger lunch coverage. |
| 1:30 PM | First integrated build. Commit a guess, reveal results, drag the load, and retest the same brace. Editable quotes show the funding gap and break-even. |
| 2:30 PM | An outside tester completes both views and prints the one-page decision sheet. Optional recorded measurements and template carry explicit labels. |
| 3:30 PM | Full manual demo runs locally on the presentation laptop. Budget and horizon changes leave solver results untouched. |
| 4:15 PM | Freeze features. Fix only issues that affect the judging flow or correctness. |
| 4:40 PM | Two timed rehearsals, submission materials ready, offline copy tested. Complete the organizer’s required handoff before 5:00 PM. |

## What to cut first

Protect commit/reveal, the load-position retest, the cost comparison, and the decision sheet. If time runs short, drop model narration, template export, and live measurement in that order as needed. If a physical trial cannot resolve the displacement against a ruler, report the observed uncertainty or leave measurements blank.

## Ninety second judging sequence

**0–15 seconds.** “You have one brace. Where would you put it?” Give the judge the load control, let them pick a panel, and ask them to commit.

**15–45 seconds.** Reveal their result and the best placement(s). Keep their brace fixed as they move the load. Toggle original and modified predictions; show the first trial for comparison.

**45–75 seconds.** Open Compare build options. Ask which package fits $20,000 today and how much annual upkeep the more expensive package must save to justify the premium. Let the judge change the horizon or a vendor quote.

**75–90 seconds.** Export the decision sheet and point to one assumption the team would verify next. Target Beyond Limits and Grand Prize. Disclose reused prior-project code during judging when applicable.

