// Builds the offline demo: the whole app, an in-browser copy of the API and
// sample data in ONE html file that opens with a double click (no server, no
// database). Output: dist-demo/skillmap_Demo.html.   npm run build:demo
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

// The server's scoring, badge and plan modules read content from disk; in the
// browser they get the same JSON through demo/content.js instead.
function browserContent() {
  return {
    name: 'masar-demo-content',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === '../content/index.js' && importer?.includes('/server/src/')) return here('./demo/content.js');
      return null;
    },
  };
}

// Puts the script, the styles, the theme snippet and the icon inside the html,
// so there is a single file to send and open.
function singleFile() {
  const escapeScript = (code) => code.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
  return {
    name: 'masar-demo-single-file',
    enforce: 'post',
    transformIndexHtml(html) {
      const theme = readFileSync(here('./public/theme-init.js'), 'utf8');
      const icon = `data:image/png;base64,${readFileSync(here('./public/favicon.png')).toString('base64')}`;
      return html.replace('/*THEME_INIT*/', theme.trim()).replace('/*FAVICON*/', icon);
    },
    generateBundle(_options, bundle) {
      const page = Object.values(bundle).find((f) => f.fileName.endsWith('.html'));
      let html = page.source;
      for (const file of Object.values(bundle)) {
        const ref = new RegExp(
          `<(script|link)[^>]*?(src|href)="[^"]*${file.fileName.replace(/[.]/g, '\\.')}"[^>]*>(</script>)?`
        );
        if (file.type === 'chunk') {
          // Lazy pages are already inside this one script, so there is nothing to preload:
          // Vite leaves its preload list placeholder unfilled when code splitting is off.
          const code = file.code.replaceAll('__VITE_PRELOAD__', 'void 0');
          html = html.replace(ref, () => `<script type="module">${escapeScript(code)}</script>`);
        } else if (file.fileName.endsWith('.css')) {
          html = html.replace(ref, () => `<style>${file.source}</style>`);
        } else continue;
        delete bundle[file.fileName];
      }
      page.source = html;
      page.fileName = 'skillmap_Demo.html';
    },
  };
}

export default defineConfig({
  root: here('./demo'),
  base: './',
  mode: 'demo',
  publicDir: false,
  plugins: [browserContent(), react(), singleFile()],
  resolve: {
    alias: [{ find: /^@fontsource-variable\/(inter|readex-pro)$/, replacement: here('./demo/empty.css') }],
  },
  build: {
    outDir: here('./dist-demo'),
    emptyOutDir: true,
    assetsInlineLimit: () => true,
    cssCodeSplit: false,
    modulePreload: { polyfill: false },
    rolldownOptions: { output: { codeSplitting: false } },
  },
});
