import React, { useState, useEffect } from 'react';
import './UsefulPosts.css';

export default function UsefulPosts({ user, onPostClick, onBack }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('created_at');
  
  // Request transfer modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [userPosts, setUserPosts] = useState([]);
  const [selectedPostForTransfer, setSelectedPostForTransfer] = useState(null);
  const [loadingUserPosts, setLoadingUserPosts] = useState(false);

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

  const fetchUserPosts = async () => {
    try {
      setLoadingUserPosts(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/users/${user.id}/posts`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setUserPosts(data);
      } else {
        console.error('Failed to fetch user posts');
        setUserPosts([]);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
      setUserPosts([]);
    } finally {
      setLoadingUserPosts(false);
    }
  };

  const handleOpenRequestModal = (e) => {
    e.stopPropagation();
    setShowRequestModal(true);
    fetchUserPosts();
  };

  const handleCloseRequestModal = () => {
    setShowRequestModal(false);
    setSelectedPostForTransfer(null);
  };

  const handleRequestTransfer = async () => {
    if (!selectedPostForTransfer) {
      alert('Please select a post to transfer');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/posts/${selectedPostForTransfer}/request-transfer`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert('Transfer request submitted successfully! It will be reviewed by a manager.');
        handleCloseRequestModal();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to submit transfer request');
      }
    } catch (error) {
      console.error('Error submitting transfer request:', error);
      alert('Network error');
    }
  };

  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    setPage(1);
  };

  const handlePostCardClick = (postId) => {
    if (onPostClick) {
      onPostClick(postId);
    }
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
        <button onClick={handleOpenRequestModal} className="request-transfer-btn">
          📤 Request to Add Your Post
        </button>
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
                onClick={() => handlePostCardClick(post.id)}
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

      {/* Request Transfer Modal */}
      {showRequestModal && (
        <div className="modal-overlay" onClick={handleCloseRequestModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Request to Add Post to Useful Section</h2>
            <p className="modal-description">
              Select one of your posts to request it be added to the Useful Posts section. 
              A manager will review your request.
            </p>

            {loadingUserPosts ? (
              <div className="modal-loading">Loading your posts...</div>
            ) : userPosts.length === 0 ? (
              <div className="no-user-posts">
                <p>You don't have any posts yet. Create a post first to request a transfer!</p>
              </div>
            ) : (
              <div className="user-posts-list">
                {userPosts.map((post) => (
                  <div
                    key={post.id}
                    className={`user-post-item ${selectedPostForTransfer === post.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPostForTransfer(post.id)}
                  >
                    <div className="post-select-indicator">
                      <input
                        type="radio"
                        checked={selectedPostForTransfer === post.id}
                        onChange={() => setSelectedPostForTransfer(post.id)}
                      />
                    </div>
                    <div className="post-select-content">
                      <div className="post-select-header">
                        <span className="post-category">{post.category}</span>
                        {post.is_anonymous && (
                          <span className="anonymous-badge">Anonymous</span>
                        )}
                      </div>
                      <h4 className="post-select-title">{post.title}</h4>
                      <p className="post-select-preview">
                        {post.content.substring(0, 100)}
                        {post.content.length > 100 && '...'}
                      </p>
                      <div className="post-select-stats">
                        <span>👍 {post.likes_count}</span>
                        <span>💬 {post.comments_count}</span>
                        <span className="post-date">{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                onClick={handleRequestTransfer}
                disabled={!selectedPostForTransfer}
                className="submit-request-btn"
              >
                Submit Request
              </button>
              <button onClick={handleCloseRequestModal} className="cancel-btn">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}