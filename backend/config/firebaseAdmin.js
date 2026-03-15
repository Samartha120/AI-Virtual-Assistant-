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

  const projectId = requireEnv('FIREBASE_PROJECT_ID');
  const clientEmail = requireEnv('FIREBASE_CLIENT_EMAIL');
  let privateKeyRaw = requireEnv('FIREBASE_PRIVATE_KEY').trim();
  if (privateKeyRaw.endsWith(',')) privateKeyRaw = privateKeyRaw.slice(0, -1).trim();
  if (
    (privateKeyRaw.startsWith('"') && privateKeyRaw.endsWith('"')) ||
    (privateKeyRaw.startsWith("'") && privateKeyRaw.endsWith("'"))
  ) {
    privateKeyRaw = privateKeyRaw.slice(1, -1);
  }
  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

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
}

initFirebaseAdmin();

const adminAuth = getAuth();
const adminDb = getFirestore();
const adminBucket = getStorage().bucket();

module.exports = {
  admin,
  adminAuth,
  adminDb,
  adminBucket,
};
