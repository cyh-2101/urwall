import React, { useState } from 'react';
import './Auth.css';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerUsername, setRegisterUsername] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [registerVerificationCode, setRegisterVerificationCode] = useState('');
  const [registrationSent, setRegistrationSent] = useState(false);
  
  const [resetEmail, setResetEmail] = useState('');
  const [resetVerificationCode, setResetVerificationCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetCodeVerified, setResetCodeVerified] = useState(false);
  
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Login successful!', 'success');
        setLoginEmail('');
        setLoginPassword('');
      } else {
        showMessage(data.message || 'Login failed', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const handleSendRegisterCode = async (e) => {
    e.preventDefault();
    if (!registerEmail.endsWith('@illinois.edu')) {
      showMessage('Email must end with @illinois.edu', 'error');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: registerEmail, type: 'register' })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Verification code sent to your email', 'success');
        setRegistrationSent(true);
      } else {
        showMessage(data.message || 'Failed to send code', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerPassword !== confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerUsername,
          email: registerEmail,
          password: registerPassword,
          verificationCode: registerVerificationCode
        })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Registration successful! Please login', 'success');
        setRegisterUsername('');
        setRegisterEmail('');
        setRegisterPassword('');
        setConfirmPassword('');
        setRegisterVerificationCode('');
        setRegistrationSent(false);
        setActiveTab('login');
      } else {
        showMessage(data.message || 'Registration failed', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const handleSendResetCode = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, type: 'reset' })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Verification code sent to your email', 'success');
        setResetSent(true);
      } else {
        showMessage(data.message || 'Failed to send code', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const handleVerifyResetCode = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://localhost:5000/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail, code: resetVerificationCode })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Code verified!', 'success');
        setResetCodeVerified(true);
      } else {
        showMessage(data.message || 'Invalid code', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (resetPassword !== confirmResetPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }
    try {
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetEmail,
          verificationCode: resetVerificationCode,
          newPassword: resetPassword
        })
      });
      const data = await response.json();
      if (response.ok) {
        showMessage('Password reset successful! Please login', 'success');
        setResetEmail('');
        setResetVerificationCode('');
        setResetPassword('');
        setConfirmResetPassword('');
        setResetSent(false);
        setResetCodeVerified(false);
        setActiveTab('login');
      } else {
        showMessage(data.message || 'Password reset failed', 'error');
      }
    } catch (error) {
      showMessage('Network error', 'error');
    }
  };

  const renderInput = (label, type, value, onChange, placeholder, props = {}) => (
    <div className="auth-form-group">
      <label>{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...props}
      />
    </div>
  );

  const renderButton = (text, onClick, disabled = false) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className="auth-btn"
    >
      {text}
    </button>
  );

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          Campus Wall
        </div>

        <div className="auth-tabs">
          <button
            onClick={() => setActiveTab('login')}
            className={`auth-tab-btn ${activeTab === 'login' ? 'active' : ''}`}
          >
            Login
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`auth-tab-btn ${activeTab === 'register' ? 'active' : ''}`}
          >
            Sign Up
          </button>
          <button
            onClick={() => setActiveTab('reset')}
            className={`auth-tab-btn ${activeTab === 'reset' ? 'active' : ''}`}
          >
            Reset Password
          </button>
        </div>

        <div className="auth-content">
          {message && (
            <div className={`auth-message ${messageType} show`}>
              {message}
            </div>
          )}

          {activeTab === 'login' && (
            <div>
              {renderInput('Email', 'email', loginEmail, (e) => setLoginEmail(e.target.value), 'Enter your email', { required: true })}
              {renderInput('Password', 'password', loginPassword, (e) => setLoginPassword(e.target.value), 'Enter your password', { required: true })}
              {renderButton('Login', handleLogin)}
            </div>
          )}

          {activeTab === 'register' && (
            <div>
              {renderInput('Username', 'text', registerUsername, (e) => setRegisterUsername(e.target.value), 'Username (3+ characters)', { minLength: 3, required: true })}
              {renderInput('Email', 'email', registerEmail, (e) => setRegisterEmail(e.target.value), 'Email (@illinois.edu)', { required: true })}
              
              {!registrationSent ? (
                renderButton('Send Verification Code', handleSendRegisterCode)
              ) : (
                <>
                  {renderInput('Verification Code', 'text', registerVerificationCode, (e) => setRegisterVerificationCode(e.target.value), 'Enter code from email', { required: true })}
                  {renderInput('Password', 'password', registerPassword, (e) => setRegisterPassword(e.target.value), 'Password (6+ characters)', { minLength: 6, required: true })}
                  {renderInput('Confirm Password', 'password', confirmPassword, (e) => setConfirmPassword(e.target.value), 'Confirm password', { required: true })}
                  {renderButton('Complete Sign Up', handleRegister)}
                </>
              )}
            </div>
          )}

          {activeTab === 'reset' && (
            <div>
              {!resetSent ? (
                <>
                  {renderInput('Email', 'email', resetEmail, (e) => setResetEmail(e.target.value), 'Enter your email', { required: true })}
                  {renderButton('Send Verification Code', handleSendResetCode)}
                </>
              ) : !resetCodeVerified ? (
                <>
                  {renderInput('Email', 'email', resetEmail, (e) => setResetEmail(e.target.value), 'Your email', { disabled: true })}
                  {renderInput('Verification Code', 'text', resetVerificationCode, (e) => setResetVerificationCode(e.target.value), 'Enter code from email', { required: true })}
                  {renderButton('Verify Code', handleVerifyResetCode)}
                </>
              ) : (
                <>
                  {renderInput('Email', 'email', resetEmail, (e) => setResetEmail(e.target.value), 'Your email', { disabled: true })}
                  {renderInput('New Password', 'password', resetPassword, (e) => setResetPassword(e.target.value), 'New password (6+ characters)', { minLength: 6, required: true })}
                  {renderInput('Confirm Password', 'password', confirmResetPassword, (e) => setConfirmResetPassword(e.target.value), 'Confirm password', { required: true })}
                  {renderButton('Reset Password', handleResetPassword)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}