const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Event = require('../models/Event');
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
  const { phone, name, email, role, status, dob, age } = req.body;
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
  const { phone, name, email, role, status, dob, age } = req.body;
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
  const { title, dateTime, venue, description } = req.body;

  if (!title || !dateTime || !venue) {
    return res.status(400).json({ success: false, message: 'Title, date/time, and venue are required.' });
  }

  try {
    const newEvent = new Event({
      title,
      dateTime: new Date(dateTime),
      venue,
      description: description || ''
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

// @route   DELETE api/admin/clear-history
// @desc    Clear all user records (keeps admins and club staff)
// @access  Private (Admin only)
router.delete('/clear-history', protect, adminOnly, async (req, res) => {
  try {
    // Delete only standard users (protect admins and clubs from being cleared!)
    await User.deleteMany({ role: 'user' });
    res.json({ success: true, message: 'All user verification history has been cleared successfully.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
