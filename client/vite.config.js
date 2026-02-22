import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // -----------------------------------------------------------------
  // ADD THIS BLOCK TO PROXY API REQUESTS TO THE BACKEND
  // -----------------------------------------------------------------
  server: {
    proxy: {
      // All requests starting with '/api' (e.g., /api/chats, /api/users/save)
      '/api': {
        target: 'http://localhost:5000', // <-- Ensure your backend is running on this port!
        changeOrigin: true, // Needed for virtual hosting
        secure: false,      // Typically safe for development
      },
    },
  },
});