// Firebase configuration - referenced from firebase_barebones_javascript blueprint
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithRedirect, 
  signOut, 
  onAuthStateChanged, 
  setPersistence,
  browserLocalPersistence,
  type User 
} from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Set persistence to LOCAL so auth state persists across browser sessions
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set auth persistence:", error);
});

export const googleProvider = new GoogleAuthProvider();

// Auth helpers
export const signInWithGoogle = () => signInWithRedirect(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export const onAuthChange = (callback: (user: User | null) => void) => 
  onAuthStateChanged(auth, callback);
