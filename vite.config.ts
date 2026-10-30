/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * The build emits a single self-contained `dist/index.html` with the
 * JavaScript and CSS inlined. That one file works both on a static host and
 * opened straight from disk over `file://`, where a normal split build fails:
 * browsers fetch `<script type="module">` under CORS rules, and a `file://`
 * page has a null origin, so the separate bundle is refused.
 *
 * Relative `base` keeps the hosted case working from a subdirectory too.
 */
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
