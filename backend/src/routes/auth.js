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
  const { token, email } = req.body;

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
        role: role,
        status: role === 'user' ? 'pending' : 'verified', // admins/club don't need manual verification
      });
      await user.save();
    } else {
      if (email && !user.email) {
        user.email = email;
        await user.save();
      }
      if (user.role !== role && (phoneNumber === '+919999999999' || phoneNumber === '+918888888888')) {
        // Keep demo accounts roles updated
        user.role = role;
        user.status = 'verified';
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
