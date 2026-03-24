/* eslint-disable no-console */
'use client';

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserSessionPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

// Firebase Client SDK (browser)
// Vite replaces these at build-time via `vite.config.ts` `define`.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseEnvStatus = {
  apiKey: Boolean(firebaseConfig.apiKey),
  authDomain: Boolean(firebaseConfig.authDomain),
  projectId: Boolean(firebaseConfig.projectId),
  appId: Boolean(firebaseConfig.appId),
};

export const isFirebaseConfigured: boolean =
  firebaseEnvStatus.apiKey &&
  firebaseEnvStatus.authDomain &&
  firebaseEnvStatus.projectId &&
  firebaseEnvStatus.appId;

function initFirebaseApp(): FirebaseApp {
  if (getApps().length) return getApps()[0]!;
  return initializeApp(firebaseConfig);
}

export const firebaseApp: FirebaseApp | null = isFirebaseConfigured ? initFirebaseApp() : null;
export const auth: Auth | null = firebaseApp ? getAuth(firebaseApp) : null;
export const db: Firestore | null = firebaseApp ? getFirestore(firebaseApp) : null;
export const storage: FirebaseStorage | null = firebaseApp ? getStorage(firebaseApp) : null;

// Enforce session persistence: user will be logged out when the browser window/tab is closed
// Note: Client components still SSR; guard browser-only APIs.
if (typeof window !== 'undefined') {
  if (!isFirebaseConfigured) {
    console.error('[Firebase] Missing frontend env vars. Set these in frontend/.env or .env.local:', {
      NEXT_PUBLIC_FIREBASE_API_KEY: firebaseEnvStatus.apiKey,
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: firebaseEnvStatus.authDomain,
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseEnvStatus.projectId,
      NEXT_PUBLIC_FIREBASE_APP_ID: firebaseEnvStatus.appId,
    });
  } else if (auth) {
    setPersistence(auth, browserSessionPersistence)
      .then(() => {
        console.log('Firebase persistence set to browserSessionPersistence');
      })
      .catch((error) => {
        console.error('Error setting Firebase persistence:', error);
      });
  }
}
