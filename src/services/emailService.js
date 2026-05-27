const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const baseTemplate = (content) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .container { max-width: 580px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; }
    .header { background: #1D9E75; padding: 28px 32px; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 32px; color: #333; line-height: 1.6; }
    .btn { display: inline-block; background: #1D9E75; color: white; padding: 12px 28px;
           border-radius: 8px; text-decoration: none; font-weight: bold; margin: 16px 0; }
    .footer { background: #f9f9f9; padding: 20px 32px; font-size: 13px; color: #888; }
    .code { font-size: 32px; font-weight: bold; color: #1D9E75; letter-spacing: 6px;
            background: #E1F5EE; padding: 16px 24px; border-radius: 8px; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h1>🌿 VolConnect</h1></div>
    <div class="body">${content}</div>
    <div class="footer">Bu xabar VolConnect platformasi tomonidan yuborildi.<br>© 2024 VolConnect. Barcha huquqlar himoyalangan.</div>
  </div>
</body>
</html>`;

// --- Email turlari ---

const sendVerificationEmail = async (email, fullName, code) => {
  await transporter.sendMail({
    from: `"VolConnect" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Email manzilingizni tasdiqlang',
    html: baseTemplate(`
      <h2>Salom, ${fullName}! 👋</h2>
      <p>VolConnect platformasiga xush kelibsiz! Emailingizni tasdiqlash uchun quyidagi kodni kiriting:</p>
      <div style="text-align:center; margin: 24px 0;">
        <span class="code">${code}</span>
      </div>
      <p>Kod <strong>15 daqiqa</strong> davomida amal qiladi.</p>
      <p style="color:#888; font-size:13px">Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.</p>
    `),
  });
};

const sendWelcomeEmail = async (email, fullName) => {
  await transporter.sendMail({
    from: `"VolConnect" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'VolConnect\'ga xush kelibsiz! 🎉',
    html: baseTemplate(`
      <h2>Tabriklaymiz, ${fullName}! 🎉</h2>
      <p>Siz muvaffaqiyatli ro'yxatdan o'tdingiz. Endi minglab volontyorlar va tashkilotlar bilan bog'lana olasiz.</p>
      <ul style="margin: 16px 0; padding-left: 20px;">
        <li>Profilingizni to'ldiring</li>
        <li>Ko'nikmalaringizni qo'shing</li>
        <li>Tadbirlarni toping va qo'shiling</li>
      </ul>
      <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Platformani ochish →</a>
    `),
  });
};

const sendEventJoinEmail = async (email, fullName, eventTitle, eventDate, orgName) => {
  await transporter.sendMail({
    from: `"VolConnect" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `"${eventTitle}" tadbiriga qo'shildingiz`,
    html: baseTemplate(`
      <h2>Siz tadbirga qo'shildingiz! ✅</h2>
      <p>Salom, ${fullName}!</p>
      <div style="background:#E1F5EE; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <strong>📅 Tadbir:</strong> ${eventTitle}<br>
        <strong>🏢 Tashkilot:</strong> ${orgName}<br>
        <strong>🕐 Sana:</strong> ${eventDate}
      </div>
      <p>Tadbir haqida batafsil ma'lumot olish uchun platformaga kiring.</p>
      <a href="${process.env.FRONTEND_URL}/events" class="btn">Tadbirlarim →</a>
    `),
  });
};

const sendPasswordResetEmail = async (email, fullName, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  await transporter.sendMail({
    from: `"VolConnect" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Parolni tiklash',
    html: baseTemplate(`
      <h2>Parolni tiklash</h2>
      <p>Salom, ${fullName}! Parolingizni tiklash uchun quyidagi tugmani bosing:</p>
      <a href="${resetUrl}" class="btn">Parolni tiklash →</a>
      <p style="color:#888; font-size:13px">Havola <strong>1 soat</strong> davomida amal qiladi.<br>
      Agar siz so'rov yubormagan bo'lsangiz, bu xabarni e'tiborsiz qoldiring.</p>
    `),
  });
};

const sendCertificateEmail = async (email, fullName, eventTitle, pdfBuffer) => {
  await transporter.sendMail({
    from: `"VolConnect" <${process.env.SMTP_USER}>`,
    to: email,
    subject: `Sertifikat: ${eventTitle}`,
    html: baseTemplate(`
      <h2>Sertifikatingiz tayyor! 🏆</h2>
      <p>Salom, ${fullName}! "${eventTitle}" tadbirida ishtirokingiz uchun sertifikat qo'shib yuborildi.</p>
      <p>Sertifikatni quyidagi biriktirilgan fayldan ko'rishingiz mumkin.</p>
    `),
    attachments: [{ filename: `sertifikat-${Date.now()}.pdf`, content: pdfBuffer }],
  });
};

module.exports = {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendEventJoinEmail,
  sendPasswordResetEmail,
  sendCertificateEmail,
};
