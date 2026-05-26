const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const https = require('https');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Google ID Token Verification Helper using Native HTTPS
const verifyGoogleToken = (idToken) => {
  return new Promise((resolve, reject) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error_description) {
            reject(new Error(parsed.error_description));
          } else {
            resolve(parsed);
          }
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
};

// Helper: Format phone number consistently
const formatPhone = (phone) => {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return `+91${clean}`;
  }
  return phone.startsWith('+') ? phone : `+${clean}`;
};

// @route   POST api/auth/register
// @desc    Register a new user (role is strictly 'user')
// @access  Public
router.post('/register', async (req, res) => {
  const { email, phone, name, password, schoolAnswer, petAnswer, cityAnswer } = req.body;

  if (!email || !phone || !name || !password || !schoolAnswer || !petAnswer || !cityAnswer) {
    return res.status(400).json({ success: false, message: 'All fields (Name, Email, Phone, Password, and 3 Security Answers) are required.' });
  }

  try {
    const formattedPhone = formatPhone(phone);

    // Check if user already exists
    let existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase().trim() },
        { phone: formattedPhone }
      ]
    });

    if (existingUser) {
      // If user exists but has no password (registered via Google), upgrade the account!
      if (!existingUser.password) {
        const salt = await bcrypt.genSalt(10);
        existingUser.password = await bcrypt.hash(password, salt);
        existingUser.schoolAnswer = await bcrypt.hash(schoolAnswer.toLowerCase().trim(), salt);
        existingUser.petAnswer = await bcrypt.hash(petAnswer.toLowerCase().trim(), salt);
        existingUser.cityAnswer = await bcrypt.hash(cityAnswer.toLowerCase().trim(), salt);
        existingUser.phone = formattedPhone;
        existingUser.name = name.trim();
        await existingUser.save();

        const jwtSecret = process.env.JWT_SECRET;
        const token = jwt.sign(
          { id: existingUser._id, role: existingUser.role },
          jwtSecret,
          { expiresIn: '30d' }
        );

        return res.status(200).json({
          success: true,
          token,
          user: {
            id: existingUser._id,
            name: existingUser.name,
            email: existingUser.email,
            phone: existingUser.phone,
            role: existingUser.role,
            status: existingUser.status
          }
        });
      }

      return res.status(400).json({ success: false, message: 'An account with this email or phone number is already registered.' });
    }

    // Hash password and security question answers (case-insensitive conversion)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    const hashedSchool = await bcrypt.hash(schoolAnswer.toLowerCase().trim(), salt);
    const hashedPet = await bcrypt.hash(petAnswer.toLowerCase().trim(), salt);
    const hashedCity = await bcrypt.hash(cityAnswer.toLowerCase().trim(), salt);

    // Force role: 'user' for public registrations (staff must be created by admin)
    const newUser = new User({
      email: email.toLowerCase().trim(),
      phone: formattedPhone,
      name: name.trim(),
      password: hashedPassword,
      schoolAnswer: hashedSchool,
      petAnswer: hashedPet,
      cityAnswer: hashedCity,
      role: 'user',
      status: 'pending'
    });

    await newUser.save();

    // Generate session JWT
    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        status: newUser.status
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// @route   POST api/auth/login
// @desc    Authenticate user by email/phone and password
// @access  Public
router.post('/login', async (req, res) => {
  const { emailOrPhone, password } = req.body;

  if (!emailOrPhone || !password) {
    return res.status(400).json({ success: false, message: 'Email/Phone and Password are required.' });
  }

  try {
    const formattedPhone = formatPhone(emailOrPhone);
    const identifier = emailOrPhone.toLowerCase().trim();

    // Find user in database
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: formattedPhone }
      ]
    });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Account not found.' });
    }

    // Google-only users might not have a password configured
    if (!user.password) {
      return res.status(400).json({ success: false, message: 'No password has been set for this account yet. Please log in using Google, or register manually using the same email/phone to establish a password.' });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. Incorrect password.' });
    }

    // Generate session JWT
    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// @route   POST api/auth/google-login
// @desc    Authenticate user via Google OAuth ID token
// @access  Public
router.post('/google-login', async (req, res) => {
  const { idToken, phone } = req.body;

  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Google ID Token is required.' });
  }

  try {
    // 1. Verify token with Google
    const payload = await verifyGoogleToken(idToken);
    const email = payload.email.toLowerCase().trim();
    const name = payload.name;

    // 2. Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // If user doesn't exist, create a new one (strictly role: 'user')
      user = new User({
        email,
        name,
        phone: phone ? formatPhone(phone) : `+91-GOOGLE-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`, // Unique placeholder avoids MongoDB duplicate phone indexes
        role: 'user',
        status: 'pending'
      });
      await user.save();
    }

    // Generate session JWT
    const jwtSecret = process.env.JWT_SECRET;
    const token = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error('Google Auth Error:', error.message);
    res.status(400).json({ success: false, message: `Google authentication failed: ${error.message}` });
  }
});

// @route   POST api/auth/reset-password
// @desc    Reset password using security question answers
// @access  Public
router.post('/reset-password', async (req, res) => {
  const { emailOrPhone, schoolAnswer, petAnswer, cityAnswer, newPassword } = req.body;

  if (!emailOrPhone || !schoolAnswer || !petAnswer || !cityAnswer || !newPassword) {
    return res.status(400).json({ success: false, message: 'All security answers and new password are required.' });
  }

  try {
    const formattedPhone = formatPhone(emailOrPhone);
    const identifier = emailOrPhone.toLowerCase().trim();

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: formattedPhone }
      ]
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }

    // Check if security answers exist (e.g. Google-only users might not have them)
    if (!user.schoolAnswer || !user.petAnswer || !user.cityAnswer) {
      return res.status(400).json({ success: false, message: 'This account does not have security questions configured. Please log in with Google.' });
    }

    // Validate security answers (case-insensitive conversion)
    const matchSchool = await bcrypt.compare(schoolAnswer.toLowerCase().trim(), user.schoolAnswer);
    const matchPet = await bcrypt.compare(petAnswer.toLowerCase().trim(), user.petAnswer);
    const matchCity = await bcrypt.compare(cityAnswer.toLowerCase().trim(), user.cityAnswer);

    if (!matchSchool || !matchPet || !matchCity) {
      return res.status(401).json({ success: false, message: 'Security answers are incorrect. Reset rejected.' });
    }

    // Update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ success: true, message: 'Password has been successfully reset.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Server error during password reset.' });
  }
});

// @route   GET api/auth/me
// @desc    Get current user profile & Self-Healing check
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Self-healing: if user is verified but has no qrToken or qrPin, generate them dynamically
    if (user.status === 'verified') {
      let updated = false;

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
        updated = true;
      }

      if (!user.qrPin) {
        user.qrPin = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8-digit PIN
        user.qrPinExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days expiry
        updated = true;
      }

      if (updated) {
        await user.save();
      }
    }

    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
