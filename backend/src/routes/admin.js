const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
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
    } else {
      user.status = 'rejected';
      user.rejectionReason = reason || 'Document image was unclear or face match failed.';
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

    user.qrToken = jwt.sign(qrPayload, jwtSecret);

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

module.exports = router;
