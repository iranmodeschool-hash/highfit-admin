import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// مسیر پوشه dist که فایل‌های بیلد شده در آن قرار می‌گیرند
const distPath = path.join(__dirname, 'dist');
console.log('Serving static files from:', distPath);

// بررسی اینکه آیا پوشه dist ساخته شده است یا خیر (برای دیباگ)
if (!fs.existsSync(distPath)) {
  console.error('CRITICAL WARNING: dist folder does not exist! The build might have failed.');
}

// سرو کردن فایل‌های استاتیک (CSS, JS, Images)
app.use(express.static(distPath));

// هدایت تمام مسیرها به index.html (برای React Router)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('Build (dist) folder is missing. Please check the build logs.');
  }
});

app.listen(PORT, () => {
  console.log(`Admin Panel is running on port ${PORT}`);
});
