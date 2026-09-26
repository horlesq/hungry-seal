import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works from any subpath (itch.io, GitHub Pages).
  base: './',
  server: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    // Phaser alone is ~1.2 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
