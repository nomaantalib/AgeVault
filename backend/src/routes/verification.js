const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const upload = require('../middleware/upload');
const { uploadImage } = require('../config/cloudinary');
const { protect, clubOrAdmin } = require('../middleware/auth');

// Helper: Calculate age from DOB
const calculateAge = (dobString) => {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// @route   POST api/verify/submit
// @desc    Submit ID Card + Live Selfie for verification
// @access  Private
router.post('/submit', protect, upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, dob, faceMatchConfidence } = req.body;

    if (!dob) {
      return res.status(400).json({ success: false, message: 'Date of birth (DOB) is required' });
    }

    if (!req.files || !req.files['idCard'] || !req.files['selfie']) {
      return res.status(400).json({ success: false, message: 'Both ID Card and Selfie images are required' });
    }

    const age = calculateAge(dob);

    // Upload files using the Cloudinary/Local adapter
    const idCardLocalPath = req.files['idCard'][0].path;
    const selfieLocalPath = req.files['selfie'][0].path;

    const idCardUrl = await uploadImage(idCardLocalPath, req);
    const selfieUrl = await uploadImage(selfieLocalPath, req);

    const confidenceScore = faceMatchConfidence ? parseFloat(faceMatchConfidence) : 0;

    // Determine verification status
    // Auto-verify if:
    // 1. User is older than 18
    // 2. Face match confidence is 75% or higher
    // Otherwise, set status to pending for admin manual review
    let status = 'pending';
    if (age >= 18 && confidenceScore >= 75) {
      status = 'verified';
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.name = name || user.name;
    user.dob = new Date(dob);
    user.age = age;
    user.status = status;
    user.idCardUrl = idCardUrl;
    user.selfieUrl = selfieUrl;
    user.faceMatchConfidence = confidenceScore;
    user.rejectionReason = ''; // Clear previous reasons

    // Generate Encrypted / Signed JWT for QR verification
    const jwtSecret = process.env.JWT_SECRET;
    const qrPayload = {
      uid: user._id,
      name: user.name,
      verified: status === 'verified',
      age: age,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const qrToken = jwt.sign(qrPayload, jwtSecret);
    user.qrToken = qrToken;

    await user.save();

    res.json({
      success: true,
      message: status === 'verified' ? 'Identity auto-verified successfully!' : 'Verification submitted and pending review.',
      status,
      user: {
        id: user._id,
        name: user.name,
        dob: user.dob,
        age: user.age,
        status: user.status,
        idCardUrl: user.idCardUrl,
        selfieUrl: user.selfieUrl,
        faceMatchConfidence: user.faceMatchConfidence,
        qrToken: user.qrToken
      }
    });
  } catch (error) {
    console.error('Submit verification error:', error);
    res.status(500).json({ success: false, message: 'Failed to process verification submission' });
  }
});

// @route   POST api/verify/scan
// @desc    Verify QR token scanned by club staff
// @access  Private (Club or Admin only)
router.post('/scan', protect, clubOrAdmin, async (req, res) => {
  const { qrToken } = req.body;

  if (!qrToken) {
    return res.status(400).json({ success: false, message: 'QR Token is required' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    // Verify JWT
    const decoded = jwt.verify(qrToken, jwtSecret);

    // Replay attack prevention: Ensure QR code was generated within the last 15 minutes
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const maxAge = 15 * 60; // 15 minutes
    if (decoded.timestamp && (currentTimestamp - decoded.timestamp) > maxAge) {
      return res.status(400).json({
        success: false,
        message: 'Security Alert: QR Code has expired. Ask the customer to refresh their dashboard.'
      });
    }

    // Fetch user from DB to verify status and prevent stale/revoked verification tokens
    const user = await User.findById(decoded.uid);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid QR Code: User does not exist.'
      });
    }

    if (user.status !== 'verified') {
      return res.json({
        success: true,
        verified: false,
        status: user.status,
        message: `User is not verified. Current status: ${user.status.toUpperCase()}`,
        user: {
          name: user.name,
          age: user.age,
          phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'), // Mask phone
          selfieUrl: user.selfieUrl,
          faceMatchConfidence: user.faceMatchConfidence
        }
      });
    }

    res.json({
      success: true,
      verified: true,
      status: user.status,
      message: 'Access Granted: User is verified.',
      user: {
        name: user.name,
        age: user.age,
        phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'),
        selfieUrl: user.selfieUrl,
        faceMatchConfidence: user.faceMatchConfidence,
        verifiedAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Scan verification error:', error);
    res.status(400).json({
      success: false,
      message: 'Invalid QR Code: Token has been modified or is expired.'
    });
  }
});

module.exports = router;
