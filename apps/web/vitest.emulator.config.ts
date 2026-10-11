import { defineConfig } from 'vitest/config';

// Tests that need a running Firebase Auth emulator (`npm run test:emulator` at the root).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.emulator.test.ts'],
  },
});
