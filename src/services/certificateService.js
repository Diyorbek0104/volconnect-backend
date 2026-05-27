const PDFDocument = require('pdfkit');

/**
 * Volontyor sertifikatini PDF formatida yaratadi
 * @returns {Promise<Buffer>}
 */
const generateCertificate = ({ fullName, eventTitle, orgName, hours, completedDate, certId }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = 841.89;
    const H = 595.28;

    // Fon
    doc.rect(0, 0, W, H).fill('#F0FAF5');

    // Chap dekor paneli
    doc.rect(0, 0, 12, H).fill('#1D9E75');
    doc.rect(12, 0, 6, H).fill('#5DCAA5');

    // O'ng dekor paneli
    doc.rect(W - 12, 0, 12, H).fill('#1D9E75');
    doc.rect(W - 18, 0, 6, H).fill('#5DCAA5');

    // Ustki va pastki chiziq
    doc.rect(0, 0, W, 8).fill('#1D9E75');
    doc.rect(0, H - 8, W, 8).fill('#1D9E75');

    // Burchak bezaklari
    const cornerSize = 60;
    [[30, 20], [W - 30 - cornerSize, 20], [30, H - 20 - cornerSize], [W - 30 - cornerSize, H - 20 - cornerSize]]
      .forEach(([x, y]) => {
        doc.rect(x, y, cornerSize, cornerSize)
           .lineWidth(2).strokeColor('#1D9E75').stroke();
      });

    // Logo / platforma nomi
    doc.fontSize(13).fillColor('#0F6E56').font('Helvetica-Bold')
       .text('🌿 VOLCONNECT', 0, 36, { align: 'center' });

    // Sertifikat sarlavhasi
    doc.fontSize(36).fillColor('#085041').font('Helvetica-Bold')
       .text('SERTIFIKAT', 0, 70, { align: 'center', characterSpacing: 6 });

    // Ajratuvchi chiziq
    doc.moveTo(120, 125).lineTo(W - 120, 125).lineWidth(1.5).strokeColor('#5DCAA5').stroke();

    // Taqdim etilmoqda
    doc.fontSize(13).fillColor('#5F5E5A').font('Helvetica')
       .text('ushbu sertifikat quyidagi shaxsga taqdim etiladi', 0, 140, { align: 'center' });

    // Ism
    doc.fontSize(42).fillColor('#085041').font('Helvetica-Bold')
       .text(fullName, 0, 170, { align: 'center' });

    // Pastki chiziq ismi ostida
    doc.moveTo(200, 222).lineTo(W - 200, 222).lineWidth(1).strokeColor('#9FE1CB').stroke();

    // Tadbir matn
    doc.fontSize(13).fillColor('#5F5E5A').font('Helvetica')
       .text('quyidagi tadbirda faol ishtirok etganligi va', 0, 238, { align: 'center' });

    // Tadbir nomi
    doc.fontSize(20).fillColor('#1D9E75').font('Helvetica-Bold')
       .text(`"${eventTitle}"`, 0, 258, { align: 'center' });

    // Soat
    doc.fontSize(13).fillColor('#5F5E5A').font('Helvetica')
       .text(`tadbirida ${hours} soat vaqt sarflaganligi uchun`, 0, 288, { align: 'center' });

    // Ajratuvchi
    doc.moveTo(120, 318).lineTo(W - 120, 318).lineWidth(1).strokeColor('#5DCAA5').stroke();

    // Pastki info qismi
    const infoY = 338;
    const col1 = 160, col2 = W / 2 + 20;

    // Tashkilot
    doc.fontSize(11).fillColor('#888780').font('Helvetica').text('TASHKILOT', col1, infoY, { width: 220, align: 'center' });
    doc.fontSize(14).fillColor('#26215C').font('Helvetica-Bold').text(orgName, col1, infoY + 16, { width: 220, align: 'center' });

    // Vertikal ajratuvchi
    doc.moveTo(W / 2, infoY - 4).lineTo(W / 2, infoY + 60).lineWidth(0.5).strokeColor('#B4B2A9').stroke();

    // Sana
    doc.fontSize(11).fillColor('#888780').font('Helvetica').text('SANA', col2, infoY, { width: 220, align: 'center' });
    doc.fontSize(14).fillColor('#26215C').font('Helvetica-Bold')
       .text(new Date(completedDate).toLocaleDateString('uz-UZ'), col2, infoY + 16, { width: 220, align: 'center' });

    // Sertifikat ID
    doc.fontSize(10).fillColor('#B4B2A9').font('Helvetica')
       .text(`ID: ${certId}`, 0, H - 36, { align: 'center' });

    doc.end();
  });
};

module.exports = { generateCertificate };
