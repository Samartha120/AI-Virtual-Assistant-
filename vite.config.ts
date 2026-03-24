import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  // Vite only loads env files from the current working directory by default.
  // This repo keeps the Vite entry at the root, but some users place vars in `frontend/.env`.
  // Merge both so either location works.
  const envFromRoot = loadEnv(mode, process.cwd(), '');
  const envFromFrontend = loadEnv(mode, path.resolve(process.cwd(), 'frontend'), '');
  // Root env wins so `.env.local` at the repo root can override.
  const env = { ...envFromFrontend, ...envFromRoot };

  const firebaseEnvKeys = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ] as const;

  const defineProcessEnv: Record<string, string> = {};
  for (const key of firebaseEnvKeys) {
    defineProcessEnv[`process.env.${key}`] = JSON.stringify(env[key] ?? '');
  }

  // Existing frontend code reads NEXT_PUBLIC_API_URL.
  // Prefer Vite's conventional VITE_API_URL, but allow NEXT_PUBLIC_API_URL too.
  defineProcessEnv['process.env.NEXT_PUBLIC_API_URL'] = JSON.stringify(
    env.VITE_API_URL ?? env.NEXT_PUBLIC_API_URL ?? ''
  );

  return {
    server: {
      port: 3000,
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://localhost:5001',
          changeOrigin: true,
        },
      },
    },
    define: defineProcessEnv,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './frontend'),
      },
    },
  };
});
