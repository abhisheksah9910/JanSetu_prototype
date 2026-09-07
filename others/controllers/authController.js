const User = require('../models/User');
const { logActivity } = require('../services/notificationService');

const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  const citizenId = user.citizenId || ('C' + (user.aadhaar ? user.aadhaar.replace(/[^0-9]/g, '').slice(-4) : (user._id ? user._id.toString().slice(-4) : '4819')));
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      citizenId: citizenId,
      phone: user.phone || '9431100003',
      aadhaar: user.aadhaar || '8492-3840-4819',
      aadhaarVerified: user.aadhaarVerified !== false,
      phoneVerified: user.phoneVerified !== false,
      emailVerified: user.emailVerified !== false,
      address: user.address,
      avatar: user.avatar,
      isVerified: user.isVerified,
      universityId: user.universityId,
      industryPartnerId: user.industryPartnerId
    }
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, aadhaar, address, universityId, industryPartnerId, designation, department } = req.body;

    // Validate role
    const allowedRoles = ['citizen', 'university_rep', 'industry_rep'];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    // Generate clean Citizen ID without dashes or underscores: e.g. C9604
    let citizenId = req.body.citizenId;
    if (!citizenId && (!role || role === 'citizen')) {
      citizenId = 'C' + Math.floor(1000 + Math.random() * 9000);
    }

    const userData = {
      name,
      email,
      password,
      role: role || 'citizen',
      citizenId,
      phone: phone || '9431100003',
      aadhaar: aadhaar || '8492-3840-4819',
      aadhaarVerified: true,
      phoneVerified: true,
      emailVerified: true,
      address,
      designation,
      department
    };
    if (role === 'university_rep' && universityId) userData.universityId = universityId;
    if (role === 'industry_rep' && industryPartnerId) userData.industryPartnerId = industryPartnerId;

    const user = await User.create(userData);

    await logActivity({
      actor: user,
      action: 'user_registered',
      target: { type: 'User', id: user._id, name: user.name },
      description: `New user registered: ${user.name} (${user.role}) - ID: ${citizenId || user._id}`
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user (supports Email, Phone, Citizen ID e.g. C9604, or Aadhaar)
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const identifier = req.body.email || req.body.identifier || req.body.citizenId;
    const { password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email/mobile/citizen ID and password' });
    }

    const cleanId = identifier.trim();
    const user = await User.findOne({
      $or: [
        { email: cleanId.toLowerCase() },
        { phone: cleanId },
        { citizenId: cleanId.toUpperCase() },
        { aadhaar: cleanId },
        { aadhaar: cleanId.replace(/[^0-9]/g, '') }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Your account has been deactivated. Contact support.' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    await logActivity({
      actor: user,
      action: 'user_login',
      target: { type: 'User', id: user._id, name: user.name },
      description: `User logged in: ${user.name}`
    });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged-in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('universityId', 'name shortName logo')
      .populate('industryPartnerId', 'name type logo');

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Update profile
// @route   PUT /api/auth/update-profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'email', 'phone', 'aadhaar', 'bio', 'designation', 'department', 'address', 'notificationPreferences'];
    const updateData = {};
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file) {
      updateData.avatar = '/uploads/avatars/' + req.file.filename;
    }

    const user = await User.findByIdAndUpdate(req.user.id, updateData, {
      new: true, runValidators: true
    });

    if (user && !user.citizenId && user.role === 'citizen') {
      user.citizenId = 'C' + (user.aadhaar ? user.aadhaar.replace(/[^0-9]/g, '').slice(-4) : user._id.toString().slice(-4));
      await user.save({ validateBeforeSave: false });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};

// @desc    Send OTP (Dummy OTP 123456 as requested)
// @route   POST /api/auth/send-otp
// @access  Public
exports.sendOtp = async (req, res, next) => {
  try {
    const { target, type } = req.body;
    const otp = '123456'; // User requested dummy OTP 123456 everywhere
    res.status(200).json({
      success: true,
      message: `OTP sent to ${target || 'contact'}. Use demo OTP: 123456`,
      otp,
      expiresIn: 300
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify OTP (Accepts 123456)
// @route   POST /api/auth/verify-otp
// @access  Public
exports.verifyOtp = async (req, res, next) => {
  try {
    const { otp } = req.body;
    if (otp !== '123456') {
      return res.status(400).json({ success: false, message: 'अमान्य OTP! कृपया सही OTP (123456) दर्ज करें।' });
    }
    res.status(200).json({ success: true, message: 'OTP verified successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password (requires current password and new password)
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!currentPassword) {
      return res.status(400).json({ success: false, message: 'कृपया वर्तमान पासवर्ड दर्ज करें (Please enter current password).' });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(400).json({ success: false, message: 'मूल/वर्तमान पासवर्ड गलत है (Incorrect current password)' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'नया पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'पासवर्ड सफलतापूर्वक बदल दिया गया (Password changed successfully)!' });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password (generates reset token - simplified for demo)
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email' });
    }

    // In production, send reset email; for demo, return token
    const resetToken = require('crypto').randomBytes(32).toString('hex');
    user.resetPasswordToken = require('crypto').createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email (Demo: token returned)',
      resetToken // Remove in production
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const resetPasswordToken = require('crypto').createHash('sha256').update(req.params.token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};
