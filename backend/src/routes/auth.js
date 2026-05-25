const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Brevo Email Helper
const sendBrevoOTP = (email, otp) => {
  return new Promise((resolve) => {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL || 'noreply@agevault.com';
    const senderName = process.env.BREVO_SENDER_NAME || 'AgeVault';

    if (!apiKey) {
      console.error('BREVO_API_KEY is not configured on the server.');
      return resolve(false);
    }

    const data = JSON.stringify({
      sender: {
        name: senderName,
        email: senderEmail
      },
      to: [
        {
          email: email
        }
      ],
      subject: 'AgeVault Security Verification Code',
      htmlContent: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 40px; border-radius: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 16px; margin-bottom: 12px;">
              <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">AgeVault</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0;">One-Time Security Code</h2>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Secure Email OTP Authentication</p>
          </div>
          
          <div style="background-color: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #94a3b8; margin-top: 0; margin-bottom: 16px;">Use the following 6-digit OTP code to log in or register your account. This code is valid for 10 minutes.</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #6366f1; font-family: monospace; background-color: #020617; display: inline-block; padding: 12px 30px; border-radius: 12px; border: 1px solid rgba(99, 102, 241, 0.3); text-shadow: 0 0 10px rgba(99, 102, 241, 0.4); margin-bottom: 12px;">
              ${otp}
            </div>
            <p style="font-size: 11px; color: #64748b; margin: 0;">If you did not request this code, please ignore this email.</p>
          </div>
          
          <div style="text-align: center; border-top: 1px solid #1e293b; padding-top: 20px; font-size: 11px; color: #64748b;">
            <p style="margin: 0 0 6px 0;">This email was sent dynamically by AgeVault verification network.</p>
            <p style="margin: 0;">&copy; 2026 AgeVault. All rights reserved.</p>
          </div>
        </div>
      `
    });

    const options = {
      hostname: 'api.brevo.com',
      path: '/v3/smtp/email',
      method: 'POST',
      headers: {
        'api-key': apiKey,
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
          console.error(`Brevo Send OTP Error: Status ${res.statusCode}, Body: ${body}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Brevo Send OTP Network Error:', err);
      resolve(false);
    });

    req.write(data);
    req.end();
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

    // Generate 6-digit OTP code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Handle simulated OTP flow
    if (process.env.USE_SIMULATED_OTP === 'true') {
      await user.save();
      console.log(`[SIMULATED OTP] Verification code for ${email} is ${otp}`);
      return res.json({
        success: true,
        message: `Simulated security verification code generated.`,
        otp: otp
      });
    }

    // Save details to DB
    await user.save();

    if (!process.env.BREVO_API_KEY) {
      return res.status(500).json({ success: false, message: 'Real OTP transmission failed: BREVO_API_KEY is not configured on the server.' });
    }

    // Send email using Brevo
    const emailSent = await sendBrevoOTP(email, otp);

    if (!emailSent) {
      return res.status(500).json({ success: false, message: 'Failed to send security verification code. Please check your Brevo API configurations.' });
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

    // Check if OTP matches locally (Brevo sends code, server verifies via MongoDB)
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
