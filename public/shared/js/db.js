import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, startAfter
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { db } from './firebase-config.js';

// ---- Users ----------------------------------------------------------------

export async function listUsers(role = null, cursor = null, pageSize = 50) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (role) constraints.unshift(where('role', '==', role));
  if (cursor) constraints.push(startAfter(cursor));
  const q = query(collection(db, 'users'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data(), _snap: d }));
}

export async function getUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function updateUser(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}

export async function freezeUser(uid, frozen) {
  await updateDoc(doc(db, 'users', uid), { frozen });
}

export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

// ---- Files ----------------------------------------------------------------

export async function listFiles(filter = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(100)];
  if (filter.ownerId)    constraints.unshift(where('ownerId',    '==', filter.ownerId));
  if (filter.classroomId) constraints.unshift(where('classroomId', '==', filter.classroomId));
  if (filter.category)   constraints.unshift(where('category',   '==', filter.category));
  const q = query(collection(db, 'files'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createFile(meta) {
  const ref = doc(collection(db, 'files'));
  await setDoc(ref, meta);
  return ref.id;
}

export async function deleteFile(fileId) {
  await deleteDoc(doc(db, 'files', fileId));
}

// ---- Activity logs --------------------------------------------------------

export async function listActivityLogs(userId = null, pageSize = 50) {
  const constraints = [orderBy('timestamp', 'desc'), limit(pageSize)];
  if (userId) constraints.unshift(where('userId', '==', userId));
  const q = query(collection(db, 'activity_logs'), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ---- Classrooms -----------------------------------------------------------

export async function listClassrooms() {
  const snap = await getDocs(collection(db, 'classrooms'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
