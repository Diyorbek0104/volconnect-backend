const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../config/database');
const { auth } = require('../middleware/auth');

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Obuna rejalari
const PLANS = {
  organization_monthly: {
    name: 'Tashkilot (oylik)',
    price: 99000, // so'm (tiyin)
    currency: 'uzs',
    features: ['Cheksiz tadbir yaratish', 'Volontyorlar bilan chat', 'Statistika'],
  },
  organization_yearly: {
    name: 'Tashkilot (yillik)',
    price: 890000,
    currency: 'uzs',
    features: ['Oylikdan 25% arzon', 'Sertifikat yuborish', 'Priority qo\'llab-quvvatlash'],
  },
};

// GET /api/payments/plans
router.get('/plans', (req, res) => {
  res.json({ success: true, plans: PLANS });
});

// POST /api/payments/create-intent  — to'lov sessiyasi yaratish
router.post('/create-intent', auth, async (req, res) => {
  try {
    const { planId } = req.body;
    const plan = PLANS[planId];
    if (!plan) return res.status(400).json({ success: false, message: 'Noto\'g\'ri reja' });

    const paymentIntent = await stripe.paymentIntents.create({
      amount: plan.price,
      currency: plan.currency,
      metadata: { userId: req.user.id, planId },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret, plan });
  } catch (err) {
    console.error('Stripe error:', err.message);
    res.status(500).json({ success: false, message: 'To\'lov yaratilmadi' });
  }
});

// POST /api/payments/donate  — xayriya
router.post('/donate', auth, async (req, res) => {
  try {
    const { amount, message } = req.body;
    if (!amount || amount < 5000) {
      return res.status(400).json({ success: false, message: 'Minimal xayriya 5000 so\'m' });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'uzs',
      metadata: { userId: req.user.id, type: 'donation', message: message || '' },
    });

    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Xayriya to\'lovi yaratilmadi' });
  }
});

// POST /api/payments/webhook  — Stripe to'lovni tasdiqlaydi
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).json({ error: `Webhook xatosi: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const { userId, planId, type } = event.data.object.metadata;
    const amount = event.data.object.amount;

    await pool.query(
      `INSERT INTO payments (user_id, plan_id, amount, status, stripe_id)
       VALUES ($1, $2, $3, 'completed', $4)
       ON CONFLICT DO NOTHING`,
      [userId, planId || 'donation', amount, event.data.object.id]
    ).catch(console.error);

    // Tashkilot obunasini faollashtirish
    if (planId?.startsWith('organization')) {
      const months = planId.includes('yearly') ? 12 : 1;
      await pool.query(
        `UPDATE users SET subscription_expires = NOW() + INTERVAL '${months} months'
         WHERE id = $1`,
        [userId]
      ).catch(console.error);
    }
  }

  res.json({ received: true });
});

// GET /api/payments/history
router.get('/history', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.user.id]
    );
    res.json({ success: true, payments: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server xatosi' });
  }
});

module.exports = router;
