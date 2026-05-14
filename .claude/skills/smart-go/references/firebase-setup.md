# Smart Go — Firebase Setup

This is the complete backend reference. Every step is required for the platform to
work correctly. Read this file end-to-end before running `firebase init`.

---

## Step 1 — Initialize the Firebase project

```bash
cd smart-go
firebase login
firebase init
```

When prompted, select:
- **Hosting** — public directory: `public`, single-page app: **No**, GitHub deploys: optional
- **Firestore** — accept default rules path (`firestore.rules`) and indexes path (`firestore.indexes.json`)
- **Storage** — accept default rules path (`storage.rules`)
- **Functions** — language **JavaScript** (or TypeScript if user prefers), ESLint **Yes**

After init, edit `firebase.json` to look like this:

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      { "source": "/admin",   "destination": "/admin/admin.html" },
      { "source": "/board",   "destination": "/board/board.html" },
      { "source": "/teacher", "destination": "/teacher/teacher.html" },
      { "source": "/student", "destination": "/student/student.html" },
      { "source": "/login",   "destination": "/login/login.html" }
    ],
    "headers": [
      { "source": "**/*.@(js|css)", "headers": [{ "key": "Cache-Control", "value": "max-age=3600" }] }
    ]
  },
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": [
    {
      "source": "functions",
      "codebase": "default",
      "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
    }
  ]
}
```

---

## Step 2 — Firestore schema

All collections at the top level of the database.

### `users/{uid}`
```
{
  email:        string,
  displayName:  string,
  role:         "admin" | "teacher" | "student" | "board",
  frozen:       boolean,           // true → blocked from reads/writes
  createdAt:    Timestamp,
  updatedAt:    Timestamp,
  classroomIds: string[],          // students/teachers belong to one or more
  photoURL?:    string
}
```

### `files/{fileId}`
```
{
  ownerId:      string (uid of teacher),
  title:        string,
  category:     "assignment" | "lesson" | "note" | "other" | "smartboard",
  storagePath:  string,            // e.g. "files/{teacherId}/{fileId}/{filename}"
  downloadURL:  string,
  mimeType:     string,
  sizeBytes:    number,
  classroomId:  string,
  source:       "upload" | "smartboard",
  createdAt:    Timestamp
}
```

### `board_sessions/{sessionId}`
```
{
  boardId:      string (uid of board user, or "anonymous-{shortId}"),
  storagePath:  string,            // path to PNG in Cloud Storage
  createdAt:    Timestamp,
  expiresAt:    Timestamp,         // createdAt + 10 minutes
  claimed:      boolean,
  claimedBy:    string | null,
  claimedAt:    Timestamp | null
}
```

### `classrooms/{classroomId}`
```
{
  name:         string,
  teacherIds:   string[],
  studentIds:   string[],
  createdAt:    Timestamp
}
```

### `activity_logs/{logId}`
```
{
  userId:    string,
  userRole:  string,
  action:    "login" | "logout" | "upload" | "download" | "scan_qr"
            | "freeze_user" | "unfreeze_user" | "delete_user"
            | "edit_user" | "create_session" | "claim_session",
  targetId:  string | null,
  metadata:  object | null,
  timestamp: Timestamp
}
```

### `firestore.indexes.json`

Compose indexes that the platform needs (Firestore will also prompt at runtime
when missing). Start with this:

```json
{
  "indexes": [
    { "collectionGroup": "files",       "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "classroomId", "order": "ASCENDING" },
      { "fieldPath": "category",    "order": "ASCENDING" },
      { "fieldPath": "createdAt",   "order": "DESCENDING" }
    ]},
    { "collectionGroup": "files",       "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "ownerId",   "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "users",       "queryScope": "COLLECTION", "fields": [
      { "fieldPath": "role",      "order": "ASCENDING" },
      { "fieldPath": "createdAt", "order": "DESCENDING" }
    ]},
    { "collectionGroup": "activity_logs","queryScope": "COLLECTION", "fields": [
      { "fieldPath": "userId",    "order": "ASCENDING" },
      { "fieldPath": "timestamp", "order": "DESCENDING" }
    ]}
  ],
  "fieldOverrides": []
}
```

---

## Step 3 — Firestore Security Rules

File: `firestore.rules` — **copy verbatim**, then adjust the schoolId field if extending.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ---------- Helpers ----------
    function isSignedIn()    { return request.auth != null; }
    function role()          { return request.auth.token.role; }
    function uid()           { return request.auth.uid; }
    function isAdmin()       { return isSignedIn() && role() == 'admin'; }
    function isTeacher()     { return isSignedIn() && role() == 'teacher'; }
    function isStudent()     { return isSignedIn() && role() == 'student'; }
    function isBoard()       { return isSignedIn() && role() == 'board'; }
    function notFrozen() {
      return get(/databases/$(database)/documents/users/$(uid())).data.frozen == false;
    }
    function userClassrooms() {
      return get(/databases/$(database)/documents/users/$(uid())).data.classroomIds;
    }

    // ---------- users ----------
    match /users/{userId} {
      allow read:   if isAdmin() || (isSignedIn() && uid() == userId);
      allow create: if isAdmin();             // also created by Cloud Function during signup
      allow update: if isAdmin() ||
                       (isSignedIn() && uid() == userId &&
                        // user can update only displayName/photoURL on themselves
                        request.resource.data.diff(resource.data)
                          .changedKeys().hasOnly(['displayName', 'photoURL', 'updatedAt']));
      allow delete: if isAdmin();
    }

    // ---------- files ----------
    match /files/{fileId} {
      allow read:   if isAdmin() ||
                       (isTeacher() && notFrozen()) ||
                       (isStudent() && notFrozen() &&
                        resource.data.classroomId in userClassrooms());
      allow create: if isTeacher() && notFrozen() &&
                       request.resource.data.ownerId == uid();
      allow update: if isAdmin() ||
                       (isTeacher() && notFrozen() && resource.data.ownerId == uid());
      allow delete: if isAdmin() ||
                       (isTeacher() && resource.data.ownerId == uid());
    }

    // ---------- board_sessions ----------
    match /board_sessions/{sessionId} {
      // any signed-in user can create (boards run as anon-auth users)
      allow create: if isSignedIn() &&
                       request.resource.data.claimed == false;
      // teachers and admins can read; needed to claim
      allow read:   if isTeacher() || isAdmin() || isBoard();
      // only teachers may claim, and only via Cloud Function (rules forbid direct write)
      allow update, delete: if false;
    }

    // ---------- classrooms ----------
    match /classrooms/{classroomId} {
      allow read:   if isAdmin() ||
                       (isSignedIn() && (uid() in resource.data.teacherIds ||
                                         uid() in resource.data.studentIds));
      allow write:  if isAdmin();
    }

    // ---------- activity_logs ----------
    match /activity_logs/{logId} {
      allow read:   if isAdmin() ||
                       (isSignedIn() && resource.data.userId == uid());
      allow create: if isSignedIn() && request.resource.data.userId == uid();
      allow update, delete: if false;          // immutable
    }
  }
}
```

> **Why update/delete on board_sessions is `false`**: claiming is an atomic transaction
> done in a Cloud Function. The function uses the Admin SDK and bypasses these rules.

---

## Step 4 — Cloud Storage rules

File: `storage.rules`

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    function role() { return request.auth.token.role; }

    // Teacher uploads — limited to their own folder, max 25 MB, only docs/images/PDFs
    match /files/{teacherId}/{fileId}/{filename} {
      allow read:   if request.auth != null;   // app-level filtering via Firestore
      allow create: if request.auth != null &&
                       request.auth.uid == teacherId &&
                       role() == 'teacher' &&
                       request.resource.size < 25 * 1024 * 1024 &&
                       request.resource.contentType.matches('image/.*|application/pdf|application/vnd\\..*|video/mp4|audio/mpeg|audio/mp3');
      allow delete: if request.auth != null &&
                       (request.auth.uid == teacherId || role() == 'admin');
    }

    // Smart-board snapshots — created by board users, claimed by teachers
    match /board_snapshots/{sessionId}.png {
      allow read:   if request.auth != null && (role() == 'teacher' || role() == 'admin' || role() == 'board');
      allow create: if request.auth != null && role() == 'board' &&
                       request.resource.size < 10 * 1024 * 1024 &&
                       request.resource.contentType == 'image/png';
      allow delete: if request.auth != null && role() == 'admin';
    }

    // Avatars
    match /avatars/{uid}.{ext} {
      allow read:   if request.auth != null;
      allow write:  if request.auth != null && request.auth.uid == uid &&
                       request.resource.size < 2 * 1024 * 1024 &&
                       request.resource.contentType.matches('image/.*');
    }
  }
}
```

---

## Step 5 — Cloud Functions

File: `functions/package.json`

```json
{
  "name": "smart-go-functions",
  "engines": { "node": "20" },
  "main": "index.js",
  "type": "commonjs",
  "dependencies": {
    "firebase-admin": "^12.1.0",
    "firebase-functions": "^5.0.0"
  }
}
```

File: `functions/index.js` — implement these three functions.

```js
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule }         = require('firebase-functions/v2/scheduler');
const { initializeApp }      = require('firebase-admin/app');
const { getAuth }            = require('firebase-admin/auth');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getStorage }         = require('firebase-admin/storage');

initializeApp();
const db = getFirestore();

/* =========================================================================
   setUserRole — admin-only, sets a user's role custom claim AND mirrors it
   into the users/{uid} document. Call this whenever a role changes.
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
  await db.doc(`users/${uid}`).set({
    role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

/* =========================================================================
   claimBoardSession — teacher-only. Atomically:
     1. Verifies session exists, not expired, not claimed
     2. Marks claimed
     3. Creates a files/{fileId} doc owned by the teacher
     4. Logs activity
   Returns the new fileId.
   ========================================================================= */
exports.claimBoardSession = onCall(async (request) => {
  if (request.auth?.token?.role !== 'teacher') {
    throw new HttpsError('permission-denied', 'Only teachers can claim sessions.');
  }
  const { sessionId, classroomId } = request.data;
  if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId required.');

  const teacherId = request.auth.uid;
  const sessionRef = db.doc(`board_sessions/${sessionId}`);
  const fileRef    = db.collection('files').doc();

  const downloadURL = await getDownloadURL(`board_snapshots/${sessionId}.png`);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(sessionRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Session not found.');
    const s = snap.data();
    if (s.claimed) throw new HttpsError('failed-precondition', 'Session already claimed.');
    if (s.expiresAt.toMillis() < Date.now()) {
      throw new HttpsError('deadline-exceeded', 'Session expired.');
    }

    tx.update(sessionRef, {
      claimed: true,
      claimedBy: teacherId,
      claimedAt: FieldValue.serverTimestamp()
    });

    tx.set(fileRef, {
      ownerId:     teacherId,
      title:       `Smart Board capture (${new Date().toLocaleString()})`,
      category:    'smartboard',
      storagePath: s.storagePath,
      downloadURL,
      mimeType:    'image/png',
      sizeBytes:   0,                 // optional: fill from storage metadata
      classroomId: classroomId || '',
      source:      'smartboard',
      createdAt:   FieldValue.serverTimestamp()
    });

    tx.set(db.collection('activity_logs').doc(), {
      userId: teacherId,
      userRole: 'teacher',
      action: 'claim_session',
      targetId: sessionId,
      metadata: { fileId: fileRef.id },
      timestamp: FieldValue.serverTimestamp()
    });
  });

  return { ok: true, fileId: fileRef.id, downloadURL };
});

async function getDownloadURL(path) {
  const file = getStorage().bucket().file(path);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-09-2491'   // far-future; or use Firebase Hosting public read
  });
  return url;
}

/* =========================================================================
   cleanupExpiredSessions — runs hourly, deletes board sessions older than
   1 hour (claimed or not) and their snapshot files. Keeps storage tidy.
   ========================================================================= */
exports.cleanupExpiredSessions = onSchedule('every 60 minutes', async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - 60 * 60 * 1000);
  const expired = await db.collection('board_sessions')
    .where('createdAt', '<', cutoff).limit(200).get();

  const batch = db.batch();
  const bucket = getStorage().bucket();
  for (const doc of expired.docs) {
    const { storagePath } = doc.data();
    if (storagePath) bucket.file(storagePath).delete().catch(() => {});
    batch.delete(doc.ref);
  }
  await batch.commit();
  console.log(`Cleaned up ${expired.size} expired board sessions.`);
});
```

---

## Step 6 — Frontend Firebase init

File: `public/shared/js/firebase-config.js`

```js
import { initializeApp }    from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth }          from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore }     from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getStorage }       from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';
import { getFunctions }     from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

// Replace with the user's actual config from the Firebase Console
const firebaseConfig = {
  apiKey:            "AIza...",
  authDomain:        "smart-go-xxxxx.firebaseapp.com",
  projectId:         "smart-go-xxxxx",
  storageBucket:     "smart-go-xxxxx.appspot.com",
  messagingSenderId: "...",
  appId:             "1:..."
};

const app = initializeApp(firebaseConfig);

export const auth      = getAuth(app);
export const db        = getFirestore(app);
export const storage   = getStorage(app);
export const functions = getFunctions(app);

export { app };
```

> **API keys in client code are normal for Firebase.** They identify the project and are
> not secrets — security comes from rules, not from hiding the key.

---

## Step 7 — Initial admin user

After first deploy, create the initial admin user manually:

1. Sign up via the login page with the desired admin email/password.
2. Run this from a privileged shell (or use the Firebase Console "Auth → Users → ⋮ → Set custom claims"):

```bash
# functions/scripts/bootstrap-admin.js
const admin = require('firebase-admin');
admin.initializeApp();
const uid = process.argv[2];
admin.auth().setCustomUserClaims(uid, { role: 'admin' })
  .then(() => admin.firestore().doc(`users/${uid}`).set({
    role: 'admin', frozen: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true }))
  .then(() => { console.log('Admin set.'); process.exit(0); });
```

```bash
node functions/scripts/bootstrap-admin.js <uid-from-firebase-auth>
```

The user must sign out and sign in again for the new claim to take effect on the client.

---

## Step 8 — Deploy

```bash
# First time: install function deps
cd functions && npm install && cd ..

# Deploy rules + functions first (so the app has a working backend)
firebase deploy --only firestore:rules,firestore:indexes,storage:rules,functions

# Then frontend
firebase deploy --only hosting
```

---

## Notes on scaling and cost

- **Reads dominate cost.** The admin user table can be large; always paginate with `limit(50)` + `startAfter`.
- **Real-time listeners** count as one read per document delivered. Unsubscribe (`unsub()`) when leaving a page.
- **Activity logs** grow forever. The `cleanupExpiredSessions` job is hourly; add a similar scheduled function to archive logs older than 6 months if needed.
- **Storage egress** is the silent killer for media-heavy apps. If file downloads grow heavy, put Cloudflare in front of the bucket.
