import {
  signInWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { auth, db, ADMIN_EMAILS } from '../shared/js/firebase-config.js';
import { redirectByRole } from '../shared/js/router.js';
import { logActivity } from '../shared/js/activity.js';

// ---- DOM refs --------------------------------------------------------------
const form       = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const pwInput    = document.getElementById('password');
const signinBtn  = document.getElementById('signin-btn');
const errorMsg   = document.getElementById('error-msg');
const togglePw   = document.getElementById('toggle-pw');
const forgotPw   = document.getElementById('forgot-pw');
const rolePills  = document.querySelectorAll('.role-pill');

// ---- Frozen account message -----------------------------------------------
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'frozen') {
  showError('Your account has been suspended. Contact your administrator.');
}

// ---- Redirect if already signed in ----------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    if (ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      redirectByRole('admin');
      return;
    }
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists() && snap.data().role) {
      redirectByRole(snap.data().role);
    }
  } catch {
    // not redirecting
  }
});

// ---- Role pills ------------------------------------------------------------
rolePills.forEach(pill => {
  pill.addEventListener('click', () => {
    rolePills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
  });
});

// ---- Password toggle -------------------------------------------------------
togglePw.addEventListener('click', () => {
  const isText = pwInput.type === 'text';
  pwInput.type = isText ? 'password' : 'text';
  togglePw.setAttribute('aria-label', isText ? 'Show password' : 'Hide password');
  document.getElementById('eye-icon').innerHTML = isText
    ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
    : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/>';
});

// ---- Sign in ---------------------------------------------------------------
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const email    = emailInput.value.trim().toLowerCase();
  const password = pwInput.value;

  if (!email || !password) {
    showError('Please enter your email and password.');
    return;
  }

  setLoading(true);

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const user = cred.user;

    // Hardcoded admin — auto-create Firestore doc if missing, then redirect
    if (ADMIN_EMAILS.includes(email)) {
      await setDoc(doc(db, 'users', user.uid), {
        email:        user.email,
        displayName:  user.displayName || email.split('@')[0],
        role:         'admin',
        frozen:       false,
        classroomIds: [],
        updatedAt:    serverTimestamp()
      }, { merge: true });
      await logActivity('login');
      redirectByRole('admin');
      return;
    }

    // All other users: read role from Firestore
    const userSnap = await getDoc(doc(db, 'users', user.uid));
    if (!userSnap.exists() || !userSnap.data().role) {
      await signOut(auth);
      showError('Your account has no role assigned. Contact your administrator.');
      return;
    }

    const userData = userSnap.data();
    if (userData.frozen === true) {
      await signOut(auth);
      showError('Your account has been suspended. Contact your administrator.');
      return;
    }

    await logActivity('login');
    redirectByRole(userData.role);

  } catch (err) {
    const messages = {
      'auth/invalid-credential': 'Invalid email or password.',
      'auth/user-not-found':     'No account found with this email.',
      'auth/wrong-password':     'Incorrect password.',
      'auth/too-many-requests':  'Too many attempts. Please try again later.',
      'auth/user-disabled':      'This account has been disabled.',
      'auth/invalid-email':      'Please enter a valid email address.'
    };
    showError(messages[err.code] || 'Sign-in failed. Please try again.');
  } finally {
    setLoading(false);
  }
});

// ---- Forgot password -------------------------------------------------------
forgotPw.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  if (!email) {
    showError('Enter your email address above, then click "Forgot password?".');
    emailInput.focus();
    return;
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showSuccess('Password reset email sent. Check your inbox.');
  } catch {
    showError('Could not send reset email. Check the address and try again.');
  }
});

// ---- Helpers ---------------------------------------------------------------
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.removeProperty('background');
  errorMsg.style.removeProperty('border-color');
  errorMsg.style.removeProperty('color');
  errorMsg.classList.remove('hidden');
}

function hideError() {
  errorMsg.classList.add('hidden');
  errorMsg.textContent = '';
}

function showSuccess(msg) {
  errorMsg.textContent = msg;
  errorMsg.style.background   = 'var(--success-soft)';
  errorMsg.style.borderColor  = 'var(--success)';
  errorMsg.style.color        = 'var(--success-text)';
  errorMsg.classList.remove('hidden');
}

function setLoading(loading) {
  signinBtn.disabled    = loading;
  signinBtn.textContent = loading ? 'Signing in…' : 'Sign In';
}
