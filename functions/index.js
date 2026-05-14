const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule }         = require('firebase-functions/v2/scheduler');
const { initializeApp }      = require('firebase-admin/app');
const { getAuth }            = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage }         = require('firebase-admin/storage');

initializeApp();
const db = getFirestore();

/* =========================================================================
   setUserRole — admin-only. Sets the role custom claim + mirrors it into
   the users/{uid} Firestore document. Call this on every role change.
   ========================================================================= */
exports.setUserRole = onCall(async (request) => {
  if (request.auth?.token?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Only admins can change roles.');
  }
  const { uid, role } = request.data;
  if (!['admin', 'teacher', 'student', 'board'].includes(role)) {
    throw new HttpsError('invalid-argument', 'Invalid role.');
  }
  await getAuth().setCustomUserClaims(uid, { role });
  await db.doc(`users/${uid}`).set(
    { role, updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  return { ok: true };
});

/* =========================================================================
   createUser — admin-only. Creates a Firebase Auth user, sets their role
   custom claim, and writes the initial users/{uid} document.
   ========================================================================= */
exports.createUser = onCall(async (request) => {
  if (request.auth?.token?.role !== 'admin') {
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
  await getAuth().setCustomUserClaims(userRecord.uid, { role });
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
   claimBoardSession — teacher-only. Atomically:
     1. Verifies the session exists, is not expired, is not already claimed
     2. Marks the session as claimed
     3. Creates a files/{fileId} doc owned by the teacher
     4. Logs the claim activity
   Returns the new fileId and a signed download URL for the snapshot.
   ========================================================================= */
exports.claimBoardSession = onCall(async (request) => {
  if (request.auth?.token?.role !== 'teacher') {
    throw new HttpsError('permission-denied', 'Only teachers can claim sessions.');
  }
  const { sessionId, classroomId } = request.data;
  if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId required.');

  const teacherId  = request.auth.uid;
  const sessionRef = db.doc(`board_sessions/${sessionId}`);
  const fileRef    = db.collection('files').doc();

  const downloadURL = await getSignedDownloadURL(`board_snapshots/${sessionId}.png`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Session not found.');
    const s = snap.data();
    if (s.claimed) throw new HttpsError('failed-precondition', 'Session already claimed.');
    if (s.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Session expired.');
    }

    tx.update(sessionRef, {
      claimed:   true,
      claimedBy: teacherId,
      claimedAt: FieldValue.serverTimestamp(),
    });

    tx.set(fileRef, {
      ownerId:     teacherId,
      title:       `Smart Board capture (${new Date().toLocaleString()})`,
      category:    'smartboard',
      storagePath: s.storagePath,
      downloadURL,
      mimeType:    'image/png',
      sizeBytes:   0,
      classroomId: classroomId || '',
      source:      'smartboard',
      createdAt:   FieldValue.serverTimestamp(),
    });

    tx.set(db.collection('activity_logs').doc(), {
      userId:    teacherId,
      userRole:  'teacher',
      action:    'claim_session',
      targetId:  sessionId,
      metadata:  { fileId: fileRef.id },
      timestamp: FieldValue.serverTimestamp(),
    });
  });

  return { ok: true, fileId: fileRef.id, downloadURL };
});

async function getSignedDownloadURL(path) {
  const file = getStorage().bucket().file(path);
  const [url] = await file.getSignedUrl({
    action:  'read',
    expires: '03-09-2491',
  });
  return url;
}

/* =========================================================================
   cleanupExpiredSessions — runs hourly. Deletes board_sessions older than
   1 hour (claimed or not) and their Cloud Storage snapshot files.
   ========================================================================= */
exports.cleanupExpiredSessions = onSchedule('every 60 minutes', async () => {
  const cutoff  = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const expired = await db.collection('board_sessions')
    .where('createdAt', '<', cutoff)
    .limit(200)
    .get();

  const batch  = db.batch();
  const bucket = getStorage().bucket();

  for (const doc of expired.docs) {
    const { storagePath } = doc.data();
    if (storagePath) bucket.file(storagePath).delete().catch(() => {});
    batch.delete(doc.ref);
  }

  await batch.commit();
  console.log(`Cleaned up ${expired.size} expired board sessions.`);
});
