const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');
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

// Google Cloud Vision REST OCR Helper (100% Native NodeJS HTTPS)
const fs = require('fs');
const https = require('https');

const runGoogleVisionOCR = (filePath) => {
  return new Promise((resolve) => {
    const apiKey = process.env.GOOGLE_VISION_API_KEY;
    if (!apiKey) {
      console.log('Google Vision API key missing. Skipping backend ML verification.');
      return resolve(null);
    }

    try {
      if (!fs.existsSync(filePath)) {
        return resolve(null);
      }
      const imageBuffer = fs.readFileSync(filePath);
      const base64Image = imageBuffer.toString('base64');

      const requestData = JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image
            },
            features: [
              {
                type: 'TEXT_DETECTION'
              }
            ]
          }
        ]
      });

      const options = {
        hostname: 'vision.googleapis.com',
        path: `/v1/images:annotate?key=${apiKey}`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(requestData)
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
            const textAnnotations = parsed.responses?.[0]?.textAnnotations;
            if (textAnnotations && textAnnotations.length > 0) {
              resolve(textAnnotations[0].description);
            } else {
              resolve('');
            }
          } catch (e) {
            console.error('Failed to parse Google Vision response:', e);
            resolve('');
          }
        });
      });

      req.on('error', (e) => {
        console.error('Google Vision request error:', e);
        resolve('');
      });

      req.write(requestData);
      req.end();
    } catch (err) {
      console.error('Google Vision file read error:', err);
      resolve('');
    }
  });
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

    if (age < 18) {
      return res.status(400).json({ success: false, message: 'Access Denied: You must be 18 years or older to register.' });
    }

    // Google Cloud Vision OCR backend check (if API key is present)
    const idCardLocalPath = req.files['idCard'][0].path;
    const googleVisionText = await runGoogleVisionOCR(idCardLocalPath);

    if (googleVisionText) {
      console.log('Google Vision ML OCR extracted text successfully.');
      // Attempt to extract and double-check DOB
      const dobRegex = /\b\d{2}[\/\-]\d{2}[\/\-]\d{4}\b/g;
      const matches = googleVisionText.match(dobRegex);
      let dobParsed = '';
      
      if (matches && matches.length > 0) {
        const parts = matches[0].split(/[\/\-]/);
        if (parts[0].length === 4) {
          dobParsed = matches[0];
        } else {
          dobParsed = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }

      if (!dobParsed) {
        const yobRegex = /(?:Year of Birth|YOB|Birth|Year)\s*:\s*(\d{4})/i;
        const yobMatch = googleVisionText.match(yobRegex);
        if (yobMatch && yobMatch[1]) {
          dobParsed = `${yobMatch[1]}-01-01`;
        }
      }

      if (dobParsed) {
        const mlAge = calculateAge(dobParsed);
        if (mlAge < 18) {
          return res.status(400).json({ 
            success: false, 
            message: `Access Denied: Google ML Vision OCR verified that the DOB on this document (${dobParsed}) is underage.` 
          });
        }
        console.log(`Google Vision verified DOB: ${dobParsed}, Age: ${mlAge}`);
      }
    }

    // Upload files using the Cloudinary/Local adapter
    const selfieLocalPath = req.files['selfie'][0].path;

    const idCardUrl = await uploadImage(idCardLocalPath, req);
    const selfieUrl = await uploadImage(selfieLocalPath, req);

    const confidenceScore = faceMatchConfidence ? parseFloat(faceMatchConfidence) : 0;

    // Determine verification status
    // Auto-verify if:
    // 1. User is older than 18
    // 2. Face match confidence is 40% or higher
    // Otherwise, set status to pending for admin manual review
    let status = 'pending';
    if (age >= 18 && confidenceScore >= 40) {
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
    user.qrScanned = false; // Reset scan status on new submission

    // Generate Encrypted / Signed JWT for QR verification
    const jwtSecret = process.env.JWT_SECRET;
    const qrPayload = {
      uid: user._id,
      name: user.name,
      verified: status === 'verified',
      age: age,
      timestamp: Math.floor(Date.now() / 1000)
    };

    const qrToken = jwt.sign(qrPayload, jwtSecret, { expiresIn: '72h' });
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
    // 1. Fetch latest event details to check if the event timing has passed
    const event = await Event.findOne().sort({ createdAt: -1 });
    if (event) {
      const eventTime = new Date(event.dateTime).getTime();
      const currentTime = Date.now();
      if (currentTime > eventTime) {
        return res.status(400).json({
          success: false,
          message: `Access Denied: The event (${event.title}) date and time has passed. This ticket is expired.`
        });
      }
    }

    const jwtSecret = process.env.JWT_SECRET;
    // Verify JWT
    const decoded = jwt.verify(qrToken, jwtSecret);

    // Replay attack prevention: Ensure QR code was generated within the last 72 hours
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const maxAge = 72 * 60 * 60; // 72 hours
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

    // Enforce One-Time Use to prevent ticket sharing / duplication
    if (user.qrScanned) {
      return res.status(400).json({
        success: false,
        message: `Access Denied: This QR pass has already been scanned/used on ${new Date(user.qrScannedAt).toLocaleTimeString()}. Double entry is blocked.`
      });
    }

    if (user.status !== 'verified') {
      return res.json({
        success: true,
        verified: false,
        status: user.status,
        message: `User is not verified. Current status: ${user.status.toUpperCase()}`,
        user: {
          id: user._id,
          name: user.name,
          age: user.age,
          dob: user.dob,
          phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'), // Mask phone
          selfieUrl: user.selfieUrl,
          idCardUrl: user.idCardUrl,
          faceMatchConfidence: user.faceMatchConfidence
        }
      });
    }

    // Successfully verified and scanned! Mark QR as scanned/used.
    user.qrScanned = true;
    user.qrScannedAt = new Date();
    await user.save();

    res.json({
      success: true,
      verified: true,
      status: user.status,
      message: 'Access Granted: User is verified.',
      eventTitle: event ? event.title : 'General Admission',
      user: {
        id: user._id,
        name: user.name,
        age: user.age,
        dob: user.dob,
        phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'),
        selfieUrl: user.selfieUrl,
        idCardUrl: user.idCardUrl,
        faceMatchConfidence: user.faceMatchConfidence,
        verifiedAt: user.qrScannedAt
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
      await user.save();
      return res.json({ 
        success: true, 
        verified: true,
        status: user.status,
        message: `Entry manually GRANTED and verification pass approved for ${user.name}.`,
        eventTitle: event ? event.title : 'General Admission',
        user: {
          name: user.name,
          age: user.age,
          dob: user.dob,
          phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'),
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
          name: user.name,
          age: user.age,
          dob: user.dob,
          phone: user.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1*****$3'),
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
