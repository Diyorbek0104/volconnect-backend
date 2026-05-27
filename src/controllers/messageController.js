const { pool } = require('../config/database');

// GET /api/messages/conversations
const getConversations = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (partner_id)
         partner_id,
         partner_name,
         partner_avatar,
         last_message,
         last_time,
         unread_count
       FROM (
         SELECT
           CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END AS partner_id,
           CASE WHEN m.sender_id = $1 THEN ru.full_name ELSE su.full_name END AS partner_name,
           CASE WHEN m.sender_id = $1 THEN ru.avatar_url ELSE su.avatar_url END AS partner_avatar,
           m.content AS last_message,
           m.created_at AS last_time,
           COUNT(*) FILTER (WHERE m.receiver_id = $1 AND NOT m.is_read) OVER (
             PARTITION BY CASE WHEN m.sender_id = $1 THEN m.receiver_id ELSE m.sender_id END
           ) AS unread_count
         FROM messages m
         JOIN users su ON su.id = m.sender_id
         JOIN users ru ON ru.id = m.receiver_id
         WHERE m.sender_id = $1 OR m.receiver_id = $1
         ORDER BY m.created_at DESC
       ) sub
       ORDER BY partner_id, last_time DESC`,
      [req.user.id]
    );
    res.json({ success: true, conversations: result.rows });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// GET /api/messages/:userId
const getMessages = async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT m.*, u.full_name AS sender_name, u.avatar_url AS sender_avatar
       FROM messages m JOIN users u ON u.id = m.sender_id
       WHERE (m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1)
       ORDER BY m.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, req.params.userId, limit, offset]
    );

    await pool.query(
      'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
      [req.params.userId, req.user.id]
    );

    res.json({ success: true, messages: result.rows.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

// POST /api/messages/:userId
const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ success: false, message: 'Xabar bo\'sh bo\'lishi mumkin emas' });

    const result = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, req.params.userId, content.trim()]
    );

    // Notification yaratish
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, body)
       VALUES ($1, 'message', 'Yangi xabar', $2)`,
      [req.params.userId, `${req.user.full_name} sizga xabar yubordi`]
    );

    res.status(201).json({ success: true, message: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
};

module.exports = { getConversations, getMessages, sendMessage };
