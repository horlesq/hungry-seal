import { defineConfig } from 'vitest/config';
import { version } from './package.json';

export default defineConfig({
  // Relative base so the build works from any subpath (itch.io, GitHub Pages).
  base: './',
  define: {
    // Shown on the title screen and in the release zip name (see docs/RELEASE.md).
    __APP_VERSION__: JSON.stringify(version),
  },
  server: {
    port: 5173,
  },
  build: {
    // Source maps triple the upload (12 MB for a 1.6 MB bundle); `vite build --sourcemap`
    // when debugging a release.
    sourcemap: false,
    // Phaser alone is ~1.3 MB minified; don't warn about it.
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      output: {
        // Phaser in its own chunk: a game update doesn't make returning players download the
        // engine again (file names carry a content hash).
        codeSplitting: {
          groups: [{ name: 'phaser', test: /node_modules[\\/]phaser/ }],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
