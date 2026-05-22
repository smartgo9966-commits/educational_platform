import {
  collection, doc, getDocs, getCountFromServer, setDoc,
  query, where, orderBy, limit, onSnapshot,
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
// Ensure all modals are hidden (safety guard against animation glitch)
document.querySelectorAll('.modal-backdrop').forEach(el => el.classList.add('hidden'));
loadStats();
loadClassrooms().finally(() => loadUsers(roleForTab(state.currentTab)));
loadActivityLog();

// Tab name ('students'/'teachers') maps to Firestore role ('student'/'teacher').
function roleForTab(tab) {
  return tab === 'teachers' ? 'teacher' : 'student';
}

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
  } catch (err) {
    console.warn('loadStats failed:', err);
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

// Show the Classroom field only when the selected role is 'student'.
function syncClassroomVisibility(roleSelectId, groupId, classroomSelectId) {
  const role  = document.getElementById(roleSelectId).value;
  const group = document.getElementById(groupId);
  const show  = role === 'student';
  group.classList.toggle('hidden', !show);
  if (!show) document.getElementById(classroomSelectId).value = '';
}

// 'classroom' role is a Firestore-only entry (no Firebase Auth user), so the
// email + password fields make no sense for it. Hide them and skip the
// `required` attribute so the form can submit.
function syncAuthFieldsVisibility() {
  const role     = document.getElementById('new-role').value;
  const isAuth   = role && role !== 'classroom';
  const emailEl  = document.getElementById('new-email');
  const passEl   = document.getElementById('new-password');
  document.getElementById('new-email-group').classList.toggle('hidden', !isAuth);
  document.getElementById('new-password-group').classList.toggle('hidden', !isAuth);
  if (!isAuth) { emailEl.value = ''; passEl.value = ''; }
}

document.getElementById('new-role').addEventListener('change', () => {
  syncClassroomVisibility('new-role', 'classroom-group', 'new-classroom');
  syncAuthFieldsVisibility();
});
document.getElementById('edit-role').addEventListener('change', () => {
  syncClassroomVisibility('edit-role', 'edit-classroom-group', 'edit-classroom');
});

// ---- Users table ----------------------------------------------------------
async function loadUsers(role) {
  showTableLoading();
  try {
    const q = query(collection(db, 'users'), where('role', '==', role), limit(200));
    const snap = await getDocs(q);
    state.allRows = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() ?? ((a.createdAt?.seconds ?? 0) * 1000);
        const tb = b.createdAt?.toMillis?.() ?? ((b.createdAt?.seconds ?? 0) * 1000);
        return tb - ta;
      });
    state.page = 1;
    applySearch();
  } catch (err) {
    const msg = err?.code || err?.message || String(err);
    document.getElementById('users-tbody').innerHTML =
      `<tr><td colspan="6" class="table-loading" style="color:var(--error-text)">Error: ${msg}</td></tr>`;
    console.error('loadUsers failed:', err);
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
    loadUsers(roleForTab(state.currentTab));
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
      loadUsers(roleForTab(state.currentTab));
    }
  );
  if (action === 'unfreeze') return confirmAction(
    'Unfreeze account',
    `Unfreeze <strong>${esc(user.displayName || user.email)}</strong>?`,
    async () => {
      await freezeUser(uid, false);
      await logActivity('unfreeze_user', uid);
      toast(`${user.displayName || user.email} unfrozen.`, 'success');
      loadUsers(roleForTab(state.currentTab));
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
  syncClassroomVisibility('edit-role', 'edit-classroom-group', 'edit-classroom');
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
    loadUsers(roleForTab(state.currentTab));
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
  syncClassroomVisibility('new-role', 'classroom-group', 'new-classroom');
  syncAuthFieldsVisibility();
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

  // Role-specific validation. Classroom entries are Firestore-only and have
  // no Auth account, so they don't need email/password.
  if (!name || !role) {
    errEl.textContent = 'Name and role are required.';
    errEl.classList.remove('hidden');
    return;
  }
  if (role !== 'classroom') {
    if (!email || !password) {
      errEl.textContent = 'Email and password are required.';
      errEl.classList.remove('hidden');
      return;
    }
    if (password.length < 8) {
      errEl.textContent = 'Password must be at least 8 characters.';
      errEl.classList.remove('hidden');
      return;
    }
  }

  const submitBtn = document.getElementById('add-user-submit');
  submitBtn.disabled = true;
  errEl.classList.add('hidden');

  try {
    if (role === 'classroom') {
      // No Firebase Auth user — generate a random Firestore doc ID and
      // write directly. The entry shows up in admin lists but can't sign in.
      const newDocRef = doc(collection(db, 'users'));
      await setDoc(newDocRef, {
        email:        '',
        displayName:  name,
        role:         'classroom',
        frozen:       false,
        classroomIds: [],
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
    } else {
      // Spark (free) plan: no Cloud Functions, so we use the public Identity
      // Toolkit REST endpoint to create the Auth user without signing out the
      // current admin. Security note: the web API key is public, so anyone
      // can call signUp directly. Firestore rules still prevent non-admins
      // from writing the users/{uid} doc with a role — without an admin
      // promoting them, a self-created Auth user has no app access.
      const uid = await createAuthUser(email, password, name);
      await setDoc(doc(db, 'users', uid), {
        email,
        displayName:  name,
        role,
        frozen:       false,
        classroomIds: classroom ? [classroom] : [],
        createdAt:    serverTimestamp(),
        updatedAt:    serverTimestamp(),
      });
    }

    toast(`User ${name} created successfully.`, 'success');
    await logActivity('create_user');
    hideModal('add-user-modal');
    loadUsers(roleForTab(state.currentTab));
    loadStats();
  } catch (err) {
    errEl.textContent = err.message || 'Failed to create user.';
    errEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
  }
});

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
  return data.localId;
}

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
  // Prefer the userName we now record at write-time. Older entries don't have
  // it — fall back to the role, then to a generic label.
  const who = log.userName
    ? `<strong>${esc(log.userName)}</strong>`
    : (log.userRole
        ? `<span style="text-transform:capitalize">${esc(log.userRole)}</span>`
        : 'Someone');
  const labels = {
    login:          `${who} logged in`,
    logout:         `${who} logged out`,
    upload:         `${who} uploaded a file`,
    download:       `${who} downloaded a file`,
    delete_file:    `${who} deleted a file`,
    scan_qr:        `${who} scanned a QR code`,
    create_user:    `${who} created a user`,
    edit_user:      `${who} edited a user`,
    freeze_user:    `${who} froze a user`,
    unfreeze_user:  `${who} unfroze a user`,
    delete_user:    `${who} deleted a user`,
    create_session: `${who} created a board session`,
    claim_session:  `${who} claimed a board session`,
  };
  return labels[log.action] || `${who}: ${esc(log.action)}`;
}

// ---- Confirm modal helper -------------------------------------------------
// Clone-and-replace the OK button each open so any stale listener from a
// previously-cancelled invocation can't double-fire.
function confirmAction(title, bodyHtml, onConfirm, isDanger = false) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-body').innerHTML = bodyHtml;
  const oldBtn = document.getElementById('confirm-ok');
  const okBtn  = oldBtn.cloneNode(true);
  okBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  oldBtn.replaceWith(okBtn);
  showModal('confirm-modal');

  okBtn.addEventListener('click', async () => {
    okBtn.disabled = true;
    try { await onConfirm(); } catch (err) { toast(err.message || 'Action failed.', 'error'); }
    okBtn.disabled = false;
    hideModal('confirm-modal');
  }, { once: true });
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
    } else if (section === 'dashboard') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (section === 'activity') {
      document.getElementById('activity-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ---- Utilities ------------------------------------------------------------
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Cleanup on unload — pagehide fires reliably on Safari/back-forward cache;
// beforeunload covers most other paths.
let activityUnsubCalled = false;
function teardownActivity() {
  if (activityUnsubCalled) return;
  activityUnsubCalled = true;
  state.unsubActivity?.();
}
window.addEventListener('pagehide',     teardownActivity);
window.addEventListener('beforeunload', teardownActivity);
