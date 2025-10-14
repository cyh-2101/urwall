import React, { useState, useEffect } from 'react';
import './UserProfile.css';

export default function UserProfile({ userId, currentUser, onBack, onPostClick }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts'); // posts or comments
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    bio: '',
    avatar_url: ''
  });

  const isOwnProfile = currentUser && currentUser.id === parseInt(userId);

  useEffect(() => {
    fetchUserProfile();
    fetchUserPosts();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}`);
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setEditForm({
          username: data.username || '',
          bio: data.bio || '',
          avatar_url: data.avatar_url || ''
        });
      } else {
        console.error('Failed to fetch user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/users/${userId}/posts`);
      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error fetching user posts:', error);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5000/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        setIsEditing(false);
        alert('个人信息更新成功！');
      } else {
        alert('更新失败，请重试');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('网络错误');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return '刚刚';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} 分钟前`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} 小时前`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} 天前`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!profile) {
    return (
      <div className="error-container">
        <div className="error">用户不存在</div>
        <button onClick={onBack} className="back-btn">← 返回</button>
      </div>
    );
  }

  return (
    <div className="user-profile-container">
      <button onClick={onBack} className="back-btn">← 返回首页</button>

      <div className="profile-header">
        <div className="profile-info">
          <div className="avatar-container">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.username} 
                className="profile-avatar"
                onError={(e) => { 
                  e.target.src = 'https://via.placeholder.com/150?text=' + profile.username[0].toUpperCase(); 
                }}
              />
            ) : (
              <div className="avatar-placeholder">
                {profile.username[0].toUpperCase()}
              </div>
            )}
          </div>
          
          <div className="profile-details">
            <h1>{profile.username}</h1>
            <p className="profile-email">{profile.email}</p>
            <p className="profile-bio">{profile.bio || '这个用户还没有填写简介'}</p>
            <p className="member-since">加入时间: {new Date(profile.created_at).toLocaleDateString()}</p>
            
            {isOwnProfile && !isEditing && (
              <button onClick={() => setIsEditing(true)} className="edit-btn">
                编辑个人信息
              </button>
            )}
          </div>
        </div>

        <div className="profile-stats">
          <div className="stat-item">
            <span className="stat-number">{posts.length}</span>
            <span className="stat-label">帖子</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{profile.total_likes || 0}</span>
            <span className="stat-label">获赞</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{profile.total_comments || 0}</span>
            <span className="stat-label">评论</span>
          </div>
        </div>
      </div>

      {isEditing && (
        <div className="edit-form-container">
          <h2>编辑个人信息</h2>
          <form onSubmit={handleUpdateProfile} className="edit-form">
            <div className="form-group">
              <label>用户名</label>
              <input
                type="text"
                value={editForm.username}
                onChange={(e) => setEditForm({...editForm, username: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label>个人简介</label>
              <textarea
                value={editForm.bio}
                onChange={(e) => setEditForm({...editForm, bio: e.target.value})}
                placeholder="介绍一下自己..."
                rows="4"
              />
            </div>
            <div className="form-group">
              <label>头像 URL</label>
              <input
                type="url"
                value={editForm.avatar_url}
                onChange={(e) => setEditForm({...editForm, avatar_url: e.target.value})}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            <div className="form-actions">
              <button type="button" onClick={() => setIsEditing(false)} className="cancel-btn">
                取消
              </button>
              <button type="submit" className="save-btn">
                保存
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="profile-content">
        <div className="content-tabs">
          <button 
            className={activeTab === 'posts' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('posts')}
          >
            发布的帖子
          </button>
          <button 
            className={activeTab === 'anonymous' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('anonymous')}
          >
            匿名帖子
          </button>
        </div>

        <div className="posts-list">
          {activeTab === 'posts' && (
            <>
              {posts.filter(p => !p.is_anonymous).length === 0 ? (
                <div className="no-posts">还没有发布任何帖子</div>
              ) : (
                posts.filter(p => !p.is_anonymous).map(post => (
                  <div 
                    key={post.id} 
                    className="post-card"
                    onClick={() => onPostClick(post.id)}
                  >
                    <div className="post-header">
                      <span className="post-category">{post.category}</span>
                      <span className="post-time">{formatDate(post.created_at)}</span>
                    </div>
                    <h3 className="post-title">{post.title}</h3>
                    <p className="post-preview">{post.content}</p>
                    <div className="post-stats">
                      <span>❤️ {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'anonymous' && isOwnProfile && (
            <>
              {posts.filter(p => p.is_anonymous).length === 0 ? (
                <div className="no-posts">没有匿名帖子</div>
              ) : (
                posts.filter(p => p.is_anonymous).map(post => (
                  <div 
                    key={post.id} 
                    className="post-card anonymous-post"
                    onClick={() => onPostClick(post.id)}
                  >
                    <div className="post-header">
                      <span className="anonymous-badge">匿名发布</span>
                      <span className="post-category">{post.category}</span>
                      <span className="post-time">{formatDate(post.created_at)}</span>
                    </div>
                    <h3 className="post-title">{post.title}</h3>
                    <p className="post-preview">{post.content}</p>
                    <div className="post-stats">
                      <span>❤️ {post.likes_count}</span>
                      <span>💬 {post.comments_count}</span>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'anonymous' && !isOwnProfile && (
            <div className="no-posts">只有自己可以查看匿名帖子</div>
          )}
        </div>
      </div>
    </div>
  );
}