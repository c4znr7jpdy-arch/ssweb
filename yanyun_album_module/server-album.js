/**
 * 成员相册后端示例
 * 安装：
 * npm i express multer sharp nanoid
 *
 * 启动：
 * node server-album.js
 *
 * 访问：
 * http://localhost:3000/album-upload.html
 * http://localhost:3000/album.html?memberId=2
 */

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { nanoid } = require('nanoid');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10M
const TARGET_SIZE = 1 * 1024 * 1024;      // 1M

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'albums.json');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'uploads', 'albums');

app.use(express.static(PUBLIC_DIR));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
  fileFilter(req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error('只支持 JPG / PNG / WEBP 图片'));
      return;
    }
    cb(null, true);
  }
});

async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify({ items: [] }, null, 2), 'utf-8');
  }
}

async function readAlbums() {
  await ensureFiles();
  const text = await fs.readFile(DATA_FILE, 'utf-8');
  return JSON.parse(text || '{"items":[]}');
}

async function writeAlbums(data) {
  await ensureFiles();
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

async function compressUnder1MB(buffer) {
  let maxSide = 2200;

  while (maxSide >= 1000) {
    for (let quality = 82; quality >= 42; quality -= 8) {
      const output = await sharp(buffer)
        .rotate()
        .resize({
          width: maxSide,
          height: maxSide,
          fit: 'inside',
          withoutEnlargement: true
        })
        .webp({
          quality,
          effort: 5
        })
        .toBuffer();

      if (output.length <= TARGET_SIZE) {
        return {
          buffer: output,
          size: output.length,
          quality,
          maxSide
        };
      }
    }

    maxSide = Math.floor(maxSide * 0.84);
  }

  const output = await sharp(buffer)
    .rotate()
    .resize({
      width: 900,
      height: 900,
      fit: 'inside',
      withoutEnlargement: true
    })
    .webp({
      quality: 38,
      effort: 6
    })
    .toBuffer();

  return {
    buffer: output,
    size: output.length,
    quality: 38,
    maxSide: 900
  };
}

app.get('/api/albums', async (req, res) => {
  const { memberId } = req.query;
  const data = await readAlbums();

  const items = data.items
    .filter(item => !memberId || String(item.memberId) === String(memberId))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ items });
});

app.post('/api/albums/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ message: '请上传图片' });
      return;
    }

    const memberId = String(req.body.memberId || 'unknown').replace(/[^\w-]/g, '');
    const nickname = String(req.body.nickname || '').trim();
    const title = String(req.body.title || req.file.originalname || '未命名图片').trim();
    const category = String(req.body.category || '个人').trim();
    const description = String(req.body.description || '').trim();

    const memberDir = path.join(UPLOAD_DIR, memberId);
    await fs.mkdir(memberDir, { recursive: true });

    const compressed = await compressUnder1MB(req.file.buffer);
    const id = nanoid(12);
    const filename = `${Date.now()}-${id}.webp`;
    const filepath = path.join(memberDir, filename);

    await fs.writeFile(filepath, compressed.buffer);

    const url = `/uploads/albums/${memberId}/${filename}`;

    const data = await readAlbums();
    const item = {
      id,
      memberId,
      nickname,
      title,
      category,
      description,
      url,
      originalName: req.file.originalname,
      originalSize: req.file.size,
      compressedSize: compressed.size,
      quality: compressed.quality,
      maxSide: compressed.maxSide,
      createdAt: new Date().toISOString()
    };

    data.items.push(item);
    await writeAlbums(data);

    res.json({
      message: '上传成功',
      item,
      compressedSize: compressed.size
    });
  } catch (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ message: '图片超过 10M' });
      return;
    }

    res.status(500).json({ message: err.message || '上传失败' });
  }
});

app.listen(PORT, async () => {
  await ensureFiles();
  console.log(`Album server running: http://localhost:${PORT}`);
});
