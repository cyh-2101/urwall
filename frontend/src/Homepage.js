import React, { useState, useEffect } from 'react';
import './Homepage.css';
import PostDetail from './PostDetail';
import UserProfile from './UserProfile';
import UsefulPosts from './UsefulPosts';
import ManagerPanel from './ManagerPanel';

export default function Homepage({ user, onLogout }) {
  // Posts and UI state
  const [posts, setPosts] = useState([]);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // New post form state
  const [newPost, setNewPost] = useState({
    title: '',
    content: '',
    category: 'General',
    isAnonymous: false,
  });

  // Filter and sort state
  const [sortBy, setSortBy] = useState('created_at');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Manager and useful posts state
  const [showUsefulPosts, setShowUsefulPosts] = useState(false);
  const [showManagerPanel, setShowManagerPanel] = useState(false);
  const [isManager, setIsManager] = useState(false);

  // Track where we came from for proper back navigation
  const [previousView, setPreviousView] = useState(null);

  const categories = ['General', 'Housing', 'Course', 'Events', 'Buy/Sell', 'Jobs', 'Other'];

  // Fetch posts when sort or category changes
useEffect(() => {
  fetchPosts();
}, [sortBy, selectedCategory, searchQuery]);

  // Check if user is a manager
  useEffect(() => {
    checkManagerStatus();
  }, []);

  const checkManagerStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('https://urwall-production.up.railway.app/api/auth/check-manager', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setIsManager(data.isManager);
      }
    } catch (error) {
      console.error('Error checking manager status:', error);
    }
  };

const fetchPosts = async () => {
  setLoading(true);
  try {
    let url;
    if (searchQuery.trim()) {
      // Use search endpoint if there's a search query
      url = `https://urwall-production.up.railway.app/api/posts/search?query=${encodeURIComponent(searchQuery)}&sortBy=${sortBy}`;
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
    } else {
      // Use regular endpoint if no search query
      url = `https://urwall-production.up.railway.app/api/posts?sortBy=${sortBy}`;
      if (selectedCategory) {
        url += `&category=${selectedCategory}`;
      }
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
      const response = await fetch('https://urwall-production.up.railway.app/api/posts', {
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

  const handleLike = async (postId, e) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`https://urwall-production.up.railway.app/api/posts/${postId}/like`, {
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

  const handleViewProfile = () => {
    setSelectedUserId(user.id);
  };

  const handlePostClick = (postId, fromView = null) => {
    setPreviousView(fromView);
    setSelectedPostId(postId);
  };

  const handleBackFromPostDetail = () => {
    setSelectedPostId(null);
    // If we came from useful posts, go back there
    if (previousView === 'useful') {
      setShowUsefulPosts(true);
    }
    setPreviousView(null);
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

  // Conditional rendering for Manager Panel
  if (showManagerPanel) {
    return <ManagerPanel user={user} onBack={() => setShowManagerPanel(false)} />;
  }

  // Conditional rendering for Useful Posts
  if (showUsefulPosts && !selectedPostId) {
    return (
      <UsefulPosts 
        user={user} 
        onPostClick={(postId) => handlePostClick(postId, 'useful')}
        onBack={() => setShowUsefulPosts(false)} 
      />
    );
  }

  // Conditional rendering for Post Detail
  if (selectedPostId) {
    return (
      <PostDetail 
        postId={selectedPostId} 
        onBack={handleBackFromPostDetail} 
        user={user} 
      />
    );
  }

  // Conditional rendering for User Profile
  if (selectedUserId) {
    return (
      <UserProfile 
        userId={selectedUserId}
        currentUser={user}
        onBack={() => setSelectedUserId(null)}
        onPostClick={(postId) => {
          setSelectedUserId(null);
          handlePostClick(postId);
        }}
      />
    );
  }

  return (
    <div className="home-container">
      <nav className="navbar">
        <h1>Campus Wall</h1>
        <div className="nav-right">
          <span 
            className="username-link" 
            onClick={handleViewProfile}
            style={{ cursor: 'pointer', textDecoration: 'underline' }}
          >
            Welcome, {user.username}!
          </span>
          {isManager && (
            <button 
              onClick={() => setShowManagerPanel(true)} 
              className="control-btn"
            >
              🔧 Control
            </button>
          )}
          <button onClick={onLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="main-content">
        <aside className="sidebar">
          <button className="create-post-btn" onClick={() => setShowCreatePost(true)}>
            + New Post
          </button>
          <div className="filter-section">
            <h3>Search</h3>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search posts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')} 
                  className="clear-search-btn"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
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
          {/* View Tabs for General Posts vs Useful Posts */}
          <div className="view-tabs">
            <button 
              onClick={() => setShowUsefulPosts(false)} 
              className={`view-tab ${!showUsefulPosts ? 'active' : ''}`}
            >
              General Posts
            </button>
            <button 
              onClick={() => setShowUsefulPosts(true)} 
              className="view-tab"
            >
              干货板块 - Useful Posts
            </button>
          </div>

          {/* Create Post Modal */}
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
          {/* Posts List */}
          {loading ? (
            <div className="loading">Loading posts...</div>
          ) : posts.length === 0 ? (
            <div className="no-posts">No posts yet. Be the first to post!</div>
          ) : (
            posts.map((post) => (
              <div 
                key={post.id} 
                className="post-card"
                onClick={() => handlePostClick(post.id)}
                style={{ cursor: 'pointer' }}
              >
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
                  <button onClick={(e) => handleLike(post.id, e)} className="action-btn">
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