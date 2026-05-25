// Firebase Admin has been removed from this project.
// Authentication is handled via MongoDB + Resend OTP flow only.
// This stub is kept to prevent module-not-found errors if anything still imports it.

const verifyFirebaseToken = async () => {
  throw new Error('Firebase has been removed. Use OTP-based auth via Resend.');
};

module.exports = {
  verifyFirebaseToken,
  isFirebaseAdminInitialized: false,
};
