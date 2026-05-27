const express = require('express');
const { pool } = require('../config/database');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(auth, requireRole('admin'));

// GET /api/admin/stats  — bosh panel statistikasi
router.get('/stats', async (req, res) => {
  try {
    const [users, events, messages, hours, newUsers, donations] = await Promise.all([
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE role = 'volunteer') AS volunteers,
        COUNT(*) FILTER (WHERE role = 'organization') AS organizations,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_this_month
        FROM users`),
      pool.query(`SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed
        FROM events`),
      pool.query('SELECT COUNT(*) AS total FROM messages'),
      pool.query('SELECT COALESCE(SUM(hours_logged), 0) AS total FROM event_participants'),
      pool.query(`SELECT DATE_TRUNC('day', created_at) AS day, COUNT(*) AS count
        FROM users WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY day ORDER BY day`),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'`),
    ]);

    res.json({
      success: true,
      stats: {
        users: users.rows[0],
        events: events.rows[0],
        messages: messages.rows[0].total,
        total_volunteer_hours: hours.rows[0].total,
        total_donations: donations.rows[0].total,
        user_growth: newUsers.rows,
      },
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

// GET /api/admin/users  — barcha foydalanuvchilar
router.get('/users', async (req, res) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let conditions = [];

    if (role) { params.push(role); conditions.push(`role = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`(full_name ILIKE $${params.length} OR email ILIKE $${params.length})`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    params.push(limit, offset);

    const result = await pool.query(
      `SELECT id, full_name, email, role, city, rating, total_hours, is_verified, created_at
       FROM users ${where} ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    const count = await pool.query(`SELECT COUNT(*) FROM users ${where}`, params.slice(0, -2));

    res.json({ success: true, users: result.rows, total: parseInt(count.rows[0].count) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

// PUT /api/admin/users/:id/verify
router.put('/users/:id/verify', async (req, res) => {
  await pool.query('UPDATE users SET is_verified = true WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Foydalanuvchi tasdiqlandi' });
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ success: false, message: 'O\'zingizni o\'chira olmaysiz' });
  }
  await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);
  res.json({ success: true, message: 'Foydalanuvchi o\'chirildi' });
});

// GET /api/admin/events  — barcha tadbirlar
router.get('/events', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, o.org_name,
              (SELECT COUNT(*) FROM event_participants ep WHERE ep.event_id = e.id) AS participant_count
       FROM events e JOIN organizations o ON o.id = e.org_id
       ORDER BY e.created_at DESC LIMIT 50`
    );
    res.json({ success: true, events: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

// PUT /api/admin/events/:id/status
router.put('/events/:id/status', async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'completed', 'cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Noto\'g\'ri status' });
  }
  await pool.query('UPDATE events SET status = $1 WHERE id = $2', [status, req.params.id]);
  res.json({ success: true, message: 'Tadbir statusi yangilandi' });
});

// POST /api/admin/notify  — ommaviy bildirishnoma
router.post('/notify', async (req, res) => {
  try {
    const { title, body, role } = req.body;
    let query = 'SELECT id FROM users';
    const params = [];
    if (role) { params.push(role); query += ' WHERE role = $1'; }

    const users = await pool.query(query, params);
    if (!users.rows.length) return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });

    const values = users.rows.map((u, i) =>
      `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`
    ).join(',');
    const flat = users.rows.flatMap((u) => [u.id, 'admin', title, body]);

    await pool.query(`INSERT INTO notifications (user_id, type, title, body) VALUES ${values}`, flat);
    res.json({ success: true, message: `${users.rows.length} foydalanuvchiga bildirishnoma yuborildi` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

module.exports = router;
