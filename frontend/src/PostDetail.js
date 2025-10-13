import React, { useState, useEffect } from 'react';
import './PostDetail.css';

export default function PostDetail({ postId, onBack, user }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPostDetail();
    fetchComments();
  }, [postId]);

  const fetchPostDetail = async () => {
    try {
      console.log('Fetching post with ID:', postId);
      const response = await fetch(`http://localhost:5000/api/posts/${postId}`);
      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Response not OK:', response.status, errorData);
        setError(errorData.message || 'Failed to load post');
        setPost(null);
        return;
      }
      
      const data = await response.json();
      console.log('Post data:', data);
      setPost(data);
      setError(null);
    } catch (error) {
      console.error('Error fetching post:', error);
      setError('Network error. Please try again.');
      setPost(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments`);
      if (!response.ok) {
        console.error('Failed to fetch comments');
        setComments([]);
        return;
      }
      const data = await response.json();
      // 确保 data 是数组
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching comments:', error);
      setComments([]);
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to like posts');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchPostDetail();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Network error');
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to comment');
        return;
      }

      const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: newComment,
          isAnonymous: isAnonymous,
        }),
      });

      if (response.ok) {
        setNewComment('');
        setIsAnonymous(false);
        fetchComments();
        fetchPostDetail(); // 更新评论数
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Network error');
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

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error">{error}</div>
        <button onClick={onBack} className="back-btn">
          ← Back to Feed
        </button>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="error-container">
        <div className="error">Post not found</div>
        <button onClick={onBack} className="back-btn">
          ← Back to Feed
        </button>
      </div>
    );
  }

  return (
    <div className="post-detail-container">
      <button onClick={onBack} className="back-btn">
        ← Back to Feed
      </button>

      <div className="post-detail-card">
        <div className="post-detail-header">
          <div className="post-detail-author">
            {post.author_avatar && (
              <img 
                src={post.author_avatar} 
                alt={post.author} 
                className="author-avatar"
                onError={(e) => { e.target.style.display = 'none'; }}
              />
            )}
            <strong>{post.author || 'Anonymous'}</strong>
            <span className="post-detail-category">{post.category}</span>
          </div>
          <span className="post-detail-time">{formatDate(post.created_at)}</span>
        </div>

        <h1 className="post-detail-title">{post.title}</h1>
        <p className="post-detail-content">{post.content}</p>

        <div className="post-detail-actions">
          <button onClick={handleLike} className="detail-action-btn">
            ❤️ {post.likes_count} {post.likes_count === 1 ? 'Like' : 'Likes'}
          </button>
          <span className="detail-action-btn">
            💬 {post.comments_count} {post.comments_count === 1 ? 'Comment' : 'Comments'}
          </span>
        </div>
      </div>

      <div className="comments-section">
        <h2>Comments</h2>
        
        {user && (
          <form onSubmit={handleAddComment} className="comment-form">
            <textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows="3"
              className="comment-input"
            />
            <div className="comment-form-actions">
              <label className="anonymous-checkbox">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                />
                Comment anonymously
              </label>
              <button type="submit" className="comment-submit-btn">
                Post Comment
              </button>
            </div>
          </form>
        )}

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">No comments yet. Be the first to comment!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <div className="comment-header">
                  <div className="comment-author">
                    {comment.author_avatar && (
                      <img 
                        src={comment.author_avatar} 
                        alt={comment.author} 
                        className="comment-author-avatar"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <strong>{comment.author || 'Anonymous'}</strong>
                  </div>
                  <span className="comment-time">{formatDate(comment.created_at)}</span>
                </div>
                <p className="comment-content">{comment.content}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}