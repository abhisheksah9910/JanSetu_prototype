const Challenge = require('../models/Challenge');
const University = require('../models/University');
const User = require('../models/User');
const IndustryPartner = require('../models/IndustryPartner');
const { classifyChallenge, generateTags, suggestPriority, parseVoiceTranscript, findSimilarChallenges } = require('../services/aiClassifier');
const { notifyChallenge, notifyStatusChange, notifyUniversityAssignment, logActivity } = require('../services/notificationService');
const path = require('path');
const mongoose = require('mongoose');

// @desc    Get all challenges (with search, filter, pagination)
// @route   GET /api/challenges
// @access  Public/Private (different views)
exports.getChallenges = async (req, res, next) => {
  try {
    const {
      search, category, status, priority, district, assignedUniversity,
      page = 1, limit = 10, sort = '-createdAt', startDate, endDate, myOnly
    } = req.query;

    let query = {};

    // Role-based filtering
    if (req.user) {
      if (req.user.role === 'citizen') {
        if (myOnly === 'true') {
          query.submittedBy = req.user.id;
        } else {
          query.isPublic = true;
          query.status = { $nin: ['draft', 'rejected'] };
        }
      } else if (req.user.role === 'university_rep') {
        query.assignedUniversity = req.user.universityId;
      } else if (req.user.role === 'industry_rep') {
        // Industry reps see all non-draft challenges
        query.status = { $ne: 'draft' };
      }
    } else {
      // Public: show all active public challenges including newly submitted citizen reports
      query.isPublic = true;
      query.status = { $nin: ['draft', 'rejected'] };
    }

    // Filters
    if (search) query.$text = { $search: search };
    if (category) query.category = category;
    if (status && status !== 'all') {
      if (status.includes(',')) {
        query.status = { $in: status.split(',').map(s => s.trim()) };
      } else {
        query.status = status;
      }
    }
    if (priority) query.priority = priority;
    if (district) query['location.district'] = new RegExp('^' + district.trim() + '$', 'i');
    if (assignedUniversity) query.assignedUniversity = assignedUniversity;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [challenges, total] = await Promise.all([
      Challenge.find(query)
        .populate('submittedBy', 'name email avatar role')
        .populate('assignedUniversity', 'name shortName logo')
        .populate('assignedBy', 'name')
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Challenge.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      count: challenges.length,
      total,
      pages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: challenges
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single challenge
// @route   GET /api/challenges/:id
// @access  Public
exports.getChallenge = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id)
      .populate('submittedBy', 'name email role avatar stats')
      .populate('assignedUniversity', 'name shortName code location logo stats')
      .populate('assignedBy', 'name email role')
      .populate('projectTeam.faculty', 'name email avatar department designation')
      .populate('projectTeam.students', 'name email avatar department currentYear')
      .populate('industryCollaborators.partner', 'name companyType logo website')
      .populate('resolutionProof.verifiedBy', 'name role')
      .populate('feedback.submittedBy', 'name avatar');

    if (!challenge) {
      return res.status(404).json({ success: false, message: 'Challenge not found' });
    }

    // Increment view count (fire and forget)
    Challenge.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } }).exec();

    res.status(200).json({ success: true, data: challenge });
  } catch (error) {
    next(error);
  }
};

// @desc    Create challenge
// @route   POST /api/challenges
// @access  Private (Citizen, Admin) or Guest/Demo with submitterContact
exports.createChallenge = async (req, res, next) => {
  try {
    const {
      title, description, category, priority, location,
      submitterContact, deadline, isPublic = true,
      coverImage: reqCoverImage, image: reqImage
    } = req.body;

    // AI classification
    const aiResult = classifyChallenge(title, description);
    const tags = generateTags(`${title} ${description}`);
    const suggestedPriority = suggestPriority(`${title} ${description}`);

    let attachments = req.files && req.files.length > 0 ? req.files.map(f => ({
      filename: f.filename,
      originalName: f.originalname,
      mimetype: f.mimetype,
      size: f.size,
      url: `/uploads/challenges/${f.filename}`
    })) : [];

    if (attachments.length === 0 && req.body.attachments && Array.isArray(req.body.attachments) && req.body.attachments.length > 0) {
      attachments = req.body.attachments;
    } else if (attachments.length === 0 && (reqImage || reqCoverImage)) {
      const imgUrl = reqCoverImage || reqImage;
      attachments = [{
        filename: 'citizen_evidence.png',
        originalName: 'citizen_evidence.png',
        mimetype: 'image/png',
        size: typeof imgUrl === 'string' ? imgUrl.length : 1000,
        url: imgUrl
      }];
    }

    const coverImage = reqCoverImage || reqImage || (attachments.length > 0 ? attachments[0].url : null);

    // Resolve submitting user (support guest demo submission if token not present)
    let submitterUserId = req.user ? req.user.id : null;
    let submitterName = req.user ? req.user.name : (submitterContact && submitterContact.name ? submitterContact.name : 'Citizen');
    let submitterEmail = req.user ? req.user.email : (submitterContact && submitterContact.email ? submitterContact.email : 'citizen@jansetu.in');
    let submitterPhone = req.user ? req.user.phone : (submitterContact && submitterContact.phone ? submitterContact.phone : '9876543210');

    if (!submitterUserId) {
      const existingUser = await User.findOne({ email: submitterEmail.toLowerCase() });
      if (existingUser) {
        submitterUserId = existingUser._id;
      } else {
        const fallbackCitizen = await User.findOne({ role: 'citizen' });
        if (fallbackCitizen) submitterUserId = fallbackCitizen._id;
      }
    }

    const challenge = await Challenge.create({
      title: title.trim(),
      description,
      category: category || aiResult.category,
      aiSuggestedCategory: aiResult.category,
      aiConfidenceScore: aiResult.confidence,
      tags,
      priority: priority || suggestedPriority,
      submittedBy: submitterUserId,
      submitterContact: submitterContact || {
        name: submitterName,
        email: submitterEmail,
        phone: submitterPhone
      },
      location: typeof location === 'string' ? JSON.parse(location) : location,
      attachments,
      coverImage,
      deadline: deadline ? new Date(deadline) : null,
      isPublic,
      status: 'submitted',
      statusHistory: [{
        status: 'submitted',
        changedBy: submitterUserId,
        note: 'Challenge submitted by citizen'
      }]
    });

    // Update user stats if submitter is tracked
    if (submitterUserId) {
      await User.findByIdAndUpdate(submitterUserId, { $inc: { 'stats.challengesSubmitted': 1 } }).catch(() => {});
    }

    // Notify
    if (req.user) {
      await notifyChallenge(challenge, req.user).catch(() => {});
    }

    await logActivity({
      actor: req.user || { name: submitterName, role: 'citizen', id: submitterUserId },
      action: 'challenge_created',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
    });

    res.status(201).json({ success: true, data: challenge, message: `Challenge submitted! ID: ${challenge.challengeId}` });
  } catch (error) {
    next(error);
  }
};

// @desc    Update challenge (admin/university)
// @route   PUT /api/challenges/:id
// @access  Private
exports.updateChallenge = async (req, res, next) => {
  try {
    let challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    // Only submitter or admin can update
    if (challenge.submittedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const allowedUpdates = ['title', 'description', 'category', 'priority', 'location', 'deadline', 'isPublic', 'validationNotes', 'rejectionReason', 'impactMetrics'];
    const updateData = {};
    allowedUpdates.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });

    challenge = await Challenge.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });

    await logActivity({
      actor: req.user,
      action: 'challenge_updated',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
      description: `Challenge updated: "${challenge.title}"`,
      req
    });

    res.status(200).json({ success: true, data: challenge });
  } catch (error) {
    next(error);
  }
};

// @desc    Update challenge status (Admin)
// @route   PUT /api/challenges/:id/status
// @access  Private (Admin, UniversityRep)
exports.updateStatus = async (req, res, next) => {
  try {
    const { status, note, rejectionReason } = req.body;
    const challenge = await Challenge.findById(req.params.id).populate('submittedBy', 'name email');

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    const validTransitions = {
      submitted: ['under_review', 'validated', 'rejected'],
      under_review: ['validated', 'rejected', 'submitted'],
      validated: ['assigned', 'under_review', 'rejected'],
      assigned: ['in_progress', 'escalated', 'validated', 'rejected'],
      in_progress: ['testing', 'resolved', 'escalated', 'assigned', 'rejected'],
      testing: ['resolved', 'in_progress', 'escalated'],
      escalated: ['assigned', 'in_progress', 'testing', 'resolved', 'closed'],
      resolved: ['closed', 'in_progress'],
      closed: ['resolved', 'in_progress'],
      rejected: ['under_review', 'submitted']
    };

    const allowed = validTransitions[challenge.status] || [];
    if (!allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from '${challenge.status}' to '${status}'`
      });
    }

    const oldStatus = challenge.status;
    challenge.status = status;
    if (rejectionReason) challenge.rejectionReason = rejectionReason;
    if (status === 'resolved') {
      challenge.resolvedAt = new Date();
      await User.findByIdAndUpdate(challenge.submittedBy, { $inc: { 'stats.challengesResolved': 1 } });
    }

    challenge.statusHistory.push({
      status,
      changedBy: req.user.id,
      changedAt: new Date(),
      note
    });

    await challenge.save();

    // Notify submitter
    await notifyStatusChange(challenge, oldStatus, status, req.user);

    await logActivity({
      actor: req.user,
      action: 'challenge_status_changed',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
      description: `Status changed: ${oldStatus} → ${status}`,
      metadata: new Map([['oldStatus', oldStatus], ['newStatus', status]]),
      req
    });

    res.status(200).json({ success: true, data: challenge, message: `Status updated to ${status}` });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign challenge to university
// @route   POST /api/challenges/:id/assign
// @access  Private (Admin)
exports.assignChallenge = async (req, res, next) => {
  try {
    const { universityId, deadline, note } = req.body;

    const [challenge, university] = await Promise.all([
      Challenge.findById(req.params.id).populate('submittedBy'),
      University.findById(universityId).populate('representatives', 'name email')
    ]);

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });
    if (!university) return res.status(404).json({ success: false, message: 'University not found' });

    const oldStatus = challenge.status;
    challenge.assignedUniversity = universityId;
    challenge.assignedAt = new Date();
    challenge.assignedBy = req.user.id;
    challenge.status = 'assigned';
    if (deadline) challenge.deadline = new Date(deadline);

    challenge.statusHistory.push({
      status: 'assigned',
      changedBy: req.user.id,
      note: note || `Assigned to ${university.name}`
    });

    await challenge.save();

    // Update university stats
    await University.findByIdAndUpdate(universityId, { $inc: { 'stats.totalAssigned': 1 } });

    // Notify citizen
    await notifyStatusChange(challenge, oldStatus, 'assigned', req.user);

    // Notify university reps
    for (const rep of (university.representatives || [])) {
      await notifyUniversityAssignment(challenge, rep._id, req.user);
    }

    await logActivity({
      actor: req.user,
      action: 'challenge_assigned',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
      description: `Challenge assigned to ${university.name}`,
      req
    });

    const populated = await Challenge.findById(challenge._id)
      .populate('assignedUniversity', 'name shortName logo');

    res.status(200).json({ success: true, data: populated, message: `Challenge assigned to ${university.name}` });
  } catch (error) {
    next(error);
  }
};

// @desc    Submit feedback/rating for resolved challenge
// @route   POST /api/challenges/:id/feedback
// @access  Private (Citizen - submitter only)
exports.submitFeedback = async (req, res, next) => {
  try {
    const { rating, review } = req.body;
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });
    if (challenge.submittedBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the submitter can provide feedback' });
    }
    if (challenge.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Feedback can only be submitted for resolved challenges' });
    }
    if (challenge.feedback && challenge.feedback.rating) {
      return res.status(400).json({ success: false, message: 'Feedback already submitted' });
    }

    challenge.feedback = {
      rating: parseInt(rating),
      review,
      submittedAt: new Date(),
      submittedBy: req.user.id
    };

    await challenge.save();

    await logActivity({
      actor: req.user,
      action: 'feedback_submitted',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
      description: `Feedback submitted: ${rating}/5 stars`,
      req
    });

    res.status(200).json({ success: true, message: 'Thank you for your feedback!', data: challenge.feedback });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete challenge
// @route   DELETE /api/challenges/:id
// @access  Private (Admin or submitter)
exports.deleteChallenge = async (req, res, next) => {
  try {
    let challenge = null;
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      challenge = await Challenge.findById(req.params.id);
    }
    if (!challenge) {
      challenge = await Challenge.findOne({ challengeId: req.params.id });
    }
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    // Authorization check
    const clientEmail = (req.headers['x-citizen-email'] || (req.user && req.user.email) || '').toLowerCase().trim();
    const subEmail = (challenge.submitterContact?.email || '').toLowerCase().trim();
    const isSubmitter = (req.user && challenge.submittedBy && challenge.submittedBy.toString() === req.user.id.toString())
      || (clientEmail && subEmail && clientEmail === subEmail);
    const isAdmin = req.user && req.user.role === 'admin';

    if (!isAdmin && !isSubmitter && req.user) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this challenge' });
    }

    // Citizens can delete unverified/submitted or draft grievances
    if (!isAdmin && !['draft', 'submitted', 'pending'].includes(challenge.status)) {
      return res.status(400).json({ success: false, message: 'Cannot delete a grievance once it is assigned or in progress' });
    }

    await challenge.deleteOne();
    res.status(200).json({ success: true, message: 'Challenge deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get challenges submitted by current user
// @route   GET /api/challenges/my
// @access  Private
exports.getMyChallenges = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { submittedBy: req.user.id };
    if (status) query.status = status;

    const [challenges, total] = await Promise.all([
      Challenge.find(query)
        .populate('assignedUniversity', 'name shortName logo')
        .sort('-createdAt')
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Challenge.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: challenges,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public challenge stats
// @route   GET /api/challenges/stats
// @access  Public
exports.getChallengeStats = async (req, res, next) => {
  try {
    const [statusStats, categoryStats, districtStats] = await Promise.all([
      Challenge.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Challenge.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Challenge.aggregate([
        { $group: { _id: '$location.district', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    const total = await Challenge.countDocuments();
    const resolved = await Challenge.countDocuments({ status: 'resolved' });

    res.status(200).json({
      success: true,
      data: {
        total,
        resolved,
        resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
        byStatus: statusStats.reduce((acc, s) => { acc[s._id] = s.count; return acc; }, {}),
        byCategory: categoryStats,
        byDistrict: districtStats
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Live classify challenge text with AI
// @route   POST /api/challenges/classify
// @access  Public
exports.classifyChallengeText = async (req, res, next) => {
  try {
    const { title = '', description = '' } = req.body;
    const classification = classifyChallenge(title, description);
    const suggestedPriority = suggestPriority(`${title} ${description}`);
    const tags = generateTags(`${title} ${description}`);

    res.status(200).json({
      success: true,
      data: {
        category: classification.category,
        confidence: classification.confidence,
        suggestedPriority,
        tags,
        scores: classification.scores
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle support (like) on a challenge
// @route   POST /api/challenges/:id/support
// @access  Private
exports.toggleSupport = async (req, res, next) => {
  try {
    const challenge = await Challenge.findById(req.params.id);
    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    const userId = req.user.id;
    const alreadySupported = challenge.supports.some(id => id.toString() === userId);

    if (alreadySupported) {
      challenge.supports = challenge.supports.filter(id => id.toString() !== userId);
      challenge.supportCount = Math.max(0, (challenge.supportCount || 1) - 1);
    } else {
      challenge.supports.push(userId);
      challenge.supportCount = (challenge.supportCount || 0) + 1;
    }

    await challenge.save();

    res.status(200).json({
      success: true,
      data: {
        supported: !alreadySupported,
        supportCount: challenge.supportCount
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get public social feed
// @route   GET /api/feed
// @access  Public
exports.getPublicFeed = async (req, res, next) => {
  try {
    const {
      page = 1, limit = 10,
      state, category, status,
      sort = 'recent', search
    } = req.query;

    const query = {
      isPublic: true,
      status: { $nin: ['draft', 'rejected'] }
    };

    if (state && state !== 'all') query['location.state'] = state;
    if (category) query.category = category;
    if (status && status !== 'all') query.status = status;
    if (search) query.$text = { $search: search };

    const sortOptions = {
      recent: '-createdAt',
      supported: '-supportCount',
      discussed: '-commentCount',
      oldest: 'createdAt'
    };
    const sortBy = sortOptions[sort] || '-createdAt';

    const [challenges, total] = await Promise.all([
      Challenge.find(query)
        .populate('submittedBy', 'name avatar role')
        .populate('assignedUniversity', 'name shortName')
        .select('title description category priority status location attachments coverImage supportCount commentCount viewCount createdAt submittedBy assignedUniversity isFeatured submitterContact')
        .sort(sortBy)
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit)),
      Challenge.countDocuments(query)
    ]);

    // Increment view counts in background
    const ids = challenges.map(c => c._id);
    Challenge.updateMany({ _id: { $in: ids } }, { $inc: { viewCount: 1 } }).exec();

    res.status(200).json({
      success: true,
      data: challenges,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
        hasMore: parseInt(page) < Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get India-wide map data (state-wise counts)
// @route   GET /api/map-data
// @access  Public
exports.getMapData = async (req, res, next) => {
  try {
    const { category, startDate, endDate } = req.query;

    const matchQuery = {};
    if (category) matchQuery.category = category;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) matchQuery.createdAt.$lte = new Date(endDate);
    }

    const stateData = await Challenge.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$location.state',
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review', 'validated', 'assigned', 'in_progress', 'testing']] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          pending: { $sum: { $cond: [{ $in: ['$status', ['submitted', 'under_review']] }, 1, 0] } },
          urgent: { $sum: { $cond: [{ $eq: ['$priority', 'urgent'] }, 1, 0] } },
          avgLat: { $avg: '$location.coordinates.lat' },
          avgLng: { $avg: '$location.coordinates.lng' }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Category breakdown per state
    const categoryData = await Challenge.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { state: '$location.state', category: '$category' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format category data
    const categoryByState = {};
    categoryData.forEach(item => {
      const state = item._id.state;
      if (!categoryByState[state]) categoryByState[state] = {};
      categoryByState[state][item._id.category] = item.count;
    });

    const formattedData = stateData.map(s => ({
      state: s._id || 'Unknown',
      total: s.total,
      active: s.active,
      resolved: s.resolved,
      pending: s.pending,
      urgent: s.urgent,
      resolutionRate: s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0,
      categories: categoryByState[s._id] || {}
    }));

    const summary = {
      totalStates: stateData.length,
      totalChallenges: stateData.reduce((sum, s) => sum + s.total, 0),
      totalActive: stateData.reduce((sum, s) => sum + s.active, 0),
      totalResolved: stateData.reduce((sum, s) => sum + s.resolved, 0),
      topState: stateData[0]?._id || 'N/A'
    };

    res.status(200).json({
      success: true,
      data: formattedData,
      summary
    });
  } catch (error) {
    next(error);
  }
};



// @desc    Check for potential duplicate challenges nearby
// @route   POST /api/challenges/check-duplicates
// @access  Public/Private
exports.checkDuplicates = async (req, res, next) => {
  try {
    const { title, description, category, location } = req.body;
    const district = location && location.district ? location.district : '';

    let candidateQuery = { status: { $in: ['submitted', 'under_review', 'validated', 'assigned', 'in_progress', 'testing', 'resolved'] } };
    if (district) {
      candidateQuery['location.district'] = new RegExp(district, 'i');
    }

    const candidateList = await Challenge.find(candidateQuery)
      .select('title description category status location challengeId supportCount supports createdAt')
      .limit(50)
      .lean();

    const duplicates = findSimilarChallenges({ title, description, category, location }, candidateList);

    res.status(200).json({
      success: true,
      hasDuplicates: duplicates.length > 0,
      data: duplicates
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Parse speech-to-text transcript into structured challenge data
// @route   POST /api/challenges/parse-voice
// @access  Public/Private
exports.parseVoice = async (req, res, next) => {
  try {
    const { transcript = '' } = req.body;
    const parsed = parseVoiceTranscript(transcript);
    res.status(200).json({
      success: true,
      data: parsed
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Citizen validates resolution of problem (Confirm / Reopen)
// @route   POST /api/challenges/:id/validate-resolution
// @access  Private (Citizen submitter)
exports.validateResolution = async (req, res, next) => {
  try {
    const { isSolved, feedback, reopenReason } = req.body;
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    if (challenge.submittedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only the original citizen can validate the solution' });
    }

    if (isSolved) {
      challenge.status = 'closed';
      challenge.resolvedAt = challenge.resolvedAt || new Date();
      challenge.resolutionProof = {
        ...(challenge.resolutionProof || {}),
        citizenVerified: true,
        citizenFeedback: feedback || 'Citizen confirmed solution is working satisfactorily.',
        verifiedAt: new Date()
      };
      challenge.statusHistory.push({
        status: 'closed',
        changedBy: req.user.id,
        note: 'Citizen verified solution: ' + (feedback || 'Problem solved satisfactorily')
      });
    } else {
      challenge.status = 'in_progress';
      challenge.resolutionProof = {
        ...(challenge.resolutionProof || {}),
        citizenVerified: false,
        citizenFeedback: reopenReason || 'Citizen indicated problem still persists.',
        verifiedAt: new Date()
      };
      challenge.statusHistory.push({
        status: 'in_progress',
        changedBy: req.user.id,
        note: 'Citizen reported problem NOT resolved: ' + (reopenReason || 'Issue persists')
      });
    }

    await challenge.save();

    res.status(200).json({
      success: true,
      status: challenge.status,
      message: isSolved ? 'Thank you! Solution citizen-verified & report closed.' : 'Report reopened. University and taskforce have been alerted.',
      data: challenge
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Citizen provides additional info requested by authority
// @route   POST /api/challenges/:id/provide-info
// @access  Private (Citizen submitter)
exports.provideAdditionalInfo = async (req, res, next) => {
  try {
    const { notes, landmark, voiceTranscript } = req.body;
    const challenge = await Challenge.findById(req.params.id);

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });

    const mediaUrls = req.files ? req.files.map(f => '/uploads/challenges/' + f.filename) : [];

    challenge.needMoreInfo = challenge.needMoreInfo || {};
    challenge.needMoreInfo.isActive = false;
    challenge.needMoreInfo.responses = challenge.needMoreInfo.responses || [];
    challenge.needMoreInfo.responses.push({
      notes: notes || '',
      landmark: landmark || '',
      voiceTranscript: voiceTranscript || '',
      mediaUrls,
      submittedAt: new Date()
    });

    challenge.statusHistory.push({
      status: challenge.status,
      changedBy: req.user.id,
      note: 'Citizen submitted additional information' + (landmark ? ' (Landmark: ' + landmark + ')' : '')
    });

    await challenge.save();

    res.status(200).json({
      success: true,
      message: 'Additional information successfully submitted to JanSetu!',
      data: challenge
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Assign industry partner to challenge
// @route   POST /api/challenges/:id/assign-industry
// @access  Private (Admin)
exports.assignIndustryPartner = async (req, res, next) => {
  try {
    const { partnerId, role, note } = req.body;

    const [challenge, partner] = await Promise.all([
      Challenge.findById(req.params.id),
      IndustryPartner.findById(partnerId)
    ]);

    if (!challenge) return res.status(404).json({ success: false, message: 'Challenge not found' });
    if (!partner) return res.status(404).json({ success: false, message: 'Industry Partner not found' });

    // Prevent duplicate assignment
    const alreadyAssigned = challenge.industryCollaborators.some(c => c.partner.toString() === partnerId);
    if (alreadyAssigned) {
      return res.status(400).json({ success: false, message: 'Partner is already collaborating on this challenge' });
    }

    challenge.industryCollaborators.push({
      partner: partnerId,
      role: role || 'funder',
      joinedAt: new Date()
    });

    challenge.statusHistory.push({
      status: challenge.status,
      changedBy: req.user.id,
      note: note || `Industry Partner ${partner.name} joined as ${role || 'funder'}`
    });

    await challenge.save();

    // Update partner stats
    await IndustryPartner.findByIdAndUpdate(partnerId, { $inc: { 'stats.totalCollaborations': 1 } });

    await logActivity({
      actor: req.user,
      action: 'challenge_assigned',
      target: { type: 'Challenge', id: challenge._id, name: challenge.title },
      description: `Industry partner ${partner.name} joined challenge`,
      req
    });

    res.status(200).json({ success: true, message: `Industry Partner ${partner.name} assigned` });
  } catch (error) {
    next(error);
  }
};
