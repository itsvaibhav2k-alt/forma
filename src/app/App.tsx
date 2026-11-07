import { useAppController } from './useAppController';

export function App() {
  const { studio } = useAppController();
  return (
    <main>
      <h1>Where should we add one brace?</h1>
      <p>Forma: a fixed tabletop bridge, one added brace, and your prediction.</p>
      <section aria-labelledby="engine-title">
        <h2 id="engine-title">Calculation engines ready</h2>
        <p role="status">The judging interface is awaiting Claude’s presentation checkpoint.</p>
        <p>Preset: {studio.preset.label} ({studio.preset.version}).</p>
        <p>Four brace choices. Three load positions. Millimeters and newtons.</p>
        <p>No prediction or physical measurement has been recorded.</p>
      </section>
    </main>
  );
}
