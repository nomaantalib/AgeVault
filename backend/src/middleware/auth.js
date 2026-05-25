const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      req.user = await User.findById(decoded.id).select('-qrToken');
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error('Auth verification error:', error);
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
  }
};

const clubOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'club' || req.user.role === 'admin')) {
    next();
  } else {
    res.status(403).json({ success: false, message: 'Forbidden: Club staff or Admins only' });
  }
};

module.exports = {
  protect,
  adminOnly,
  clubOrAdmin,
};
