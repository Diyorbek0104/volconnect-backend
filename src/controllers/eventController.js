const { pool } = require('../config/database');

// GET /api/events
const getEvents = async (req, res) => {
  try {
    const { city, category, status = 'active', search, page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    const params = [];
    let conditions = ['e.status = $1'];
    params.push(status);

    if (city) { params.push(`%${city}%`); conditions.push(`e.city ILIKE $${params.length}`); }
    if (category) { params.push(category); conditions.push(`e.category = $${params.length}`); }
    if (search) { params.push(`%${search}%`); conditions.push(`e.title ILIKE $${params.length}`); }

    params.push(limit, offset);
    const result = await pool.query(
      `SELECT e.*, o.org_name, o.logo_url,
              ROUND((e.current_volunteers::DECIMAL / NULLIF(e.max_volunteers, 0)) * 100) AS fill_pct
       FROM events e
       JOIN organizations o ON o.id = e.org_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_date ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM events e WHERE ${conditions.join(' AND ')}`,
      params.slice(0, -2)
    );

    res.json({
      success: true,
      events: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      pages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// GET /api/events/:id
const getEventById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT e.*, o.org_name, o.logo_url, o.description AS org_desc
       FROM events e JOIN organizations o ON o.id = e.org_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Tadbir topilmadi' });

    const participants = await pool.query(
      `SELECT u.id, u.full_name, u.avatar_url, u.rating, ep.status
       FROM event_participants ep JOIN users u ON u.id = ep.user_id
       WHERE ep.event_id = $1 AND ep.status = 'approved'
       LIMIT 20`,
      [req.params.id]
    );

    res.json({ success: true, event: result.rows[0], participants: participants.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// POST /api/events  (tashkilot yaratadi)
const createEvent = async (req, res) => {
  try {
    const { title, description, category, city, address, start_date, end_date, max_volunteers, required_skills } = req.body;

    const orgResult = await pool.query('SELECT id FROM organizations WHERE user_id = $1', [req.user.id]);
    if (!orgResult.rows[0]) return res.status(403).json({ success: false, message: 'Tashkilot topilmadi' });

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await pool.query(
      `INSERT INTO events (org_id, title, description, category, city, address, start_date, end_date, max_volunteers, required_skills, image_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [orgResult.rows[0].id, title, description, category, city, address, start_date, end_date, max_volunteers || 10, required_skills || [], image_url]
    );

    res.status(201).json({ success: true, message: 'Tadbir yaratildi', event: result.rows[0] });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// POST /api/events/:id/join
const joinEvent = async (req, res) => {
  try {
    const event = await pool.query(
      'SELECT id, max_volunteers, current_volunteers, status FROM events WHERE id = $1',
      [req.params.id]
    );
    if (!event.rows[0]) return res.status(404).json({ success: false, message: 'Tadbir topilmadi' });
    if (event.rows[0].status !== 'active') return res.status(400).json({ success: false, message: 'Tadbir faol emas' });
    if (event.rows[0].current_volunteers >= event.rows[0].max_volunteers) {
      return res.status(400).json({ success: false, message: 'O\'rinlar to\'ldi' });
    }

    await pool.query(
      'INSERT INTO event_participants (event_id, user_id) VALUES ($1, $2)',
      [req.params.id, req.user.id]
    );

    await pool.query(
      'UPDATE events SET current_volunteers = current_volunteers + 1 WHERE id = $1',
      [req.params.id]
    );

    res.json({ success: true, message: 'Tabriklaymiz! Tadbirga qo\'shildingiz' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Siz allaqachon qo\'shilgansiz' });
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// PUT /api/events/:id/complete  (soatlarni yozish)
const logHours = async (req, res) => {
  try {
    const { user_id, hours } = req.body;
    await pool.query(
      `UPDATE event_participants SET status = 'completed', hours_logged = $1
       WHERE event_id = $2 AND user_id = $3`,
      [hours, req.params.id, user_id]
    );
    await pool.query(
      'UPDATE users SET total_hours = total_hours + $1 WHERE id = $2',
      [hours, user_id]
    );
    res.json({ success: true, message: 'Soatlar kiritildi' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

module.exports = { getEvents, getEventById, createEvent, joinEvent, logHours };
