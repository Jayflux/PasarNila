const { chromium } = require('playwright');
const path = require('path');

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Invoice - habibijoki</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #332d31;
      background-color: #ffffff;
      -webkit-font-smoothing: antialiased;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 48px 52px;
      margin: 0 auto;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      position: relative;
      background: #ffffff;
      page-break-after: always;
      page-break-inside: avoid;
    }
    .page:last-child {
      page-break-after: avoid;
    }

    /* HEADER */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 34px;
    }
    .brand-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 34px;
      font-weight: 700;
      color: #2b2328;
      letter-spacing: -0.5px;
      line-height: 1.1;
    }
    .brand-subtitle {
      font-size: 13px;
      color: #786d73;
      margin-top: 6px;
      font-weight: 400;
    }
    .invoice-meta {
      text-align: right;
    }
    .invoice-badge {
      font-size: 16px;
      font-weight: 700;
      letter-spacing: 2px;
      color: #c993a4;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .invoice-number {
      font-size: 14px;
      font-weight: 700;
      color: #2b2328;
      margin-bottom: 5px;
    }
    .invoice-date {
      font-size: 11.5px;
      color: #554b51;
      line-height: 1.5;
    }

    /* INFO SECTION */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      column-gap: 48px;
      margin-bottom: 34px;
    }
    .section-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #2b2328;
      text-transform: uppercase;
      padding-bottom: 8px;
      border-bottom: 1.5px solid #edd5dc;
      margin-bottom: 14px;
    }
    .info-group {
      margin-bottom: 12px;
    }
    .info-group:last-child {
      margin-bottom: 0;
    }
    .info-label {
      font-size: 9.5px;
      font-weight: 600;
      color: #8c7e84;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      margin-bottom: 2px;
    }
    .info-value {
      font-size: 12.5px;
      font-weight: 600;
      color: #2b2328;
      line-height: 1.35;
    }
    .info-value.highlight-red {
      color: #a62a42;
      font-weight: 700;
    }
    .payment-note {
      font-size: 11.5px;
      color: #493f44;
      line-height: 1.45;
      margin-bottom: 6px;
    }
    .payment-account {
      font-size: 12px;
      font-weight: 700;
      color: #201a1e;
      margin-bottom: 3px;
      line-height: 1.4;
    }
    .payment-subnote {
      font-size: 10px;
      font-style: italic;
      color: #786d73;
      margin-top: 4px;
    }

    /* RINCIAN BIAYA TABLE */
    .table-section-title {
      font-family: 'Playfair Display', Georgia, serif;
      font-size: 14.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      color: #2b2328;
      text-transform: uppercase;
      margin-bottom: 12px;
    }
    .cost-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .cost-table thead tr {
      background-color: #3b2230;
    }
    .cost-table th {
      color: #ffffff;
      font-size: 11.5px;
      font-weight: 600;
      padding: 10px 14px;
      text-align: left;
    }
    .cost-table th.col-desc {
      width: 58%;
    }
    .cost-table th.col-qty {
      width: 18%;
      text-align: center;
    }
    .cost-table th.col-price {
      width: 24%;
      text-align: right;
    }
    .cost-table td {
      padding: 12px 14px;
      border-bottom: 1px solid #eedde2;
      vertical-align: top;
    }
    .cost-table td.col-qty {
      text-align: center;
      font-size: 12px;
      color: #332d31;
    }
    .cost-table td.col-price {
      text-align: right;
      font-size: 12px;
      font-weight: 500;
      color: #332d31;
    }
    .item-title {
      font-size: 12.5px;
      font-weight: 700;
      color: #201a1e;
      margin-bottom: 3px;
      line-height: 1.3;
    }
    .item-desc {
      font-size: 10.5px;
      color: #63575d;
      line-height: 1.45;
    }

    /* TOTALS SECTION */
    .totals-container {
      width: 370px;
      margin-left: auto;
      margin-top: 14px;
    }
    .subtotal-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 14px 10px 14px;
    }
    .subtotal-label {
      font-size: 12px;
      color: #786d73;
    }
    .subtotal-value {
      font-size: 12.5px;
      font-weight: 600;
      color: #2b2328;
    }
    .total-banner {
      background-color: #edd5dc;
      border-radius: 2px;
      padding: 11px 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .total-label {
      font-size: 14px;
      font-weight: 700;
      color: #3b2230;
    }
    .total-value {
      font-size: 14px;
      font-weight: 700;
      color: #3b2230;
    }

    /* FOOTER */
    .page-footer {
      margin-top: auto;
      text-align: right;
      font-size: 10px;
      color: #8c7e84;
    }

    /* PAGE 2 STYLES */
    .terms-box {
      background-color: #faf3f5;
      border-left: 4px solid #3b2230;
      padding: 24px 28px;
      border-radius: 0 4px 4px 0;
      margin-top: 10px;
    }
    .terms-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #2b2328;
      margin-bottom: 14px;
    }
    .terms-list {
      list-style-type: none;
      padding: 0;
      margin: 0;
    }
    .terms-item {
      position: relative;
      padding-left: 18px;
      font-size: 11.5px;
      color: #493f44;
      line-height: 1.65;
      margin-bottom: 11px;
    }
    .terms-item:last-child {
      margin-bottom: 0;
    }
    .terms-item::before {
      content: "•";
      position: absolute;
      left: 2px;
      color: #3b2230;
      font-size: 14px;
      line-height: 1.2;
    }
    .terms-item strong {
      color: #201a1e;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <!-- PAGE 1 -->
  <div class="page">
    <!-- Header -->
    <div class="header">
      <div>
        <h1 class="brand-title">habibijoki</h1>
        <div class="brand-subtitle">Web Development &amp; UI/UX Services</div>
      </div>
      <div class="invoice-meta">
        <div class="invoice-badge">INVOICE</div>
        <div class="invoice-number">#INV-2026-1120</div>
        <div class="invoice-date">Tanggal: 17 November 2026</div>
        <div class="invoice-date">Batas Waktu: 20 November 2026</div>
      </div>
    </div>

    <!-- Info Section -->
    <div class="info-grid">
      <!-- Left Column -->
      <div>
        <div class="section-title">DIBERIKAN KEPADA</div>
        
        <div class="info-group">
          <div class="info-label">PELANGGAN / MAHASISWA</div>
          <div class="info-value">Klien Project Juki Fish Farm</div>
        </div>

        <div class="info-group">
          <div class="info-label">PROJEK</div>
          <div class="info-value">Website Presentasi &amp; Sistem Juki Fish Farm (Pasar Nila)</div>
        </div>

        <div class="info-group">
          <div class="info-label">PERIODE PENGERJAAN</div>
          <div class="info-value highlight-red">17 - 20 November 2026 (Ekspres 3 Hari)</div>
        </div>
      </div>

      <!-- Right Column -->
      <div>
        <div class="section-title">METODE PEMBAYARAN</div>

        <div class="info-group">
          <div class="info-label">SISTEM PEMBAYARAN</div>
          <div class="info-value">Full Payment (Sekali Bayar)</div>
        </div>

        <div class="info-group">
          <div class="payment-note">Silakan lakukan transfer ke salah satu rekening berikut:</div>
          <div class="payment-account">• Bank BCA: 1092520662 (a.n Muhamad Najwan)</div>
          <div class="payment-account">• GoPay: 081808927665</div>
          <div class="payment-subnote">*Kirimkan bukti transfer untuk mengonfirmasi pembayaran.</div>
        </div>
      </div>
    </div>

    <!-- Rincian Biaya -->
    <div>
      <div class="table-section-title">RINCIAN BIAYA</div>
      <table class="cost-table">
        <thead>
          <tr>
            <th class="col-desc">Deskripsi Layanan / Fitur</th>
            <th class="col-qty">Jumlah</th>
            <th class="col-price">Harga (IDR)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <div class="item-title">Full-Stack Development Web App Juki Fish Farm</div>
              <div class="item-desc">
                Pembangunan sistem web platform Pasar Nila berbasis Next.js, integrasi katalog produk nila, sistem kalkulator pakan &amp; bibit interaktif, landing page responsif, serta panel edukasi budidaya.
              </div>
            </td>
            <td class="col-qty">1 Sistem</td>
            <td class="col-price">Rp 1.500.000</td>
          </tr>
          <tr>
            <td>
              <div class="item-title">Deployment, Supabase Integration &amp; Source Code</div>
              <div class="item-desc">
                Perancangan skema database PostgreSQL Supabase, konfigurasi API backend, penyimpanan storage aset, setup hosting production live di Vercel, dan pengemasan source code.
              </div>
            </td>
            <td class="col-qty">1 Paket</td>
            <td class="col-price">Rp 300.000</td>
          </tr>
          <tr>
            <td>
              <div class="item-title">Express Service Charge &amp; Fast-Track Priority (3 Days)</div>
              <div class="item-desc">
                Biaya prioritas pengerjaan kilat deadline tepat waktu (masuk 17 Nov, selesai 20 Nov), uji kelayakan sistem menyeluruh, serta asistensi briefing alur sistem.
              </div>
            </td>
            <td class="col-qty">1 Projek</td>
            <td class="col-price">Rp 200.000</td>
          </tr>
          <tr>
            <td>
              <div class="item-title">Penambahan Fitur Editable Foto Produk &amp; Paket Mitra</div>
              <div class="item-desc">
                Fitur kustom penambahan &amp; pengubahan foto produk secara interaktif pada katalog, instant panel navigasi, serta modul pengelolaan paket kemitraan budidaya nila.
              </div>
            </td>
            <td class="col-qty">1 Fitur</td>
            <td class="col-price">Rp 200.000</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-container">
      <div class="subtotal-row">
        <span class="subtotal-label">Subtotal:</span>
        <span class="subtotal-value">Rp 2.200.000</span>
      </div>
      <div class="total-banner">
        <span class="total-label">Total Biaya:</span>
        <span class="total-value">Rp 2.200.000</span>
      </div>
    </div>

    <!-- Footer -->
    <div class="page-footer">
      Halaman 1 dari 2
    </div>
  </div>

  <!-- PAGE 2 -->
  <div class="page">
    <div class="terms-box">
      <div class="terms-title">Syarat &amp; Ketentuan (Ketentuan Kerja):</div>
      <ul class="terms-list">
        <li class="terms-item">
          Projek akan mulai diproses segera setelah <strong>Full Payment (Rp 2.200.000)</strong> dan bukti transfer diterima.
        </li>
        <li class="terms-item">
          Sudah termasuk layanan <strong>Revisi Minor maksimal 3x</strong> (seperti typo, ubah teks, ganti warna elemen) dan <strong>Revisi Mayor maksimal 1x</strong> (ubah layout/struktur halaman).
        </li>
        <li class="terms-item">
          Seluruh berkas <strong>Source Code</strong> akan diserahkan setelah website selesai dan ditunjukkan via live link Vercel serta repository project.
        </li>
        <li class="terms-item">
          Bimbingan atau penjelasan alur program akan diberikan secara efisien melalui Chat atau Voice Note agar menghemat waktu kejar target deadline.
        </li>
      </ul>
    </div>

    <!-- Footer -->
    <div class="page-footer">
      Halaman 2 dari 2
    </div>
  </div>

</body>
</html>
`;

async function generateInvoice() {
  const rootOutputPath = path.resolve(__dirname, '..', 'Invoice_Juki_Fish_Farm_Habibijoki.pdf');
  const scriptsOutputPath = path.resolve(__dirname, 'Invoice_Juki_Fish_Farm_Habibijoki.pdf');
  
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  
  await page.pdf({
    path: rootOutputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  });

  // copy to scripts folder as well
  require('fs').copyFileSync(rootOutputPath, scriptsOutputPath);

  const pages = page.locator('.page');
  const count = await pages.count();
  for (let i = 0; i < count; i++) {
    await pages.nth(i).screenshot({ path: path.resolve(__dirname, `page_${i + 1}.png`) });
  }

  await browser.close();
  console.log('Invoice PDF successfully generated at:', rootOutputPath);
}

generateInvoice().catch(err => {
  console.error(err);
  process.exit(1);
});
