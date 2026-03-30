const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

// 确保 uploads 目录存在
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// 元数据文件路径
const dataFile = path.join(__dirname, 'data.json');

// 读取元数据
function readMediaData() {
    if (!fs.existsSync(dataFile)) {
        return [];
    }
    try {
        const raw = fs.readFileSync(dataFile);
        return JSON.parse(raw);
    } catch (err) {
        console.error('读取元数据失败', err);
        return [];
    }
}

// 写入元数据
function writeMediaData(data) {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

// 配置 multer 存储
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // 生成唯一文件名，保留原始扩展名
        const ext = path.extname(file.originalname);
        const uniqueName = `${uuidv4()}${ext}`;
        cb(null, uniqueName);
    }
});

// 文件过滤：只允许图片和视频
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/webm', 'video/quicktime'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('不支持的文件类型'), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB 限制
});

// 静态文件服务（前端页面）
app.use(express.static(path.join(__dirname, 'public')));
// 静态文件服务（上传的媒体文件）
app.use('/uploads', express.static(uploadsDir));

// 获取所有媒体列表
app.get('/api/media', (req, res) => {
    const mediaList = readMediaData();
    res.json(mediaList);
});

// 上传文件
app.post('/api/upload', upload.array('files', 20), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: '未选择文件' });
        }

        const mediaList = readMediaData();
        const newItems = [];

        for (const file of req.files) {
            const mimeType = file.mimetype;
            const type = mimeType.startsWith('image/') ? 'image' : 'video';
            const newItem = {
                id: uuidv4(),
                filename: file.filename,
                originalName: file.originalname,
                type: type,
                mimeType: mimeType,
                url: `/uploads/${file.filename}`,
                createdAt: new Date().toISOString()
            };
            mediaList.push(newItem);
            newItems.push(newItem);
        }

        writeMediaData(mediaList);
        res.json({ success: true, items: newItems });
    } catch (err) {
        console.error('上传失败', err);
        res.status(500).json({ error: '服务器错误' });
    }
});

// 删除单个媒体
app.delete('/api/media/:id', (req, res) => {
    const { id } = req.params;
    let mediaList = readMediaData();
    const item = mediaList.find(m => m.id === id);
    if (!item) {
        return res.status(404).json({ error: '文件不存在' });
    }

    // 删除物理文件
    const filePath = path.join(uploadsDir, item.filename);
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }

    // 更新元数据
    mediaList = mediaList.filter(m => m.id !== id);
    writeMediaData(mediaList);
    res.json({ success: true });
});

// 清空所有媒体
app.delete('/api/media', (req, res) => {
    const mediaList = readMediaData();
    // 删除所有物理文件
    for (const item of mediaList) {
        const filePath = path.join(uploadsDir, item.filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
    // 清空元数据
    writeMediaData([]);
    res.json({ success: true });
});

// 启动服务器
app.listen(PORT, () => {
    console.log(`✨ 媒体画廊服务已启动`);
    console.log(`🌐 本地访问: http://localhost:${PORT}`);
    console.log(`📱 局域网分享: http://<本机IP>:${PORT}`);
});