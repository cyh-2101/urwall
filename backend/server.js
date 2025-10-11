const express = require('express');
const cors = require('cors');

const app = express();

// 中间件
app.use(cors());
app.use(express.json());

// 简单的测试路由
app.get('/api/test', (req, res) => {
  res.json({ message: '后端服务运行正常！' });
});

// 启动服务器
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`);
});