const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const onlineUsers = new Map(); // userId -> socketId

const initSocket = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] },
  });

  // JWT orqali autentifikatsiya
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Token yo\'q'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const result = await pool.query('SELECT id, full_name FROM users WHERE id = $1', [decoded.userId]);
      if (!result.rows[0]) return next(new Error('Foydalanuvchi topilmadi'));
      socket.user = result.rows[0];
      next();
    } catch {
      next(new Error('Token noto\'g\'ri'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    onlineUsers.set(userId, socket.id);
    console.log(`🟢 ${socket.user.full_name} ulandi (${socket.id})`);

    // Online foydalanuvchilarni xabar qilish
    io.emit('user:online', { userId, online: true });

    // Xabar yuborish
    socket.on('message:send', async ({ receiverId, content }) => {
      if (!content?.trim()) return;
      try {
        const result = await pool.query(
          `INSERT INTO messages (sender_id, receiver_id, content)
           VALUES ($1, $2, $3) RETURNING *`,
          [userId, receiverId, content.trim()]
        );
        const msg = result.rows[0];

        // Jo'natuvchiga tasdiqlash
        socket.emit('message:sent', msg);

        // Qabul qiluvchi online bo'lsa, ularga yubor
        const receiverSocket = onlineUsers.get(parseInt(receiverId));
        if (receiverSocket) {
          io.to(receiverSocket).emit('message:received', {
            ...msg,
            sender_name: socket.user.full_name,
          });
        }

        // Notification bazaga yozish
        await pool.query(
          `INSERT INTO notifications (user_id, type, title, body)
           VALUES ($1, 'message', 'Yangi xabar', $2)`,
          [receiverId, `${socket.user.full_name}: ${content.slice(0, 60)}`]
        );
      } catch (err) {
        socket.emit('error', { message: 'Xabar yuborilmadi' });
      }
    });

    // Yozmoqda indikatori
    socket.on('typing:start', ({ receiverId }) => {
      const receiverSocket = onlineUsers.get(parseInt(receiverId));
      if (receiverSocket) {
        io.to(receiverSocket).emit('typing:started', { userId, name: socket.user.full_name });
      }
    });

    socket.on('typing:stop', ({ receiverId }) => {
      const receiverSocket = onlineUsers.get(parseInt(receiverId));
      if (receiverSocket) {
        io.to(receiverSocket).emit('typing:stopped', { userId });
      }
    });

    // Xabarni o'qildi deb belgilash
    socket.on('message:read', async ({ senderId }) => {
      await pool.query(
        'UPDATE messages SET is_read = true WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
        [senderId, userId]
      );
      const senderSocket = onlineUsers.get(parseInt(senderId));
      if (senderSocket) {
        io.to(senderSocket).emit('message:read_ack', { byUserId: userId });
      }
    });

    // Ulanish uzildi
    socket.on('disconnect', () => {
      onlineUsers.delete(userId);
      io.emit('user:online', { userId, online: false });
      console.log(`🔴 ${socket.user.full_name} uzildi`);
    });
  });

  return io;
};

const getOnlineUsers = () => [...onlineUsers.keys()];

module.exports = { initSocket, getOnlineUsers };
