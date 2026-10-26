import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// سرو کردن فایل‌های استاتیک از پوشه dist
app.use(express.static(path.join(__dirname, 'dist')));

// هدایت تمام مسیرها به index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Admin Panel is running on port ${PORT}`);
});
