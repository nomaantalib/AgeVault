const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  dateTime: {
    type: Date,
    required: true,
  },
  venue: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    default: '',
  },
  club: {
    type: String,
    enum: ['The Palace Lounge', 'Hype Nightclub', 'Mirage Club & Garden', 'Decibel Arena', 'Vibe Superclub'],
    default: 'The Palace Lounge',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Event', EventSchema);
