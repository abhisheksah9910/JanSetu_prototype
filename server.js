require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const connectDB = require('./others/config/database');
const errorHandler = require('./others/middleware/errorHandler');

// Connect Database
connectDB();

const app = express();

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_PATH || './others/public/uploads';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000, // Generous limit for real-time dev/demo polling
  message: { success: false, message: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts.' }
});

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limit auth routes
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// Static files - serve public directory
// Static files - Modular and Public directories
app.use('/citizen', express.static(path.join(__dirname, 'citizen')));
app.use('/university', express.static(path.join(__dirname, 'university')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use('/industries', express.static(path.join(__dirname, 'industries')));
app.use('/industry', express.static(path.join(__dirname, 'industries')));
app.use('/others', express.static(path.join(__dirname, 'others/public')));
app.use(express.static(path.join(__dirname, 'others/public')));

// Clean Modular Routes & Navigation
app.get('/citizen', (req, res) => res.sendFile(path.join(__dirname, 'citizen/citizen.html')));
app.get('/citizen/citizen.html', (req, res) => res.sendFile(path.join(__dirname, 'citizen/citizen.html')));
app.get('/university', (req, res) => res.sendFile(path.join(__dirname, 'university/university.html')));
app.get('/university/university.html', (req, res) => res.sendFile(path.join(__dirname, 'university/university.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin/admin.html')));
app.get('/admin/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin/admin.html')));
app.get('/industries', (req, res) => res.sendFile(path.join(__dirname, 'industries/industry.html')));
app.get('/industries/industry.html', (req, res) => res.sendFile(path.join(__dirname, 'industries/industry.html')));
app.get('/industry', (req, res) => res.sendFile(path.join(__dirname, 'industries/industry.html')));

// Backward-compatible dashboard paths
app.get('/dashboard/citizen.html', (req, res) => res.sendFile(path.join(__dirname, 'citizen/citizen.html')));
app.get('/dashboard/university.html', (req, res) => res.sendFile(path.join(__dirname, 'university/university.html')));
app.get('/dashboard/admin.html', (req, res) => res.sendFile(path.join(__dirname, 'admin/admin.html')));
app.get('/dashboard/industry.html', (req, res) => res.sendFile(path.join(__dirname, 'industries/industry.html')));

// Mount API Routes
app.use('/api/auth', require('./others/routes/auth'));
app.use('/api/challenges', require('./others/routes/challenges'));
app.use('/api/notifications', require('./others/routes/notifications'));
app.use('/api/analytics', require('./others/routes/analytics'));
app.use('/api/admin', require('./others/routes/admin'));

// Comments standalone route (for delete)
const { deleteComment, toggleCommentLike } = require('./others/controllers/commentController');
const { protect: commentProtect } = require('./others/middleware/auth');
app.delete('/api/comments/:id', commentProtect, deleteComment);
app.post('/api/comments/:id/like', commentProtect, toggleCommentLike);

// Public map-data shortcut
app.get('/api/map-data', (req, res, next) => { req.url = '/challenges/map-data'; require('./routes/challenges')(req, res, next); });

// Universities public route
const University = require('./others/models/University');
const IndustryPartner = require('./others/models/IndustryPartner');

app.get('/api/universities', async (req, res) => {
  try {
    const { search, domain } = req.query;
    const query = { isActive: true };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (domain) query.expertiseDomains = domain;
    const universities = await University.find(query)
      .select('name shortName type location contact logo expertiseDomains departments facilities stats naacGrade')
      .sort('-stats.performanceScore');
    res.json({ success: true, data: universities });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.get('/api/universities/:id', async (req, res) => {
  try {
    const u = await University.findById(req.params.id).populate('representatives', 'name email avatar designation');
    if (!u) return res.status(404).json({ success: false, message: 'University not found' });
    res.json({ success: true, data: u });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

app.get('/api/industry', async (req, res) => {
  try {
    const partners = await IndustryPartner.find({ isActive: true })
      .select('name type sector description logo location contact capabilities stats');
    res.json({ success: true, data: partners });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// SPA fallback - serve index.html for non-API routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Dashboard routes
app.get('/dashboard/citizen', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard', 'citizen.html')));
app.get('/dashboard/university', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard', 'university.html')));
app.get('/dashboard/industry', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard', 'industry.html')));
app.get('/dashboard/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard', 'admin.html')));

// Auth pages
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'public', 'register.html')));
app.get('/forgot-password', (req, res) => res.sendFile(path.join(__dirname, 'public', 'forgot-password.html')));

// Pages
app.get('/feed', (req, res) => res.redirect('/dashboard/citizen.html'));
app.get('/map', (req, res) => res.sendFile(path.join(__dirname, 'public', 'map.html')));
app.get('/intro', (req, res) => res.sendFile(path.join(__dirname, 'public', 'intro.html')));


// API 404
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found` });
});

// Page 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`\n🚀 InnovateSphere Server running on port ${PORT}`);
  console.log(`🌐 Open: http://localhost:${PORT}`);
  console.log(`📊 Admin Dashboard: http://localhost:${PORT}/dashboard/admin`);
  console.log(`👤 Citizen Dashboard: http://localhost:${PORT}/dashboard/citizen`);
  console.log(`\n📌 Demo Credentials:`);
  console.log(`   Admin:      admin@innovatesphere.in / admin123`);
  console.log(`   Citizen:    rajesh@gmail.com / citizen123`);
  console.log(`   University: rajesh@iitjharkhand.ac.in / univ123`);
  console.log(`   Industry:   tata@steel.com / industry123\n`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});

module.exports = app;
