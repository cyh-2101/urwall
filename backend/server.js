require('dotenv').config();
console.log('========== ENV VARIABLES ==========');
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***exists***' : 'MISSING');
console.log('===================================');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Generate verification code
function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification email
async function sendVerificationEmail(email, code) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Campus Wall - Verification Code',
    html: `
      <h2>Campus Wall Verification</h2>
      <p>Your verification code is: <strong>${code}</strong></p>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email sent to:', email);
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

// Initialize database tables with migration support
async function initializeDatabase() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Check if avatar_url column exists
    const checkAvatarColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='avatar_url'
    `);
    
    if (checkAvatarColumn.rows.length === 0) {
      console.log('Adding avatar_url column to users table...');
      await pool.query('ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)');
      console.log('avatar_url column added successfully');
    }

    // Check if bio column exists
    const checkBioColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='users' AND column_name='bio'
    `);
    
    if (checkBioColumn.rows.length === 0) {
      console.log('Adding bio column to users table...');
      await pool.query('ALTER TABLE users ADD COLUMN bio TEXT');
      console.log('bio column added successfully');
    }

    // Create other tables
    await pool.query(`
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

    // Insert default manager
    await pool.query(`
      INSERT INTO managers (email) 
      VALUES ('yuhengc7@illinois.edu')
      ON CONFLICT (email) DO NOTHING
    `);

    console.log('Database tables initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Middleware to verify JWT token
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

// Middleware to check if user is manager
async function authenticateManager(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, process.env.JWT_SECRET);
    req.user = user;

    // Check if user is a manager
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

// Routes

// Send verification code
app.post('/api/auth/send-verification', async (req, res) => {
  const { email, type } = req.body;

  if (!email || !type) {
    return res.status(400).json({ message: 'Email and type are required' });
  }

  // Verify it's an illinois.edu email
  if (!email.endsWith('@illinois.edu')) {
    return res.status(400).json({ message: 'Only @illinois.edu emails are allowed' });
  }

  try {
    // Generate code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store code
    await pool.query(
      'INSERT INTO verification_codes (email, code, type, expires_at) VALUES ($1, $2, $3, $4)',
      [email, code, type, expiresAt]
    );

    // Send email
    await sendVerificationEmail(email, code);

    res.json({ message: 'Verification code sent successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
});

// Register
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
    // Verify code
    const codeResult = await pool.query(
      'SELECT * FROM verification_codes WHERE email = $1 AND code = $2 AND type = $3 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, verificationCode, 'register']
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR username = $2',
      [email, username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    await pool.query(
      'INSERT INTO users (username, email, password, verified) VALUES ($1, $2, $3, $4)',
      [username, email, hashedPassword, true]
    );

    // Delete used verification code
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

// Login
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

    // Check if user is a manager
    const managerResult = await pool.query(
      'SELECT * FROM managers WHERE email = $1',
      [user.email]
    );
    const isManager = managerResult.rows.length > 0;

    // Generate JWT token
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

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  const { email, verificationCode, newPassword } = req.body;

  if (!email || !verificationCode || !newPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    // Verify code
    const codeResult = await pool.query(
      'SELECT * FROM verification_codes WHERE email = $1 AND code = $2 AND type = $3 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [email, verificationCode, 'reset']
    );

    if (codeResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Check if user exists
    const userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'User not found' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE users SET password = $1 WHERE email = $2',
      [hashedPassword, email]
    );

    // Delete used verification code
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

// Create a new post
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

// Get all posts (with pagination and sorting)
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

    // Sorting
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

    // Get total count
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

// Get a single post by ID
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

// Like a post
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

// Add a comment to a post
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

// Add this route to your backend/server.js file, after the "Get comments for a post" route

// Delete a comment (only by comment author)
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // First, check if the comment exists and get its details
    const commentResult = await pool.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    // Check if the user is the comment author
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    // Delete the comment
    await pool.query('DELETE FROM comments WHERE id = $1', [id]);

    // Decrease the comment count on the post
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

// ALSO UPDATE the "Get comments for a post" route to include user_id for ownership check:
// Replace the existing route with this updated version:

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
      // Keep user_id for ownership verification but don't expose it publicly for anonymous comments
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



// Delete a comment (only by comment author)
app.delete('/api/comments/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // First, check if the comment exists and get its details
    const commentResult = await pool.query(
      'SELECT * FROM comments WHERE id = $1',
      [id]
    );

    if (commentResult.rows.length === 0) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    const comment = commentResult.rows[0];

    // Check if the user is the comment author
    if (comment.user_id !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own comments' });
    }

    // Delete the comment
    await pool.query('DELETE FROM comments WHERE id = $1', [id]);

    // Decrease the comment count on the post
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

// Get user profile
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

// Get user's posts
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
        // Token invalid, continue without auth
      }
    }

    let query;
    let params;

    if (requestingUserId && requestingUserId === parseInt(id)) {
      query = `
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
        ORDER BY p.created_at DESC
      `;
      params = [id];
    } else {
      query = `
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
        WHERE p.user_id = $1 AND p.is_anonymous = false
        ORDER BY p.created_at DESC
      `;
      params = [id];
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update user profile
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

// ============== USEFUL POSTS ROUTES ==============

// Get all useful posts
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

// Request to transfer post to useful posts
app.post('/api/posts/:id/request-transfer', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    // Check if post exists
    const postResult = await pool.query('SELECT * FROM posts WHERE id = $1', [id]);
    if (postResult.rows.length === 0) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if already in useful posts
    const usefulPostCheck = await pool.query('SELECT * FROM useful_posts WHERE post_id = $1', [id]);
    if (usefulPostCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Post is already in useful posts' });
    }

    // Check if request already exists
    const existingRequest = await pool.query(
      'SELECT * FROM transfer_requests WHERE post_id = $1 AND status = $2',
      [id, 'pending']
    );
    if (existingRequest.rows.length > 0) {
      return res.status(400).json({ message: 'Transfer request already pending' });
    }

    // Create transfer request
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

// Check if current user is a manager
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

// ============== MANAGER ROUTES ==============

// Get all posts with real authors (manager only)
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

// Get all transfer requests (manager only)
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

// Approve transfer request (manager only)
app.post('/api/manager/transfer-requests/:id/approve', authenticateManager, async (req, res) => {
  const { id } = req.params;

  try {
    // Get the request
    const requestResult = await pool.query(
      'SELECT * FROM transfer_requests WHERE id = $1',
      [id]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ message: 'Transfer request not found' });
    }

    const request = requestResult.rows[0];

    // Check if already in useful posts
    const usefulPostCheck = await pool.query(
      'SELECT * FROM useful_posts WHERE post_id = $1',
      [request.post_id]
    );

    if (usefulPostCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Post is already in useful posts' });
    }

    // Add to useful posts
    await pool.query(
      'INSERT INTO useful_posts (post_id) VALUES ($1)',
      [request.post_id]
    );

    // Update request status
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

// Reject transfer request (manager only)
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

// Delete a post (manager only)
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

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

// Start server
const PORT = process.env.PORT || 5000;

pool.connect((err) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Connected to database');
    initializeDatabase();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});