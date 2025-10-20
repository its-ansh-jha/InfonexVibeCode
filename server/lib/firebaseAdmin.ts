// Firebase Admin SDK for server-side authentication
import { initializeApp, getApps, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

let adminApp: App;

export function getFirebaseAdmin() {
  if (getApps().length === 0) {
    // Initialize Firebase Admin SDK
    // For production, use service account credentials from environment
    // For development, Firebase Admin can work without explicit credentials if GOOGLE_APPLICATION_CREDENTIALS is set
    // or we can use the REST API approach for verification
    adminApp = initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    });
  }
  return adminApp || getApps()[0];
}

// Alternative: verify tokens using Firebase REST API (works without service account)
export async function verifyIdToken(token: string): Promise<DecodedIdToken> {
  try {
    // Try using Admin SDK first
    const app = getFirebaseAdmin();
    const auth = getAuth(app);
    return await auth.verifyIdToken(token);
  } catch (error) {
    // Fallback: Verify using Google's public key API (for development)
    // In production, ensure proper service account credentials are configured
    console.warn("Admin SDK verification failed, using REST API fallback:", error);
    return await verifyTokenWithRestAPI(token);
  }
}

// Fallback verification using Google's public API
async function verifyTokenWithRestAPI(idToken: string): Promise<DecodedIdToken> {
  const response = await fetch(
    `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.VITE_FIREBASE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) {
    throw new Error('Invalid ID token');
  }

  const data = await response.json();
  const user = data.users?.[0];

  if (!user) {
    throw new Error('User not found');
  }

  // Return a DecodedIdToken-like object
  return {
    uid: user.localId,
    email: user.email,
    email_verified: user.emailVerified === 'true',
    auth_time: parseInt(user.lastLoginAt) / 1000,
    iat: parseInt(user.lastLoginAt) / 1000,
    exp: parseInt(user.lastLoginAt) / 1000 + 3600, // 1 hour
    aud: process.env.VITE_FIREBASE_PROJECT_ID!,
    iss: `https://securetoken.google.com/${process.env.VITE_FIREBASE_PROJECT_ID}`,
    sub: user.localId,
  } as DecodedIdToken;
}
