import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Load all env variables (including those without the VITE_ prefix)
  // so we can inspect them in this config file if needed.
  // In application code, use import.meta.env.VITE_* instead.
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      tailwindcss(),
    ],
    define: {
      // Legacy shim: allows older code that uses process.env.API_KEY to keep
      // working. New code should use import.meta.env.VITE_GEMINI_API_KEY.
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY ?? env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend'),
      }
    }
  };
});
