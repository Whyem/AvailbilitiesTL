import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works at https://<user>.github.io/<repo>/.
  base: './',
  server: {
    // Forward API calls to the backend (npm run server).
    proxy: { '/api': 'http://localhost:3001' },
  },
});
