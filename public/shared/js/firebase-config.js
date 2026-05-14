import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js';
import { getFunctions }   from 'https://www.gstatic.com/firebasejs/10.7.0/firebase-functions.js';

// ---- Hardcoded admin emails -----------------------------------------------
// These emails are automatically granted admin role on first login.
// Add more emails separated by commas.
export const ADMIN_EMAILS = [
  'faresayman12316@gmail.com',
  'smart.go.9966@gmail.com',
];

// ---- Firebase config ------------------------------------------------------
const firebaseConfig = {
    apiKey: "AIzaSyBorFvHOvBTzc4Ot57ZFi8YB8S1K0zwKcc",
    authDomain: "educationalplatform-e744b.firebaseapp.com",
    projectId: "educationalplatform-e744b",
    storageBucket: "educationalplatform-e744b.firebasestorage.app",
    messagingSenderId: "65801719587",
    appId: "1:65801719587:web:07b28a8cb5786ee2f84696",
    measurementId: "G-KLVN9C1YSC"
  };

const app = initializeApp(firebaseConfig);

export const auth           = getAuth(app);
export const db             = getFirestore(app);
export const functions      = getFunctions(app);
export const FIREBASE_API_KEY = firebaseConfig.apiKey;

export { app };
