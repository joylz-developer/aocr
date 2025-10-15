import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Vite replaces `process.env` with this object at build time.
    // This makes `process.env.API_KEY` available in your client-side code.
    'process.env': {
      'API_KEY': process.env.API_KEY
    }
  },
  server: {
    port: 3000,
    open: true,
  }
});
