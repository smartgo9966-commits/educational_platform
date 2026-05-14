import {
  signInAnonymously
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  collection, doc, serverTimestamp, setDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { auth, db } from '../shared/js/firebase-config.js';
import { uploadBlob } from '../shared/js/storage.js';

// ---- Anonymous sign-in (board requires no login) -------------------------
let currentUser = null;
try {
  const cred = await signInAnonymously(auth);
  currentUser = cred.user;
} catch (e) {
  console.warn('Board: anonymous sign-in unavailable –', e.message);
}

// ---- Fabric canvas -------------------------------------------------------
const canvas = new fabric.Canvas('board-canvas', {
  width:         window.innerWidth,
  height:        window.innerHeight - 64,
  isDrawingMode: true,
  selection:     false,
});

canvas.freeDrawingBrush.color = '#0B1F3A';
canvas.freeDrawingBrush.width = 5;

window.addEventListener('resize', () => {
  canvas.setWidth(window.innerWidth);
  canvas.setHeight(window.innerHeight - 64);
  canvas.renderAll();
});

// ---- Tool state ----------------------------------------------------------
let activeTool  = 'pen';
let activeColor = '#0B1F3A';
let activeSize  = 5;

// ---- History (undo / redo) -----------------------------------------------
const history   = [JSON.stringify({ objects: [] })];
const redoStack = [];
let   pauseHist = false;

function pushHistory() {
  if (pauseHist) return;
  redoStack.length = 0;
  history.push(JSON.stringify(canvas.toJSON(['selectable', 'evented'])));
}

canvas.on('object:added',    pushHistory);
canvas.on('object:modified', pushHistory);
canvas.on('object:removed',  pushHistory);

// ---- Eraser — removes objects the cursor touches -------------------------
let isErasing = false;

canvas.on('mouse:down', (opt) => {
  if (activeTool !== 'eraser') return;
  isErasing = true;
  eraseAt(opt.pointer);
});

canvas.on('mouse:move', (opt) => {
  if (!isErasing || activeTool !== 'eraser') return;
  eraseAt(opt.pointer);
});

canvas.on('mouse:up', () => { isErasing = false; });

function eraseAt(pointer) {
  if (!pointer) return;
  const radius  = Math.max(activeSize * 2, 12);
  const removed = [];
  canvas.forEachObject(obj => {
    const bb = obj.getBoundingRect(true, true);
    if (
      pointer.x >= bb.left   - radius && pointer.x <= bb.left   + bb.width  + radius &&
      pointer.y >= bb.top    - radius && pointer.y <= bb.top    + bb.height + radius
    ) {
      removed.push(obj);
    }
  });
  if (removed.length) {
    removed.forEach(obj => canvas.remove(obj));
    canvas.renderAll();
  }
}

// ---- Activate a drawing tool ---------------------------------------------
function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll('.board-tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.board-tool-btn[data-tool="${tool}"]`);
  if (btn) btn.classList.add('active');

  canvas.defaultCursor = 'default';
  canvas.hoverCursor   = 'move';

  if (tool === 'pen') {
    canvas.isDrawingMode = true;
    canvas.selection     = false;
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = activeSize;
  } else if (tool === 'eraser') {
    canvas.isDrawingMode = false;
    canvas.selection     = false;
    canvas.defaultCursor = 'crosshair';
    canvas.hoverCursor   = 'crosshair';
  } else {
    canvas.isDrawingMode = false;
    canvas.selection     = true;
  }
}

// ---- Tool buttons --------------------------------------------------------
document.getElementById('tool-pen').addEventListener('click', () => setTool('pen'));
document.getElementById('tool-eraser').addEventListener('click', () => setTool('eraser'));

document.getElementById('tool-text').addEventListener('click', () => {
  setTool('text');
  const t = new fabric.IText('Type here', {
    left:       Math.max(60, window.innerWidth  / 2 - 60),
    top:        Math.max(40, window.innerHeight / 2 - 40),
    fill:       activeColor,
    fontFamily: 'Inter, sans-serif',
    fontSize:   24,
    padding:    4,
  });
  canvas.add(t).setActiveObject(t);
  t.enterEditing();
});

document.getElementById('tool-rect').addEventListener('click', () => {
  setTool('rect');
  const r = new fabric.Rect({
    left:        window.innerWidth  / 2 - 100,
    top:         window.innerHeight / 2 - 70,
    width:       200,
    height:      140,
    fill:        'transparent',
    stroke:      activeColor,
    strokeWidth: activeSize,
  });
  canvas.add(r).setActiveObject(r);
});

document.getElementById('tool-circle').addEventListener('click', () => {
  setTool('circle');
  const c = new fabric.Circle({
    left:        window.innerWidth  / 2 - 80,
    top:         window.innerHeight / 2 - 80,
    radius:      80,
    fill:        'transparent',
    stroke:      activeColor,
    strokeWidth: activeSize,
  });
  canvas.add(c).setActiveObject(c);
});

// ---- Color picker --------------------------------------------------------
const colorInput  = document.getElementById('tool-color');
const colorSwatch = document.getElementById('color-swatch');

colorSwatch.style.background = activeColor;

colorInput.addEventListener('input', (e) => {
  activeColor = e.target.value;
  colorSwatch.style.background = activeColor;
  if (activeTool === 'pen') canvas.freeDrawingBrush.color = activeColor;
  const obj = canvas.getActiveObject();
  if (obj) {
    if (obj.type === 'i-text' || obj.type === 'text') {
      obj.set('fill', activeColor);
    } else {
      obj.set('stroke', activeColor);
    }
    canvas.renderAll();
  }
});

// ---- Size presets --------------------------------------------------------
document.querySelectorAll('.board-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.board-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeSize = parseInt(btn.dataset.size, 10);
    if (activeTool === 'pen') canvas.freeDrawingBrush.width = activeSize;
  });
});

// ---- Undo ----------------------------------------------------------------
document.getElementById('action-undo').addEventListener('click', () => {
  if (history.length < 2) return;
  redoStack.push(history.pop());
  pauseHist = true;
  canvas.loadFromJSON(
    JSON.parse(history[history.length - 1]),
    () => { canvas.renderAll(); pauseHist = false; }
  );
});

// ---- Redo ----------------------------------------------------------------
document.getElementById('action-redo').addEventListener('click', () => {
  if (!redoStack.length) return;
  const state = redoStack.pop();
  history.push(state);
  pauseHist = true;
  canvas.loadFromJSON(
    JSON.parse(state),
    () => { canvas.renderAll(); pauseHist = false; }
  );
});

// ---- Clear ---------------------------------------------------------------
document.getElementById('action-clear').addEventListener('click', () => {
  if (!confirm('Clear the entire board?')) return;
  canvas.clear();
  canvas.renderAll();
  history.length   = 1;
  redoStack.length = 0;
});

// ---- Save & Generate QR --------------------------------------------------
let countdownTimer = null;

document.getElementById('action-save-qr').addEventListener('click', async () => {
  const btn = document.getElementById('action-save-qr');
  btn.disabled    = true;
  btn.textContent = 'Saving…';

  try {
    // 1. Export canvas to PNG with white background
    canvas.backgroundColor = '#FFFFFF';
    canvas.renderAll();
    const dataURL = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    canvas.backgroundColor = null;
    canvas.renderAll();

    const blob = await (await fetch(dataURL)).blob();

    // 2. Generate session ID, then upload snapshot to Cloudinary
    const sessionRef = doc(collection(db, 'board_sessions'));
    const sessionId  = sessionRef.id;

    const { downloadURL } = await uploadBlob(blob, `${sessionId}.png`);

    // 3. Create board session in Firestore (includes Cloudinary URL for teacher claim)
    const expiresAt = Timestamp.fromMillis(Date.now() + 10 * 60 * 1000);
    await setDoc(sessionRef, {
      boardId:     currentUser?.uid || 'anonymous',
      storagePath: `cloudinary/${sessionId}`,
      downloadURL,
      createdAt:   serverTimestamp(),
      expiresAt,
      claimed:     false,
      claimedBy:   null,
      claimedAt:   null,
    });

    // 4. Render QR encoding just the sessionId
    const qrTarget = document.getElementById('qr-target');
    qrTarget.innerHTML = '';
    new QRCode(qrTarget, {
      text:         sessionId,
      width:        220,
      height:       220,
      colorDark:    '#0B1F3A',
      colorLight:   '#FFFFFF',
      correctLevel: QRCode.CorrectLevel.H,
    });

    // 5. Show modal + start 10-min countdown
    document.getElementById('qr-modal').classList.remove('hidden');
    startCountdown(10 * 60);

  } catch (err) {
    console.error('Save & QR failed:', err);
    alert(`Could not generate QR: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
      Save &amp; Generate QR`;
  }
});

// ---- Close QR modal ------------------------------------------------------
document.getElementById('qr-close').addEventListener('click', closeQR);

function closeQR() {
  document.getElementById('qr-modal').classList.add('hidden');
  if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; }
}

// ---- Countdown timer -----------------------------------------------------
function startCountdown(totalSeconds) {
  if (countdownTimer) clearInterval(countdownTimer);
  const el = document.getElementById('qr-countdown');
  let seconds = totalSeconds;

  function tick() {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el.textContent = `${m}:${s}`;
    seconds--;
    if (seconds < 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      document.getElementById('qr-modal').classList.add('hidden');
    }
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
}

window.addEventListener('beforeunload', () => {
  if (countdownTimer) clearInterval(countdownTimer);
});
