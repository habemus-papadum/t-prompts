import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    silent: true, // Suppress console.log output during tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      exclude: ['dist/**', 'build.js'],
      reportsDirectory: './coverage',
    },
  },
});
