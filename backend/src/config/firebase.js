const admin = require('firebase-admin');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

let isFirebaseAdminInitialized = false;

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    isFirebaseAdminInitialized = true;
    console.log('Firebase Admin SDK initialized successfully.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK:', error);
  }
} else {
  console.log('Firebase Service Account path not provided or file missing. Firebase operations will run in simulated mode.');
}

/**
 * Verifies a Firebase ID token or validates a simulated token.
 * @param {string} token - The Firebase ID token or a simulated OTP token.
 * @returns {Promise<object>} The decoded token claims (contains phone_number, uid, etc.).
 */
const verifyFirebaseToken = async (token) => {
  // Check if it's a simulated token (for local developer ease of use)
  if (process.env.USE_SIMULATED_OTP === 'true' || token.startsWith('simulated-token-')) {
    const phone = token.replace('simulated-token-', '');
    return {
      uid: `simulated-uid-${phone}`,
      phone_number: phone,
      firebase: { sign_in_provider: 'phone' },
    };
  }

  if (!isFirebaseAdminInitialized) {
    throw new Error('Firebase Admin SDK not initialized and simulated mode is disabled.');
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Firebase token verification error:', error);
    throw error;
  }
};

module.exports = {
  verifyFirebaseToken,
  isFirebaseAdminInitialized,
};
