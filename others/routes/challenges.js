const express = require('express');
const router = express.Router();
const {
  getChallenges, getChallenge, createChallenge, updateChallenge,
  updateStatus, assignChallenge, submitFeedback, deleteChallenge,
  getMyChallenges, getChallengeStats, classifyChallengeText,
  toggleSupport, getPublicFeed, getMapData,
  checkDuplicates, parseVoice, validateResolution, provideAdditionalInfo
} = require('../controllers/challengeController');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/roleCheck');
const upload = require('../middleware/upload');

// Public feed & map
router.get('/feed', optionalAuth, getPublicFeed);
router.get('/map-data', getMapData);
router.get('/stats', getChallengeStats);
router.post('/classify', classifyChallengeText);
router.post('/check-duplicates', checkDuplicates);
router.post('/parse-voice', parseVoice);
router.get('/my', protect, getMyChallenges);
router.get('/', optionalAuth, getChallenges);
router.post('/', optionalAuth, (req, res, next) => { req.uploadSubDir = 'challenges'; next(); }, upload.array('attachments', 10), createChallenge);
router.get('/:id', optionalAuth, getChallenge);
router.put('/:id', protect, updateChallenge);
router.delete('/:id', optionalAuth, deleteChallenge);
router.put('/:id/status', protect, authorize('admin', 'university_rep'), updateStatus);
router.post('/:id/assign', protect, authorize('admin'), assignChallenge);
router.put('/:id/assign', protect, authorize('admin'), assignChallenge);
router.post('/:id/support', protect, toggleSupport);
router.post('/:id/feedback', protect, authorize('citizen'), submitFeedback);
router.post('/:id/validate-resolution', protect, authorize('citizen', 'admin'), validateResolution);
router.post('/:id/provide-info', protect, authorize('citizen', 'admin'), (req, res, next) => { req.uploadSubDir = 'challenges'; next(); }, upload.array('attachments', 10), provideAdditionalInfo);

// Comments — nested router
router.use('/:id/comments', require('./comments'));

module.exports = router;
