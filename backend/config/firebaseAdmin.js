const admin = require('firebase-admin');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function initFirebaseAdmin() {
  if (admin.apps.length) return;

  try {
    const projectId = requireEnv('FIREBASE_PROJECT_ID');
    const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
    let privateKeyRaw = requireEnv('FIREBASE_PRIVATE_KEY').trim();
    
    // Aggressively clean the raw string: remove quotes, literal \n strings, and normalize
    let privateKey = privateKeyRaw
      .replace(/^["']|["']$/g, '')
      .replace(/\\n/g, '\n')
      .trim();

    // Rebuild it from base64 body to ensure perfect PEM formatting
    if (privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
       const body = privateKey
         .replace('-----BEGIN PRIVATE KEY-----', '')
         .replace('-----END PRIVATE KEY-----', '')
         .replace(/[^A-Za-z0-9+/=]/g, ''); // remove EVERYTHING except valid base64
       
       const lines = [];
       for (let i = 0; i < body.length; i += 64) {
         lines.push(body.substring(i, i + 64));
       }
       privateKey = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
    }

    // For Storage, Firebase default bucket is usually: <project-id>.appspot.com
    // Some UIs/docs show *.firebasestorage.app domains; those are not bucket names.
    let storageBucketRaw = (process.env.FIREBASE_STORAGE_BUCKET || '').trim();
    if (
      (storageBucketRaw.startsWith('"') && storageBucketRaw.endsWith('"')) ||
      (storageBucketRaw.startsWith("'") && storageBucketRaw.endsWith("'"))
    ) {
      storageBucketRaw = storageBucketRaw.slice(1, -1);
    }
    const storageBucket =
      !storageBucketRaw || storageBucketRaw.includes('firebasestorage')
        ? `${projectId}.appspot.com`
        : storageBucketRaw;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
    console.log('[FirebaseAdmin] Successfully initialized');
    return true;
  } catch (err) {
    console.error('[FirebaseAdmin] Initialization failed:', err.message);
    return false;
  }
}

const isInitialized = initFirebaseAdmin();

let adminAuth = null;
let adminDb = null;
let adminBucket = null;

if (isInitialized) {
  try {
    adminAuth = getAuth();
    adminDb = getFirestore();
    adminBucket = getStorage().bucket();
  } catch (err) {
    console.error('[FirebaseAdmin] Service acquisition failed:', err.message);
  }
}

module.exports = {
  admin,
  adminAuth,
  adminDb,
  adminBucket,
};
