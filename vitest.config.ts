import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [{ test: {
      name: 'unit', environment: 'node', globals: true,
      include: ['__tests__/**/*.test.ts'],
      alias: { '@': path.resolve(__dirname, '.') },
    } }],
  },
});
