import React, { useState, useEffect } from 'react';
import './PostDetail.css';

export default function PostDetail({ postId, onBack, user }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);

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
      console.error('Response not OK:', response.status);
      setPost(null);
      return;
    }
    
    const data = await response.json();
    console.log('Post data:', data);
    setPost(data);
  } catch (error) {
    console.error('Error fetching post:', error);
    setPost(null);
  } finally {
    setLoading(false);
  }
};

const fetchComments = async () => {
  try {
    const response = await fetch(`http://localhost:5000/api/posts/${postId}/comments`);
    const data = await response.json();
    // 确保 data 是数组
    setComments(Array.isArray(data) ? data : []);
  } catch (error) {
    console.error('Error fetching comments:', error);
    setComments([]); // 错误时设置为空数组
  }
};

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        fetchPostDetail();
      }
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const token = localStorage.getItem('token');
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
        fetchPostDetail();
      } else {
        alert('Failed to add comment');
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

  if (!post) {
    return <div className="error">Post not found</div>;
  }

  return (
    <div className="post-detail-container">
      <button onClick={onBack} className="back-btn">
        ← Back to Feed
      </button>

      <div className="post-detail-card">
        <div className="post-detail-header">
          <div className="post-detail-author">
            <strong>{post.author}</strong>
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
        <h2>Comments ({comments.length})</h2>

        <form onSubmit={handleAddComment} className="comment-form">
          <textarea
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows="3"
            required
          />
          <div className="comment-form-actions">
            <label className="comment-anonymous-label">
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

        <div className="comments-list">
          {comments.length === 0 ? (
            <div className="no-comments">No comments yet. Be the first to comment!</div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="comment-card">
                <div className="comment-header">
                  <strong>{comment.author}</strong>
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