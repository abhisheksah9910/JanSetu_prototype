const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  role: {
    type: String,
    enum: ['citizen', 'university_rep', 'industry_rep', 'admin'],
    default: 'citizen'
  },
  phone: {
    type: String,
    trim: true
  },
  citizenId: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  aadhaar: {
    type: String,
    trim: true,
    default: '8492-3840-4819'
  },
  aadhaarVerified: {
    type: Boolean,
    default: true
  },
  phoneVerified: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: true
  },
  avatar: {
    type: String,
    default: null
  },
  // Citizen fields
  address: {
    street: String,
    city: String,
    district: String,
    state: { type: String, default: 'Jharkhand' },
    pincode: String
  },
  // University rep fields
  universityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University'
  },
  // Industry rep fields
  industryPartnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'IndustryPartner'
  },
  designation: String,
  department: String,
  bio: String,
  isActive: {
    type: Boolean,
    default: true
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  notificationPreferences: {
    email: { type: Boolean, default: true },
    inApp: { type: Boolean, default: true }
  },
  stats: {
    challengesSubmitted: { type: Number, default: 0 },
    challengesResolved: { type: Number, default: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE }
  );
};

// Get full name virtual
userSchema.virtual('initials').get(function() {
  return this.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
});

module.exports = mongoose.model('User', userSchema);
