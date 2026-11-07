import { JUDGE_PRESET } from '../shared/fixtures';

export function App() {
  return (
    <main>
      <h1>Where should we add one brace?</h1>
      <p>Forma: a fixed tabletop bridge, one added brace, and your prediction.</p>
      <section aria-labelledby="foundation-title">
        <h2 id="foundation-title">Foundation checkpoint</h2>
        <p role="status">Calculations and the judging experience are pending implementation.</p>
        <p>Preset: {JUDGE_PRESET.label} ({JUDGE_PRESET.version}).</p>
        <p>Four brace choices. Three load positions. Millimeters and newtons.</p>
        <p>No prediction, ranking, or physical measurement has been recorded.</p>
      </section>
    </main>
  );
}
