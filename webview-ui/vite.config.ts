import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'webview.js',
        chunkFileNames: 'webview-[hash].js',
        assetFileNames: 'webview.[ext]',
      },
    },
  },
  base: './',
});
