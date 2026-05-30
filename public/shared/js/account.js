// Shared "account details" popup, used by the teacher / student / admin headers.
// Lazily injects a single #account-modal into <body> and reuses the
// .modal-backdrop / .modal styles from components.css.

let built = false;

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hide() {
  document.getElementById('account-modal')?.classList.add('hidden');
}

function ensureModal() {
  if (built) return;
  const wrap = document.createElement('div');
  wrap.className = 'modal-backdrop hidden';
  wrap.id = 'account-modal';
  wrap.innerHTML = `
    <div class="modal">
      <div class="account-head">
        <div class="account-avatar" id="account-avatar"></div>
        <div>
          <h3 class="modal-title" id="account-modal-title" style="margin:0">Account</h3>
          <p class="text-muted" id="account-modal-sub" style="margin:0"></p>
        </div>
      </div>
      <dl class="account-details" id="account-modal-body"></dl>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" id="account-modal-close">Close</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target.id === 'account-modal') hide(); });
  document.getElementById('account-modal-close').addEventListener('click', hide);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  });
  built = true;
}

/**
 * Show the account popup.
 * @param {object} opts
 * @param {string} opts.title    Display name (modal heading).
 * @param {string} [opts.subtitle] Small line under the title (e.g. email).
 * @param {string} [opts.initial]  Single letter for the avatar circle.
 * @param {{label:string, value:string}[]} opts.rows  Detail rows (empty values skipped).
 */
export function openAccountModal({ title, subtitle, initial, rows = [] }) {
  ensureModal();
  document.getElementById('account-modal-title').textContent = title || 'Account';
  document.getElementById('account-modal-sub').textContent = subtitle || '';
  document.getElementById('account-avatar').textContent =
    (initial || title || '?').trim().charAt(0).toUpperCase();

  document.getElementById('account-modal-body').innerHTML = rows
    .filter(r => r && r.value)
    .map(r => `<div class="account-row"><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`)
    .join('');

  document.getElementById('account-modal').classList.remove('hidden');
}
