import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'metadata.json',
          dest: ''
        }
      ]
    })
  ],
  define: {
    'process.env': process.env
  },
  server: {
    port: 3000
  }
});