import { defineConfig, type Plugin } from 'vite';

// Strict CSP injected at build time only (dev server needs inline HMR scripts).
const csp = (): Plugin => ({
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml(html) {
    const policy = "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'";
    return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
  },
});

export default defineConfig({
  base: './',
  plugins: [csp()],
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 600 },
  test: { include: ['tests/**/*.test.ts'] },
} as never);
