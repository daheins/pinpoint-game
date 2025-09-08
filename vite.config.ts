import { defineConfig } from 'vite';

export default defineConfig({
  base: '/pinpoint-game/', // 👈 replace with your actual repo name
  build: {
    rollupOptions: {
      output: {
        // Remove crossorigin attribute to fix Chrome CORS issues
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
});
