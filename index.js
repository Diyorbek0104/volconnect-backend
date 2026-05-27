require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDB } = require('./src/config/database');

const app = express();
const server = http.createServer(app);

// Socket.io (ixtiyoriy)
try {
  const { initSocket } = require('./src/sockets/chat');
  initSocket(server);
} catch(e) {}

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL, 'http://localhost:5173']
  : ['*'];

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,
}));
app.use(morgan('dev'));
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
const authRoutes = require('./src/routes/auth');
const { userRouter, eventRouter, messageRouter } = require('./src/routes/index');

app.use('/api/auth',     authRoutes);
app.use('/api/users',    userRouter);
app.use('/api/events',   eventRouter);
app.use('/api/messages', messageRouter);

try {
  const adminRouter = require('./src/routes/admin');
  const paymentRouter = require('./src/routes/payments');
  const { certRouter, verifyRouter } = require('./src/routes/extras');
  app.use('/api/admin',        adminRouter);
  app.use('/api/payments',     paymentRouter);
  app.use('/api/certificates', certRouter);
  app.use('/api/verify',       verifyRouter);
} catch(e) { console.log('Optional routes skipped:', e.message); }

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'VolConnect API' }));
app.use((req, res) => res.status(404).json({ success: false, message: 'Topilmadi' }));
app.use((err, req, res, next) => res.status(500).json({ success: false, message: 'Server xatosi' }));

const PORT = process.env.PORT || 5000;
initDB()
  .then(() => server.listen(PORT, () => console.log(`🚀 VolConnect API — port ${PORT}`)))
  .catch(err => { console.error(err.message); process.exit(1); });
