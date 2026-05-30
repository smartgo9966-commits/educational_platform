import {
  doc, updateDoc, deleteDoc
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// ---- Users ----------------------------------------------------------------
// Only the admin dashboard mutates user docs through here. Read/query paths
// live inline in each page (admin.js, teacher.js, student.js), close to the
// UI state they feed.

export async function updateUser(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}

export async function freezeUser(uid, frozen) {
  await updateDoc(doc(db, 'users', uid), { frozen });
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}
