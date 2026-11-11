import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const LOCAL_PROJECT_ID = "checkin-local";

function credentialValue(name) {
  return (process.env[name] || "").trim();
}

// Local runs have no service account. Point the Admin SDK at the emulator
// before the first Firestore call. A deployed server sets one of the
// credential variables and talks to the real project instead.
export function ensureFirestoreTarget() {
  const hasCredentials = Boolean(credentialValue("GOOGLE_APPLICATION_CREDENTIALS") || credentialValue("FIREBASE_SERVICE_ACCOUNT"));
  if (!process.env.FIRESTORE_EMULATOR_HOST && !hasCredentials) {
    process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  }
}

export function firestoreProjectId() {
  return process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || LOCAL_PROJECT_ID;
}

export function firestoreTargetLabel() {
  ensureFirestoreTarget();
  if (process.env.FIRESTORE_EMULATOR_HOST) return `emulator ${process.env.FIRESTORE_EMULATOR_HOST}`;
  return `project ${firestoreProjectId()}`;
}

export function getDb() {
  ensureFirestoreTarget();
  if (getApps().length === 0) {
    const projectId = firestoreProjectId();
    const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
    const serviceAccount = credentialValue("FIREBASE_SERVICE_ACCOUNT");

    if (!emulator && serviceAccount) {
      let parsed;
      try {
        parsed = JSON.parse(serviceAccount);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON.");
      }
      initializeApp({ credential: cert(parsed), projectId: parsed.project_id || projectId });
    } else if (!emulator && credentialValue("GOOGLE_APPLICATION_CREDENTIALS")) {
      initializeApp({ credential: applicationDefault(), projectId });
    } else {
      initializeApp({ projectId });
    }
  }
  return getFirestore();
}
