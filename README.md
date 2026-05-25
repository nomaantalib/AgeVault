# 🛡️ AgeVault — Premium Decentralized Age Verification & Gatekeeping System

<div align="center">
  <img src="https://img.shields.io/badge/Aesthetics-Glassmorphism-6366f1?style=for-the-badge&logo=css3" alt="Aesthetics Glassmorphism" />
  <img src="https://img.shields.io/badge/AI_Face_Screening-40%25_Likeness-emerald?style=for-the-badge&logo=tensorflow" alt="AI Match Score" />
  <img src="https://img.shields.io/badge/Authentication-Resend_Email_OTP-FF69B4?style=for-the-badge&logo=auth0" alt="Auth Resend" />
  <img src="https://img.shields.io/badge/Database-MongoDB_Atlas-47a248?style=for-the-badge&logo=mongodb" alt="Database MongoDB" />
</div>

---

## 🌟 Overview
**AgeVault** is a state-of-the-art, premium age verification and access control platform designed for nightlife and entertainment venues requiring strict 18+ gatekeeping with frictionless entry. 

Rather than relying on third-party identity providers, AgeVault processes all sensitive document analysis and face screening locally in the customer's browser, matching it with a secure database for verification.

The platform is optimized for 5 of the most exclusive clubs:
1. **The Palace Lounge**
2. **Hype Nightclub**
3. **Mirage Club & Garden**
4. **Decibel Arena**
5. **Vibe Superclub**

---

## 🛠️ The Architecture & Technology Stack

AgeVault employs a robust, modern monorepo layout separating frontend and backend operations cleanly:

### 1. Frontend UI/UX (Vite + React)
*   **Vite + React SPA**: High-performance client-side Single Page Application.
*   **Aesthetics (Nightclub Theme)**: Electric violet, pink neon accents, frosted glass cards (glassmorphism), animated background orbs, glowing inputs, and active-state animations.
*   **Client-Side AI/ML**:
    *   `@vladmandic/face-api`: High-performance in-browser facial recognition, verification, and likeness matching (configured with a robust **40% similarity threshold** for optimal matching in low-light environments).
    *   `tesseract.js`: Browser-based OCR scanner that extracts and parses Dates of Birth from identity documents locally to respect user privacy.
*   **Access Control**: Interactive QR code generator (`qrcode.react`) to present a secure, scanned pass upon verification.

### 2. Backend Services (Express + Node.js)
*   **Express & Node.js REST API**: Backend server handling business logic, user profiles, event scheduling, and analytics.
*   **MongoDB Atlas (Mongoose ODM)**: The single source of truth database holding user profiles, verification logs, scheduled events, and active OTP checkins.
*   **Rotational Resend Mail Pool (Failover Core)**:
    *   Integrates a pool of **7 Resend API key instances** loaded from environment variables (`RESEND_API_KEY_1` to `RESEND_API_KEY_7`).
    *   Maintains a global tracker index. If an API key throws a quota or rate-limit error, the server immediately redirects to the next instance. This failover loop completely prevents site crashes during high-traffic authentication loads.
*   **Security & Custom JWT**: Express generates and issues secure JWT tokens locally upon successful OTP matches, keeping all session signatures completely inside your database ecosystem.

---

## 💾 Data Locations Guide — Where is Data Stored?

To monitor, audit, and verify database privacy, here is where user, auth, and image data is stored:

### 1. 🟢 MongoDB Atlas (Application Database)
*   **`users` collection**: Stores full member details, including phone numbers, emails, names, parsed Date of Birth (`dob`), computed ages, verification status (`pending`, `verified`, `rejected`), assigned target `club`, facial likeness scores, and generated QR keys.
*   **`events` collection**: Stores venue event schedules (`title`, `dateTime`, `venue`, `description`, `club`), automatically compressing past logs to conserve space.
*   **Temporary OTPs**: Verified 6-digit verification codes and 10-minute expiry timestamps are stored temporarily in the user's document for secure check-ins.

### 2. ☁️ Media Uploads (Cloudinary & Local Storage)
To keep the MongoDB Atlas Free Tier database footprint lightweight:
*   Large images (ID documents, selfie captures) are **never** stored inside MongoDB.
*   Instead, images are uploaded directly to **Cloudinary** (or saved in a compressed format inside the `/uploads` directory on the server).
*   Only the secure, public HTTPS image URL strings (e.g., `idCardUrl` and `selfieUrl`) are saved inside the user's MongoDB profile.

---

## 🚀 Setup & Installation Guide

Follow these steps to run the application locally:

### 1. Install Dependencies
Run from the root directory:
```bash
npm run install-all
```
This runs parallel package installations inside both the `frontend` and `backend` directories.

### 2. Model Weights Setup
Download the pre-trained neural network weights for face detection:
```bash
npm run download-models
```
*This downloads the required SSD MobileNet, Face Landmark, and Face Recognition weights to `frontend/public/models` automatically.*

### 3. Environment Variables Config
Create your local environment files:

*   **Backend (`backend/.env`)**:
    ```env
    PORT=5000
    MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/agevault
    JWT_SECRET=your_jwt_signing_key_secret_key
    CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
    CLOUDINARY_API_KEY=your_cloudinary_api_key
    CLOUDINARY_API_SECRET=your_cloudinary_api_secret
    
    # Resend Failover Keys
    RESEND_API_KEY_1=your_resend_api_key_1_here
    RESEND_API_KEY_2=your_resend_api_key_2_here
    RESEND_API_KEY_3=your_resend_api_key_3_here
    RESEND_API_KEY_4=your_resend_api_key_4_here
    RESEND_API_KEY_5=your_resend_api_key_5_here
    RESEND_API_KEY_6=your_resend_api_key_6_here
    RESEND_API_KEY_7=your_resend_api_key_7_here
    
    USE_SIMULATED_OTP=false
    ```

*   **Frontend (`frontend/.env`)**:
    ```env
    VITE_API_URL=http://localhost:5000
    ```

### 4. Run Development Servers
Start both servers simultaneously to test local changes:
*   **Backend**: `cd backend && npm run dev` (Runs on port `5000`)
*   **Frontend**: `cd frontend && npm run dev` (Runs on port `5173`)

---

## 🧹 Maintenance & Storage Protection
To ensure your database stays safely within MongoDB Atlas free tier capacities, follow this simple maintenance workflow inside the **Admin Portal > Database Operations**:
1.  Filter to your club or select **All 5 Clubs**.
2.  Click **1. Download CSV Export** to save the active log records to your offsite Excel sheet.
3.  Once the download completes, the delete mechanism automatically unlocks. Click **2. Clear User Database** to safely wipe user profiles while leaving gatekeeper and system admin accounts intact.

---

<div align="center">
  <sub>Developed with 🤍 for secure gatekeeping and premium venue access control.</sub>
</div>
