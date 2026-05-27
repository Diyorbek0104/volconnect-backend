const express = require('express');
const multer = require('multer');
const path = require('path');
const { auth, requireRole } = require('../middleware/auth');
const { getUsers, getUserById, updateProfile, getUserStats } = require('../controllers/userController');
const { getEvents, getEventById, createEvent, joinEvent, logHours } = require('../controllers/eventController');
const { getConversations, getMessages, sendMessage } = require('../controllers/messageController');

// --- Fayl yuklash sozlamasi ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, process.env.UPLOAD_PATH || './uploads'),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()));
  },
});

// --- Users ---
const userRouter = express.Router();
userRouter.get('/', getUsers);
userRouter.get('/:id', getUserById);
userRouter.get('/:id/stats', getUserStats);
userRouter.put('/profile', auth, upload.single('avatar'), updateProfile);

// --- Events ---
const eventRouter = express.Router();
eventRouter.get('/', getEvents);
eventRouter.get('/:id', getEventById);
eventRouter.post('/', auth, requireRole('organization', 'admin'), upload.single('image'), createEvent);
eventRouter.post('/:id/join', auth, requireRole('volunteer'), joinEvent);
eventRouter.put('/:id/log-hours', auth, requireRole('organization', 'admin'), logHours);

// --- Messages ---
const messageRouter = express.Router();
messageRouter.get('/conversations', auth, getConversations);
messageRouter.get('/:userId', auth, getMessages);
messageRouter.post('/:userId', auth, sendMessage);

module.exports = { userRouter, eventRouter, messageRouter };
