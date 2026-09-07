const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const challengeSchema = new mongoose.Schema({
  challengeId: {
    type: String,
    unique: true,
    default: () => 'JH-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000)
  },
  title: {
    type: String,
    required: [true, 'Challenge title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [5, 'Description must be at least 5 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Education',
      'Healthcare',
      'Agriculture',
      'Water Management',
      'Sanitation & Environment',
      'Rural Livelihoods',
      'Accessibility',
      'Urban Infrastructure',
      'Public Administration',
      'Energy & Technology'
    ]
  },
  aiSuggestedCategory: String,
  aiConfidenceScore: { type: Number, min: 0, max: 1 },
  tags: [String],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'validated', 'assigned', 'in_progress', 'testing', 'resolved', 'rejected', 'closed'],
    default: 'submitted'
  },
  // Submitter
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submitterContact: {
    name: String,
    email: String,
    phone: String
  },
  // Location
  location: {
    address: String,
    village: String,
    panchayat: String,
    block: String,
    district: {
      type: String,
      required: [true, 'District is required']
    },
    state: { type: String, default: 'Jharkhand', index: true },
    pincode: String,
    coordinates: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null }
    }
  },

  // Media
  attachments: [{
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    url: String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  // Assignment
  assignedUniversity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'University'
  },
  assignedAt: Date,
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Industry collaboration
  industryCollaborators: [{
    partner: { type: mongoose.Schema.Types.ObjectId, ref: 'IndustryPartner' },
    role: { type: String, enum: ['mentor', 'funder', 'co_developer', 'pilot_partner'] },
    joinedAt: { type: Date, default: Date.now }
  }],
  // Team
  projectTeam: {
    faculty: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
  },
  // Milestones
  milestones: [{
    title: String,
    description: String,
    deadline: Date,
    completedAt: Date,
    status: { type: String, enum: ['pending', 'in_progress', 'completed', 'delayed'], default: 'pending' }
  }],
  // Solution
  solutionProposal: {
    title: String,
    description: String,
    approach: String,
    expectedOutcome: String,
    timeline: String,
    budget: Number,
    submittedAt: Date,
    approvedAt: Date,
    status: { type: String, enum: ['not_submitted', 'submitted', 'approved', 'revision_needed'], default: 'not_submitted' }
  },
  // Feedback
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    review: String,
    submittedAt: Date,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  // Audit trail
  statusHistory: [{
    status: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedAt: { type: Date, default: Date.now },
    note: String
  }],
  // Validation
  validationNotes: String,
  rejectionReason: String,
  // Deadline
  deadline: Date,
  resolvedAt: Date,
  // Impact metrics
    // Before / After Evidence & Resolution Proof
  resolutionProof: {
    beforeImage: { type: String, default: null },
    afterImage: { type: String, default: null },
    summary: { type: String, default: null },
    citizenVerified: { type: Boolean, default: false },
    citizenFeedback: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  // Need More Info Interactive Workflow
  needMoreInfo: {
    isActive: { type: Boolean, default: false },
    query: { type: String, default: null },
    requestedAt: { type: Date, default: null },
    responses: [{
      notes: String,
      mediaUrls: [String],
      landmark: String,
      voiceTranscript: String,
      submittedAt: { type: Date, default: Date.now }
    }]
  },
  impactMetrics: {
    beneficiaries: Number,
    patentsGenerated: Number,
    startupsCreated: Number,
    implementationStatus: String
  },
  // Support system
  supports: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  supportCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  // Cover/thumbnail image (first image from attachments or manually set)
  coverImage: { type: String, default: null },
  // Meta
  viewCount: { type: Number, default: 0 },
  isPublic: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});


// Text search index
challengeSchema.index({ title: 'text', description: 'text', tags: 'text' });
challengeSchema.index({ category: 1, status: 1, priority: 1 });
challengeSchema.index({ 'location.district': 1 });
challengeSchema.index({ submittedBy: 1 });
challengeSchema.index({ assignedUniversity: 1 });

// Virtual: days since submission
challengeSchema.virtual('daysSinceSubmission').get(function() {
  return Math.floor((Date.now() - this.createdAt) / (1000 * 60 * 60 * 24));
});

// Virtual: is overdue
challengeSchema.virtual('isOverdue').get(function() {
  if (!this.deadline) return false;
  return Date.now() > this.deadline && this.status !== 'resolved' && this.status !== 'closed';
});

module.exports = mongoose.model('Challenge', challengeSchema);

