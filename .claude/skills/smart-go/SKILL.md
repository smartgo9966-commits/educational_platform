---
name: smart-go
description: >
  Build the complete "Smart Go" educational platform — a multi-role web app with
  Admin, Smart Board, Teacher, and Student pages, frontend in vanilla HTML/CSS/JS
  and backend on Firebase (Auth, Firestore, Storage, Cloud Functions). Use this
  skill whenever the user asks to build, scaffold, implement, set up, or extend
  the Smart Go platform; whenever they mention any of its pages (admin dashboard,
  smart board / digital whiteboard, teacher portal, student portal); whenever
  they reference the QR-based smart-board-to-teacher capture flow; or whenever
  they ask to build a school/classroom management web app with role-based
  access on Firebase. Always use this skill for any Smart Go related work,
  even if the user only mentions one page or one feature of it.
---

# Smart Go — Build Skill

You are building the **Smart Go** platform end-to-end. Smart Go is a tech/automation-themed
educational web platform with four role-based pages, a futuristic light-theme design system,
and a Firebase backend. Follow every step in order. Do not skip steps. Do not invent
endpoints, schemas, or routes that aren't specified here.

---

## Project Overview

A static frontend (vanilla HTML/CSS/JS, ES modules, no build step) deployed to Firebase
Hosting, with Firebase Auth + Firestore + Cloud Storage + a small Cloud Functions service
for privileged operations.

Four user roles, each with their own page:

| Role        | Capability                                                                |
|-------------|---------------------------------------------------------------------------|
| **admin**   | Manage all users, view activity, freeze/delete/edit members               |
| **board**   | Smart whiteboard (draw/write/edit), export drawing → generate QR code     |
| **teacher** | Upload lesson files, scan smart-board QR → save board image to library    |
| **student** | View teacher uploads, organized into Assignments / Lessons / Notes / Other |

The defining feature is the **QR-based capture flow**: a smart board exports its current
canvas, stores it as a short-lived "board session", and shows a QR. A teacher scans the
QR on their device and the image is automatically claimed into their file library.

---

## Tech Stack

| Layer        | Technology                                          |
|--------------|-----------------------------------------------------|
| Frontend     | Vanilla HTML + CSS + JS (ES modules, no bundler)    |
| Hosting      | Firebase Hosting                                    |
| Auth         | Firebase Auth (email/password + anonymous for boards) |
| Database     | Firestore (with custom-claim role checks)           |
| File storage | Firebase Cloud Storage                              |
| Functions    | Firebase Cloud Functions (Node 20)                  |
| Canvas       | Fabric.js v5 (smart board drawing surface)          |
| QR generate  | qrcode.js (davidshimjs/qrcodejs)                    |
| QR scan      | html5-qrcode                                        |
| Design       | Custom "Smart Go" light-theme tokens (see `references/design-system.md`) |

---

## Reference Files (read these when doing the relevant step)

- **`references/design-system.md`** — Full color palette, gradients, typography, shadows, component recipes. Read this **before** writing any HTML or CSS.
- **`references/firebase-setup.md`** — Firestore schema, Security Rules, Storage Rules, Cloud Functions, custom claims. Read this **before** initializing Firebase.
- **`references/qr-flow.md`** — End-to-end QR transfer implementation (board side + teacher side). Read this **before** building the board or teacher pages.
- **`references/pages.md`** — Per-page HTML structure, JS responsibilities, and feature checklists for all 5 pages (login + 4 role pages). Read this **before** building each page.
- **`assets/tokens.css`** — Drop-in CSS file with all design tokens. Copy into `public/shared/css/variables.css`.
- **`assets/base.css`** — Drop-in reset + typography + primitives. Copy into `public/shared/css/base.css`.

---

## Build Order (follow exactly)

### Step 1 — Scaffold the folder structure

Create exactly this layout:

```
smart-go/
├── public/
│   ├── index.html                  # role-based redirect after auth
│   ├── login/
│   │   ├── login.html
│   │   ├── login.css
│   │   └── login.js
│   ├── admin/
│   │   ├── admin.html
│   │   ├── admin.css
│   │   └── admin.js
│   ├── board/
│   │   ├── board.html
│   │   ├── board.css
│   │   └── board.js
│   ├── teacher/
│   │   ├── teacher.html
│   │   ├── teacher.css
│   │   └── teacher.js
│   ├── student/
│   │   ├── student.html
│   │   ├── student.css
│   │   └── student.js
│   ├── shared/
│   │   ├── css/
│   │   │   ├── reset.css
│   │   │   ├── variables.css       # from assets/tokens.css
│   │   │   ├── base.css            # from assets/base.css
│   │   │   └── components.css      # buttons, cards, modals, inputs
│   │   ├── js/
│   │   │   ├── firebase-config.js
│   │   │   ├── auth.js
│   │   │   ├── db.js
│   │   │   ├── storage.js
│   │   │   ├── router.js
│   │   │   ├── ui.js
│   │   │   └── activity.js         # logs user actions
│   │   └── assets/
│   │       └── logo.svg
│   └── vendor/
│       ├── fabric.min.js
│       ├── qrcode.min.js
│       └── html5-qrcode.min.js
│
├── functions/
│   ├── index.js
│   ├── package.json
│   └── .eslintrc.js
│
├── firestore.rules
├── firestore.indexes.json
├── storage.rules
├── firebase.json
└── .firebaserc
```

```bash
mkdir -p smart-go/public/{login,admin,board,teacher,student}
mkdir -p smart-go/public/shared/{css,js,assets}
mkdir -p smart-go/public/vendor
mkdir -p smart-go/functions
```

### Step 2 — Drop in the design system

1. Copy `assets/tokens.css` → `public/shared/css/variables.css`
2. Copy `assets/base.css` → `public/shared/css/base.css`
3. Read `references/design-system.md` and create `public/shared/css/components.css` with the buttons, cards, inputs, badges, and modal styles defined there.
4. Create `public/shared/css/reset.css` with a minimal modern CSS reset (margin/padding 0, box-sizing border-box, body min-height 100vh, etc.).

Every page HTML must include all four shared CSS files in this order:
```html
<link rel="stylesheet" href="../shared/css/reset.css">
<link rel="stylesheet" href="../shared/css/variables.css">
<link rel="stylesheet" href="../shared/css/base.css">
<link rel="stylesheet" href="../shared/css/components.css">
<link rel="stylesheet" href="./<page>.css">
```

### Step 3 — Set up Firebase

Read `references/firebase-setup.md` and complete every sub-step in order:
1. Initialize the Firebase project (`firebase init`) selecting Hosting, Firestore, Storage, Functions.
2. Configure `firebase.json` with the public dir set to `public` and rewrites for clean URLs.
3. Write `firestore.rules` and `storage.rules` exactly as specified.
4. Implement the Cloud Functions (`setUserRole`, `claimBoardSession`, `cleanupExpiredSessions`).
5. Create the `firebase-config.js` file in `public/shared/js/` with the v10 modular SDK.

### Step 4 — Build shared JS modules

In `public/shared/js/`, implement:

- `firebase-config.js` — initializes app, exports `auth`, `db`, `storage`, `functions`.
- `auth.js` — exports `signIn(email, pw)`, `signOut()`, `requireRole(role)`, `getCurrentUser()`. `requireRole` reads the custom claim, redirects to `/login/` if not authenticated, and to a "no access" page if the role doesn't match.
- `db.js` — thin Firestore helpers: `listUsers(role?)`, `getUser(uid)`, `updateUser(uid, patch)`, `freezeUser(uid)`, `deleteUser(uid)`, `listFiles(filter)`, `createFile(meta)`, `deleteFile(fileId)`.
- `storage.js` — `uploadFile(file, path) → {downloadURL, storagePath}`, `getDownloadURL(path)`, `deleteFile(path)`.
- `router.js` — `redirectByRole(role)` sends user to `/admin/`, `/teacher/`, `/student/`, or `/board/`.
- `ui.js` — `toast(msg, type)`, `confirm(msg)`, `showLoader()` / `hideLoader()`, `formatDate(ts)`.
- `activity.js` — `logActivity(action, targetId?)` writes to `activity_logs/`.

Every page's main JS file must start with:
```js
import { requireRole } from '../shared/js/auth.js';
const user = await requireRole('teacher'); // or 'admin' | 'student' | 'board'
```

### Step 5 — Build the login page

Read `references/pages.md` § Login. The login page is the only page that does not require auth — it handles sign-in and routes to the right role-page on success.

### Step 6 — Build the admin page

Read `references/pages.md` § Admin. This is the heaviest page: tabs for Students/Teachers, a data table per tab, row actions (view, edit, freeze, delete), an activity log viewer modal.

### Step 7 — Build the smart board page

Read `references/pages.md` § Smart Board, then `references/qr-flow.md` § Board side. Use Fabric.js for the canvas. The "Save & QR" button is the most important interaction.

### Step 8 — Build the teacher page

Read `references/pages.md` § Teacher, then `references/qr-flow.md` § Teacher side. Two main features: file upload (drag-drop + file picker, with category selector), and a QR scanner modal.

### Step 9 — Build the student page

Read `references/pages.md` § Student. Read-only view of files filtered to the student's classroom(s), with category tabs.

### Step 10 — Deploy

```bash
firebase deploy --only firestore:rules,storage:rules,functions
firebase deploy --only hosting
```

---

## Critical Rules

- **Always read the reference file before building the corresponding piece.** Don't guess at colors, schemas, or rules — they are defined exactly in the references and must match.
- **Never use a bundler, npm, or React/Vue.** Frontend is plain HTML/CSS/JS with native ES modules loaded from CDN or `/vendor/`.
- **Never bypass Firebase Security Rules.** All authorization happens in rules + custom claims, not in client code.
- **Never put role checks only on the client.** Client-side `requireRole()` is for UX (redirect); server-side rules are what actually enforce access.
- **Always use the design tokens.** Never hardcode `#1E90FF` or `#0B1F3A` in a stylesheet — always reference `var(--primary-blue)` or `var(--text-primary)`.
- **Always use the modular Firebase v10 SDK** (`firebase/app`, `firebase/auth`, etc.) imported from `https://www.gstatic.com/firebasejs/10.7.0/...`. Do NOT use compat mode.
- **Each page CSS file should only contain page-specific styles.** Buttons, cards, inputs, modals all live in `components.css`.

---

## Common Mistakes to Avoid

- Hardcoding role checks in HTML (e.g., `<div if-admin>`) — always check via `requireRole()` in JS.
- Forgetting to set custom claims when an admin creates a user — must call the `setUserRole` Cloud Function, not just write to Firestore.
- Storing the QR-scanned `sessionId` in localStorage or URL for any longer than the claim — it's one-time-use and expires in 10 min.
- Calling `getDownloadURL()` repeatedly for every list render — store the URL on the file doc when it's first uploaded.
- Forgetting CORS for the Cloud Storage bucket if you ever serve images cross-origin (board snapshots displayed on the teacher page from the storage URL).
- Running Cloud Functions on the wrong Node version — must be `nodejs20` in `functions/package.json`.
- Not deploying rules before functions — rules must exist or functions that read Firestore may fail.

---

## Verification Checklist

Before declaring done, verify:

- [ ] Each role can log in and is routed only to their own page (try logging in as a teacher and navigating manually to `/admin/` — must redirect away).
- [ ] An admin can change a user's role and the change takes effect on next login (claim refresh).
- [ ] Freezing a user prevents them from reading any file the next time they refresh (rule check).
- [ ] A board session QR can be scanned exactly once, and after 10 min the session is unclaimable.
- [ ] Files uploaded by a teacher appear immediately in their student page (real-time listener).
- [ ] All buttons use the brand gradient or a tokenized color — no hardcoded hex anywhere outside `variables.css`.
- [ ] Storage rules reject files >25 MB and non-image/non-PDF MIME types for teacher uploads.

---

## Production Upgrade Notes (not for MVP)

When extending Smart Go later, the natural next steps:

1. Add Algolia or Typesense for full-text search across lessons.
2. Replace `Date.now() + 10*60*1000` session expiry with a Firestore TTL policy.
3. Add a Cloud Function image-thumbnailer for snapshots (sharp + Cloud Functions v2).
4. Add classroom-level real-time presence (RTDB) so teachers see "3 students viewing".
5. Multi-tenant: introduce a `schools/{schoolId}/...` parent collection and scope all rules to it.
6. Add Cloudflare in front of Storage for public-asset egress savings.
