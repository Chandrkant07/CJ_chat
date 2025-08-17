import { defineConfig } from 'vite';

export default defineConfig({
  root: 'client', // Set the root directory for Vite to 'client'
  build: {
    outDir: '../dist', // Output build files to 'dist' in the project root
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000', // Proxy Socket.io requests to the backend
        ws: true,
      },
    },
  },
});
