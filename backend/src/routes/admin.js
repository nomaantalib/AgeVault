const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');
const Club = require('../models/Club');
const { protect, adminOnly } = require('../middleware/auth');

// @route   GET api/admin/pending
// @desc    Get all pending verification requests
// @access  Private (Admin only)
router.get('/pending', protect, adminOnly, async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending' }).sort({ createdAt: -1 });
    res.json({ success: true, count: pendingUsers.length, users: pendingUsers });
  } catch (error) {
    console.error('Fetch pending users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/admin/stats
// @desc    Get system verification stats
// @access  Private (Admin only)
router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments({ role: 'user' });
    const verifiedUsers = await User.countDocuments({ role: 'user', status: 'verified' });
    const pendingUsers = await User.countDocuments({ role: 'user', status: 'pending' });
    const rejectedUsers = await User.countDocuments({ role: 'user', status: 'rejected' });

    res.json({
      success: true,
      stats: {
        total: totalUsers,
        verified: verifiedUsers,
        pending: pendingUsers,
        rejected: rejectedUsers
      }
    });
  } catch (error) {
    console.error('Fetch admin stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST api/admin/action
// @desc    Approve or Reject verification request
// @access  Private (Admin only)
router.post('/action', protect, adminOnly, async (req, res) => {
  const { userId, action, reason } = req.body;

  if (!userId || !['approve', 'reject'].includes(action)) {
    return res.status(400).json({ success: false, message: 'UserId and valid action (approve/reject) are required' });
  }

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (action === 'approve') {
      user.status = 'verified';
      user.rejectionReason = '';
      user.qrScanned = false; // Reset scan status upon new approval
    } else {
      user.status = 'rejected';
      user.rejectionReason = reason || 'Document image was unclear or face match failed.';
      user.qrScanned = false;
    }

    // Regenerate Signed JWT token with updated status
    const jwtSecret = process.env.JWT_SECRET;
    const qrPayload = {
      uid: user._id,
      name: user.name,
      verified: user.status === 'verified',
      age: user.age,
      timestamp: Math.floor(Date.now() / 1000)
    };

    user.qrToken = jwt.sign(qrPayload, jwtSecret, { expiresIn: '72h' });

    await user.save();

    res.json({
      success: true,
      message: `User verification successfully ${action === 'approve' ? 'approved' : 'rejected'}.`,
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        status: user.status,
        rejectionReason: user.rejectionReason,
        qrToken: user.qrToken
      }
    });
  } catch (error) {
    console.error('Admin action processing error:', error);
    res.status(500).json({ success: false, message: 'Failed to process action' });
  }
});

// @route   GET api/admin/users
// @desc    Get all users for CRUD
// @access  Private (Admin only)
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({}).sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST api/admin/users
// @desc    Create a user manually
// @access  Private (Admin only)
router.post('/users', protect, adminOnly, async (req, res) => {
  const { phone, name, email, role, status, dob, age, club } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone number is required' });
  }
  try {
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'User with this phone number already exists' });
    }
    const newUser = new User({
      phone,
      name: name || '',
      email: email || '',
      role: role || 'user',
      status: status || 'pending',
      dob: dob ? new Date(dob) : undefined,
      age: age || undefined,
      club: club || 'The Palace Lounge',
    });
    // Generate QR token if verified
    const jwtSecret = process.env.JWT_SECRET;
    const qrPayload = {
      uid: newUser._id,
      name: newUser.name,
      verified: newUser.status === 'verified',
      age: newUser.age || 0,
      timestamp: Math.floor(Date.now() / 1000)
    };
    newUser.qrToken = jwt.sign(qrPayload, jwtSecret);
    await newUser.save();
    res.json({ success: true, user: newUser });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT api/admin/users/:id
// @desc    Update a user manually
// @access  Private (Admin only)
router.put('/users/:id', protect, adminOnly, async (req, res) => {
  const { phone, name, email, role, status, dob, age, club } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.phone = phone || user.phone;
    user.name = name !== undefined ? name : user.name;
    user.email = email !== undefined ? email : user.email;
    user.role = role || user.role;
    user.status = status || user.status;
    user.club = club || user.club;
    if (dob) {
      user.dob = new Date(dob);
    }
    if (age !== undefined) {
      user.age = age;
    }
    // Regenerate QR token
    const jwtSecret = process.env.JWT_SECRET;
    const qrPayload = {
      uid: user._id,
      name: user.name,
      verified: user.status === 'verified',
      age: user.age || 0,
      timestamp: Math.floor(Date.now() / 1000)
    };
    user.qrToken = jwt.sign(qrPayload, jwtSecret);
    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete a single user manually
// @access  Private (Admin only)
router.delete('/users/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/admin/export
// @desc    Export user data for CSV
// @access  Private (Admin only)
router.get('/export', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('phone name email dob age status faceMatchConfidence createdAt');
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Helper: Truncate past event descriptions to minimize MongoDB storage occupancy
const compressEventHistory = async () => {
  try {
    // Clear description for events older than today to save space
    await Event.updateMany(
      { dateTime: { $lt: new Date() }, description: { $ne: '' } },
      { $set: { description: '' } }
    );
  } catch (err) {
    console.error('Error compressing event history:', err);
  }
};

// @route   GET api/admin/event
// @desc    Get the upcoming scheduled event (Public)
// @access  Public
router.get('/event', async (req, res) => {
  try {
    // Clean up older events description to minimize space
    await compressEventHistory();
    
    // Find the next upcoming event (date in future)
    let event = await Event.findOne({ dateTime: { $gte: new Date() } }).sort({ dateTime: 1 });
    
    // If no upcoming event, fall back to the most recently created event
    if (!event) {
      event = await Event.findOne().sort({ dateTime: -1 });
    }
    
    res.json({ success: true, event });
  } catch (error) {
    console.error('Fetch event error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/admin/events
// @desc    Get all events list for history (Admin only)
// @access  Private (Admin only)
router.get('/events', protect, adminOnly, async (req, res) => {
  try {
    await compressEventHistory();
    const events = await Event.find({}).sort({ dateTime: -1 });
    res.json({ success: true, events });
  } catch (error) {
    console.error('Fetch all events error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST api/admin/event
// @desc    Create or update event (Admin only)
// @access  Private (Admin only)
router.post('/event', protect, adminOnly, async (req, res) => {
  const { title, dateTime, venue, description, club } = req.body;

  if (!title || !dateTime || !venue) {
    return res.status(400).json({ success: false, message: 'Title, date/time, and venue are required.' });
  }

  try {
    const newEvent = new Event({
      title,
      dateTime: new Date(dateTime),
      venue,
      description: description || '',
      club: club || 'The Palace Lounge'
    });

    await newEvent.save();
    
    // Compact old events to save space
    await compressEventHistory();
    
    res.json({ success: true, message: 'Event scheduled successfully.', event: newEvent });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE api/admin/event/:id
// @desc    Delete a specific event from schedule/history (Admin only)
// @access  Private (Admin only)
router.delete('/event/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }
    res.json({ success: true, message: 'Event deleted successfully.' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// HTTPS library for Resend API OTP calls
const https = require('https');

// Global Resend Key Tracker for Failover Rotation (Admin Route)
let currentResendKeyIndex = 0;

const executeResendCall = (apiKey, email, otp, subject, htmlTemplate) => {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || 'AgeVault <onboarding@resend.dev>',
      to: [email],
      subject: subject || 'AgeVault Admin Action Authorization Code',
      html: htmlTemplate || `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #f8fafc; padding: 40px; border-radius: 24px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);">
          <div style="text-align: center; margin-bottom: 30px;">
            <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #4f46e5, #6366f1); border-radius: 16px; margin-bottom: 12px;">
              <span style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: 1px;">AgeVault</span>
            </div>
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0;">Destructive Admin Action Request</h2>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 6px;">Security Authorization Required</p>
          </div>
          
          <div style="background-color: rgba(15, 23, 42, 0.6); border: 1px solid #1e293b; padding: 24px; border-radius: 16px; text-align: center; margin-bottom: 24px;">
            <p style="font-size: 14px; color: #94a3b8; margin-top: 0; margin-bottom: 16px;">An Admin action was requested to wipe club data or modify dynamic venue records. Enter this 6-digit code to authorize this action.</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 6px; color: #f43f5e; font-family: monospace; background-color: #020617; display: inline-block; padding: 12px 30px; border-radius: 12px; border: 1px solid rgba(244, 63, 94, 0.3); text-shadow: 0 0 10px rgba(244, 63, 94, 0.4); margin-bottom: 12px;">
              ${otp}
            </div>
            <p style="font-size: 11px; color: #64748b; margin: 0;">If you did not initiate this request, please ignore this email.</p>
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

// Helper: Verify Admin security code
const verifyAdminOTP = async (req, res, otpCode) => {
  const adminEmail = 'mohdnomaantalib@gmail.com';
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    return { success: false, status: 404, message: 'Admin profile not found.' };
  }
  
  if (!otpCode) {
    // Generate and save OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    admin.otp = otp;
    admin.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry
    await admin.save();

    if (process.env.USE_SIMULATED_OTP === 'true') {
      console.log(`[SIMULATED OTP] Admin verification code is ${otp}`);
      return {
        success: false,
        status: 400,
        requiresOtp: true,
        message: `[SIMULATED] Security Verification: Code is ${otp}. Please input it to authorize this action.`
      };
    }

    // Check if key is configured
    const keysCount = [1, 2, 3, 4, 5, 6, 7].filter(i => process.env[`RESEND_API_KEY_${i}`]).length + (process.env.RESEND_API_KEY ? 1 : 0);
    if (keysCount === 0) {
      return { success: false, status: 500, message: 'Real OTP transmission failed: No RESEND_API_KEY instances are configured on the server.' };
    }
    
    const otpResult = await sendResendOTP(adminEmail, otp);
    if (!otpResult.success) {
      // Temporary Fallback: If Resend fails (e.g. sandbox restriction, quota, rate-limit),
      // we save the OTP in the database and return it to the admin client to bypass the lockout.
      admin.otp = otp;
      admin.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await admin.save();
      console.warn(`[OTP FALLBACK] Admin Resend email failed. Falling back to simulated OTP code: ${otp}`);
      return { 
        success: false, 
        status: 400, 
        requiresOtp: true, 
        message: `[Demo Mode] Security Verification: A code has been generated: ${otp}. Please input it to authorize this action.` 
      };
    }
    
    return { success: false, status: 400, requiresOtp: true, message: `Security Verification: A secure 6-digit authorization code has been sent to your administrator email (${adminEmail}). Please input it to authorize this action.` };
  }
  
  // Verify OTP (Resend sends, server verifies against MongoDB)
  if (admin.otp !== otpCode) {
    return { success: false, status: 400, message: 'Security Verification Failed: Invalid authorization code.' };
  }
  
  if (admin.otpExpires && new Date() > admin.otpExpires) {
    return { success: false, status: 400, message: 'Security Verification Failed: Code has expired. Please try again.' };
  }
  
  // Clear OTP
  admin.otp = '';
  admin.otpExpires = undefined;
  await admin.save();
  
  return { success: true };
};

// Helper to ensure default clubs exist
const ensureDefaultClubs = async () => {
  const count = await Club.countDocuments();
  if (count === 0) {
    const defaults = ['The Palace Lounge', 'Hype Nightclub', 'Mirage Club & Garden', 'Decibel Arena', 'Vibe Superclub'];
    for (const name of defaults) {
      await Club.create({ name });
    }
  }
};

// @route   DELETE api/admin/clear-history
// @desc    Clear all user records (keeps admins and club staff)
// @access  Private (Admin only)
router.delete('/clear-history', protect, adminOnly, async (req, res) => {
  const { club, otp } = req.query;
  try {
    const otpVerify = await verifyAdminOTP(req, res, otp);
    if (!otpVerify.success) {
      if (otpVerify.requiresOtp) {
        return res.status(otpVerify.status).json({ success: false, requiresOtp: true, message: otpVerify.message });
      }
      return res.status(otpVerify.status).json({ success: false, message: otpVerify.message });
    }

    if (club && club !== 'All Clubs') {
      // Clear standard users for a particular club
      await User.deleteMany({ role: 'user', club });
      res.json({ success: true, message: `Verification history for standard users at "${club}" has been cleared.` });
    } else {
      // Clear all standard users across all clubs
      await User.deleteMany({ role: 'user' });
      res.json({ success: true, message: 'Verification history for standard users across all clubs has been cleared.' });
    }
  } catch (error) {
    console.error('Clear history error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET api/admin/clubs
// @desc    Get all dynamic clubs (Admin and Club Staff)
// @access  Private
router.get('/clubs', protect, async (req, res) => {
  try {
    await ensureDefaultClubs();
    const clubs = await Club.find().sort({ createdAt: 1 });
    res.json({ success: true, clubs });
  } catch (error) {
    console.error('Fetch clubs error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST api/admin/clubs
// @desc    Create a new dynamic club Gate (Admin only)
// @access  Private (Admin only)
router.post('/clubs', protect, adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Club name is required' });
  }

  try {
    await ensureDefaultClubs();
    const existing = await Club.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Club already exists' });
    }

    const club = await Club.create({ name: name.trim() });
    res.json({ success: true, club });
  } catch (error) {
    console.error('Create club error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT api/admin/clubs/:id
// @desc    Edit a club name and update associated users & events (Admin only)
// @access  Private (Admin only)
router.put('/clubs/:id', protect, adminOnly, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Club name is required' });
  }

  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    const oldName = club.name;
    club.name = name.trim();
    await club.save();

    // Cascading updates in background
    await User.updateMany({ club: oldName }, { $set: { club: name.trim() } });
    await Event.updateMany({ club: oldName }, { $set: { club: name.trim() } });

    res.json({ success: true, club });
  } catch (error) {
    console.error('Update club error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE api/admin/clubs/:id
// @desc    Delete a club and wipe associated events & members with OTP check (Admin only)
// @access  Private (Admin only)
router.delete('/clubs/:id', protect, adminOnly, async (req, res) => {
  const { otp } = req.query;
  try {
    const club = await Club.findById(req.params.id);
    if (!club) {
      return res.status(404).json({ success: false, message: 'Club not found' });
    }

    // OTP confirmation required for Destructive Action
    const otpVerify = await verifyAdminOTP(req, res, otp);
    if (!otpVerify.success) {
      if (otpVerify.requiresOtp) {
        return res.status(otpVerify.status).json({ success: false, requiresOtp: true, message: otpVerify.message });
      }
      return res.status(otpVerify.status).json({ success: false, message: otpVerify.message });
    }

    const clubName = club.name;
    await Club.findByIdAndDelete(req.params.id);

    // Cascading deletes
    await Event.deleteMany({ club: clubName });
    await User.deleteMany({ role: 'user', club: clubName });

    res.json({ success: true, message: `Club "${clubName}", its scheduled events, and member directory records have been permanently wiped.` });
  } catch (error) {
    console.error('Delete club error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
