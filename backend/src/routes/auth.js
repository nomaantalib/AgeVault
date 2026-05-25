const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

// Global Resend Key Tracker for Failover Rotation
let currentResendKeyIndex = 0;

const executeResendCall = (apiKey, email, otp, subject, htmlTemplate) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      from: 'AgeVault <onboarding@resend.dev>',
      to: [email],
      subject: subject || 'AgeVault Security Verification Code',
      html: htmlTemplate || `
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
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => { responseBody += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true });
        } else {
          console.error(`Resend API Instance Error status: ${res.statusCode}, Body: ${responseBody}`);
          let isSandboxRestriction = false;
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed.name === 'restricted_to_domain' || (parsed.message && parsed.message.includes('only send to'))) {
              isSandboxRestriction = true;
            }
          } catch(e) {}
          resolve({ success: false, isSandboxRestriction });
        }
      });
    });

    req.on('error', (err) => {
      console.error('Resend Instance Network Error:', err);
      resolve({ success: false, isSandboxRestriction: false });
    });

    req.write(data);
    req.end();
  });
};

const sendResendOTP = (email, otp, subject, htmlTemplate) => {
  return new Promise(async (resolve) => {
    // Gather all active environment API keys (supports 7 instances)
    const keys = [];
    for (let i = 1; i <= 7; i++) {
      const key = process.env[`RESEND_API_KEY_${i}`];
      if (key) keys.push(key);
    }
    // Fallback to general RESEND_API_KEY if configured and not already included
    if (process.env.RESEND_API_KEY && !keys.includes(process.env.RESEND_API_KEY)) {
      keys.unshift(process.env.RESEND_API_KEY);
    }

    if (keys.length === 0) {
      console.error('No Resend API keys configured on the server.');
      return resolve({ success: false, isSandboxRestriction: false });
    }

    // Try keys sequentially starting from currentResendKeyIndex
    for (let attempt = 0; attempt < keys.length; attempt++) {
      const keyIndex = (currentResendKeyIndex + attempt) % keys.length;
      const apiKey = keys[keyIndex];

      console.log(`Attempting Resend email delivery using Instance ${keyIndex + 1}...`);
      const result = await executeResendCall(apiKey, email, otp, subject, htmlTemplate);

      if (result.success) {
        // Update to the last successful instance index
        currentResendKeyIndex = keyIndex;
        return resolve({ success: true });
      }

      if (result.isSandboxRestriction) {
        console.warn(`Resend sandbox restriction detected for ${email}. Bypassing key rotation and falling back.`);
        return resolve({ success: false, isSandboxRestriction: true });
      }

      console.warn(`Resend Instance ${keyIndex + 1} failed. Rotating to next instance...`);
    }

    console.error('All Resend API key instances failed or expired quota.');
    resolve({ success: false, isSandboxRestriction: false });
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

    // Allow email verification, registration, and login for all three roles (admin, club, user)
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

    // Check if any Resend API Keys are configured
    const keysCount = [1, 2, 3, 4, 5, 6, 7].filter(i => process.env[`RESEND_API_KEY_${i}`]).length + (process.env.RESEND_API_KEY ? 1 : 0);
    if (keysCount === 0) {
      return res.status(500).json({ success: false, message: 'Real OTP transmission failed: No RESEND_API_KEY instances are configured on the server.' });
    }

    // Send email using Resend key failover pool
    const otpResult = await sendResendOTP(email, otp);

    if (!otpResult.success) {
      if (otpResult.isSandboxRestriction) {
        // Save user to DB to ensure they can verify
        await user.save();
        console.log(`[SANDBOX FALLBACK] Verification code for ${email} is ${otp}`);
        return res.json({
          success: true,
          message: `[Sandbox Mode] A secure verification code has been generated: ${otp}`,
          otp: otp
        });
      }
      return res.status(500).json({ success: false, message: 'Failed to send security verification code. Please check your Resend API configurations.' });
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
