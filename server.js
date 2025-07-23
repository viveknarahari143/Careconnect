const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const session = require('express-session');
const fs = require('fs');
const Volunteer = require('./models/Volunteer');
const bcrypt = require('bcrypt');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'careconnect_secret',
  resave: false,
  saveUninitialized: true
}));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/careconnect';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('Connected to MongoDB successfully');
})
.catch((error) => {
  console.error('MongoDB connection error:', error);
  process.exit(1);
});

// Routes
const requestRoutes = require('./routes/requests');
app.use('/api/requests', requestRoutes);

// Serve login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login POST
app.post('/login', (req, res) => {
  const { role } = req.body;
  if (role === 'elder') {
    req.session.role = 'elder';
    return res.json({ redirect: '/' });
  } else if (role === 'volunteer') {
    req.session.role = 'volunteer';
    return res.json({ redirect: '/admin' });
  } else {
    return res.status(400).json({ error: 'Invalid role' });
  }
});

// Serve volunteer login and register pages
app.get('/volunteer-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'volunteer-login.html'));
});
app.get('/volunteer-register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'volunteer-register.html'));
});

// Volunteer registration
app.post('/volunteer-register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const existing = await Volunteer.findOne({ email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    const volunteer = new Volunteer({ name, email, phone, password });
    await volunteer.save();
    return res.json({ redirect: '/volunteer-login' });
  } catch (err) {
    console.error('Volunteer registration error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// Volunteer login
app.post('/volunteer-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const volunteer = await Volunteer.findOne({ email });
    if (!volunteer) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    const match = await bcrypt.compare(password, volunteer.password);
    if (!match) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }
    req.session.role = 'volunteer';
    req.session.volunteerId = volunteer._id;
    return res.json({ redirect: '/admin' });
  } catch (err) {
    console.error('Volunteer login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Middleware to check login
function requireLogin(role) {
  return (req, res, next) => {
    if (req.session.role === role) {
      return next();
    }
    res.redirect('/login');
  };
}

// Protect routes
app.get('/', requireLogin('elder'), (req, res) => {
  const role = req.session.role;
  const indexHtmlPath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(indexHtmlPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading help request form');
    // Inject a script to set window.userRole
    const injected = data.replace('</head>', `<script>window.userRole = '${role || ''}';</script></head>`);
    res.send(injected);
  });
});

// Allow both elders and volunteers to access /admin, but pass role info
app.get('/admin', (req, res) => {
  const role = req.session.role;
  const adminHtmlPath = path.join(__dirname, 'public', 'admin.html');
  fs.readFile(adminHtmlPath, 'utf8', (err, data) => {
    if (err) return res.status(500).send('Error loading admin dashboard');
    // Inject a script to set window.userRole
    const injected = data.replace('</head>', `<script>window.userRole = '${role || ''}';</script></head>`);
    res.send(injected);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'CareConnect server is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`CareConnect server is running on port ${PORT}`);
  console.log(`Frontend: http://localhost:${PORT}`);
  console.log(`Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`API Health Check: http://localhost:${PORT}/health`);
});

