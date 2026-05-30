import {
  collection, doc, getDoc, getDocs, setDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, serverTimestamp,
  runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { requireRole, signOut } from '../shared/js/auth.js';
import { db } from '../shared/js/firebase-config.js';
import { uploadFile } from '../shared/js/storage.js';
import { toast, formatDateTime } from '../shared/js/ui.js';
import { logActivity } from '../shared/js/activity.js';

// ---- Auth guard -----------------------------------------------------------
const currentUser = await requireRole('teacher');

// ---- State ----------------------------------------------------------------
const appState = {
  files:             [],
  filter:            'all',
  searchTerm:        '',
  classrooms:        [],
  activeClassroomId: '',
  unsubFiles:        null,
  selectedFileId:    null,
  pendingFile:       null,
  pendingSession:    null
};

// ---- Header ---------------------------------------------------------------
const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
const userData = userSnap.data() || {};
document.getElementById('user-display-name').textContent = userData.displayName || currentUser.email || 'Teacher';
document.getElementById('user-avatar').textContent = (userData.displayName || 'T')[0].toUpperCase();

if (userData.classroomIds?.length) {
  // Classrooms now live in the users collection with role='classroom'.
  // (Old data path used a separate 'classrooms' collection.)
  const clSnap = await getDoc(doc(db, 'users', userData.classroomIds[0]));
  if (clSnap.exists()) {
    document.getElementById('user-classroom').textContent = clSnap.data().displayName || '—';
    appState.activeClassroomId = userData.classroomIds[0];
  }
}

document.getElementById('signout-btn').addEventListener('click', () => signOut());

// ---- Load classrooms for upload form -------------------------------------
// Classrooms live in the users collection with role='classroom' (admin
// manages them from the Classrooms tab).
async function loadClassrooms() {
  try {
    const q = query(collection(db, 'users'), where('role', '==', 'classroom'), limit(200));
    const snap = await getDocs(q);
    appState.classrooms = snap.docs.map(d => ({
      id:   d.id,
      name: d.data().displayName || d.id,
    }));
    const opts = appState.classrooms.map(c =>
      `<option value="${esc(c.id)}"${c.id === appState.activeClassroomId ? ' selected' : ''}>${esc(c.name)}</option>`
    ).join('');

    // Upload form — classroom is optional ("None").
    document.getElementById('upload-classroom').innerHTML = '<option value="">None</option>' + opts;

    // Smart Board capture form — classroom is required (placeholder leads).
    document.getElementById('smartboard-classroom').innerHTML =
      '<option value="">Select classroom…</option>' + opts;
  } catch (err) {
    console.warn('loadClassrooms failed:', err);
  }
}
loadClassrooms();

// ---- Real-time file subscription -----------------------------------------
function subscribeFiles() {
  const q = query(
    collection(db, 'files'),
    where('ownerId', '==', currentUser.uid),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  appState.unsubFiles = onSnapshot(
    q,
    (snap) => {
      appState.files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderFiles();
    },
    (err) => {
      // Without this handler, a denied query (rules / missing index) would
      // fail silently and the grid would stay empty forever.
      console.error('files subscription failed:', err);
      document.getElementById('files-loading')?.classList.add('hidden');
      const grid = document.getElementById('files-grid');
      if (grid) {
        grid.innerHTML = `<div style="grid-column:1/-1;padding:var(--space-6);color:var(--error-text);text-align:center">
          Couldn't load your files: ${esc(err.code || err.message || 'unknown error')}.
          Check the browser console.
        </div>`;
      }
      toast(`Files load failed: ${err.code || err.message}`, 'error');
    }
  );
}
subscribeFiles();
window.addEventListener('beforeunload', () => appState.unsubFiles?.());

// ---- Render files ---------------------------------------------------------
function renderFiles() {
  const grid    = document.getElementById('files-grid');
  const emptyEl = document.getElementById('empty-state');
  const loadEl  = document.getElementById('files-loading');

  loadEl.classList.add('hidden');

  let filtered = appState.files;
  if (appState.filter !== 'all') {
    filtered = filtered.filter(f => f.category === appState.filter);
  }
  if (appState.searchTerm) {
    const t = appState.searchTerm.toLowerCase();
    filtered = filtered.filter(f => f.title?.toLowerCase().includes(t));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  grid.innerHTML = filtered.map(fileCard).join('');
}

function fileCard(f) {
  const cat   = f.category || 'other';
  const thumb = f.mimeType?.startsWith('image/') && f.downloadURL
    ? `<img src="${esc(f.downloadURL)}" alt="${esc(f.title)}" loading="lazy">`
    : `<div class="file-thumb-icon">${catIcon(cat)}</div>`;

  return `<div class="file-card" data-id="${esc(f.id)}" data-url="${esc(f.downloadURL || '')}" role="button" tabindex="0" aria-label="Open ${esc(f.title || 'file')} in a new tab" style="cursor:pointer">
    <div class="file-thumb">
      ${thumb}
      <div class="file-cat-badge">${catBadgeIcon(cat)}${catLabel(cat)}</div>
    </div>
    <div class="file-card-body">
      <div class="file-card-title" title="${esc(f.title)}">${esc(f.title || 'Untitled')}</div>
      <div class="file-card-date">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        ${formatDateTime(f.createdAt)}
      </div>
    </div>
    <div class="file-card-actions">
      <button class="file-download-btn" data-action="download" data-url="${esc(f.downloadURL)}" data-name="${esc(f.title)}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Download
      </button>
      <button class="file-delete-btn" data-action="delete" data-id="${esc(f.id)}" aria-label="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  </div>`;
}

// ---- File grid delegation ------------------------------------------------
document.getElementById('files-grid').addEventListener('click', (e) => {
  // Action buttons (Download / Delete) take precedence — handle them first.
  const btn = e.target.closest('[data-action]');
  if (btn) {
    if (btn.dataset.action === 'download') {
      const a = document.createElement('a');
      a.href = btn.dataset.url; a.download = btn.dataset.name || 'file';
      a.target = '_blank'; a.rel = 'noopener'; a.click();
      logActivity('download', btn.dataset.url);
    }
    if (btn.dataset.action === 'delete') {
      appState.selectedFileId = btn.dataset.id;
      showModal('delete-modal');
    }
    return;
  }
  // Card body click → open the file in a new tab.
  const card = e.target.closest('.file-card');
  if (!card || !card.dataset.url) return;
  window.open(card.dataset.url, '_blank', 'noopener');
  logActivity('open_file', card.dataset.id);
});

// Keyboard accessibility: Enter / Space on a focused card opens the file.
document.getElementById('files-grid').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  if (e.target.closest('[data-action]')) return;
  const card = e.target.closest('.file-card');
  if (!card || !card.dataset.url) return;
  e.preventDefault();
  window.open(card.dataset.url, '_blank', 'noopener');
  logActivity('open_file', card.dataset.id);
});

// ---- Delete confirm -------------------------------------------------------
document.getElementById('delete-cancel').addEventListener('click',  () => hideModal('delete-modal'));
document.getElementById('delete-confirm').addEventListener('click', async () => {
  const id = appState.selectedFileId;
  if (!id) return;
  try {
    await deleteDoc(doc(db, 'files', id));
    await logActivity('delete_file', id);
    toast('File deleted.', 'success');
  } catch {
    toast('Failed to delete file.', 'error');
  }
  hideModal('delete-modal');
});

// ---- Filter pills ---------------------------------------------------------
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    appState.filter = pill.dataset.cat;
    renderFiles();
  });
});

// ---- Search ---------------------------------------------------------------
document.getElementById('search-input').addEventListener('input', (e) => {
  appState.searchTerm = e.target.value.trim();
  renderFiles();
});

// ---- Upload modal ---------------------------------------------------------
document.getElementById('upload-btn').addEventListener('click', () => {
  document.getElementById('upload-form').reset();
  document.getElementById('upload-error').classList.add('hidden');
  document.getElementById('selected-file').classList.add('hidden');
  document.getElementById('upload-progress').classList.add('hidden');
  document.getElementById('upload-submit').disabled = true;
  appState.pendingFile = null;
  showModal('upload-modal');
});
document.getElementById('upload-cancel').addEventListener('click', () => hideModal('upload-modal'));

// Drag-drop zone
const zone = document.getElementById('upload-zone');
zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
zone.addEventListener('dragleave', ()  => zone.classList.remove('drag-over'));
zone.addEventListener('drop', (e) => {
  e.preventDefault();
  zone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) selectFile(file);
});
document.getElementById('file-input').addEventListener('change', (e) => {
  if (e.target.files[0]) selectFile(e.target.files[0]);
});

function selectFile(file) {
  if (file.size > 25 * 1024 * 1024) { toast('File exceeds 25 MB limit.', 'error'); return; }
  appState.pendingFile = file;
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('selected-file-size').textContent = fmtBytes(file.size);
  document.getElementById('selected-file').classList.remove('hidden');
  document.getElementById('upload-submit').disabled = false;
  if (!document.getElementById('upload-title').value) {
    document.getElementById('upload-title').value = file.name.replace(/\.[^.]+$/, '');
  }
}

document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const file        = appState.pendingFile;
  const title       = document.getElementById('upload-title').value.trim();
  const category    = document.getElementById('upload-category').value;
  const classroomId = document.getElementById('upload-classroom').value;

  if (!file)     { showUploadError('Please select a file.'); return; }
  if (!title)    { showUploadError('Title is required.'); return; }
  if (!category) { showUploadError('Please select a category.'); return; }

  const submitBtn = document.getElementById('upload-submit');
  submitBtn.disabled = true;
  document.getElementById('upload-error').classList.add('hidden');
  document.getElementById('upload-progress').classList.remove('hidden');

  try {
    // Upload to Cloudinary
    const { downloadURL } = await uploadFile(file, {
      onProgress: (pct) => {
        document.getElementById('progress-fill').style.width  = pct + '%';
        document.getElementById('progress-label').textContent = `Uploading… ${pct}%`;
      }
    });

    // Save metadata to Firestore
    const fileId = doc(collection(db, 'files')).id;
    await setDoc(doc(db, 'files', fileId), {
      ownerId:     currentUser.uid,
      title,
      category,
      storagePath: '',
      downloadURL,
      mimeType:    file.type,
      sizeBytes:   file.size,
      classroomId: classroomId || '',
      source:      'upload',
      createdAt:   serverTimestamp()
    });

    await logActivity('upload', fileId);
    toast('File uploaded successfully.', 'success');
    hideModal('upload-modal');
  } catch (err) {
    showUploadError(err.message || 'Upload failed. Please try again.');
    submitBtn.disabled = false;
  }
});

function showUploadError(msg) {
  const el = document.getElementById('upload-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---- QR Scanner -----------------------------------------------------------
let scanner = null;

document.getElementById('scan-btn').addEventListener('click', async () => {
  document.getElementById('scan-status').textContent = 'Starting camera…';
  showModal('scanner-modal');
  scanner = new Html5Qrcode('qr-reader');
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      onQRScanned,
      () => {}
    );
    document.getElementById('scan-status').textContent = 'Point your camera at the QR code.';
  } catch (err) {
    document.getElementById('scan-status').textContent = `Camera error: ${err.message || err}`;
  }
});

document.getElementById('scanner-close').addEventListener('click', closeScanner);

async function closeScanner() {
  hideModal('scanner-modal');
  if (scanner) {
    try { await scanner.stop(); await scanner.clear(); }
    catch (err) { console.warn('Scanner cleanup failed:', err); }
    scanner = null;
  }
}

async function onQRScanned(sessionId) {
  await closeScanner();
  try {
    // Phase 1 — read & validate the session, then show the review form.
    // The actual claim + file creation happens on Save (#smartboard-form).
    const snap = await getDoc(doc(db, 'board_sessions', sessionId));
    if (!snap.exists()) { toast('Invalid QR code.', 'error'); return; }
    const s = snap.data();
    if (s.claimed) { toast('That QR was already claimed.', 'error'); return; }
    const expiresMs = s.expiresAt?.toMillis?.() ?? 0;
    if (expiresMs < Date.now()) { toast('QR expired — generate a new one.', 'error'); return; }

    appState.pendingSession = {
      sessionId,
      downloadURL: s.downloadURL || '',
      storagePath: s.storagePath || ''
    };

    // Preview + editable defaults.
    const preview = document.getElementById('smartboard-preview');
    preview.src = s.downloadURL || '';
    preview.style.display = s.downloadURL ? '' : 'none';
    document.getElementById('smartboard-title').value = `Smart Board — ${new Date().toLocaleString()}`;
    document.getElementById('smartboard-classroom').value = appState.activeClassroomId || '';
    document.getElementById('smartboard-error').classList.add('hidden');
    // Required classroom: Save stays disabled until one is chosen.
    document.getElementById('smartboard-submit').disabled = !appState.activeClassroomId;

    showModal('smartboard-modal');
  } catch (err) {
    console.error('QR read failed:', err);
    toast(`Couldn't read that QR: ${err.code || err.message}`, 'error');
  }
}

// Manual QR entry
document.getElementById('manual-submit').addEventListener('click', () => {
  const code = document.getElementById('manual-code').value.trim();
  if (code) onQRScanned(code);
});

// ---- Smart Board capture — name + class, then claim & save ----------------
document.getElementById('smartboard-classroom').addEventListener('change', (e) => {
  document.getElementById('smartboard-submit').disabled = !e.target.value;
});

document.getElementById('smartboard-cancel').addEventListener('click', () => {
  hideModal('smartboard-modal');
  appState.pendingSession = null;   // leave the session unclaimed so it can be scanned again
});

document.getElementById('smartboard-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const session = appState.pendingSession;
  if (!session) { hideModal('smartboard-modal'); return; }

  const title       = document.getElementById('smartboard-title').value.trim();
  const classroomId = document.getElementById('smartboard-classroom').value;
  if (!title)       { showSmartboardError('Title is required.'); return; }
  if (!classroomId) { showSmartboardError('Please choose a classroom.'); return; }

  const submitBtn = document.getElementById('smartboard-submit');
  submitBtn.disabled = true;
  document.getElementById('smartboard-error').classList.add('hidden');

  const sessionRef = doc(db, 'board_sessions', session.sessionId);
  const fileRef    = doc(collection(db, 'files'));

  try {
    // Phase 2 — claim atomically and create the file with the chosen title/class.
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists()) throw Object.assign(new Error('Session not found.'), { code: 'not-found' });
      const s = snap.data();
      if (s.claimed) throw Object.assign(new Error('Already claimed.'), { code: 'already-claimed' });
      const expiresMs = s.expiresAt?.toMillis?.() ?? 0;
      if (expiresMs < Date.now()) throw Object.assign(new Error('Expired.'), { code: 'expired' });

      tx.update(sessionRef, {
        claimed:   true,
        claimedBy: currentUser.uid,
        claimedAt: serverTimestamp()
      });

      tx.set(fileRef, {
        ownerId:     currentUser.uid,
        title,
        category:    'smartboard',
        storagePath: s.storagePath || '',
        downloadURL: s.downloadURL  || '',
        mimeType:    'image/png',
        sizeBytes:   0,
        classroomId,
        source:      'smartboard',
        createdAt:   serverTimestamp()
      });
    });

    await logActivity('scan_qr', session.sessionId);
    appState.pendingSession = null;
    hideModal('smartboard-modal');
    toast('Smart Board capture saved to your library!', 'success');
  } catch (err) {
    submitBtn.disabled = false;   // let them retry / pick a different class
    if (err.code === 'already-claimed') showSmartboardError('That QR was already claimed on another device.');
    else if (err.code === 'expired')    showSmartboardError('This QR expired — generate a new one on the board.');
    else if (err.code === 'not-found')  showSmartboardError('This session no longer exists.');
    else showSmartboardError(err.message || 'Could not save. Please try again.');
  }
});

function showSmartboardError(msg) {
  const el = document.getElementById('smartboard-error');
  el.textContent = msg;
  el.classList.remove('hidden');
}

// ---- Modal helpers --------------------------------------------------------
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      backdrop.classList.add('hidden');
      if (backdrop.id === 'scanner-modal') closeScanner();
    }
  });
});

// ---- Category helpers -----------------------------------------------------
function catLabel(cat) {
  return { lesson: 'Lesson', assignment: 'Assignment', note: 'Note', smartboard: 'Smart Board', other: 'Other' }[cat] || cat;
}

function catBadgeIcon(cat) {
  const icons = {
    lesson:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    assignment: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    note:       `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    smartboard: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    other:      `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`
  };
  return icons[cat] || icons.other;
}

function catIcon(cat) {
  const s = 48;
  const icons = {
    lesson:     `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    assignment: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    note:       `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    smartboard: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    other:      `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>`
  };
  return icons[cat] || icons.other;
}

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / (1024 * 1024)).toFixed(1) + ' MB';
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
