const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const mdPath = path.join(rootDir, 'PROJECT_DOCUMENTATION.md');
const htmlPath = path.join(rootDir, 'docs', 'documentation.html');
const pdfPath = path.join(rootDir, 'SANJEEVANI_PROJECT_DOCUMENTATION.pdf');

console.log('1. Reading markdown...');
const mdContent = fs.readFileSync(mdPath, 'utf8');

console.log('2. Converting markdown to HTML using marked...');
const tempMd = path.join(__dirname, 'temp.md');
fs.writeFileSync(tempMd, mdContent, 'utf8');

let bodyHtml = '';
try {
  bodyHtml = execSync(`npx -y marked "${tempMd}"`, { encoding: 'utf8' });
} finally {
  if (fs.existsSync(tempMd)) fs.unlinkSync(tempMd);
}

console.log('3. Wrapping with professional print CSS...');
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sanjeevani — Master Project Documentation</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 18mm 16mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1a221b;
      line-height: 1.55;
      font-size: 10.5pt;
      margin: 0;
      padding: 0;
    }
    .header-banner {
      background: linear-gradient(135deg, #1b4d24 0%, #2f7a3e 100%);
      color: #ffffff;
      padding: 24px;
      border-radius: 10px;
      margin-bottom: 25px;
    }
    .header-banner h1 {
      margin: 0 0 8px 0;
      font-size: 24pt;
      letter-spacing: -0.03em;
    }
    .header-banner p {
      margin: 0;
      font-size: 11pt;
      opacity: 0.92;
      line-height: 1.4;
    }
    h1, h2, h3, h4 {
      color: #13381a;
      font-weight: 700;
      page-break-after: avoid;
    }
    h1 {
      font-size: 18pt;
      border-bottom: 2px solid #e1ebe0;
      padding-bottom: 6px;
      margin-top: 26px;
      margin-bottom: 12px;
    }
    h2 {
      font-size: 14pt;
      border-bottom: 1px solid #edf2ec;
      padding-bottom: 4px;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    h3 {
      font-size: 12pt;
      margin-top: 16px;
      margin-bottom: 6px;
    }
    p, ul, ol {
      margin-top: 0;
      margin-bottom: 10px;
    }
    li {
      margin-bottom: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0 20px;
      font-size: 9.5pt;
      page-break-inside: avoid;
    }
    th, td {
      border: 1px solid #d8e2d6;
      padding: 7px 10px;
      text-align: left;
    }
    th {
      background-color: #f0f6ee;
      color: #1a3c1e;
      font-weight: 700;
    }
    tr:nth-child(even) {
      background-color: #fafcfa;
    }
    pre {
      background-color: #f4f7f3;
      border: 1px solid #e2ece0;
      border-radius: 6px;
      padding: 10px 12px;
      font-family: Consolas, "SFMono-Regular", "Liberation Mono", Menlo, monospace;
      font-size: 9pt;
      overflow-x: auto;
      page-break-inside: avoid;
      line-height: 1.4;
    }
    code {
      font-family: Consolas, "SFMono-Regular", "Liberation Mono", Menlo, monospace;
      font-size: 9pt;
      background: #eff5ee;
      padding: 2px 5px;
      border-radius: 4px;
      color: #194e22;
    }
    pre code {
      background: transparent;
      padding: 0;
      color: inherit;
    }
    blockquote {
      border-left: 4px solid #3b874c;
      margin: 12px 0;
      padding: 8px 14px;
      background: #f4faf2;
      color: #264e2c;
      font-size: 10pt;
    }
    hr {
      border: 0;
      border-top: 1px solid #e1eae0;
      margin: 22px 0;
    }
    a {
      color: #216d33;
      text-decoration: none;
    }
    .footer-note {
      margin-top: 35px;
      padding-top: 12px;
      border-top: 1px solid #dce5db;
      font-size: 8pt;
      color: #6a7c6e;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="header-banner">
    <h1>🌿 Sanjeevani</h1>
    <p>Delivering What Matters When It Matters.<br />Civic Micro-Logistics Platform for Perishable Surplus & Disaster Relief Coordination</p>
  </div>
  ${bodyHtml}
  <div class="footer-note">
    Sanjeevani Master Project Documentation · Generated for Production Deployment · https://sanjeevani-henna-alpha.vercel.app
  </div>
</body>
</html>`;

fs.writeFileSync(htmlPath, fullHtml, 'utf8');
console.log(`4. Saved intermediate HTML to: ${htmlPath}`);

console.log('5. Rendering PDF via Chrome headless...');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const cmd = `"${chromePath}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfPath}" "${htmlPath}"`;
execSync(cmd);

console.log(`✅ PDF successfully generated at: ${pdfPath}`);
const stats = fs.statSync(pdfPath);
console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
