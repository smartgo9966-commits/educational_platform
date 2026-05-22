import {
  collection, doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db, auth, ADMIN_EMAILS } from './firebase-config.js';

// Per-session role cache so we don't hit Firestore on every action.
const roleCache = new Map(); // uid → role

async function resolveRole(user) {
  if (!user) return 'unknown';
  if (roleCache.has(user.uid)) return roleCache.get(user.uid);

  let role = 'unknown';
  const email = user.email?.toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) {
    role = 'admin';
  } else {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists() && snap.data().role) role = snap.data().role;
    } catch {
      // Read may be denied for anonymous/dev users — leave as 'unknown'.
    }
  }
  roleCache.set(user.uid, role);
  return role;
}

export async function logActivity(action, targetId = null, metadata = null) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const role = await resolveRole(user);
    const ref  = doc(collection(db, 'activity_logs'));
    await setDoc(ref, {
      userId:    user.uid,
      userRole:  role,
      action,
      targetId:  targetId || null,
      metadata:  metadata || null,
      timestamp: serverTimestamp()
    });
  } catch {
    // Activity logging is best-effort — never block the main flow
  }
}
