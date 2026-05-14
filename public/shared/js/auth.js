import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { auth, db, ADMIN_EMAILS } from './firebase-config.js';

function getBase() {
  const path = window.location.pathname;
  const knownDirs = ['/login/', '/admin/', '/teacher/', '/student/', '/board/'];
  for (const dir of knownDirs) {
    const idx = path.indexOf(dir);
    if (idx !== -1) return path.slice(0, idx);
  }
  return path.replace(/\/index\.html$/, '').replace(/\/$/, '');
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
          window.location.href = base + '/login/login.html';
          return;
        }
        const userData = userSnap.data();

        if (userData.role !== requiredRole) {
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
