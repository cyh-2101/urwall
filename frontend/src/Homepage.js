import React, { useState, useEffect } from 'react';
import './homepage.css';

export default function Homepage({ user, onLogout }) {  // Changed from 'homepage' to 'Homepage'
  const [posts, setPosts] = useState([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'General',
    isAnonymous: false,
  });
  const [sortBy, setSortBy] = useState('created_at');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(false);

  const categories = ['General', 'Housing', 'Course', 'Events', 'Buy/Sell', 'Jobs', 'Other'];

  useEffect(() => {
    fetchPosts();
  }, [sortBy, selectedCategory]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      let url = `http://localhost:5000/api/posts?sortBy=${sortBy}`;
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
      const response = await fetch(url);
      const data = await response.json();
      setPosts(data.posts);
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newPost),
      });

      if (response.ok) {
        setNewPost({ title: '', content: '', category: 'General', isAnonymous: false });
        setShowCreatePost(false);
        fetchPosts();
      } else {
        alert('Failed to create post');
      }
    } catch (error) {
      console.error('Error creating post:', error);
      alert('Network error');
    }
  };

  const handleLike = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchPosts();
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="home-container">
      <nav className="navbar">
        <h1>Campus Wall</h1>
        <div className="nav-right">
          <span>Welcome, {user.username}!</span>
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="main-content">
        <aside className="sidebar">
          <button className="create-post-btn" onClick={() => setShowCreatePost(true)}>
            + New Post
          </button>

          <div className="filter-section">
            <h3>Sort By</h3>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="created_at">Recent</option>
              <option value="likes">Most Liked</option>
              <option value="comments">Most Commented</option>
            </select>
          </div>

          <div className="filter-section">
            <h3>Category</h3>
            <div className="category-list">
              <button
                className={selectedCategory === '' ? 'active' : ''}
                onClick={() => setSelectedCategory('')}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={selectedCategory === cat ? 'active' : ''}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main className="feed">
          {showCreatePost && (
            <div className="modal-overlay" onClick={() => setShowCreatePost(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Create New Post</h2>
                <form onSubmit={handleCreatePost}>
                  <input
                    type="text"
                    placeholder="Title"
                    value={newPost.title}
                    onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                    required
                  />
                  <textarea
                    placeholder="What's on your mind?"
                    value={newPost.content}
                    onChange={(e) => setNewPost({ ...newPost, content: e.target.value })}
                    required
                    rows="6"
                  />
                  <select
                    value={newPost.category}
                    onChange={(e) => setNewPost({ ...newPost, category: e.target.value })}
                  >
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={newPost.isAnonymous}
                      onChange={(e) => setNewPost({ ...newPost, isAnonymous: e.target.checked })}
                    />
                    Post anonymously
                  </label>
                  <div className="modal-actions">
                    <button type="button" onClick={() => setShowCreatePost(false)}>Cancel</button>
                    <button type="submit">Post</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {loading ? (
            <div className="loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="no-posts">No posts yet. Be the first to post!</div>
          ) : (
            posts.map((post) => (
              <div key={post.id} className="post-card">
                <div className="post-header">
                  <div className="post-author">
                    <strong>{post.author}</strong>
                    <span className="post-category">{post.category}</span>
                  </div>
                  <span className="post-time">{formatDate(post.created_at)}</span>
                </div>
                <h3 className="post-title">{post.title}</h3>
                <p className="post-content">{post.content}</p>
                <div className="post-actions">
                  <button onClick={() => handleLike(post.id)} className="action-btn">
                    ❤️ {post.likes_count}
                  </button>
                  <button className="action-btn">
                    💬 {post.comments_count}
                  </button>
                </div>
              </div>
            ))
          )}
        </main>
      </div>
    </div>
  );
}