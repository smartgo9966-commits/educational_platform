/**
 * set-role.js — assign a role to any user by email
 *
 * Usage:
 *   node set-role.js <email> <role>
 *
 * Roles: admin | teacher | student | board
 *
 * Example:
 *   node set-role.js teacher1@school.com teacher
 *   node set-role.js admin@school.com admin
 */

const admin = require('firebase-admin');
const path  = require('path');

// ---- Load service account key ----------------------------------------------
const keyPath = path.join(__dirname, 'service-account-key.json');
let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch {
  console.error('\n❌  Service account key not found.');
  console.error('    Download it from: Firebase Console → Project Settings → Service accounts → Generate new private key');
  console.error(`    Save it as: ${keyPath}\n`);
  process.exit(1);
}

// ---- Args -----------------------------------------------------------------
const [,, email, role] = process.argv;
const validRoles = ['admin', 'teacher', 'student', 'board'];

if (!email || !role) {
  console.error('\n❌  Usage: node set-role.js <email> <role>');
  console.error('    Roles: admin | teacher | student | board\n');
  process.exit(1);
}

if (!validRoles.includes(role)) {
  console.error(`\n❌  Invalid role "${role}". Must be one of: ${validRoles.join(', ')}\n`);
  process.exit(1);
}

// ---- Init Firebase Admin ---------------------------------------------------
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId:  serviceAccount.project_id,
});

const db   = admin.firestore();
const auth = admin.auth();

// ---- Set role --------------------------------------------------------------
async function run() {
  console.log(`\n🔍  Looking up user: ${email}`);

  // Find user by email
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    console.error(`\n❌  No Firebase Auth user found with email: ${email}`);
    console.error('    Create the user first in Firebase Console → Authentication → Add user\n');
    process.exit(1);
  }

  console.log(`✅  Found user: ${user.uid}`);

  // Upsert Firestore users document. Role lives in this doc (no custom claims).
  await db.doc(`users/${user.uid}`).set({
    email:        user.email,
    displayName:  user.displayName || user.email.split('@')[0],
    role,
    frozen:       false,
    classroomIds: [],
    createdAt:    admin.firestore.FieldValue.serverTimestamp(),
    updatedAt:    admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`✅  Firestore users/${user.uid} updated`);
  console.log(`\n🎉  Done! ${email} is now a "${role}".`);
  console.log('    Takes effect on the user\'s next page load.\n');

  process.exit(0);
}

run().catch((err) => {
  console.error('\n❌  Error:', err.message, '\n');
  process.exit(1);
});
