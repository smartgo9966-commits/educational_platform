import {
  collection, doc, getDoc,
  query, where, orderBy, limit, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { requireRole, signOut } from '../shared/js/auth.js';
import { db } from '../shared/js/firebase-config.js';
import { logActivity } from '../shared/js/activity.js';

// ---- Auth guard -----------------------------------------------------------
const currentUser = await requireRole('student');

// ---- State ----------------------------------------------------------------
const state = {
  files:       [],
  filter:      'all',
  searchTerm:  '',
  unsub:       null,
  teacherNames: {}  // uid → displayName cache
};

// ---- Header setup --------------------------------------------------------
const userSnap = await getDoc(doc(db, 'users', currentUser.uid));
const userData = userSnap.data() || {};
const displayName = userData.displayName || currentUser.email || 'Student';

document.getElementById('user-display-name').textContent = displayName;
document.getElementById('user-avatar').textContent = displayName[0].toUpperCase();
document.getElementById('greeting-name').textContent = displayName;

document.getElementById('signout-btn').addEventListener('click', () => signOut());

await logActivity('login');

// ---- Classroom check + subscribe -----------------------------------------
const classroomIds = userData.classroomIds || [];

if (classroomIds.length === 0) {
  document.getElementById('files-loading').classList.add('hidden');
  showEmpty('You are not assigned to any classroom yet. Ask your admin.');
} else {
  subscribeFiles(classroomIds);
}

function subscribeFiles(ids) {
  // Firestore 'in' supports up to 30 values
  const safeIds = ids.slice(0, 30);
  const q = query(
    collection(db, 'files'),
    where('classroomId', 'in', safeIds),
    orderBy('createdAt', 'desc'),
    limit(200)
  );
  state.unsub = onSnapshot(
    q,
    async (snap) => {
      state.files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      await prefetchTeacherNames(state.files);
      renderFiles();
    },
    (err) => {
      console.error('student files subscription failed:', err);
      document.getElementById('files-loading')?.classList.add('hidden');
      showEmpty(`Couldn't load files: ${err.code || err.message || 'unknown error'}. Check the browser console.`);
    }
  );
}

window.addEventListener('beforeunload', () => state.unsub?.());

// ---- Prefetch teacher display names (cached) ----------------------------
async function prefetchTeacherNames(files) {
  const unknownIds = [...new Set(files.map(f => f.ownerId).filter(id => id && !state.teacherNames[id]))];
  await Promise.all(unknownIds.map(async (uid) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      state.teacherNames[uid] = snap.exists()
        ? (snap.data().displayName || snap.data().email || uid)
        : uid;
    } catch {
      state.teacherNames[uid] = '—';
    }
  }));
}

// ---- Render files --------------------------------------------------------
function renderFiles() {
  const grid = document.getElementById('files-grid');
  document.getElementById('files-loading').classList.add('hidden');

  let filtered = state.files;

  if (state.filter !== 'all') {
    if (state.filter === 'other') {
      // "Other" bucket: captures anything that isn't a named category
      filtered = filtered.filter(f => !['assignment','lesson','note'].includes(f.category));
    } else {
      filtered = filtered.filter(f => f.category === state.filter);
    }
  }

  if (state.searchTerm) {
    const t = state.searchTerm.toLowerCase();
    filtered = filtered.filter(f => f.title?.toLowerCase().includes(t));
  }

  if (filtered.length === 0) {
    grid.innerHTML = '';
    const msg = state.filter !== 'all'
      ? `Your teacher hasn't uploaded anything in this category yet.`
      : `No learning materials available yet.`;
    showEmpty(msg);
    return;
  }

  hideEmpty();
  grid.innerHTML = filtered.map(fileCard).join('');
}

function fileCard(f) {
  const cat          = f.category || 'other';
  const teacherName  = state.teacherNames[f.ownerId] || '—';
  const isImage      = f.mimeType?.startsWith('image/') && f.downloadURL;
  const thumb        = isImage
    ? `<img src="${esc(f.downloadURL)}" alt="${esc(f.title)}" loading="lazy">`
    : `<div class="file-thumb-icon">${thumbIcon(cat, f.mimeType)}</div>`;

  return `<div class="file-card" data-url="${esc(f.downloadURL || '')}" data-id="${esc(f.id)}" role="button" tabindex="0" aria-label="Open ${esc(f.title)}">
    <div class="file-thumb">${thumb}</div>
    <div class="file-card-body">
      <span class="file-cat-badge">${catLabel(cat)}</span>
      <div class="file-card-title">${esc(f.title || 'Untitled')}</div>
      <div class="file-card-by">by <strong>${esc(teacherName)}</strong></div>
    </div>
  </div>`;
}

// ---- File card click → open / download ----------------------------------
document.getElementById('files-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.file-card');
  if (!card || !card.dataset.url) return;
  logActivity('download', card.dataset.id);
  window.open(card.dataset.url, '_blank', 'noopener');
});

document.getElementById('files-grid').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    const card = e.target.closest('.file-card');
    if (card?.dataset.url) {
      e.preventDefault();
      logActivity('download', card.dataset.id);
      window.open(card.dataset.url, '_blank', 'noopener');
    }
  }
});

// ---- Filter pills --------------------------------------------------------
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.filter = pill.dataset.cat;
    renderFiles();
  });
});

// ---- Search toggle -------------------------------------------------------
const searchBar   = document.getElementById('search-bar');
const searchInput = document.getElementById('search-input');

document.getElementById('search-toggle').addEventListener('click', () => {
  const isHidden = searchBar.classList.toggle('hidden');
  if (!isHidden) searchInput.focus();
  else { state.searchTerm = ''; searchInput.value = ''; renderFiles(); }
});

document.getElementById('search-close').addEventListener('click', () => {
  searchBar.classList.add('hidden');
  state.searchTerm = '';
  searchInput.value = '';
  renderFiles();
});

searchInput.addEventListener('input', (e) => {
  state.searchTerm = e.target.value.trim();
  renderFiles();
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.getElementById('search-close').click();
});

// ---- Helpers -------------------------------------------------------------
function showEmpty(msg) {
  document.getElementById('empty-msg').textContent = msg;
  document.getElementById('empty-state').classList.remove('hidden');
}
function hideEmpty() {
  document.getElementById('empty-state').classList.add('hidden');
}

function catLabel(cat) {
  return {
    assignment: 'Assignment',
    lesson:     'Lesson',
    note:       'Notes',
    smartboard: 'Smart Board',
    other:      'Other'
  }[cat] || 'Other';
}

function thumbIcon(cat, mime) {
  if (mime === 'application/pdf') {
    return `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="11" y2="17"/></svg>`;
  }
  const icons = {
    assignment: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>`,
    lesson:     `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    note:       `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
    smartboard: `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
  };
  return icons[cat] || `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
