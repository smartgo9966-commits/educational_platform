# Smart Go — QR Capture Flow

The signature feature: a smart board exports its current canvas, stores it as a
short-lived "board session", and shows a QR. A teacher scans the QR on their device
and the image is automatically claimed into their file library.

---

## The flow at a glance

```
┌──────────────────────────────────┐         ┌──────────────────────────────┐
│  Smart Board page (board.html)   │         │  Teacher page (teacher.html) │
└──────────────────────────────────┘         └──────────────────────────────┘
            │                                              │
            │ 1. User clicks "Save & QR"                   │
            │ 2. Export Fabric canvas → PNG blob           │
            │ 3. Create board_sessions/{sessionId} doc     │
            │ 4. Upload PNG → board_snapshots/{sid}.png    │
            │ 5. Update doc with storagePath               │
            │ 6. Render QR encoding the sessionId          │
            │                                              │
            │            ── shows QR on screen ──          │
            │                                              │
            │                              7. Teacher opens scanner modal
            │                              8. html5-qrcode reads sessionId
            │                              9. Calls claimBoardSession(sessionId)
            │                                              │
            │                                              ▼
            │                              ┌─────────────────────────────────┐
            │                              │  Cloud Function (transactional) │
            │                              │  - verify exists / not expired  │
            │                              │  - mark claimed                 │
            │                              │  - create files/{fileId}        │
            │                              │  - log activity                 │
            │                              └─────────────────────────────────┘
            │                                              │
            │                             10. New file appears in teacher list
```

The session is **one-time-use** and **expires in 10 minutes**. After claim or expiry,
the QR is dead.

---

## Board side — implementation

### Required vendor files
Drop these into `public/vendor/`:
- `fabric.min.js` (v5.x) — canvas drawing
- `qrcode.min.js` (davidshimjs/qrcodejs) — QR rendering

### `board.html` (markup essentials)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Smart Go — Smart Board</title>
  <link rel="stylesheet" href="../shared/css/reset.css">
  <link rel="stylesheet" href="../shared/css/variables.css">
  <link rel="stylesheet" href="../shared/css/base.css">
  <link rel="stylesheet" href="../shared/css/components.css">
  <link rel="stylesheet" href="./board.css">
</head>
<body>
  <header class="board-header">
    <div class="brand-wordmark">Smart Go</div>
    <div class="board-toolbar" role="toolbar">
      <!-- pen / brush / shapes / eraser / colour / undo / redo / clear -->
      <button class="btn btn-ghost" id="tool-pen">✏️ Pen</button>
      <button class="btn btn-ghost" id="tool-eraser">🧽 Erase</button>
      <button class="btn btn-ghost" id="tool-text">T  Text</button>
      <button class="btn btn-ghost" id="tool-rect">▭ Rect</button>
      <button class="btn btn-ghost" id="tool-circle">◯ Circle</button>
      <input type="color" id="tool-color" value="#1E90FF">
      <input type="range" id="tool-size" min="1" max="40" value="3">
      <button class="btn btn-ghost" id="action-undo">↶ Undo</button>
      <button class="btn btn-ghost" id="action-redo">↷ Redo</button>
      <button class="btn btn-ghost" id="action-clear">⌫ Clear</button>
    </div>
    <button class="btn btn-primary" id="action-save-qr">📤 Save & Generate QR</button>
  </header>

  <main class="board-main">
    <canvas id="board-canvas"></canvas>
  </main>

  <!-- QR modal -->
  <div class="modal-backdrop" id="qr-modal" hidden>
    <div class="modal">
      <h2 class="modal-title">Scan from your teacher account</h2>
      <p class="text-muted">This code expires in <span id="qr-countdown">10:00</span></p>
      <div id="qr-target" class="qr-target"></div>
      <div class="row row-end" style="margin-top: var(--space-6);">
        <button class="btn btn-ghost" id="qr-close">Close</button>
      </div>
    </div>
  </div>

  <script src="../vendor/fabric.min.js"></script>
  <script src="../vendor/qrcode.min.js"></script>
  <script type="module" src="./board.js"></script>
</body>
</html>
```

### `board.js` (key logic)

```js
import { requireRole } from '../shared/js/auth.js';
import { db, storage }  from '../shared/js/firebase-config.js';
import { collection, doc, serverTimestamp, setDoc, Timestamp }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { ref, uploadBytes }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-storage.js';

const user = await requireRole('board');  // boards sign in anonymously with role=board

// ---------- Fabric canvas setup ----------
const canvas = new fabric.Canvas('board-canvas', {
  width: window.innerWidth,
  height: window.innerHeight - 64,
  isDrawingMode: true,
  backgroundColor: '#FFFFFF'
});
canvas.freeDrawingBrush.color = '#1E90FF';
canvas.freeDrawingBrush.width = 3;

// Resize on window resize
window.addEventListener('resize', () => {
  canvas.setWidth(window.innerWidth);
  canvas.setHeight(window.innerHeight - 64);
});

// ---------- Tool handlers ----------
document.getElementById('tool-pen').onclick    = () => { canvas.isDrawingMode = true; };
document.getElementById('tool-eraser').onclick = () => {
  canvas.isDrawingMode = true;
  canvas.freeDrawingBrush.color = '#FFFFFF';   // erase by drawing white
};
document.getElementById('tool-text').onclick = () => {
  canvas.isDrawingMode = false;
  const t = new fabric.IText('Type here', { left: 100, top: 100, fill: '#0B1F3A', fontFamily: 'Inter' });
  canvas.add(t).setActiveObject(t);
};
document.getElementById('tool-rect').onclick = () => {
  canvas.isDrawingMode = false;
  canvas.add(new fabric.Rect({ left: 120, top: 120, width: 200, height: 120,
    fill: 'transparent', stroke: '#1E90FF', strokeWidth: 3 }));
};
document.getElementById('tool-circle').onclick = () => {
  canvas.isDrawingMode = false;
  canvas.add(new fabric.Circle({ left: 140, top: 140, radius: 80,
    fill: 'transparent', stroke: '#00D1B2', strokeWidth: 3 }));
};
document.getElementById('tool-color').oninput = (e) => {
  canvas.freeDrawingBrush.color = e.target.value;
};
document.getElementById('tool-size').oninput = (e) => {
  canvas.freeDrawingBrush.width = parseInt(e.target.value, 10);
};
document.getElementById('action-clear').onclick = () => {
  if (confirm('Clear the board?')) canvas.clear().renderAll();
};

// Undo/redo (simple history stack)
const history = []; let redoStack = [];
canvas.on('object:added',    () => { redoStack = []; history.push(JSON.stringify(canvas)); });
canvas.on('object:modified', () => { redoStack = []; history.push(JSON.stringify(canvas)); });
document.getElementById('action-undo').onclick = () => {
  if (history.length < 2) return;
  redoStack.push(history.pop());
  canvas.loadFromJSON(history[history.length - 1] || '{}', () => canvas.renderAll());
};
document.getElementById('action-redo').onclick = () => {
  if (!redoStack.length) return;
  const state = redoStack.pop();
  history.push(state);
  canvas.loadFromJSON(state, () => canvas.renderAll());
};

// ---------- Save & QR ----------
document.getElementById('action-save-qr').onclick = async () => {
  // 1. Export canvas to PNG blob
  const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
  const blob    = await (await fetch(dataURL)).blob();

  // 2. Create the session doc with a generated id
  const sessionRef = doc(collection(db, 'board_sessions'));
  const sessionId  = sessionRef.id;
  const expiresAt  = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
  const storagePath = `board_snapshots/${sessionId}.png`;

  await setDoc(sessionRef, {
    boardId:     user.uid,
    storagePath,
    createdAt:   serverTimestamp(),
    expiresAt,
    claimed:     false,
    claimedBy:   null,
    claimedAt:   null
  });

  // 3. Upload PNG
  await uploadBytes(ref(storage, storagePath), blob, { contentType: 'image/png' });

  // 4. Render QR — encode just the sessionId (one-time-use, expires soon, requires teacher auth)
  const qrTarget = document.getElementById('qr-target');
  qrTarget.innerHTML = '';
  new QRCode(qrTarget, {
    text: sessionId,
    width: 256, height: 256,
    colorDark:  '#0B1F3A',
    colorLight: '#FFFFFF',
    correctLevel: QRCode.CorrectLevel.H
  });

  // 5. Show modal + countdown
  document.getElementById('qr-modal').hidden = false;
  startCountdown(10 * 60);
};

document.getElementById('qr-close').onclick = () => {
  document.getElementById('qr-modal').hidden = true;
};

function startCountdown(seconds) {
  const el = document.getElementById('qr-countdown');
  const t  = setInterval(() => {
    seconds -= 1;
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    if (seconds <= 0) {
      clearInterval(t);
      document.getElementById('qr-modal').hidden = true;
    }
  }, 1000);
}
```

> **Why encode just the sessionId?** Three layers of protection make it safe:
> (a) the doc auto-expires in 10 min, (b) it's marked claimed atomically, and (c) only an authenticated teacher can claim. Putting a full URL or token in the QR adds nothing.

---

## Teacher side — implementation

### Required vendor file
Drop into `public/vendor/`:
- `html5-qrcode.min.js` (mebjas/html5-qrcode)

### Scanner UI (in `teacher.html`)

```html
<button class="btn btn-secondary" id="open-scanner">📷 Scan Smart Board QR</button>

<div class="modal-backdrop" id="scanner-modal" hidden>
  <div class="modal">
    <h2 class="modal-title">Scan QR from Smart Board</h2>
    <div id="qr-reader" style="width: 100%; min-height: 320px;"></div>
    <div id="scan-status" class="text-muted" style="margin-top: var(--space-3);">
      Point your camera at the QR code on the board.
    </div>
    <div class="row row-end" style="margin-top: var(--space-4);">
      <button class="btn btn-ghost" id="scanner-close">Cancel</button>
    </div>
  </div>
</div>

<script src="../vendor/html5-qrcode.min.js"></script>
```

### Scanner JS (in `teacher.js`)

```js
import { requireRole } from '../shared/js/auth.js';
import { functions }   from '../shared/js/firebase-config.js';
import { httpsCallable }
  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';
import { toast } from '../shared/js/ui.js';

const user = await requireRole('teacher');
const claim = httpsCallable(functions, 'claimBoardSession');

let scanner = null;

document.getElementById('open-scanner').onclick = async () => {
  document.getElementById('scanner-modal').hidden = false;
  scanner = new Html5Qrcode('qr-reader');
  try {
    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 240, height: 240 } },
      onScanned,
      () => {}      // ignore "no qr found" frames
    );
  } catch (e) {
    document.getElementById('scan-status').textContent = `Camera error: ${e.message}`;
  }
};

document.getElementById('scanner-close').onclick = closeScanner;

async function closeScanner() {
  document.getElementById('scanner-modal').hidden = true;
  if (scanner) {
    try { await scanner.stop(); await scanner.clear(); } catch {}
    scanner = null;
  }
}

async function onScanned(decodedText) {
  // Decoded text is the sessionId
  await closeScanner();
  document.getElementById('scan-status').textContent = 'Claiming session...';

  try {
    // Pass the active classroomId from the teacher UI state
    const classroomId = window.appState?.activeClassroomId || '';
    const res = await claim({ sessionId: decodedText, classroomId });
    toast(`Saved as new file (${res.data.fileId.slice(0, 8)})`, 'success');
    // The file list listener will pick up the new doc automatically
  } catch (err) {
    if (err.code === 'failed-precondition')   toast('That QR was already used.', 'error');
    else if (err.code === 'deadline-exceeded') toast('That QR expired. Generate a new one.', 'error');
    else if (err.code === 'not-found')         toast('Invalid QR code.', 'error');
    else                                        toast(`Error: ${err.message}`, 'error');
  }
}
```

---

## Edge cases to handle

| Case                                          | Handling                                                              |
|-----------------------------------------------|-----------------------------------------------------------------------|
| Two teachers scan the same QR simultaneously  | Firestore transaction lets only one win; second gets `failed-precondition` |
| QR is photographed and scanned 9 minutes later| Still valid if not yet claimed; cleanup function eventually removes it |
| QR is scanned 11 minutes later                | Cloud Function returns `deadline-exceeded`; toast tells user          |
| Camera permission denied                      | Modal shows the error with a manual-entry fallback (paste sessionId)  |
| Board upload completes but Firestore write fails (network blip) | Retry once; if still fails, alert and let user re-save        |
| Board reopens with stale QR modal             | Always close modal on `beforeunload` and after countdown finishes     |

---

## Optional manual-entry fallback

If a teacher's camera fails, accept a typed code:

```html
<details style="margin-top: var(--space-3);">
  <summary class="text-muted">Camera not working? Enter code manually</summary>
  <div class="row" style="margin-top: var(--space-3);">
    <input class="input" id="manual-code" placeholder="Paste session ID">
    <button class="btn btn-secondary" id="manual-submit">Claim</button>
  </div>
</details>
```

```js
document.getElementById('manual-submit').onclick = () => {
  const code = document.getElementById('manual-code').value.trim();
  if (code) onScanned(code);
};
```

---

## Why not encode a full URL?

A common alternative is encoding `https://yourapp.com/teacher?claim=SESSION_ID`. Two reasons we don't:

1. **Security theatre** — the URL doesn't add any verification on top of what we already have (auth + transaction + expiry).
2. **UX** — if a non-teacher scans the QR with their phone's default camera, they end up at a login wall on a page that doesn't make sense to them. Encoding just the ID means only our in-app scanner ever processes the code.

If you later want a "tap to add to your account" experience for trusted environments, switch to a deep-link URL and have the teacher app intercept the `?claim=` param at boot.
