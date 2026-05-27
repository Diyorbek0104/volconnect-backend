const express = require('express');
const { body } = require('express-validator');
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

const registerRules = [
  body('full_name').trim().isLength({ min: 2 }).withMessage('Ism kamida 2 harf'),
  body('email').isEmail().withMessage('Email noto\'g\'ri'),
  body('password').isLength({ min: 6 }).withMessage('Parol kamida 6 belgi'),
];

router.post('/register', registerRules, register);
router.post('/login', login);
router.get('/me', auth, getMe);
router.put('/change-password', auth, changePassword);

module.exports = router;
