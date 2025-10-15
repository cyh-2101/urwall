import React, { useState, useEffect, useRef } from 'react';
import './PostDetail.css';

export default function PostDetail({ postId, onBack, user }) {
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [deletingCommentId, setDeletingCommentId] = useState(null);
  
  const refreshIntervalRef = useRef(null);
  const commentInputRef = useRef(null);

  useEffect(() => {
    fetchPostDetail();
    fetchComments();

    refreshIntervalRef.current = setInterval(() => {
      fetchComments();
      fetchPostDetail();
    }, 5000);

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [postId]);

  useEffect(() => {
    if (replyingTo && commentInputRef.current) {
      commentInputRef.current.focus();
    }
  }, [replyingTo]);

  const fetchPostDetail = async () => {
    try {
      const response = await fetch(`urwall-production-7ba9.up.railway.app/api/posts/${postId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to load post');
        setPost(null);
        return;
      }
      
      const data = await response.json();
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
      const response = await fetch(`urwall-production-7ba9.up.railway.app/api/posts/${postId}/comments`);
      if (!response.ok) {
        console.error('Failed to fetch comments');
        return;
      }
      const data = await response.json();
      setComments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleLike = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to like posts');
        return;
      }

      const response = await fetch(`urwall-production-7ba9.up.railway.app/api/posts/${postId}/like`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        await fetchPostDetail();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to like post');
      }
    } catch (error) {
      console.error('Error liking post:', error);
      alert('Network error');
    }
  };

  const handleReply = (comment) => {
    setReplyingTo(comment);
    setNewComment(`@${comment.author}: `);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
    setNewComment('');
  };

  const handleDeleteComment = async (commentId) => {
    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this comment? This action cannot be undone.')) {
      return;
    }

    setDeletingCommentId(commentId);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to delete comments');
        setDeletingCommentId(null);
        return;
      }

      const response = await fetch(`urwall-production-7ba9.up.railway.app/api/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Show success message
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Comment deleted successfully!';
        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #f44336; color: white; padding: 15px 20px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);

        // Refresh comments and post
        await Promise.all([
          fetchComments(),
          fetchPostDetail()
        ]);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete comment');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Network error');
    } finally {
      setDeletingCommentId(null);
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) {
      alert('Please enter a comment');
      return;
    }

    if (isSubmitting) return;

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login to comment');
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`urwall-production-7ba9.up.railway.app/api/posts/${postId}/comments`, {
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
        setReplyingTo(null);
        
        await Promise.all([
          fetchComments(),
          fetchPostDetail()
        ]);
        
        const successMsg = document.createElement('div');
        successMsg.textContent = 'Comment posted successfully!';
        successMsg.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; padding: 15px 20px; border-radius: 8px; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);';
        document.body.appendChild(successMsg);
        setTimeout(() => successMsg.remove(), 3000);
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Network error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const parseCommentContent = (content) => {
    const parts = content.split(/(@[\w\s]+:)/g);
    return parts.map((part, index) => {
      if (part.match(/^@[\w\s]+:$/)) {
        return (
          <span key={index} className="mention-reference">
            {part}
          </span>
        );
      }
      return part;
    });
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

  // Helper function to check if current user can delete a comment
  const canDeleteComment = (comment) => {
    if (!user) return false;
    // User can delete if they are the author (for non-anonymous comments)
    if (!comment.is_anonymous && comment.author === user.username) {
      return true;
    }
    // For anonymous comments, check user_id if available
    if (comment.is_anonymous && comment.user_id === user.id) {
      return true;
    }
    return false;
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
        <h2>Comments ({comments.length})</h2>
        
        {user && (
          <form onSubmit={handleAddComment} className="comment-form">
            {replyingTo && (
              <div className="replying-to-banner">
                <span>
                  Replying to <strong>{replyingTo.author}</strong>
                </span>
                <button 
                  type="button" 
                  onClick={handleCancelReply}
                  className="cancel-reply-btn"
                >
                  ✕
                </button>
              </div>
            )}
            <textarea
              ref={commentInputRef}
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows="3"
              className="comment-input"
              disabled={isSubmitting}
            />
            <div className="comment-form-actions">
              <label className="anonymous-checkbox">
                <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  disabled={isSubmitting}
                />
                Comment anonymously
              </label>
              <button 
                type="submit" 
                className="comment-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Posting...' : 'Post Comment'}
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
                <p className="comment-content">
                  {parseCommentContent(comment.content)}
                </p>
                <div className="comment-actions">
                  {user && (
                    <button 
                      className="reply-btn"
                      onClick={() => handleReply(comment)}
                    >
                      ↩ Reply
                    </button>
                  )}
                  {user && canDeleteComment(comment) && (
                    <button 
                      className="delete-comment-btn"
                      onClick={() => handleDeleteComment(comment.id)}
                      disabled={deletingCommentId === comment.id}
                    >
                      {deletingCommentId === comment.id ? '🗑️ Deleting...' : '🗑️ Delete'}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}