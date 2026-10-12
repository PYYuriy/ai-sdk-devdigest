import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Vitest configuration.
// - `tsconfigPaths` makes the `@/*` alias from tsconfig.json resolve in tests,
//   so tests can import `@/app/tools/...` exactly like the app does.
// - `environment: 'node'` because the tools run server-side (SQLite, fetch),
//   not in a browser.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    // Each test file gets a clean module registry so the db singleton and
    // mocks don't leak between files.
    isolate: true,
  },
});
