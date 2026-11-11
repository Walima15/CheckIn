import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || "checkin-local";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:checkin",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

const emulatorFlag = import.meta.env.VITE_FIREBASE_USE_EMULATOR;
const useEmulator = emulatorFlag === "true" || (import.meta.env.DEV && emulatorFlag !== "false");

if (useEmulator) {
  const globalState = globalThis as typeof globalThis & { __checkinFirestoreEmulator?: boolean };
  if (!globalState.__checkinFirestoreEmulator) {
    const raw = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    const [host, portText] = raw.split(":");
    connectFirestoreEmulator(db, host, Number(portText || 8080));
    globalState.__checkinFirestoreEmulator = true;
  }
}
