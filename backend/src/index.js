const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for MVP ease of testing, can restrict to client url in production
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically for local fallback
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/verify', require('./routes/verification'));
app.use('/api/admin', require('./routes/admin'));

// Base health check route
app.get('/', (req, res) => {
  res.json({ message: 'AgeVault API is running.' });
});

// Database Connection
const mongoUri = process.env.MONGO_URI;
const jwtSecret = process.env.JWT_SECRET;

if (!mongoUri || !jwtSecret) {
  console.error('CRITICAL ERROR: MONGO_URI or JWT_SECRET is not defined in the environment variables.');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Successfully connected to MongoDB Atlas.');
  // Start server
  app.listen(PORT, () => {
    console.log(`AgeVault backend server running on port ${PORT}`);
  });
})
.catch((err) => {
  console.error('Database connection error:', err);
});
