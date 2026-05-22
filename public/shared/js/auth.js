import {
  signInWithEmailAndPassword,
  signInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { auth, db, ADMIN_EMAILS } from './firebase-config.js';
import { getBase } from './router.js';

// Dev bypass: when the site is opened on localhost / 127.0.0.1 / file://,
// pages return a fake user instead of redirecting to login. Production
// origins are never affected.
function isLocalHost() {
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '' || h === '::1';
}
// Sign in anonymously so Firestore reads have a valid request.auth, then
// wrap the anonymous user with a fake displayName/email for the requested role.
// Role-gated Firestore reads will still be denied by rules (expected — this is
// just so pages can render their UI without throwing on init).
async function makeDevUser(role) {
  let user = auth.currentUser;
  if (!user) {
    try {
      const cred = await signInAnonymously(auth);
      user = cred.user;
    } catch {
      // Anonymous auth disabled — fall back to a fully fake user. Most
      // Firestore reads will fail, but requireRole itself will resolve.
      return {
        uid: 'dev-' + role,
        email: 'dev-' + role + '@local',
        displayName: 'Dev ' + role.charAt(0).toUpperCase() + role.slice(1),
        dev: true
      };
    }
  }
  return {
    uid: user.uid,
    email: user.email || 'dev-' + role + '@local',
    displayName: 'Dev ' + role.charAt(0).toUpperCase() + role.slice(1),
    dev: true,
    _firebaseUser: user
  };
}

export async function signIn(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOut() {
  await firebaseSignOut(auth);
  window.location.href = getBase() + '/login/login.html';
}

export function getCurrentUser() {
  return auth.currentUser;
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function requireRole(requiredRole) {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      const base = getBase();
      if (!user) {
        if (isLocalHost()) { resolve(await makeDevUser(requiredRole)); return; }
        window.location.href = base + '/login/login.html';
        return;
      }
      try {
        // Hardcoded admin emails bypass — no Firestore doc needed
        if (requiredRole === 'admin' && ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
          resolve(user);
          return;
        }

        // Read role from Firestore (no JWT custom claim required)
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (!userSnap.exists()) {
          if (isLocalHost()) { resolve(await makeDevUser(requiredRole)); return; }
          window.location.href = base + '/login/login.html';
          return;
        }
        const userData = userSnap.data();

        if (userData.role !== requiredRole) {
          if (isLocalHost()) { resolve(await makeDevUser(requiredRole)); return; }
          window.location.href = base + '/login/login.html';
          return;
        }
        if (userData.frozen === true) {
          await firebaseSignOut(auth);
          window.location.href = base + '/login/login.html?error=frozen';
          return;
        }
        resolve(user);
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function getUserRole(user) {
  if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) return 'admin';
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? (snap.data().role || null) : null;
}
