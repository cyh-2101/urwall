# UrWall — Universal Campus Wall

UrWall is a **campus wall web application** originally built for **UIUC**, where students can post messages and interact within a campus-wide feed.

This project was developed quickly with the help of **AI-generated code**, so it should be treated as a **prototype / starter template**, not a production-ready system.

The main goal of this repository is to serve as a **forkable template** that can be easily adapted for other universities.

---

## 🌐 Live Demo (UIUC Edition)

Frontend (Vercel):  
👉 https://urwall.vercel.app

---

## 🧠 Project Overview

UrWall consists of two parts:


frontend/   — Next.js + React (UI)
backend/    — Node.js + Express + PostgreSQL (API & Auth)


Core features:
- Campus-wide anonymous message wall
- Email-based verification
- JWT-based authentication
- Simple, extensible backend design

---

## 🚀 Local Development

### 1. Clone the repository

```bash
git clone https://github.com/cyh-2101/urwall.git
cd urwall
````

---

### 2. Backend Setup

#### Install dependencies

```bash
cd backend
npm install
```

#### Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=campus_wall
DB_USER=postgres
DB_PASSWORD=your_db_password

JWT_SECRET=your_jwt_secret

EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password
```

⚠️ **Do not commit `.env` files to GitHub.**

---

#### Start backend server

```bash
npm run dev
```

Backend runs on your configured port (e.g. `http://localhost:3001`).

---

### 3. Frontend Setup

```bash
cd ../frontend
npm install
npm run dev
```

Frontend runs on:
`http://localhost:3000`

---

## 📧 Email Configuration (Gmail App Password)

This project uses **Gmail SMTP with Google App Passwords** to send verification emails.

Google does **not** allow normal Gmail passwords for programmatic access.

### How to configure:

1. Enable **2-Step Verification** on your Google account
   [https://myaccount.google.com/security](https://myaccount.google.com/security)

2. Generate an **App Password**
   [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

   * App: Mail
   * Device: Other

3. Copy the generated **16-character password**

4. Set it in `.env`:

```env
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_16_char_app_password
```

Each fork **must generate its own App Password**.

---

## ☁️ Deployment Guide

### 🔹 Frontend Deployment (Vercel)

The frontend is deployed using **Vercel**.

Steps:

1. Go to [https://vercel.com](https://vercel.com)
2. Log in using your **GitHub account**
3. Import your forked repository
4. Select the `frontend/` directory as the project root
5. Configure environment variables if needed
6. Click **Deploy**

Vercel automatically redeploys on every push.

---

### 🔹 Backend Deployment (Railway)

The backend is deployed using **Railway**.

Steps:

1. Go to [https://railway.app](https://railway.app)
2. Log in using your **GitHub account**
3. Create a new project → Deploy from GitHub repository
4. Select the repository and set root directory to `backend/`
5. Add environment variables in Railway dashboard:

   * DB_HOST
   * DB_PORT
   * DB_NAME
   * DB_USER
   * DB_PASSWORD
   * JWT_SECRET
   * EMAIL_USER
   * EMAIL_PASSWORD
6. Deploy

Railway automatically builds and restarts the backend on updates.

---

## 🏫 Forking for Another University

This repository is designed to be **easily forked** and adapted.

To create a campus wall for another school:

1. Fork this repository
2. Update frontend branding (school name, UI text, colors)
3. Adjust email rules if needed (e.g. domain restrictions)
4. Configure your own database and email credentials
5. Deploy frontend (Vercel) and backend (Railway)

Each fork should use **its own credentials and database**.

---

## ⚠️ Disclaimer

* This project was built rapidly with AI assistance
* Code quality and security have **not been production-hardened**
* Review authentication, rate limiting, and input validation before real-world use

---

## 📜 License

MIT License

---

## 🙌 Contributing

Issues and pull requests are welcome, especially improvements in:

* Security
* UI/UX
* Moderation tools
* Performance
