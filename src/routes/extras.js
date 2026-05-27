const express = require('express');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');
const { generateCertificate } = require('../services/certificateService');
const { sendCertificateEmail, sendVerificationEmail, sendWelcomeEmail } = require('../services/emailService');

// ==================== SERTIFIKAT ====================
const certRouter = express.Router();

// GET /api/certificates/:eventId  — sertifikat olish yoki yaratish
certRouter.get('/:eventId', auth, async (req, res) => {
  try {
    const participation = await pool.query(
      `SELECT ep.*, e.title AS event_title, e.end_date,
              o.org_name, ep.hours_logged
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       JOIN organizations o ON o.id = e.org_id
       WHERE ep.event_id = $1 AND ep.user_id = $2 AND ep.status = 'completed'`,
      [req.params.eventId, req.user.id]
    );

    if (!participation.rows[0]) {
      return res.status(403).json({ success: false, message: 'Sertifikat uchun tadbir topilmadi yoki tugatilmagan' });
    }

    const p = participation.rows[0];
    const certId = `VC-${req.user.id}-${req.params.eventId}-${Date.now()}`.toUpperCase();

    const pdfBuffer = await generateCertificate({
      fullName: req.user.full_name,
      eventTitle: p.event_title,
      orgName: p.org_name,
      hours: p.hours_logged,
      completedDate: p.end_date,
      certId,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="sertifikat-${certId}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Sertifikat yaratilmadi' });
  }
});

// POST /api/certificates/:eventId/email  — emailga yuborish
certRouter.post('/:eventId/email', auth, async (req, res) => {
  try {
    const participation = await pool.query(
      `SELECT ep.*, e.title AS event_title, e.end_date, o.org_name
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       JOIN organizations o ON o.id = e.org_id
       WHERE ep.event_id = $1 AND ep.user_id = $2 AND ep.status = 'completed'`,
      [req.params.eventId, req.user.id]
    );

    if (!participation.rows[0]) {
      return res.status(403).json({ success: false, message: 'Sertifikat topilmadi' });
    }

    const p = participation.rows[0];
    const certId = `VC-${req.user.id}-${req.params.eventId}`;

    const pdfBuffer = await generateCertificate({
      fullName: req.user.full_name,
      eventTitle: p.event_title,
      orgName: p.org_name,
      hours: p.hours_logged,
      completedDate: p.end_date,
      certId,
    });

    const userEmail = await pool.query('SELECT email FROM users WHERE id = $1', [req.user.id]);
    await sendCertificateEmail(userEmail.rows[0].email, req.user.full_name, p.event_title, pdfBuffer);

    res.json({ success: true, message: 'Sertifikat emailga yuborildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Email yuborilmadi' });
  }
});

// ==================== EMAIL TASDIQLASH ====================
const verifyRouter = express.Router();

// POST /api/verify/send  — tasdiqlash kodi yuborish
verifyRouter.post('/send', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 daqiqa

    await pool.query(
      `INSERT INTO verification_codes (user_id, code, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE SET code = $2, expires_at = $3`,
      [req.user.id, code, expires]
    );

    const userResult = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [req.user.id]);
    const { email, full_name } = userResult.rows[0];

    await sendVerificationEmail(email, full_name, code);

    res.json({ success: true, message: 'Tasdiqlash kodi emailga yuborildi' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Kod yuborilmadi' });
  }
});

// POST /api/verify/confirm  — kodni tasdiqlash
verifyRouter.post('/confirm', auth, async (req, res) => {
  try {
    const { code } = req.body;

    const result = await pool.query(
      'SELECT * FROM verification_codes WHERE user_id = $1 AND expires_at > NOW()',
      [req.user.id]
    );

    if (!result.rows[0] || result.rows[0].code !== code) {
      return res.status(400).json({ success: false, message: 'Kod noto\'g\'ri yoki muddati tugagan' });
    }

    await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [req.user.id]);
    await pool.query('DELETE FROM verification_codes WHERE user_id = $1', [req.user.id]);

    const userResult = await pool.query('SELECT email, full_name FROM users WHERE id = $1', [req.user.id]);
    await sendWelcomeEmail(userResult.rows[0].email, userResult.rows[0].full_name);

    res.json({ success: true, message: 'Email muvaffaqiyatli tasdiqlandi!' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

module.exports = { certRouter, verifyRouter };
