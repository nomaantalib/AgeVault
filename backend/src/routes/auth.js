const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Supabase OTP Helper
const sendSupabaseOTP = (email) => {
  return new Promise((resolve) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return resolve(false);
    }

    const data = JSON.stringify({
      email,
      create_user: true
    });

    try {
      const parsedUrl = new URL(supabaseUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: '/auth/v1/otp',
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            console.error(`Supabase Send OTP Error: Status ${res.statusCode}, Body: ${body}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('Supabase Send OTP Network Error:', err);
        resolve(false);
      });

      req.write(data);
      req.end();
    } catch (urlError) {
      console.error('Invalid SUPABASE_URL:', urlError);
      resolve(false);
    }
  });
};

const verifySupabaseOTP = (email, token) => {
  return new Promise((resolve) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase configuration missing (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return resolve(false);
    }

    const data = JSON.stringify({
      email,
      token,
      type: 'email'
    });

    try {
      const parsedUrl = new URL(supabaseUrl);
      const options = {
        hostname: parsedUrl.hostname,
        path: '/auth/v1/verify',
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(true);
          } else {
            console.error(`Supabase Verify OTP Error: Status ${res.statusCode}, Body: ${body}`);
            resolve(false);
          }
        });
      });

      req.on('error', (err) => {
        console.error('Supabase Verify OTP Network Error:', err);
        resolve(false);
      });

      req.write(data);
      req.end();
    } catch (urlError) {
      console.error('Invalid SUPABASE_URL:', urlError);
      resolve(false);
    }
  });
};




// @route   POST api/auth/send-otp
// @desc    Generate and send 6-digit OTP code via Resend
// @access  Public
router.post('/send-otp', async (req, res) => {
  const { email, name, phone, role, authMode } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }

  try {
    // Check if user exists by email or phone
    const formattedPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone}`) : '';
    let user = await User.findOne({ 
      $or: [
        { email }, 
        { phone: formattedPhone || '___none___' }
      ] 
    });

    // 1. Enforce single-person Admin: Only mohdnomaantalib@gmail.com or +919999999999 can log in as Admin
    if (role === 'admin' && email !== 'mohdnomaantalib@gmail.com' && formattedPhone !== '+919999999999') {
      return res.status(403).json({ success: false, message: 'Access Denied: Only the authorized administrator account can log in as Admin.' });
    }

    // 2. Prevent Staff self-registration: Staff accounts must already exist (manually added by Admin)
    if (role === 'club' && !user && email !== 'staff@agevault.com' && formattedPhone !== '+918888888888') {
      return res.status(403).json({ success: false, message: 'Access Denied: Staff accounts must be manually created by the Administrator.' });
    }

    // 3. Prevent Staff/Admin from logging in as standard members (users)
    if (user && (user.role === 'club' || user.role === 'admin') && role === 'user') {
      return res.status(403).json({ success: false, message: 'Access Denied: Staff/Admin accounts cannot log in as standard members.' });
    }

    if (authMode === 'login' && !user) {
      return res.status(404).json({ success: false, message: 'This email is not registered. Please switch to register mode.' });
    }

    let finalRole = role || 'user';
    if (email === 'mohdnomaantalib@gmail.com' || formattedPhone === '+919999999999') {
      finalRole = 'admin';
    } else if (email === 'staff@agevault.com' || formattedPhone === '+918888888888') {
      finalRole = 'club';
    }

    if (!user) {
      if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required for registration' });
      }
      if (!name) {
        return res.status(400).json({ success: false, message: 'Full Name is required for registration' });
      }
      // Create user temporarily
      user = new User({
        email,
        phone: formattedPhone,
        name,
        role: finalRole,
        status: finalRole === 'user' ? 'pending' : 'verified',
      });
    } else {
      // If registering but user exists, let's update details if provided
      if (authMode === 'register') {
        if (name) user.name = name;
        if (formattedPhone) user.phone = formattedPhone;
        if (role) {
          user.role = finalRole;
          if (finalRole !== 'user') {
            user.status = 'verified';
          }
        }
      }
    }

    // Handle simulated OTP flow
    if (process.env.USE_SIMULATED_OTP === 'true') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      user.otp = otp;
      user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      console.log(`[SIMULATED OTP] Verification code for ${email} is ${otp}`);
      return res.json({
        success: true,
        message: `Simulated security verification code generated.`,
        otp: otp
      });
    }

    // Save user details before triggering external OTP service
    await user.save();

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return res.status(500).json({ success: false, message: 'Real OTP transmission failed: Supabase configurations (SUPABASE_URL / SUPABASE_ANON_KEY) are not set on the server.' });
    }

    // Send OTP using Supabase GoTrue Auth
    const emailSent = await sendSupabaseOTP(email);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send security verification code. Please check your Supabase email/OTP settings.' });
    }

    res.json({
      success: true,
      message: `A secure 6-digit verification code has been sent to ${email}.`
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    const isDbError = error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError';
    res.status(500).json({
      success: false,
      message: isDbError
        ? 'Database is temporarily unreachable. Please check your MongoDB Atlas IP whitelist and try again.'
        : 'Failed to dispatch verification code'
    });
  }
});

// @route   POST api/auth/verify-otp
// @desc    Verify 6-digit OTP and issue JWT session token
// @access  Public
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ success: false, message: 'Email and OTP code are required' });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (process.env.USE_SIMULATED_OTP === 'true') {
      // Check if OTP matches locally
      if (!user.otp || user.otp !== otp) {
        return res.status(400).json({ success: false, message: 'Invalid verification code' });
      }

      // Check expiration
      if (user.otpExpires && new Date() > user.otpExpires) {
        return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
      }

      // Clear OTP fields after successful verification
      user.otp = '';
      user.otpExpires = undefined;
      await user.save();
    } else {
      // Verify OTP via Supabase
      const verified = await verifySupabaseOTP(email, otp);
      if (!verified) {
        return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
      }
    }

    // Mark user status as verified if pending standard user
    if (user.role === 'user' && user.status === 'pending') {
      user.status = 'verified';
      await user.save();
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
    console.error('Verify OTP error:', error);
    const isDbError = error.name === 'MongoServerSelectionError' || error.name === 'MongoNetworkError';
    res.status(500).json({
      success: false,
      message: isDbError
        ? 'Database is temporarily unreachable. Please check your MongoDB Atlas IP whitelist and try again.'
        : 'Authentication verification failed'
    });
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
