// Firebase Admin SDK for server-side authentication
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

let adminApp: App;

export function getFirebaseAdmin() {
  if (getApps().length === 0) {
    // Parse service account from environment variable
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT environment variable is required for production authentication. " +
        "Please add your Firebase service account JSON to Secrets."
      );
    }

    let serviceAccountObj;
    try {
      serviceAccountObj = JSON.parse(serviceAccount);
    } catch (error) {
      throw new Error(
        "Invalid FIREBASE_SERVICE_ACCOUNT format. Please ensure it's a valid JSON string."
      );
    }

    // Initialize Firebase Admin SDK with service account
    adminApp = initializeApp({
      credential: cert(serviceAccountObj),
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
  return adminApp || getApps()[0];
}

// Verify ID tokens using Firebase Admin SDK
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  try {
    const app = getFirebaseAdmin();
    const auth = getAuth(app);
    return await auth.verifyIdToken(token);
  } catch (error) {
    console.error("Token verification failed:", error);
    throw new Error("Invalid or expired authentication token");
  }
}