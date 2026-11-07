# Forma — native PDF acceptance

Run this on the presentation laptop/browser. This is a manual acceptance task;
screen layout measurements do not prove native print pagination. Host-generated
Chromium PDFs have been visually inspected during RC hardening; that evidence
does not replace this target-browser/driver check.

Start the extracted bundle with `node serve.mjs` and open
`http://127.0.0.1:4173/`. Keep the terminal open. Save generated PDFs and JSON files
outside the candidate folder to preserve its integrity checks.

1. Commit P2 at B1, then move the load to B2. Load the fictional financial example
   in Compare build options. Capture without checking the retest option.
2. Confirm the primary result is B1/P2, about 1.09%, and B2 is absent. Select
   Print / Save PDF. Use US Letter, portrait, 100% scale, and turn browser headers
   and footers off. Confirm **one page** before saving.
3. Reopen the PDF. Inspect all five sections, trial identity, original/modified
   geometry, shared 200× magnification, signed brace forces, units, sources and
   complete text. Confirm no clipped rows or blank extra page.
4. Capture again with the retest explicitly included. Confirm the separate B2/P2
   scenario shows 10.46%, P2 + P3 tied best, and its own signed force. The original
   B1/P2 result must remain unchanged. Save and inspect the one-page PDF in grayscale.
5. Repeat with B's annual upkeep blank and long package names. B's upfront cost
   and gap stay known; its discounted total and expected savings become unknown.
   Confirm readable wrapping and one page. Oversized notes should disable the
   app's print button. Browser-native printing must show the overflow warning,
   not clipped paper. Full evidence must remain on screen and in JSON. Shorten
   the inputs and recapture only if that still preserves the intended evidence.
6. Repeat the complete flow with internet disconnected while the local server
   remains running. Download the JSON snapshot and compare the selected scenarios,
   horizon, costs and report ID with the PDF.

Record browser/version, candidate ID, date, pass/fail and any issue in a separate
copy of the release checklist. Keep an approved complete sample named
`Forma_Decision_Sheet_Sample.pdf` with your release evidence. In the source checkout,
the intended location is `output/pdf/Forma_Decision_Sheet_Sample.pdf`.

The app cannot control every printer driver or browser default. If page count or
legibility differs, record the settings and fix/retest before declaring acceptance.

For assembly output, use the separate captured template and Letter landscape at
100% / actual size. Confirm one page, complete member lengths and the captured
trial ID. Measure its 100 mm check bar with a physical ruler before use. Do not
shrink overfull geometry to fit; the overflow guard must block that print.
