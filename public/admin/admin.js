import {
  collection, doc, getDoc, getDocs, getCountFromServer, setDoc,
  query, where, limit, onSnapshot,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { requireRole } from '../shared/js/auth.js';
import { signOut } from '../shared/js/auth.js';
import { db, FIREBASE_API_KEY } from '../shared/js/firebase-config.js';
import { toast, formatDateTime } from '../shared/js/ui.js';
import { logActivity } from '../shared/js/activity.js';
import { updateUser, freezeUser, deleteUser as dbDeleteUser } from '../shared/js/db.js';

// ---- Auth guard -----------------------------------------------------------
const currentUser = await requireRole('admin');

// Update header
document.getElementById('user-display-name').textContent =
  currentUser.displayName || currentUser.email || 'Admin';
document.getElementById('user-avatar').textContent =
  (currentUser.displayName || 'A')[0].toUpperCase();

// Sign out
document.getElementById('signout-btn').addEventListener('click', () => signOut());

// ---- State ----------------------------------------------------------------
const state = {
  currentTab: 'students',
  allRows: [],
  filteredRows: [],
  page: 1,
  pageSize: 10,
  searchTerm: '',
  selectedUser: null,
  classrooms: [],
  unsubActivity: null
};

// ---- Init -----------------------------------------------------------------
loadStats();
loadClassrooms().finally(() => loadUsers(state.currentTab));
loadActivityLog();

// ---- Stats ----------------------------------------------------------------
async function loadStats() {
  try {
    const [studentsSnap, teachersSnap, filesSnap, sessionsSnap] = await Promise.all([
      getCountFromServer(query(collection(db, 'users'), where('role', '==', 'student'))),
      getCountFromServer(query(collection(db, 'users'), where('role', '==', 'teacher'))),
      getCountFromServer(collection(db, 'files')),
      getCountFromServer(collection(db, 'board_sessions'))
    ]);
    document.getElementById('stat-students').textContent = fmtNumber(studentsSnap.data().count);
    document.getElementById('stat-teachers').textContent = fmtNumber(teachersSnap.data().count);
    document.getElementById('stat-files').textContent    = fmtNumber(filesSnap.data().count);
    document.getElementById('stat-sessions').textContent = fmtNumber(sessionsSnap.data().count);
  } catch {
    // Stats are informational — don't block the page on failure
  }
}

function fmtNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ---- Classrooms -----------------------------------------------------------
async function loadClassrooms() {
  try {
    const snap = await getDocs(collection(db, 'classrooms'));
    state.classrooms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    populateClassroomSelects();
  } catch {
    // Classrooms optional — continue without them
  }
}

function populateClassroomSelects() {
  const opts = state.classrooms.map(c =>
    `<option value="${c.id}">${c.name}</option>`
  ).join('');
  document.getElementById('new-classroom').innerHTML = '<option value="">None</option>' + opts;
  document.getElementById('edit-classroom').innerHTML = '<option value="">None</option>' + opts;
}

// ---- Users table ----------------------------------------------------------
async function loadUsers(role) {
  showTableLoading();
  try {
    const q = query(collection(db, 'users'), where('role', '==', role), limit(200));
    const snap = await getDocs(q);
    state.allRows = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds * 1000) ?? 0;
        const tb = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds * 1000) ?? 0;
        return tb - ta;
      });
    state.page = 1;
    applySearch();
  } catch (err) {
    document.getElementById('users-tbody').innerHTML =
      `<tr><td colspan="6" class="table-loading" style="color:var(--error-text)">Failed to load users.</td></tr>`;
  }
}

function applySearch() {
  const term = state.searchTerm.toLowerCase();
  state.filteredRows = term
    ? state.allRows.filter(u =>
        u.displayName?.toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term)
      )
    : state.allRows;
  renderTable();
}

function renderTable() {
  const tbody = document.getElementById('users-tbody');
  const total = state.filteredRows.length;
  const start = (state.page - 1) * state.pageSize;
  const pageRows = state.filteredRows.slice(start, start + state.pageSize);

  if (pageRows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">No users found.</td></tr>`;
    updatePagination(0, 0);
    return;
  }

  tbody.innerHTML = pageRows.map(u => {
    const classroomName = getClassroomName(u.classroomIds?.[0]);
    const frozen = u.frozen === true;
    const statusBadge = frozen
      ? `<span class="badge badge-warning">Frozen</span>`
      : `<span class="badge badge-success">Active</span>`;
    const freezeBtn = frozen
      ? `<button class="action-btn unfreeze" data-action="unfreeze" data-uid="${u.id}">Unfreeze</button>`
      : `<button class="action-btn freeze" data-action="freeze" data-uid="${u.id}">Freeze</button>`;
    return `<tr>
      <td><strong>${esc(u.displayName || '—')}</strong></td>
      <td>${esc(u.email || '—')}</td>
      <td>${esc(classroomName)}</td>
      <td style="text-transform:capitalize">${esc(u.role || '—')}</td>
      <td>${statusBadge}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn" data-action="view" data-uid="${u.id}">View</button>
          <button class="action-btn" data-action="edit" data-uid="${u.id}">Edit</button>
          ${freezeBtn}
          <button class="action-btn delete" data-action="delete" data-uid="${u.id}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  updatePagination(start + 1, Math.min(start + state.pageSize, total), total);
}

function updatePagination(from, to, total) {
  document.getElementById('pagination-info').textContent =
    total > 0 ? `Showing ${from} to ${to} of ${total.toLocaleString()} entries` : '';

  const totalPages = Math.ceil(state.filteredRows.length / state.pageSize);
  document.getElementById('prev-btn').disabled = state.page <= 1;
  document.getElementById('next-btn').disabled = state.page >= totalPages;

  const pn = document.getElementById('page-numbers');
  pn.innerHTML = buildPageNumbers(state.page, totalPages);
}

function buildPageNumbers(current, total) {
  if (total <= 1) return '';
  const pages = [];
  const add = (n) => {
    if (n < 1 || n > total) return;
    pages.push(`<button class="page-btn${n === current ? ' active' : ''}" data-page="${n}">${n}</button>`);
  };
  add(1);
  if (current > 3) pages.push(`<span class="page-ellipsis">…</span>`);
  if (current > 2) add(current - 1);
  if (current !== 1 && current !== total) add(current);
  if (current < total - 1) add(current + 1);
  if (current < total - 2) pages.push(`<span class="page-ellipsis">…</span>`);
  add(total);
  return [...new Set(pages)].join('');
}

function showTableLoading() {
  document.getElementById('users-tbody').innerHTML =
    `<tr><td colspan="6" class="table-loading">Loading…</td></tr>`;
}

function getClassroomName(id) {
  if (!id) return '—';
  return state.classrooms.find(c => c.id === id)?.name || id;
}

// ---- Tab switching --------------------------------------------------------
document.querySelectorAll('.tab-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.tab-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    state.currentTab = pill.dataset.tab;
    state.searchTerm = '';
    document.getElementById('search-input').value = '';
    loadUsers(state.currentTab === 'students' ? 'student' : 'teacher');
  });
});

// ---- Search ---------------------------------------------------------------
document.getElementById('search-input').addEventListener('input', (e) => {
  state.searchTerm = e.target.value;
  state.page = 1;
  applySearch();
});

// ---- Pagination controls --------------------------------------------------
document.getElementById('prev-btn').addEventListener('click', () => {
  if (state.page > 1) { state.page--; renderTable(); }
});
document.getElementById('next-btn').addEventListener('click', () => {
  const totalPages = Math.ceil(state.filteredRows.length / state.pageSize);
  if (state.page < totalPages) { state.page++; renderTable(); }
});
document.getElementById('page-numbers').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-page]');
  if (!btn) return;
  state.page = parseInt(btn.dataset.page, 10);
  renderTable();
});

// ---- Table row actions ----------------------------------------------------
document.getElementById('users-tbody').addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, uid } = btn.dataset;
  const user = state.allRows.find(u => u.id === uid);
  if (!user) return;

  if (action === 'view')     return openViewModal(user);
  if (action === 'edit')     return openEditModal(user);
  if (action === 'freeze')   return confirmAction(
    'Freeze account',
    `Freeze <strong>${esc(user.displayName || user.email)}</strong>? They won't be able to access the platform.`,
    async () => {
      await freezeUser(uid, true);
      await logActivity('freeze_user', uid);
      toast(`${user.displayName || user.email} frozen.`, 'warning');
      loadUsers(state.currentTab === 'students' ? 'student' : 'teacher');
    }
  );
  if (action === 'unfreeze') return confirmAction(
    'Unfreeze account',
    `Unfreeze <strong>${esc(user.displayName || user.email)}</strong>?`,
    async () => {
      await freezeUser(uid, false);
      await logActivity('unfreeze_user', uid);
      toast(`${user.displayName || user.email} unfrozen.`, 'success');
      loadUsers(state.currentTab === 'students' ? 'student' : 'teacher');
    }
  );
  if (action === 'delete') return confirmAction(
    'Delete user',
    `Permanently delete <strong>${esc(user.displayName || user.email)}</strong>? This cannot be undone.`,
    async () => {
      await dbDeleteUser(uid);
      await logActivity('delete_user', uid);
      toast(`User deleted.`, 'success');
      state.allRows = state.allRows.filter(u => u.id !== uid);
      applySearch();
    },
    true
  );
});

// ---- View modal -----------------------------------------------------------
async function openViewModal(user) {
  state.selectedUser = user;
  document.getElementById('view-user-name').textContent = user.displayName || user.email || 'User';
  const body = document.getElementById('view-user-body');
  body.innerHTML = `
    <div class="view-field"><div class="view-field-label">Email</div><div class="view-field-value">${esc(user.email || '—')}</div></div>
    <div class="view-field"><div class="view-field-label">Role</div><div class="view-field-value" style="text-transform:capitalize">${esc(user.role || '—')}</div></div>
    <div class="view-field"><div class="view-field-label">Classroom</div><div class="view-field-value">${esc(getClassroomName(user.classroomIds?.[0]))}</div></div>
    <div class="view-field"><div class="view-field-label">Status</div><div class="view-field-value">${user.frozen ? '<span class="badge badge-warning">Frozen</span>' : '<span class="badge badge-success">Active</span>'}</div></div>
    <div class="view-field"><div class="view-field-label">Created</div><div class="view-field-value">${formatDateTime(user.createdAt)}</div></div>
    <div class="view-field"><div class="view-field-label">UID</div><div class="view-field-value" style="font-family:var(--font-mono);font-size:var(--text-xs)">${esc(user.id)}</div></div>
  `;

  // Load recent activity
  const logsEl = document.getElementById('view-user-logs');
  logsEl.innerHTML = '<div class="table-loading">Loading activity…</div>';
  try {
    const q = query(
      collection(db, 'activity_logs'),
      where('userId', '==', user.id),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      logsEl.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm)">No activity yet.</p>';
    } else {
      logsEl.innerHTML = '<h4 style="margin-bottom:var(--space-3);font-size:var(--text-base)">Recent activity</h4>' +
        snap.docs.map(d => {
          const log = d.data();
          return `<div class="activity-item">
            <div class="activity-text">${esc(log.action)}</div>
            <div class="activity-time">${formatDateTime(log.timestamp)}</div>
          </div>`;
        }).join('');
    }
  } catch {
    logsEl.innerHTML = '<p style="color:var(--error-text);font-size:var(--text-sm)">Failed to load activity.</p>';
  }

  showModal('view-user-modal');
}

document.getElementById('view-user-close').addEventListener('click', () => hideModal('view-user-modal'));

// ---- Edit modal -----------------------------------------------------------
async function openEditModal(user) {
  state.selectedUser = user;
  document.getElementById('edit-name').value = user.displayName || '';
  document.getElementById('edit-email-display').value = user.email || '';
  document.getElementById('edit-role').value = user.role || 'student';
  document.getElementById('edit-classroom').value = user.classroomIds?.[0] || '';
  document.getElementById('edit-user-error').classList.add('hidden');
  showModal('edit-user-modal');
}

document.getElementById('edit-user-cancel').addEventListener('click', () => hideModal('edit-user-modal'));

document.getElementById('edit-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = state.selectedUser;
  if (!user) return;

  const newName      = document.getElementById('edit-name').value.trim();
  const newRole      = document.getElementById('edit-role').value;
  const newClassroom = document.getElementById('edit-classroom').value;
  const errEl        = document.getElementById('edit-user-error');

  if (!newName) { errEl.textContent = 'Name is required.'; errEl.classList.remove('hidden'); return; }

  const submitBtn = document.getElementById('edit-user-submit');
  submitBtn.disabled = true;
  errEl.classList.add('hidden');

  try {
    await updateUser(user.id, {
      ...(newRole !== user.role ? { role: newRole } : {}),
      displayName: newName,
      classroomIds: newClassroom ? [newClassroom] : [],
      updatedAt: serverTimestamp()
    });

    await logActivity('edit_user', user.id);
    toast('User updated.', 'success');
    hideModal('edit-user-modal');
    loadUsers(state.currentTab === 'students' ? 'student' : 'teacher');
  } catch (err) {
    errEl.textContent = err.message || 'Failed to update user.';
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Add user modal -------------------------------------------------------
document.getElementById('add-user-btn').addEventListener('click', () => {
  document.getElementById('add-user-form').reset();
  document.getElementById('add-user-error').classList.add('hidden');
  populateClassroomSelects();
  showModal('add-user-modal');
});

document.getElementById('add-user-cancel').addEventListener('click', () => hideModal('add-user-modal'));

document.getElementById('add-user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name      = document.getElementById('new-name').value.trim();
  const email     = document.getElementById('new-email').value.trim();
  const password  = document.getElementById('new-password').value;
  const role      = document.getElementById('new-role').value;
  const classroom = document.getElementById('new-classroom').value;
  const errEl     = document.getElementById('add-user-error');

  if (!name || !email || !password || !role) {
    errEl.textContent = 'All required fields must be filled.';
    errEl.classList.remove('hidden');
    return;
  }
  if (password.length < 8) {
    errEl.textContent = 'Password must be at least 8 characters.';
    errEl.classList.remove('hidden');
    return;
  }

  const submitBtn = document.getElementById('add-user-submit');
  submitBtn.disabled = true;
  errEl.classList.add('hidden');

  try {
    // Create Firebase Auth user via REST API (doesn't sign out the current admin)
    const uid = await createAuthUser(email, password, name);

    // Write the Firestore user doc with the assigned role
    await setDoc(doc(db, 'users', uid), {
      email,
      displayName:  name,
      role,
      frozen:       false,
      classroomIds: classroom ? [classroom] : [],
      createdAt:    serverTimestamp(),
      updatedAt:    serverTimestamp(),
    });

    toast(`User ${name} created successfully.`, 'success');
    await logActivity('create_user');
    hideModal('add-user-modal');
    loadUsers(state.currentTab === 'students' ? 'student' : 'teacher');
    loadStats();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create user.';
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

// ---- Activity log ---------------------------------------------------------
function loadActivityLog() {
  const q = query(
    collection(db, 'activity_logs'),
    orderBy('timestamp', 'desc'),
    limit(20)
  );
  state.unsubActivity = onSnapshot(q, (snap) => {
    const list = document.getElementById('activity-list');
    if (snap.empty) {
      list.innerHTML = '<p style="color:var(--text-tertiary);font-size:var(--text-sm)">No activity yet.</p>';
      return;
    }
    list.innerHTML = snap.docs.map(d => {
      const log = d.data();
      return `<div class="activity-item">
        <div class="activity-icon">${actionIcon(log.action)}</div>
        <div class="activity-text">${actionText(log)}</div>
        <div class="activity-time">${formatDateTime(log.timestamp)}</div>
      </div>`;
    }).join('');
  });
}

function actionIcon(action) {
  const icons = {
    login:           `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>`,
    logout:          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`,
    upload:          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,
    create_session:  `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 12h6M9 15h4"/></svg>`,
    claim_session:   `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
    freeze_user:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/></svg>`,
    delete_user:     `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>`,
  };
  return icons[action] || `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
}

function actionText(log) {
  const role = log.userRole ? `<span style="text-transform:capitalize">${esc(log.userRole)}</span>` : 'User';
  const labels = {
    login:          `${role} logged in`,
    logout:         `${role} logged out`,
    upload:         `${role} uploaded a file`,
    download:       `${role} downloaded a file`,
    scan_qr:        `${role} scanned a QR code`,
    freeze_user:    `Admin froze a user`,
    unfreeze_user:  `Admin unfroze a user`,
    delete_user:    `Admin deleted a user`,
    edit_user:      `Admin edited a user`,
    create_session: `Board created a session`,
    claim_session:  `Teacher claimed a board session`,
  };
  return labels[log.action] || esc(log.action);
}

// ---- Confirm modal helper -------------------------------------------------
function confirmAction(title, bodyHtml, onConfirm, isDanger = false) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').innerHTML = bodyHtml;
  const okBtn = document.getElementById('confirm-ok');
  okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  showModal('confirm-modal');

  const handler = async () => {
    okBtn.disabled = true;
    try { await onConfirm(); } catch (err) { toast(err.message || 'Action failed.', 'error'); }
    okBtn.disabled = false;
    hideModal('confirm-modal');
    okBtn.removeEventListener('click', handler);
  };
  okBtn.addEventListener('click', handler, { once: true });
}

document.getElementById('confirm-cancel').addEventListener('click', () => hideModal('confirm-modal'));

// ---- Modal helpers --------------------------------------------------------
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.classList.add('hidden');
  });
});

// ---- Sidebar navigation ---------------------------------------------------
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const section = item.dataset.section;
    if (section === 'students') {
      document.querySelector('[data-tab="students"]').click();
    } else if (section === 'teachers') {
      document.querySelector('[data-tab="teachers"]').click();
    }
  });
});

// ---- Create Firebase Auth user via REST API --------------------------------
// Uses the public API key — does NOT sign out the current admin session.
async function createAuthUser(email, password, displayName) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password, displayName, returnSecureToken: false })
    }
  );
  const data = await res.json();
  if (!res.ok) {
    const msgs = {
      EMAIL_EXISTS:    'An account with this email already exists.',
      WEAK_PASSWORD:   'Password is too weak (min 6 characters).',
      INVALID_EMAIL:   'Invalid email address.',
    };
    throw new Error(msgs[data.error?.message] || data.error?.message || 'Failed to create user');
  }
  return data.localId; // Firebase UID of the new user
}

// ---- Utilities ------------------------------------------------------------
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  state.unsubActivity?.();
});
