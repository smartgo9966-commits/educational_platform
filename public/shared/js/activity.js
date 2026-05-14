import {
  collection, doc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db, auth } from './firebase-config.js';

export async function logActivity(action, targetId = null, metadata = null) {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const tokenResult = await user.getIdTokenResult();
    const ref = doc(collection(db, 'activity_logs'));
    await setDoc(ref, {
      userId:    user.uid,
      userRole:  tokenResult.claims.role || 'unknown',
      action,
      targetId:  targetId || null,
      metadata:  metadata || null,
      timestamp: serverTimestamp()
    });
  } catch {
    // Activity logging is best-effort — never block the main flow
  }
}
