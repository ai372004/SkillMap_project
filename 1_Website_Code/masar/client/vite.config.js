import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The two font files every page needs first (Arabic text and Latin letters and
// digits) are preloaded, so they arrive with the CSS instead of after it and
// the text doesn't jump when the web font replaces the fallback.
const PRELOAD_FONTS = [/readex-pro-arabic-wght-normal-.*\.woff2$/, /inter-latin-wght-normal-.*\.woff2$/];

function preloadFonts() {
  return {
    name: 'masar-preload-fonts',
    apply: 'build',
    transformIndexHtml(_html, ctx) {
      return Object.keys(ctx.bundle || {})
        .filter((file) => PRELOAD_FONTS.some((re) => re.test(file)))
        .map((file) => ({
          tag: 'link',
          attrs: { rel: 'preload', href: `/${file}`, as: 'font', type: 'font/woff2', crossorigin: '' },
          injectTo: 'head',
        }));
    },
  };
}

// During development, calls to /api go to the Node server on port 5000.
export default defineConfig({
  plugins: [react(), preloadFonts()],
  build: {
    rollupOptions: {
      output: {
        // React and the router change rarely, so they get their own file that
        // browsers keep cached across deploys of the app code.
        manualChunks(id) {
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
