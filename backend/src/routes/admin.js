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

// Helper to send Admin security verification code via Supabase
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

// Helper: Verify Admin security code
const verifyAdminOTP = async (req, res, otpCode) => {
  const adminEmail = 'mohdnomaantalib@gmail.com';
  const admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    return { success: false, status: 404, message: 'Admin profile not found.' };
  }
  
  if (!otpCode) {
    if (process.env.USE_SIMULATED_OTP === 'true') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      admin.otp = otp;
      admin.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
      await admin.save();

      console.log(`[SIMULATED OTP] Admin verification code is ${otp}`);
      return {
        success: false,
        status: 400,
        requiresOtp: true,
        message: `[SIMULATED] Security Verification: Code is ${otp}. Please input it to authorize this action.`
      };
    }

    // Check if key is configured
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      return { success: false, status: 500, message: 'Real OTP transmission failed: Supabase configurations (SUPABASE_URL / SUPABASE_ANON_KEY) are not set on the server.' };
    }
    
    const emailSent = await sendSupabaseOTP(adminEmail);
    if (!emailSent) {
      return { success: false, status: 500, message: 'Failed to send security verification code. Please check your Supabase configurations.' };
    }
    
    return { success: false, status: 400, requiresOtp: true, message: `Security Verification: A secure 6-digit authorization code has been sent to your administrator email (${adminEmail}). Please input it to authorize this action.` };
  }
  
  // Verify OTP
  if (process.env.USE_SIMULATED_OTP === 'true') {
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
  } else {
    const verified = await verifySupabaseOTP(adminEmail, otpCode);
    if (!verified) {
      return { success: false, status: 400, message: 'Security Verification Failed: Invalid or expired authorization code.' };
    }
  }
  
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
