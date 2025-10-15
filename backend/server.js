require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sgMail = require('@sendgrid/mail');

// ============================================
// Express 初始化
// ============================================
const app = express();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://urwall.vercel.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],  // 明确允许的方法
  allowedHeaders: ['Content-Type', 'Authorization']  // 允许的请求头
}));

//app.options('*', cors());

app.use(express.json());

// ============================================
// 数据库配置
// ============================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ============================================
// Email 配置
// ============================================
// const transporter = nodemailer.createTransport({
//   host: 'smtp.sendgrid.net',
//   port: 587,
//   secure: false,
//   auth: {
//     user: 'apikey',  // 固定写 'apikey'
//     pass: process.env.SENDGRID_API_KEY
//   }
// });

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// ============================================
// 工具函数
// ============================================
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, code) {
  console.log('=== Attempting to send email ===');
  console.log('To:', email);
  console.log('Code:', code);
  console.log('SENDGRID_API_KEY exists:', !!process.env.SENDGRID_API_KEY);
  
  const msg = {
    to: email,
    from: 'recoltee0525@gmail.com',  
    subject: 'UIUC Wall - Verification Code',
    html: `
      <h2>Campus Wall Verification</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log('✅ Email sent successfully to:', email);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    if (error.response) {
      console.error('SendGrid error body:', error.response.body);
    }
    throw error;
  }
}

// ============================================
// 数据库初始化
// ============================================
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        avatar_url VARCHAR(500),
        bio TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS verification_codes (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        code VARCHAR(6) NOT NULL,
        type VARCHAR(50) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        content TEXT NOT NULL,
        category VARCHAR(100) NOT NULL,
        is_anonymous BOOLEAN DEFAULT FALSE,
        likes_count INTEGER DEFAULT 0,
        comments_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        is_anonymous BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS managers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS useful_posts (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        approved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id)
      );

      CREATE TABLE IF NOT EXISTS transfer_requests (
        id SERIAL PRIMARY KEY,
        post_id INTEGER REFERENCES posts(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        UNIQUE(post_id)
      );

      CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
      CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
    `);

    await pool.query(`
      INSERT INTO managers (email) 
      VALUES ('yuhengc7@illinois.edu')
      ON CONFLICT (email) DO NOTHING
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  }
}

// ============================================
// 中间件
// ============================================
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

async function authenticateManager(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;

    const result = await pool.query(
      'SELECT * FROM managers WHERE email = $1',
      [user.email]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ message: 'Manager access required' });
    }

    next();
  } catch (err) {
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
}

// ============================================
// 认证路由
// ============================================
app.post('/api/auth/send-verification', async (req, res) => {
  const { email, type } = req.body;

  if (!email || !type) {
    return res.status(400).json({ message: 'Email and type are required' });
  }

  if (!email.endsWith('@illinois.edu')) {
    return res.status(400).json({ message: 'Only @illinois.edu emails are allowed' });
  }

  try {
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
      [email, code, type, expiresAt]
    );

    await sendVerificationEmail(email, code);

    res.json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { username, email, password, verificationCode } = req.body;

  if (!username || !email || !password || !verificationCode) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!email.endsWith('@illinois.edu')) {
    return res.status(400).json({ message: 'Only @illinois.edu emails are allowed' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const codeResult = await pool.query(
      'SELECT * FROM verification_codes WHERE email = $1 AND code = $2 AND type = $3 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, verificationCode, 'register']
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, email, password, verified) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, true]
    );

    await pool.query(
      'DELETE FROM verification_codes WHERE email = $1 AND code = $2',
      [email, verificationCode]
    );

    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const managerResult = await pool.query(
      'SELECT * FROM managers WHERE email = $1',
      [user.email]
    );
    const isManager = managerResult.rows.length > 0;

    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        isManager: isManager,
      },
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, verificationCode, newPassword } = req.body;

  if (!email || !verificationCode || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const codeResult = await pool.query(
      'SELECT * FROM verification_codes WHERE email = $1 AND code = $2 AND type = $3 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, verificationCode, 'reset']
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );

    await pool.query(
      'DELETE FROM verification_codes WHERE email = $1 AND code = $2',
      [email, verificationCode]
    );

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/auth/check-manager', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM managers WHERE email = $1',
      [req.user.email]
    );

    res.json({ isManager: result.rows.length > 0 });
  } catch (error) {
    console.error('Error checking manager status:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// 帖子路由
// ============================================
app.post('/api/posts', authenticateToken, async (req, res) => {
  const { title, content, category, isAnonymous } = req.body;

  if (!title || !content || !category) {
    return res.status(400).json({ message: 'Title, content, and category are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO posts (user_id, title, content, category, is_anonymous) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, title, content, category, isAnonymous || false]
    );

    res.status(201).json({
      message: 'Post created successfully',
      post: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/posts', async (req, res) => {
  const { page = 1, limit = 20, sortBy = 'created_at', category } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
    `;

    const params = [];
    if (category) {
      query += ' WHERE p.category = $1';
      params.push(category);
    }

    if (sortBy === 'likes') {
      query += ' ORDER BY p.likes_count DESC, p.created_at DESC';
    } else if (sortBy === 'comments') {
      query += ' ORDER BY p.comments_count DESC, p.created_at DESC';
    } else {
      query += ' ORDER BY p.created_at DESC';
    }

    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    let countQuery = 'SELECT COUNT(*) FROM posts';
    const countParams = [];
    if (category) {
      countQuery += ' WHERE category = $1';
      countParams.push(category);
    }
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/posts/search', async (req, res) => {
  const { query, page = 1, limit = 20, sortBy = 'relevance', category } = req.query;
  const offset = (page - 1) * limit;

  if (!query || query.trim() === '') {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    let sqlQuery = `
      SELECT DISTINCT
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE (
        LOWER(p.title) LIKE $1 OR 
        LOWER(p.content) LIKE $1 OR 
        EXISTS (
          SELECT 1 FROM comments c2 
          WHERE c2.post_id = p.id AND LOWER(c2.content) LIKE $1
        )
      )
    `;

    const params = [searchTerm];
    
    if (category) {
      sqlQuery += ` AND p.category = $${params.length + 1}`;
      params.push(category);
    }

    if (sortBy === 'likes') {
      sqlQuery += ' ORDER BY p.likes_count DESC, p.created_at DESC';
    } else if (sortBy === 'comments') {
      sqlQuery += ' ORDER BY p.comments_count DESC, p.created_at DESC';
    } else {
      sqlQuery += ' ORDER BY p.created_at DESC';
    }

    sqlQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(sqlQuery, params);

    let countQuery = `
      SELECT COUNT(DISTINCT p.id) 
      FROM posts p
      LEFT JOIN comments c ON p.id = c.post_id
      WHERE (
        LOWER(p.title) LIKE $1 OR 
        LOWER(p.content) LIKE $1 OR 
        EXISTS (
          SELECT 1 FROM comments c2 
          WHERE c2.post_id = p.id AND LOWER(c2.content) LIKE $1
        )
      )
    `;
    const countParams = [searchTerm];
    
    if (category) {
      countQuery += ` AND p.category = $2`;
      countParams.push(category);
    }
    
    const countResult = await pool.query(countQuery, countParams);

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error searching posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        p.user_id,
        CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    let postData = result.rows[0];
    if (!postData.is_anonymous && postData.user_id) {
      try {
        const userResult = await pool.query(
          'SELECT avatar_url FROM users WHERE id = $1',
          [postData.user_id]
        );
        if (userResult.rows.length > 0) {
          postData.author_avatar = userResult.rows[0].avatar_url;
        }
      } catch (err) {
        console.log('Avatar column not available');
      }
    }

    delete postData.user_id;
    res.json(postData);
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/posts/:id/like', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const existingLike = await pool.query(
      'SELECT * FROM likes WHERE post_id = $1 AND user_id = $2',
      [id, req.user.id]
    );

    if (existingLike.rows.length > 0) {
      await pool.query('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [id, req.user.id]);
      await pool.query('UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1', [id]);
      res.json({ message: 'Post unliked', liked: false });
    } else {
      await pool.query('INSERT INTO likes (post_id, user_id) VALUES ($1, $2)', [id, req.user.id]);
      await pool.query('UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1', [id]);
      res.json({ message: 'Post liked', liked: true });
    }
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// 评论路由
// ============================================
app.post('/api/posts/:id/comments', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { content, isAnonymous } = req.body;

  if (!content) {
    return res.status(400).json({ message: 'Content is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO comments (post_id, user_id, content, is_anonymous) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, req.user.id, content, isAnonymous || false]
    );

    await pool.query('UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1', [id]);

    res.status(201).json({
      message: 'Comment added successfully',
      comment: result.rows[0],
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/posts/:id/comments', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT 
        c.id,
        c.content,
        c.is_anonymous,
        c.created_at,
        c.user_id,
        CASE WHEN c.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = $1
      ORDER BY c.created_at ASC`,
      [id]
    );

    const commentsWithAvatars = await Promise.all(result.rows.map(async (comment) => {
      let commentData = { ...comment };
      if (!comment.is_anonymous && comment.user_id) {
        try {
          const userResult = await pool.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [comment.user_id]
          );
          if (userResult.rows.length > 0) {
            commentData.author_avatar = userResult.rows[0].avatar_url;
          }
        } catch (err) {
          // Avatar column might not exist
        }
      }
      if (!comment.is_anonymous) {
        delete commentData.user_id;
      }
      return commentData;
    }));

    res.json(commentsWithAvatars);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const commentResult = await pool.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    await pool.query('DELETE FROM comments WHERE id = $1', [id]);

    await pool.query(
      'UPDATE posts SET comments_count = GREATEST(comments_count - 1, 0) WHERE id = $1',
      [comment.post_id]
    );

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// 用户路由
// ============================================
app.get('/api/users/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const userResult = await pool.query(
      `SELECT 
        u.id,
        u.username,
        u.email,
        u.bio,
        u.avatar_url,
        u.created_at,
        (SELECT COUNT(*) FROM posts WHERE user_id = u.id) as total_posts,
        (SELECT SUM(likes_count) FROM posts WHERE user_id = u.id) as total_likes,
        (SELECT COUNT(*) FROM comments WHERE user_id = u.id) as total_comments
      FROM users u
      WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userResult.rows[0]);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/users/:id/posts', async (req, res) => {
  const { id } = req.params;

  try {
    let requestingUserId = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        requestingUserId = decoded.id;
      } catch (err) {
        // Token invalid
      }
    }

    let query = `
      SELECT 
        p.id,
        p.title,
        p.content,
        p.category,
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at
      FROM posts p
      WHERE p.user_id = $1
    `;

    if (!requestingUserId || requestingUserId !== parseInt(id)) {
      query += ' AND p.is_anonymous = false';
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { username, bio, avatar_url } = req.body;

  if (req.user.id !== parseInt(id)) {
    return res.status(403).json({ message: 'You can only update your own profile' });
  }

  try {
    if (username) {
      const existingUser = await pool.query(
        'SELECT id FROM users WHERE username = $1 AND id != $2',
        [username, id]
      );
      if (existingUser.rows.length > 0) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    const result = await pool.query(
      `UPDATE users 
       SET username = COALESCE($1, username),
           bio = COALESCE($2, bio),
           avatar_url = COALESCE($3, avatar_url)
       WHERE id = $4
       RETURNING id, username, email, bio, avatar_url, created_at`,
      [username, bio, avatar_url, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// Useful Posts 路由
// ============================================
app.get('/api/useful-posts', async (req, res) => {
  const { page = 1, limit = 20, sortBy = 'created_at' } = req.query;
  const offset = (page - 1) * limit;

  try {
    let query = `
      SELECT 
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        up.approved_at,
        CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM useful_posts up
      JOIN posts p ON up.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
    `;

    if (sortBy === 'likes') {
      query += ' ORDER BY p.likes_count DESC, up.approved_at DESC';
    } else if (sortBy === 'comments') {
      query += ' ORDER BY p.comments_count DESC, up.approved_at DESC';
    } else {
      query += ' ORDER BY up.approved_at DESC';
    }

    query += ` LIMIT $1 OFFSET $2`;

    const result = await pool.query(query, [limit, offset]);
    const countResult = await pool.query('SELECT COUNT(*) FROM useful_posts');

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error fetching useful posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/useful-posts/search', async (req, res) => {
  const { query, page = 1, limit = 20, sortBy = 'relevance' } = req.query;
  const offset = (page - 1) * limit;

  if (!query || query.trim() === '') {
    return res.status(400).json({ message: 'Search query is required' });
  }

  try {
    const searchTerm = `%${query.toLowerCase()}%`;
    
    let sqlQuery = `
      SELECT DISTINCT
        p.id, 
        p.title, 
        p.content, 
        p.category, 
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        up.approved_at,
        CASE WHEN p.is_anonymous THEN 'Anonymous' ELSE u.username END as author
      FROM useful_posts up
      JOIN posts p ON up.post_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE (
        LOWER(p.title) LIKE $1 OR 
        LOWER(p.content) LIKE $1 OR 
        EXISTS (
          SELECT 1 FROM comments c2 
          WHERE c2.post_id = p.id AND LOWER(c2.content) LIKE $1
        )
      )
    `;

    if (sortBy === 'likes') {
      sqlQuery += ' ORDER BY p.likes_count DESC, up.approved_at DESC';
    } else if (sortBy === 'comments') {
      sqlQuery += ' ORDER BY p.comments_count DESC, up.approved_at DESC';
    } else {
      sqlQuery += ' ORDER BY up.approved_at DESC';
    }

    sqlQuery += ` LIMIT $2 OFFSET $3`;

    const result = await pool.query(sqlQuery, [searchTerm, limit, offset]);

    const countQuery = `
      SELECT COUNT(DISTINCT p.id)
      FROM useful_posts up
      JOIN posts p ON up.post_id = p.id
      WHERE (
        LOWER(p.title) LIKE $1 OR 
        LOWER(p.content) LIKE $1 OR 
        EXISTS (
          SELECT 1 FROM comments c2 
          WHERE c2.post_id = p.id AND LOWER(c2.content) LIKE $1
        )
      )
    `;
    const countResult = await pool.query(countQuery, [searchTerm]);

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error searching useful posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/posts/:id/request-transfer', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const usefulPostCheck = await pool.query('SELECT * FROM useful_posts WHERE post_id = $1', [id]);
    if (usefulPostCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Post is already in useful posts' });
    }

    const existingRequest = await pool.query(
      'SELECT * FROM transfer_requests WHERE post_id = $1 AND status = $2',
      [id, 'pending']
    );
    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ message: 'Transfer request already pending' });
    }

    await pool.query(
      'INSERT INTO transfer_requests (post_id, user_id, status) VALUES ($1, $2, $3)',
      [id, req.user.id, 'pending']
    );

    res.json({ message: 'Transfer request submitted successfully' });
  } catch (error) {
    console.error('Error creating transfer request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// 管理员路由
// ============================================
app.get('/api/manager/all-posts', authenticateManager, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT 
        p.id,
        p.title,
        p.content,
        p.category,
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        p.created_at,
        u.id as user_id,
        u.username,
        u.email
      FROM posts p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await pool.query('SELECT COUNT(*) FROM posts');

    res.json({
      posts: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(countResult.rows[0].count / limit),
    });
  } catch (error) {
    console.error('Error fetching all posts for manager:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/api/manager/transfer-requests', authenticateManager, async (req, res) => {
  const { status = 'pending' } = req.query;

  try {
    const result = await pool.query(
      `SELECT 
        tr.id as request_id,
        tr.post_id,
        tr.status,
        tr.created_at as requested_at,
        tr.reviewed_at,
        p.title,
        p.content,
        p.category,
        p.is_anonymous,
        p.likes_count,
        p.comments_count,
        u.id as requester_id,
        u.username as requester_username,
        u.email as requester_email,
        author.id as author_id,
        author.username as author_username,
        author.email as author_email
      FROM transfer_requests tr
      JOIN posts p ON tr.post_id = p.id
      JOIN users u ON tr.user_id = u.id
      JOIN users author ON p.user_id = author.id
      WHERE tr.status = $1
      ORDER BY tr.created_at DESC`,
      [status]
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching transfer requests:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/manager/transfer-requests/:id/approve', authenticateManager, async (req, res) => {
  const { id } = req.params;

  try {
    const requestResult = await pool.query(
      'SELECT * FROM transfer_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    const usefulPostCheck = await pool.query(
      'SELECT * FROM useful_posts WHERE post_id = $1',
      [request.post_id]
    );

    if (usefulPostCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Post is already in useful posts' });
    }

    await pool.query(
      'INSERT INTO useful_posts (post_id) VALUES ($1)',
      [request.post_id]
    );

    await pool.query(
      'UPDATE transfer_requests SET status = $1, reviewed_at = NOW() WHERE id = $2',
      ['approved', id]
    );

    res.json({ message: 'Transfer request approved successfully' });
  } catch (error) {
    console.error('Error approving transfer request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.post('/api/manager/transfer-requests/:id/reject', authenticateManager, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'UPDATE transfer_requests SET status = $1, reviewed_at = NOW() WHERE id = $2 RETURNING *',
      ['rejected', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Transfer request not found' });
    }

    res.json({ message: 'Transfer request rejected successfully' });
  } catch (error) {
    console.error('Error rejecting transfer request:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.delete('/api/manager/posts/:id', authenticateManager, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query('DELETE FROM posts WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    res.json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ============================================
// 测试路由
// ============================================
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    database: !!process.env.DATABASE_URL 
  });
});

// ============================================
// 启动服务器
// ============================================
const PORT = process.env.PORT || 5000;

pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.stack);
    process.exit(1);
  } else {
    console.log('✅ Database connected successfully');
    release();
    
    initializeDatabase().then(() => {
      app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
      });
    });
  }
});