import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    coverage: {
      provider: 'v8',
      include: ['lib/openaiConfig.ts', 'lib/openaiClient.ts'],
      reporter: ['text', 'html'],
    },
  },
});
