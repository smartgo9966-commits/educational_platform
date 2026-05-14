let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast${type !== 'info' ? ` toast-${type}` : ''}`;
  el.textContent = msg;
  getToastContainer().appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

export function confirm(msg) {
  return window.confirm(msg);
}

let loaderEl = null;

export function showLoader() {
  if (!loaderEl) {
    loaderEl = document.createElement('div');
    loaderEl.className = 'loader-bar';
    document.body.prepend(loaderEl);
  }
  loaderEl.classList.remove('hidden');
}

export function hideLoader() {
  loaderEl?.classList.add('hidden');
}

export function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

export function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
