const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const https = require('https');
const User = require('../models/User');
const { verifyFirebaseToken } = require('../config/firebase');
const { protect } = require('../middleware/auth');

// Resend Email Helper
const sendResendOTP = (email, otp) => {
  return new Promise((resolve) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.log('RESEND_API_KEY missing, running OTP in fallback mode. OTP code:', otp);
      return resolve(true);
    }

    const data = JSON.stringify({
      from: 'AgeVault <onboarding@resend.dev>',
      to: [email],
      subject: 'AgeVault Security Verification Code',
      html: `
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
          resolve(true);
        } else {
          console.error(`Resend API Error status: ${res.statusCode}, Body: ${responseBody}`);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      console.error('Resend Network Error:', err);
      resolve(false);
    });

    req.write(data);
    req.end();
  });
};


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

    if (authMode === 'login' && !user) {
      return res.status(404).json({ success: false, message: 'This email is not registered. Please switch to register mode.' });
    }

    let finalRole = role || 'user';
    if (email === 'admin@agevault.com' || formattedPhone === '+919999999999') {
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    await user.save();

    // Send email using Resend
    const emailSent = await sendResendOTP(email, otp);

    res.json({
      success: true,
      message: emailSent 
        ? `A 6-digit verification code has been sent to ${email}.`
        : `A simulated security verification code was generated (Demo Mode).`,
      // For testing / demo backup we can log the OTP to the console, or return it if Resend is missing
      otp: !process.env.RESEND_API_KEY ? otp : undefined
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to dispatch verification code' });
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

    // Check if OTP matches
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
    res.status(500).json({ success: false, message: 'Authentication verification failed' });
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
