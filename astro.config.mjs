// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://konan121.github.io',
  base: '/irshad/',
  trailingSlash: 'always',
  build: {
    format: 'directory',
    inlineStylesheets: 'always',
  },
  compressHTML: true,
  devToolbar: { enabled: false },
});
