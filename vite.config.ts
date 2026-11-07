import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', strictPort: true },
  test: {
    // Bound concurrent DOM renderers so geometry-heavy UI checks stay deterministic.
    maxWorkers: 4,
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
});
