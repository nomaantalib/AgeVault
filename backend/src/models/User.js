const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    trim: true,
    default: '',
  },
  email: {
    type: String,
    trim: true,
    default: '',
  },
  dob: {
    type: Date,
  },
  age: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  idCardUrl: {
    type: String,
    default: '',
  },
  idNumber: {
    type: String,
    default: '',
  },
  selfieUrl: {
    type: String,
    default: '',
  },
  qrToken: {
    type: String,
    default: '',
  },
  qrScanned: {
    type: Boolean,
    default: false,
  },
  qrScannedAt: {
    type: Date,
  },
  faceMatchConfidence: {
    type: Number,
    default: 0,
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'club'],
    default: 'user',
  },
  rejectionReason: {
    type: String,
    default: '',
  },
  otp: {
    type: String,
    default: '',
  },
  otpExpires: {
    type: Date,
  },
  password: {
    type: String,
    default: '',
  },
  schoolAnswer: {
    type: String,
    default: '',
  },
  petAnswer: {
    type: String,
    default: '',
  },
  cityAnswer: {
    type: String,
    default: '',
  },
  qrPin: {
    type: String,
    default: '',
  },
  qrPinExpires: {
    type: Date,
  },
  club: {
    type: String,
    default: 'The Palace Lounge',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('User', UserSchema);
