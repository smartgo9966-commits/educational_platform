const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule }         = require('firebase-functions/v2/scheduler');
const { initializeApp }      = require('firebase-admin/app');
const { getAuth }            = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

// Hardcoded admin emails — mirrors firestore.rules isAdminEmail() and the
// ADMIN_EMAILS list in public/shared/js/firebase-config.js. Keep in sync.
const ADMIN_EMAILS = [
  'faresayman12316@gmail.com',
  'smart.go.9966@gmail.com',
];

// Role lives in the Firestore users/{uid} doc (no custom claims).
async function isCallerAdmin(request) {
  const email = request.auth?.token?.email?.toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) return true;
  const uid = request.auth?.uid;
  if (!uid) return false;
  const snap = await db.doc(`users/${uid}`).get();
  return snap.exists && snap.data().role === 'admin';
}

/* =========================================================================
   createUser — admin-only. Creates a Firebase Auth user and writes the
   initial users/{uid} document. Admin verification reads role from
   Firestore (no custom claims).
   ========================================================================= */
exports.createUser = onCall(async (request) => {
  if (!(await isCallerAdmin(request))) {
    throw new HttpsError('permission-denied', 'Only admins can create users.');
  }
  const { email, password, displayName, role, classroomIds = [] } = request.data;
  if (!email || !password || !role) {
    throw new HttpsError('invalid-argument', 'email, password, and role are required.');
  }
  if (!['admin', 'teacher', 'student', 'board'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role.');
  }

  const userRecord = await getAuth().createUser({ email, password, displayName });
  await db.doc(`users/${userRecord.uid}`).set({
    email,
    displayName:  displayName || '',
    role,
    frozen:       false,
    classroomIds,
    createdAt:    FieldValue.serverTimestamp(),
    updatedAt:    FieldValue.serverTimestamp(),
  });

  return { ok: true, uid: userRecord.uid };
});

/* =========================================================================
   cleanupExpiredSessions — runs hourly. Deletes board_sessions older than
   1 hour (claimed or not).
   NOTE: snapshot images live on Cloudinary, not Firebase Storage. We have
   no server-side Cloudinary deletion path in this codebase, so binaries
   remain on Cloudinary indefinitely (see public/shared/js/storage.js
   deleteFile).
   ========================================================================= */
exports.cleanupExpiredSessions = onSchedule('every 60 minutes', async () => {
  const cutoff  = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const expired = await db.collection('board_sessions')
    .where('createdAt', '<', cutoff)
    .limit(200)
    .get();

  const batch = db.batch();
  for (const doc of expired.docs) batch.delete(doc.ref);
  await batch.commit();

  console.log(`Cleaned up ${expired.size} expired board sessions.`);
});
