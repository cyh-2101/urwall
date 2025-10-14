import React, { useState, useEffect } from 'react';
import './ManagerPanel.css';

export default function ManagerPanel({ user, onBack }) {
  const [allPosts, setAllPosts] = useState([]);
  const [transferRequests, setTransferRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchAllPosts();
    fetchTransferRequests();
  }, [page]);

  const fetchAllPosts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/manager/all-posts?page=${page}&limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAllPosts(data.posts);
        setTotalPages(data.totalPages);
      } else {
        console.error('Failed to fetch posts');
        setAllPosts([]);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
      setAllPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransferRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        'http://localhost:5000/api/manager/transfer-requests?status=pending',
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setTransferRequests(data.requests);
      } else {
        console.error('Failed to fetch transfer requests');
        setTransferRequests([]);
      }
    } catch (error) {
      console.error('Error fetching transfer requests:', error);
      setTransferRequests([]);
    }
  };

  const handleDeletePost = async (postId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/manager/posts/${postId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert('Post deleted successfully');
        setShowDeleteConfirm(false);
        setSelectedPost(null);
        fetchAllPosts();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to delete post');
      }
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Network error');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/manager/transfer-requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert('Transfer request approved successfully');
        setSelectedRequest(null);
        fetchTransferRequests();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      alert('Network error');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:5000/api/manager/transfer-requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert('Transfer request rejected successfully');
        setSelectedRequest(null);
        fetchTransferRequests();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      alert('Network error');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="manager-panel-container">
        <div className="manager-header">
          <button onClick={onBack} className="back-btn">← Back</button>
          <h1>Manager Control Panel</h1>
        </div>
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="manager-panel-container">
      <div className="manager-header">
        <button onClick={onBack} className="back-btn">← Back</button>
        <h1>Manager Control Panel</h1>
        <p className="manager-welcome">Welcome, {user.username}</p>
      </div>

      <div className="manager-content">
        {/* Column 1: All Posts */}
        <div className="manager-column">
          <div className="column-header">
            <h2>All Posts</h2>
            <p className="column-subtitle">View all posts with real authors</p>
          </div>

          <div className="posts-list">
            {allPosts.length === 0 ? (
              <p className="no-data">No posts found</p>
            ) : (
              allPosts.map((post) => (
                <div
                  key={post.id}
                  className="manager-post-card"
                  onClick={() => setSelectedPost(post)}
                >
                  <div className="post-header">
                    <span className="post-category">{post.category}</span>
                    {post.is_anonymous && (
                      <span className="anonymous-badge">Posted Anonymously</span>
                    )}
                  </div>

                  <h3 className="post-title">{post.title}</h3>

                  <div className="post-author-info">
                    <strong>Real Author:</strong> {post.username} ({post.email})
                  </div>

                  <div className="post-preview">
                    {post.content.substring(0, 100)}
                    {post.content.length > 100 && '...'}
                  </div>

                  <div className="post-footer">
                    <span className="post-date">{formatDate(post.created_at)}</span>
                    <div className="post-stats">
                      <span>👍 {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
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
        </div>

        {/* Column 2: Transfer Requests */}
        <div className="manager-column">
          <div className="column-header">
            <h2>Transfer Requests</h2>
            <p className="column-subtitle">
              Pending requests to move posts to Useful Posts ({transferRequests.length})
            </p>
          </div>

          <div className="requests-list">
            {transferRequests.length === 0 ? (
              <p className="no-data">No pending transfer requests</p>
            ) : (
              transferRequests.map((request) => (
                <div
                  key={request.request_id}
                  className="manager-request-card"
                  onClick={() => setSelectedRequest(request)}
                >
                  <div className="request-header">
                    <span className="post-category">{request.category}</span>
                    {request.is_anonymous && (
                      <span className="anonymous-badge">Posted Anonymously</span>
                    )}
                  </div>

                  <h3 className="post-title">{request.title}</h3>

                  <div className="request-author-info">
                    <div>
                      <strong>Post Author:</strong> {request.author_username} ({request.author_email})
                    </div>
                    <div>
                      <strong>Requested by:</strong> {request.requester_username} ({request.requester_email})
                    </div>
                  </div>

                  <div className="post-preview">
                    {request.content.substring(0, 100)}
                    {request.content.length > 100 && '...'}
                  </div>

                  <div className="post-footer">
                    <span className="post-date">Requested: {formatDate(request.requested_at)}</span>
                    <div className="post-stats">
                      <span>👍 {request.likes_count}</span>
                      <span>💬 {request.comments_count}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Delete Post Modal */}
      {selectedPost && (
        <div className="modal-overlay" onClick={() => setSelectedPost(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Post Details</h2>

            <div className="modal-section">
              <div className="modal-label">Category:</div>
              <div>{selectedPost.category}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Title:</div>
              <div className="modal-value">{selectedPost.title}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Author:</div>
              <div className="modal-value">
                {selectedPost.username} ({selectedPost.email})
                {selectedPost.is_anonymous && ' - Posted Anonymously'}
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Content:</div>
              <div className="modal-value content-full">{selectedPost.content}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Stats:</div>
              <div className="modal-value">
                {selectedPost.likes_count} likes, {selectedPost.comments_count} comments
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Posted:</div>
              <div className="modal-value">{formatDate(selectedPost.created_at)}</div>
            </div>

            <div className="modal-actions">
              {!showDeleteConfirm ? (
                <>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="delete-btn"
                  >
                    Delete Post
                  </button>
                  <button onClick={() => setSelectedPost(null)} className="cancel-btn">
                    Close
                  </button>
                </>
              ) : (
                <>
                  <div className="confirm-message">
                    Are you sure you want to delete this post? This action cannot be undone.
                  </div>
                  <button
                    onClick={() => handleDeletePost(selectedPost.id)}
                    className="confirm-delete-btn"
                  >
                    Yes, Delete
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Transfer Request Modal */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Transfer Request Details</h2>

            <div className="modal-section">
              <div className="modal-label">Category:</div>
              <div>{selectedRequest.category}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Title:</div>
              <div className="modal-value">{selectedRequest.title}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Post Author:</div>
              <div className="modal-value">
                {selectedRequest.author_username} ({selectedRequest.author_email})
                {selectedRequest.is_anonymous && ' - Posted Anonymously'}
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Requested By:</div>
              <div className="modal-value">
                {selectedRequest.requester_username} ({selectedRequest.requester_email})
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Content:</div>
              <div className="modal-value content-full">{selectedRequest.content}</div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Stats:</div>
              <div className="modal-value">
                {selectedRequest.likes_count} likes, {selectedRequest.comments_count} comments
              </div>
            </div>

            <div className="modal-section">
              <div className="modal-label">Requested:</div>
              <div className="modal-value">{formatDate(selectedRequest.requested_at)}</div>
            </div>

            <div className="modal-actions">
              <button
                onClick={() => handleApproveRequest(selectedRequest.request_id)}
                className="approve-btn"
              >
                Approve Request
              </button>
              <button
                onClick={() => handleRejectRequest(selectedRequest.request_id)}
                className="reject-btn"
              >
                Reject Request
              </button>
              <button onClick={() => setSelectedRequest(null)} className="cancel-btn">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}