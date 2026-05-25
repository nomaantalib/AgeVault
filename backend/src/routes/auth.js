const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { verifyFirebaseToken } = require('../config/firebase');
const { protect } = require('../middleware/auth');

// @route   POST api/auth/verify-phone
// @desc    Verify phone token from Firebase and sign JWT
// @access  Public
router.post('/verify-phone', async (req, res) => {
  const { token, email, name } = req.body;

  if (!token) {
    return res.status(400).json({ success: false, message: 'Token is required' });
  }

  try {
    const decodedToken = await verifyFirebaseToken(token);
    const phoneNumber = decodedToken.phone_number;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Invalid phone authentication token' });
    }

    // Check if user exists
    let user = await User.findOne({ phone: phoneNumber });

    // Determine initial role (backdoors for easy testing/demo)
    let role = 'user';
    if (phoneNumber === '+919999999999') {
      role = 'admin';
    } else if (phoneNumber === '+918888888888') {
      role = 'club';
    }

    if (!user) {
      user = new User({
        phone: phoneNumber,
        email: email || '',
        name: name || '',
        role: role,
        status: role === 'user' ? 'pending' : 'verified', // admins/club don't need manual verification
      });
      await user.save();
    } else {
      let isUpdated = false;
      if (email && !user.email) {
        user.email = email;
        isUpdated = true;
      }
      if (name && !user.name) {
        user.name = name;
        isUpdated = true;
      }
      if (user.role !== role && (phoneNumber === '+919999999999' || phoneNumber === '+918888888888')) {
        user.role = role;
        user.status = 'verified';
        isUpdated = true;
      }
      if (isUpdated) {
        await user.save();
      }
    }

    // Sign Custom JWT
    const jwtSecret = process.env.JWT_SECRET;
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Phone verification login error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

// @route   POST api/auth/supabase-login
// @desc    Verify and create session for Supabase magic link login/register
// @access  Public
router.post('/supabase-login', async (req, res) => {
  const { email, name, phone, role } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }

  try {
    // Check if user exists by email or phone
    let user = await User.findOne({ $or: [{ email }, { phone: phone || '___none___' }] });

    let finalRole = role || 'user';
    // Backdoors for easy testing/demo
    if (email === 'admin@agevault.com' || phone === '+919999999999') {
      finalRole = 'admin';
    } else if (email === 'staff@agevault.com' || phone === '+918888888888') {
      finalRole = 'club';
    }

    if (!user) {
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required for registration' });
      }
      user = new User({
        email,
        phone,
        name: name || '',
        role: finalRole,
        status: finalRole === 'user' ? 'pending' : 'verified',
      });
      await user.save();
    } else {
      let isUpdated = false;
      if (name && user.name !== name) {
        user.name = name;
        isUpdated = true;
      }
      if (phone && user.phone !== phone) {
        user.phone = phone;
        isUpdated = true;
      }
      if (role && user.role !== finalRole) {
        user.role = finalRole;
        if (finalRole !== 'user') {
          user.status = 'verified';
        }
        isUpdated = true;
      }
      if (isUpdated) {
        await user.save();
      }
    }

    // Sign Custom JWT
    const jwtSecret = process.env.JWT_SECRET;
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      jwtSecret,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      token: jwtToken,
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    console.error('Supabase login error:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
});

// @route   GET api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
