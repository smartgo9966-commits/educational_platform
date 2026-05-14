# Smart Go — Per-Page Specifications

Each page lives in its own folder under `public/` with three files:
`<page>.html`, `<page>.css`, `<page>.js`. Page CSS contains only page-specific
styles; everything reusable (buttons, cards, modals, badges, inputs) lives in
`shared/css/components.css`.

Every page (except `login`) starts its JS file with:

```js
import { requireRole } from '../shared/js/auth.js';
const user = await requireRole('admin' | 'teacher' | 'student' | 'board');
```

---

## Login (`/login/`)

The only public page. Routes the user to their role page on success.

### Layout

A single centered card on the gradient soft background:

```
┌─────────────────────────────────────────────┐
│                                             │
│                ╭────────────╮               │
│                │ [logo+wordmark]            │
│                │  Smart Go                  │
│                │                            │
│                │  Sign in                   │
│                │  ┌──────────────────┐      │
│                │  │ email            │      │
│                │  └──────────────────┘      │
│                │  ┌──────────────────┐      │
│                │  │ password         │      │
│                │  └──────────────────┘      │
│                │  [   Sign in (primary)  ]  │
│                │                            │
│                │  Forgot password?          │
│                ╰────────────╯               │
│                                             │
└─────────────────────────────────────────────┘
```

### `login.html` essentials
- Page background: `var(--gradient-soft)`
- Centered `.card` with `max-width: 420px`
- Brand wordmark at top
- Email + password `.input`s
- Primary button (full width)
- "Forgot password?" link below
- Error region (hidden by default) using `.toast-error`-style

### `login.js` responsibilities
1. If user is already signed in, immediately redirect via `redirectByRole(role)`.
2. On submit:
   - Call `signInWithEmailAndPassword(auth, email, pw)`
   - Read the user's custom claim (`(await user.getIdTokenResult()).claims.role`)
   - Check `users/{uid}.frozen` — if true, sign out and show "Account is suspended"
   - Log activity (`logActivity('login')`)
   - Call `redirectByRole(role)`
3. Forgot password: `sendPasswordResetEmail(auth, email)` → toast confirmation.

### Page-specific CSS (login.css)
```css
.login-page {
  min-height: 100vh;
  display: grid; place-items: center;
  background:
    radial-gradient(circle at 20% 20%, rgba(30, 144, 255, 0.10), transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(0, 209, 178, 0.10), transparent 50%),
    var(--bg-app);
}
.login-card {
  width: 100%; max-width: 420px;
  padding: var(--space-10);
}
.login-brand {
  text-align: center;
  margin-bottom: var(--space-8);
}
```

---

## Admin (`/admin/`)

The control center. Two main tabs: **Students** and **Teachers**. Each shows a paginated table with row actions.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Smart Go]   Admin                            [user] ▾    │
├─────────────────────────────────────────────────────────────┤
│  Sidebar                  │  Main                            │
│  ───────                  │  ─────                           │
│  • Dashboard              │  Tab: [Students] [Teachers]      │
│  • Students               │                                  │
│  • Teachers               │  ┌── Search ──┐  + Add user      │
│  • Activity log           │  │            │                  │
│  • Classrooms             │  └────────────┘                  │
│  • Settings               │                                  │
│                           │  ┌─────── table ────────┐       │
│                           │  │ Name | Email | Class │       │
│                           │  │  ... rows ...        │       │
│                           │  └──────────────────────┘       │
│                           │  pagination →                    │
└───────────────────────────┴──────────────────────────────────┘
```

### Required features
- **Tabs** — Students | Teachers, switchable client-side
- **Search** — filters by name/email (client-side over loaded page)
- **Pagination** — Firestore `limit(50)` + `startAfter` cursors
- **Row actions** (icon buttons in last column):
  - `View` → opens drawer with full profile + activity log
  - `Edit` → opens modal to update displayName, email, classroomIds
  - `Freeze` / `Unfreeze` → toggles `frozen` field, shows warning toast
  - `Delete` → confirmation modal, removes Auth user + Firestore doc + cascades
- **Add user** button → modal with email, displayName, role select, classroom select
  - Backend: creates Auth user via `admin.auth().createUser()` in a Cloud Function (NOT directly from client) and sets the role claim
- **Activity log viewer** (separate page or modal) — table of `activity_logs` filtered by user

### `admin.js` structure

```js
const state = {
  currentTab:   'students',         // 'students' | 'teachers'
  rows:         [],                 // loaded users for the active tab
  cursor:       null,               // last doc snapshot for pagination
  searchTerm:   '',
  selectedUser: null                // for view/edit/delete actions
};

async function loadUsers(role) { /* db.listUsers(role, cursor) → state.rows */ }
function renderTable() { /* state.rows → DOM */ }
function bindActions() { /* delegate clicks to view/edit/freeze/delete */ }

// modal helpers
async function openEditModal(user) { /* ... */ }
async function openViewDrawer(user) { /* ... loads activity_logs ... */ }
async function confirmFreeze(user) { /* updateUser → frozen toggle */ }
async function confirmDelete(user) { /* call deleteUser Cloud Function */ }
```

### Critical rule
When editing role, the admin **must** call the `setUserRole` Cloud Function — never write the role field directly to Firestore. The function sets the custom claim AND mirrors to Firestore atomically. Direct writes leave the claim out of sync.

### Page-specific styles

- Sidebar: `width: var(--sidebar-width)`, `background: var(--bg-surface)`, `border-right: 1px solid var(--border-default)`
- Active sidebar item: `background: var(--bg-tint-blue)`, `color: var(--primary-blue)`, `border-left: 3px solid var(--primary-blue)`
- Frozen row: subtle red tint via `background: var(--error-soft)` + `.badge-error` pill in status column
- Delete button: `.btn-ghost` with red color override, becomes `.btn-danger` in confirm modal

---

## Smart Board (`/board/`)

A full-screen drawing surface with a top toolbar and a "Save & QR" CTA.
**See `references/qr-flow.md` for the complete implementation** of canvas setup, tools, QR generation, and session creation.

### Required features
- Free-draw pen with color + width controls
- Eraser (drawing in white)
- Text tool (`fabric.IText` for editable text)
- Shapes: rectangle, circle (and optionally line, arrow)
- Undo / redo / clear
- Color picker bound to brush
- Brush size slider
- "Save & Generate QR" → board-side QR flow
- Board page does NOT show files or other UI — it is purpose-built for drawing only

### Layout
- Header: 64px tall, contains brand wordmark on the left, toolbar in the middle, CTA on the right
- Main: full-viewport `<canvas>` (resizes with window)
- Modal: QR code with countdown timer

### Page-specific styles

```css
.board-header {
  height: 64px;
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 var(--space-6);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  box-shadow: var(--shadow-sm);
  position: sticky; top: 0; z-index: 10;
}
.board-toolbar {
  display: flex; align-items: center; gap: var(--space-2);
  padding: var(--space-2);
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
}
.board-toolbar input[type="color"] {
  width: 32px; height: 32px; border: 1px solid var(--border-default);
  border-radius: var(--radius-sm); padding: 2px; cursor: pointer;
}
.board-main {
  height: calc(100vh - 64px);
  background: var(--bg-app);
}
.qr-target {
  display: grid; place-items: center;
  padding: var(--space-6);
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  margin-top: var(--space-4);
}
```

---

## Teacher (`/teacher/`)

Two main capabilities: **upload files** and **scan QR from board**. Plus a list view of files the teacher owns.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Smart Go] Teacher                         [user] ▾        │
├─────────────────────────────────────────────────────────────┤
│  Sidebar              │  Main                                │
│  • Dashboard          │  ┌── Hero card (gradient-soft) ───┐ │
│  • My Files           │  │  Upload lessons or capture     │ │
│  • Upload             │  │  from the smart board          │ │
│  • Scan QR            │  │  [+ Upload]  [📷 Scan]          │ │
│                       │  └────────────────────────────────┘ │
│                       │                                      │
│                       │  Filter: [All|Assignment|Lesson|...]│
│                       │  ┌── Files grid ─────────────────┐  │
│                       │  │ card | card | card             │  │
│                       │  │ card | card | card             │  │
│                       │  └────────────────────────────────┘  │
└───────────────────────┴──────────────────────────────────────┘
```

### Required features
- **Upload modal** — drag-and-drop zone + file picker. Required fields: title, category select (assignment/lesson/note/other), classroom select. Validates size (<25 MB) and type before upload.
- **Scan QR** — opens scanner modal (see `qr-flow.md` § Teacher side).
- **File list** — grid of `.card-interactive` components. Each card shows thumbnail (image preview or icon by mime type), title, category badge, upload date, owner.
- **Real-time updates** — `onSnapshot(query(files, where('ownerId', '==', uid), orderBy('createdAt', 'desc')))`. Unsubscribe on page unload.
- **Card actions** — download, edit metadata, delete (with confirm).
- **Category filter chips** — pill-shaped buttons that filter the displayed list.

### `teacher.js` structure

```js
const state = {
  files:       [],
  filter:      'all',
  classrooms:  [],
  activeClassroomId: null,
  unsubFiles:  null
};

async function init() { /* load classrooms, subscribe to files, render */ }
function subscribeFiles() {
  const q = query(collection(db, 'files'),
    where('ownerId', '==', user.uid),
    orderBy('createdAt', 'desc'),
    limit(100));
  state.unsubFiles = onSnapshot(q, (snap) => {
    state.files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
}
function render() { /* filter + render grid */ }

window.addEventListener('beforeunload', () => state.unsubFiles?.());

// Upload handler
async function uploadFile(file, meta) {
  const fileId = doc(collection(db, 'files')).id;
  const path   = `files/${user.uid}/${fileId}/${file.name}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  const url    = await getDownloadURL(ref(storage, path));
  await setDoc(doc(db, 'files', fileId), {
    ownerId:     user.uid,
    title:       meta.title,
    category:    meta.category,
    storagePath: path,
    downloadURL: url,
    mimeType:    file.type,
    sizeBytes:   file.size,
    classroomId: meta.classroomId,
    source:      'upload',
    createdAt:   serverTimestamp()
  });
}
```

### Page-specific styles

```css
.teacher-hero {
  background: var(--gradient-soft);
  border: 1px solid var(--primary-blue-soft);
  border-radius: var(--radius-xl);
  padding: var(--space-8);
  margin-bottom: var(--space-8);
}
.files-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: var(--space-4);
}
.file-card {
  /* extends .card.card-interactive */
  display: flex; flex-direction: column; gap: var(--space-3);
}
.file-thumb {
  aspect-ratio: 4 / 3;
  background: var(--bg-subtle);
  border-radius: var(--radius-md);
  display: grid; place-items: center;
  overflow: hidden;
}
.file-thumb img { width: 100%; height: 100%; object-fit: cover; }
.filter-pills { display: flex; gap: var(--space-2); margin-bottom: var(--space-6); }
.filter-pill {
  /* uses .badge styles + active state */
  padding: 6px 14px; cursor: pointer;
  border: 1px solid var(--border-default);
  background: var(--bg-surface);
}
.filter-pill.active {
  background: var(--gradient-primary);
  color: var(--text-on-brand);
  border-color: transparent;
}
```

### Upload-zone styling
```css
.upload-zone {
  border: 2px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--bg-tint-blue);
  padding: var(--space-12);
  text-align: center;
  transition: border-color var(--duration-2) var(--ease), background var(--duration-2) var(--ease);
}
.upload-zone.drag-over {
  border-color: var(--primary-blue);
  background: rgba(30, 144, 255, 0.06);
}
```

---

## Student (`/student/`)

Read-only view of files for the student's classroom(s), grouped by category.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Smart Go] Student                         [user] ▾        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Welcome, {name}                                            │
│                                                             │
│  Tabs: [All] [Assignments] [Lessons] [Notes] [Other]       │
│                                                             │
│  ┌── Files grid ─────────────────────────────────────────┐ │
│  │  card | card | card | card                            │ │
│  │  card | card | card | card                            │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Required features
- **Category tabs** — All / Assignments / Lessons / Notes / Other (Smart Board captures fold into "Notes" or stay as their own "Smart Board" tab — pick one).
- **File grid** — same `.file-card` style as teacher page, but **no edit/delete buttons**. Only "Open" or "Download".
- **Real-time updates** so newly uploaded teacher files appear instantly.
- **Empty state** when no files in a category — friendly illustration or icon, "Your teacher hasn't uploaded anything in this category yet."

### `student.js` structure

```js
const user = await requireRole('student');

const state = { files: [], filter: 'all', unsub: null };

const userDoc = await getDoc(doc(db, 'users', user.uid));
const classroomIds = userDoc.data().classroomIds || [];

if (classroomIds.length === 0) {
  showEmpty('You are not assigned to any classroom yet.');
} else {
  // Use 'in' query (max 30 IDs in Firestore v10)
  const q = query(collection(db, 'files'),
    where('classroomId', 'in', classroomIds),
    orderBy('createdAt', 'desc'),
    limit(200));
  state.unsub = onSnapshot(q, (snap) => {
    state.files = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
}
```

### Page-specific styles

Identical to teacher page minus the action buttons. Reuse `.files-grid` and
`.file-card` so visual consistency is automatic.

```css
.student-greeting {
  font: 700 var(--text-3xl)/1.2 var(--font-display);
  margin-bottom: var(--space-2);
}
.student-greeting .name {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.empty-state {
  text-align: center;
  padding: var(--space-16) var(--space-6);
  color: var(--text-tertiary);
}
.empty-state .icon {
  font-size: 48px;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  margin-bottom: var(--space-4);
}
```

---

## Cross-cutting UI patterns

### App header (used by admin/teacher/student)

```html
<header class="app-header">
  <a href="/" class="brand-wordmark">Smart Go</a>
  <nav class="app-nav"> ...page-specific nav items... </nav>
  <div class="user-menu">
    <img class="avatar" src="..." alt="">
    <span class="user-name">{displayName}</span>
    <button class="btn btn-ghost btn-sm" id="signout">Sign out</button>
  </div>
</header>
```

```css
.app-header {
  height: var(--header-height);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 var(--space-6);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  position: sticky; top: 0; z-index: 10;
}
.avatar {
  width: 32px; height: 32px;
  border-radius: var(--radius-pill);
  border: 2px solid var(--primary-blue-soft);
}
```

### Empty / loading / error states
- Loading: thin top progress bar (`.loader-bar`) — show during initial fetch
- Empty: centered icon + heading + helper text (use `.empty-state`)
- Error: card with `.badge-error` and a "Retry" button
