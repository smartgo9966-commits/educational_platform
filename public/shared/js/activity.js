import {
  collection, doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db, auth, ADMIN_EMAILS } from './firebase-config.js';

// Per-session cache so we don't hit Firestore on every action.
const userCache = new Map(); // uid -> { role, name }

async function resolveUser(user) {
  if (!user) return { role: 'unknown', name: 'Someone' };
  if (userCache.has(user.uid)) return userCache.get(user.uid);

  let role = 'unknown';
  let name = user.displayName || null;

  const email = user.email?.toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) {
    role = 'admin';
  }

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data.role)                role = data.role;
      if (data.displayName)         name = data.displayName;
      else if (data.email && !name) name = data.email;
    }
  } catch {
    // Read may be denied for anonymous/dev users — fall through to fallbacks.
  }

  if (!name) name = user.email || 'Someone';

  const result = { role, name };
  userCache.set(user.uid, result);
  return result;
}

export async function logActivity(action, targetId = null, metadata = null) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const { role, name } = await resolveUser(user);
    const ref = doc(collection(db, 'activity_logs'));
    await setDoc(ref, {
      userId:    user.uid,
      userName:  name,
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
