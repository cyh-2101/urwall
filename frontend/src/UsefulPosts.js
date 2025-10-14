import React, { useState, useEffect } from 'react';
import './UsefulPosts.css';

export default function UsefulPosts({ user, onPostClick, onBack }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');

  useEffect(() => {
    fetchUsefulPosts();
  }, [page, sortBy]);

  const fetchUsefulPosts = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `http://localhost:5000/api/useful-posts?page=${page}&limit=20&sortBy=${sortBy}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts);
        setTotalPages(data.totalPages);
      } else {
        console.error('Failed to fetch useful posts');
        setPosts([]);
      }
    } catch (error) {
      console.error('Error fetching useful posts:', error);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  if (loading && posts.length === 0) {
    return (
      <div className="useful-posts-container">
        <div className="useful-posts-header">
          <button onClick={onBack} className="back-btn">← Back</button>
          <h1>干货板块 - Useful Posts</h1>
          <p className="useful-posts-description">
            Curated posts about housing, course selection, and campus life
          </p>
        </div>
        <div className="loading">Loading useful posts...</div>
      </div>
    );
  }

  return (
    <div className="useful-posts-container">
      <div className="useful-posts-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h1>干货板块 - Useful Posts</h1>
        <p className="useful-posts-description">
          Curated posts about housing, course selection, and campus life
        </p>
      </div>

      <div className="useful-posts-controls">
        <div className="sort-buttons">
          <button
            onClick={() => handleSortChange('created_at')}
            className={`sort-btn ${sortBy === 'created_at' ? 'active' : ''}`}
          >
            Latest
          </button>
          <button
            onClick={() => handleSortChange('likes')}
            className={`sort-btn ${sortBy === 'likes' ? 'active' : ''}`}
          >
            Most Liked
          </button>
          <button
            onClick={() => handleSortChange('comments')}
            className={`sort-btn ${sortBy === 'comments' ? 'active' : ''}`}
          >
            Most Discussed
          </button>
        </div>
      </div>

      {posts.length === 0 ? (
        <div className="no-posts">
          <p>No useful posts yet. Posts will appear here once approved by managers.</p>
        </div>
      ) : (
        <>
          <div className="useful-posts-list">
            {posts.map((post) => (
              <div
                key={post.id}
                className="useful-post-card"
                onClick={() => onPostClick(post.id)}
              >
                <div className="post-header">
                  <span className="post-category">{post.category}</span>
                  {post.is_anonymous && (
                    <span className="anonymous-badge">Anonymous</span>
                  )}
                  <span className="post-time">{formatDate(post.approved_at)}</span>
                </div>

                <h3 className="post-title">{post.title}</h3>

                <div className="post-preview">
                  {post.content.substring(0, 200)}
                  {post.content.length > 200 && '...'}
                </div>

                <div className="post-meta">
                  <span className="post-author">
                    {post.is_anonymous ? 'Anonymous' : post.author}
                  </span>
                  <div className="post-stats">
                    <span>👍 {post.likes_count}</span>
                    <span>💬 {post.comments_count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="pagination-btn"
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}