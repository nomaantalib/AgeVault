const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');
const upload = require('../middleware/upload');
const { uploadImage } = require('../config/cloudinary');
const { protect, clubOrAdmin } = require('../middleware/auth');
const fs = require('fs');
const { execFile } = require('child_process');
const path = require('path');

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

// Helper to spawn backend Python PaddleOCR + DeepFace verification script
const runPythonMLVerify = (idCardPath, selfiePath, idType) => {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'verify_ml.py');
    execFile('python', [scriptPath, idCardPath, selfiePath, idType || 'aadhaar'], (error, stdout, stderr) => {
      if (error) {
        console.warn('Python PaddleOCR + DeepFace verification failed or is not installed:', stderr || error.message);
        return resolve(null);
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (e) {
        console.error('Failed to parse Python ML output:', stdout);
        resolve(null);
      }
    });
  });
};

// @route   POST api/verify/extract
// @desc    Extract details from ID Card using Tesseract OCR on backend
// @access  Private
router.post('/extract', protect, upload.single('idCard'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ID Card image is required' });
    }
    const { idType } = req.body;
    const idCardLocalPath = req.file.path;

    const Tesseract = require('tesseract.js');
    const { parseOcrText } = require('../utils/ocrParser');

    console.log(`Running backend Tesseract OCR for type: ${idType} on ${idCardLocalPath}...`);
    
    const { data: { text } } = await Tesseract.recognize(
      idCardLocalPath,
      'eng'
    );

    // Clean up local file after OCR extraction
    fs.unlink(idCardLocalPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.warn('Temp file cleanup warning in /extract:', err.message);
      }
    });

    const parsedData = parseOcrText(text, idType || 'aadhaar');
    console.log('Backend OCR Extracted details:', parsedData);

    res.json({
      success: true,
      data: parsedData,
      rawText: text
    });
  } catch (error) {
    console.error('Backend Tesseract OCR extraction error:', error);
    res.status(500).json({ success: false, message: 'Failed to extract text from document.' });
  }
});

// @route   POST api/verify/submit
// @desc    Submit ID Card + Live Selfie for verification
// @access  Private
router.post('/submit', protect, upload.fields([
  { name: 'idCard', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), async (req, res) => {
  try {
    const { name, dob, idNumber, faceMatchConfidence, ocrName, ocrDob, ocrIdNumber, idType } = req.body;

    if (!dob) {
      return res.status(400).json({ success: false, message: 'Date of birth (DOB) is required' });
    }

    if (!req.files || !req.files['idCard'] || !req.files['selfie']) {
      return res.status(400).json({ success: false, message: 'Both ID Card and Selfie images are required' });
    }

    const age = calculateAge(dob);

    if (age < 18) {
      return res.status(400).json({ success: false, message: 'Access Denied: You must be 18 years or older to register.' });
    }

    const idCardLocalPath = req.files['idCard'][0].path;
    const selfieLocalPath = req.files['selfie'][0].path;

    // Trigger the high-accuracy backend Python ML pipeline (PaddleOCR + DeepFace)
    let mlVerified = false;
    let mlMatchScore = 0;
    let mlDob = '';
    let mlName = '';
    let mlIdNumber = '';

    const mlResult = await runPythonMLVerify(idCardLocalPath, selfieLocalPath, idType);

    if (mlResult && mlResult.success) {
      console.log('Backend PaddleOCR + DeepFace Pipeline executed successfully:', mlResult);
      mlVerified = true;
      mlMatchScore = mlResult.face_match_confidence;
      mlDob = mlResult.dob;
      mlName = mlResult.name;
      mlIdNumber = mlResult.id_number;
    } else {
      console.warn('Backend Python ML Pipeline failed/missing dependencies. Falling back to client-side inputs.');
    }

    // Upload files using the Cloudinary/Local adapter
    const idCardUrl = await uploadImage(idCardLocalPath, req);
    const selfieUrl = await uploadImage(selfieLocalPath, req);

    // Clean up temp files from disk asynchronously after upload (prevents disk leak)
    const cleanupFiles = () => {
      [idCardLocalPath, selfieLocalPath].forEach(filePath => {
        fs.unlink(filePath, (err) => {
          if (err && err.code !== 'ENOENT') {
            console.warn('Temp file cleanup warning:', err.message);
          }
        });
      });
    };
    cleanupFiles();

    const confidenceScore = mlVerified ? mlMatchScore : (faceMatchConfidence ? parseFloat(faceMatchConfidence) : 0);

    // Helper: Normalize strings for fuzzy comparison to ignore minor OCR reading typos
    const cleanStringForComparison = (str) => {
      if (!str) return '';
      return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
    };

    // Strict OCR Verification Guard:
    // Auto-verify ONLY if:
    // 1. Calculated age is >= 18
    // 2. Face match confidence is 40% or higher
    // 3. User entered DOB matches the raw OCR-extracted DOB
    // 4. User entered Name matches the raw OCR-extracted Name
    let status = 'pending';
    
    if (mlVerified) {
      const isDobMatching = mlDob && dob === mlDob;
      const isNameMatching = mlName && cleanStringForComparison(name) === cleanStringForComparison(mlName);
      const isIdNumberMatching = mlIdNumber && cleanStringForComparison(idNumber) === cleanStringForComparison(mlIdNumber);
      
      if (age >= 18 && confidenceScore >= 40 && isDobMatching && isNameMatching && isIdNumberMatching) {
        status = 'verified';
        console.log('Strict backend PaddleOCR + DeepFace verification passed. Auto-verifying user.');
      } else {
        status = 'pending';
        console.log('Strict backend verification mismatch or low confidence. Set to pending:', {
          age: age >= 18,
          confidence: confidenceScore >= 40,
          isDobMatching,
          isNameMatching,
          isIdNumberMatching,
          mlDob,
          dob,
          mlName,
          name,
          mlIdNumber,
          idNumber
        });
      }
    } else {
      const isDobMatching = ocrDob && dob === ocrDob;
      const isNameMatching = ocrName && cleanStringForComparison(name) === cleanStringForComparison(ocrName);
      const isIdNumberMatching = ocrIdNumber && cleanStringForComparison(idNumber) === cleanStringForComparison(ocrIdNumber);
      
      if (age >= 18 && confidenceScore >= 40 && isDobMatching && isNameMatching && isIdNumberMatching) {
        status = 'verified';
        console.log('Client-side Tesseract OCR + face-api verification passed. Auto-verifying user.');
      } else {
        status = 'pending';
        console.log('Client-side verification mismatch or low confidence. Defaulting status to pending for admin human review:', {
          age: age >= 18,
          confidence: confidenceScore >= 40,
          isDobMatching,
          isNameMatching,
          isIdNumberMatching,
          ocrDob,
          dob,
          ocrName,
          name,
          ocrIdNumber,
          idNumber
        });
      }
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.name = name || user.name;
    user.dob = new Date(dob);
    user.age = age;
    user.idNumber = idNumber || user.idNumber;
    user.ocrName = ocrName || user.ocrName;
    if (ocrDob) {
      user.ocrDob = new Date(ocrDob);
    }
    user.ocrIdNumber = ocrIdNumber || user.ocrIdNumber;
    user.status = status;
    user.idCardUrl = idCardUrl;
    user.selfieUrl = selfieUrl;
    user.faceMatchConfidence = confidenceScore;
    user.rejectionReason = ''; // Clear previous reasons
    user.qrScanned = false; // Reset scan status on new submission
 
    // Generate Encrypted / Signed JWT for QR verification ONLY if verified
    const jwtSecret = process.env.JWT_SECRET;
    if (status === 'verified') {
      const qrPayload = {
        uid: user._id,
        name: user.name,
        verified: true,
        age: age,
        timestamp: Math.floor(Date.now() / 1000)
      };
      const qrToken = jwt.sign(qrPayload, jwtSecret, { expiresIn: '72h' });
      user.qrToken = qrToken;
      user.qrPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit passcode
      user.qrPinExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days expiry
    } else {
      user.qrToken = '';
      user.qrPin = '';
      user.qrPinExpires = undefined;
    }

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
    return res.status(400).json({ success: false, message: 'QR Passcode or PIN is required' });
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    let user;
    let decoded = null;

    // Check if the scanned token is a 6-digit passcode or 8-digit PIN code
    if (/^\d{6}$/.test(qrToken.trim()) || /^\d{8}$/.test(qrToken.trim())) {
      user = await User.findOne({ qrPin: qrToken.trim() });
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Access Denied: Invalid PIN code. Customer record not found.'
        });
      }
    } else {
      // Decode and verify JWT signature to extract user ID
      try {
        decoded = jwt.verify(qrToken, jwtSecret);
        user = await User.findById(decoded.uid);
      } catch (err) {
        return res.status(400).json({
          success: false,
          message: 'Access Denied: Invalid QR Code. Token has been modified, forged, or is expired.'
        });
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Access Denied: Scanned customer profile does not exist.'
      });
    }

    // Package user details payload for display on scanner
    const userDetails = {
      id: user._id,
      name: user.name,
      age: user.age,
      dob: user.dob,
      phone: user.phone ? user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3') : 'N/A',
      selfieUrl: user.selfieUrl,
      idCardUrl: user.idCardUrl,
      faceMatchConfidence: user.faceMatchConfidence,
      verifiedAt: user.qrScannedAt
    };

    // Get latest event details
    const event = await Event.findOne().sort({ createdAt: -1 });

    // Check 1: Event timeline check
    if (event) {
      const eventTime = new Date(event.dateTime).getTime();
      const currentTime = Date.now();
      if (currentTime > eventTime) {
        return res.json({
          success: true,
          verified: false,
          status: user.status,
          message: `Access Denied: The event (${event.title}) date and time has passed. This ticket is expired.`,
          eventTitle: event.title,
          user: userDetails
        });
      }
    }

    // Check 2: Expiration check (valid for 3 days / 72 hours)
    const isExpired = decoded
      ? (decoded.timestamp && (Math.floor(Date.now() / 1000) - decoded.timestamp) > 72 * 60 * 60)
      : (user.qrPinExpires && new Date() > user.qrPinExpires);

    if (isExpired) {
      return res.json({
        success: true,
        verified: false,
        status: user.status,
        message: 'Access Denied: QR Pass/PIN has expired (older than 3 days). Please refresh the dashboard.',
        eventTitle: event ? event.title : 'General Admission',
        user: userDetails
      });
    }

    // Check 3: One-time scan check
    if (user.qrScanned) {
      return res.json({
        success: true,
        verified: false,
        status: user.status,
        message: `Access Denied: Ticket already scanned on ${new Date(user.qrScannedAt).toLocaleTimeString()}. Double entry is blocked.`,
        eventTitle: event ? event.title : 'General Admission',
        user: userDetails
      });
    }

    // Check 4: Verification status check
    if (user.status !== 'verified') {
      return res.json({
        success: true,
        verified: false,
        status: user.status,
        message: `Access Denied: User is not verified. Current status: ${user.status.toUpperCase()}`,
        eventTitle: event ? event.title : 'General Admission',
        user: userDetails
      });
    }

    // Successfully verified and scanned! Mark QR as scanned/used.
    user.qrScanned = true;
    user.qrScannedAt = new Date();
    await user.save();

    // Update verifiedAt in details
    userDetails.verifiedAt = user.qrScannedAt;

    res.json({
      success: true,
      verified: true,
      status: user.status,
      message: 'Access Granted: User pass verified successfully.',
      eventTitle: event ? event.title : 'General Admission',
      user: userDetails
    });
  } catch (error) {
    console.error('Scan verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during QR scan verification.'
    });
  }
});

// @route   POST api/verify/access
// @desc    Gate staff override to manually grant or revoke user entry/verification status
// @access  Private (Club or Admin only)
router.post('/access', protect, clubOrAdmin, async (req, res) => {
  const { userId, action } = req.body;

  if (!userId || !['grant', 'revoke'].includes(action)) {
    return res.status(400).json({ success: false, message: 'UserId and action (grant/revoke) are required.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Get latest event details
    const event = await Event.findOne().sort({ createdAt: -1 });

    if (action === 'grant') {
      user.status = 'verified';
      user.qrScanned = true;
      user.qrScannedAt = new Date();
      // Generate dynamic QR token if it doesn't exist
      if (!user.qrToken) {
        const jwtSecret = process.env.JWT_SECRET;
        const qrPayload = {
          uid: user._id,
          name: user.name,
          verified: true,
          age: user.age || 18,
          timestamp: Math.floor(Date.now() / 1000)
        };
        user.qrToken = jwt.sign(qrPayload, jwtSecret, { expiresIn: '72h' });
      }
      if (!user.qrPin) {
        user.qrPin = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit passcode
        user.qrPinExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days expiry
      }
      await user.save();
      return res.json({ 
        success: true, 
        verified: true,
        status: user.status,
        message: `Entry manually GRANTED and verification pass approved for ${user.name}.`,
        eventTitle: event ? event.title : 'General Admission',
        user: {
          id: user._id,
          name: user.name,
          age: user.age,
          dob: user.dob,
          phone: user.phone ? user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3') : 'N/A',
          status: user.status,
          qrScanned: user.qrScanned,
          qrScannedAt: user.qrScannedAt,
          faceMatchConfidence: user.faceMatchConfidence,
          idCardUrl: user.idCardUrl,
          selfieUrl: user.selfieUrl
        }
      });
    } else {
      // Action: revoke
      user.status = 'rejected';
      user.qrToken = ''; // Clear QR token upon revocation
      user.qrScanned = false;
      user.qrScannedAt = undefined;
      await user.save();
      return res.json({ 
        success: true, 
        verified: false,
        status: user.status,
        message: `Verification pass and entry REVOKED for ${user.name}.`,
        eventTitle: event ? event.title : 'General Admission',
        user: {
          id: user._id,
          name: user.name,
          age: user.age,
          dob: user.dob,
          phone: user.phone ? user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3') : 'N/A',
          status: user.status,
          qrScanned: user.qrScanned,
          qrScannedAt: user.qrScannedAt,
          faceMatchConfidence: user.faceMatchConfidence,
          idCardUrl: user.idCardUrl,
          selfieUrl: user.selfieUrl
        }
      });
    }
  } catch (error) {
    console.error('Manual override access error:', error);
    res.status(500).json({ success: false, message: 'Server error while updating access status.' });
  }
});

module.exports = router;
