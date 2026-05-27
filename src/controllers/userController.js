const { pool } = require('../config/database');

// GET /api/users  — volontyorlar ro'yxati (filter + search)
const getUsers = async (req, res) => {
  try {
    const { city, skill, search, page = 1, limit = 12 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let conditions = ["role = 'volunteer'"];

    if (city) { params.push(`%${city}%`); conditions.push(`city ILIKE $${params.length}`); }
    if (skill) { params.push(skill); conditions.push(`$${params.length} = ANY(skills)`); }
    if (search) { params.push(`%${search}%`); conditions.push(`full_name ILIKE $${params.length}`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT id, full_name, avatar_url, city, bio, skills, rating, total_hours, is_verified
       FROM users ${where}
       ORDER BY rating DESC, total_hours DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users ${where}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// GET /api/users/:id
const getUserById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name, avatar_url, city, bio, skills, rating, total_hours, is_verified, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Foydalanuvchi topilmadi' });

    const events = await pool.query(
      `SELECT e.id, e.title, e.category, ep.hours_logged, ep.status
       FROM event_participants ep
       JOIN events e ON e.id = ep.event_id
       WHERE ep.user_id = $1 AND ep.status = 'completed'
       ORDER BY ep.joined_at DESC LIMIT 5`,
      [req.params.id]
    );

    res.json({ success: true, user: result.rows[0], recent_events: events.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// PUT /api/users/profile
const updateProfile = async (req, res) => {
  try {
    const { full_name, city, bio, skills } = req.body;
    const avatar_url = req.file ? `/uploads/${req.file.filename}` : undefined;

    const fields = [];
    const params = [];

    if (full_name) { params.push(full_name); fields.push(`full_name = $${params.length}`); }
    if (city !== undefined) { params.push(city); fields.push(`city = $${params.length}`); }
    if (bio !== undefined) { params.push(bio); fields.push(`bio = $${params.length}`); }
    if (skills) { params.push(skills); fields.push(`skills = $${params.length}`); }
    if (avatar_url) { params.push(avatar_url); fields.push(`avatar_url = $${params.length}`); }

    if (!fields.length) return res.status(400).json({ success: false, message: 'O\'zgartiriladigan ma\'lumot yo\'q' });

    fields.push(`updated_at = NOW()`);
    params.push(req.user.id);

    const result = await pool.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${params.length}
       RETURNING id, full_name, email, role, avatar_url, city, bio, skills, rating, total_hours`,
      params
    );

    res.json({ success: true, message: 'Profil yangilandi', user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// GET /api/users/:id/stats
const getUserStats = async (req, res) => {
  try {
    const userId = req.params.id;

    const stats = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ep.status = 'completed') AS completed_events,
         COUNT(*) FILTER (WHERE ep.status = 'approved') AS upcoming_events,
         COALESCE(SUM(ep.hours_logged), 0) AS total_hours
       FROM event_participants ep
       WHERE ep.user_id = $1`,
      [userId]
    );

    const ratingResult = await pool.query(
      'SELECT AVG(rating)::DECIMAL(3,1) as avg_rating, COUNT(*) as review_count FROM reviews WHERE reviewed_id = $1',
      [userId]
    );

    res.json({
      success: true,
      stats: {
        ...stats.rows[0],
        avg_rating: ratingResult.rows[0].avg_rating || 0,
        review_count: ratingResult.rows[0].review_count,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

module.exports = { getUsers, getUserById, updateProfile, getUserStats };
