# Indian Bank | Modern Finance & AI

A premium banking simulation with a built-in **Indian Bank AI assistant**, styled with **glassmorphism**, and optimized for **Vercel deployment**.

## Features

- **Core Banking**: Register, Login, JWT Authentication, Balance Check, and P2P Money Transfers.
- **Indian Bank AI**: A smart, floating chat assistant powered by Meta Llama 3.2.
- **Glassmorphism UI**: Premium design aesthetics with blur effects and smooth animations.
- **Deployment Ready**: Fully compatible with Vercel Serverless Functions.

## Tech Stack

- **Frontend**: Vanilla JS, HTML5, CSS3 (Glassmorphism).
- **Backend**: Node.js, Express, `node:sqlite` (SQLite).
- **AI**: Hugging Face Inference API.
- **Deployment**: Vercel.

## Quick Start (Local)

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   Create a `.env` file in the root and add your Hugging Face API key:
   ```env
   HUGGINGFACE_API_KEY=your_key_here
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```
   Open **http://localhost:3000**.

## Deployment (Vercel)

1. **Connect Repository**: Connect your GitHub repo to Vercel.
2. **Set Environment Variables**: Add `HUGGINGFACE_API_KEY` in the Vercel project settings.
3. **Deploy**: Vercel will automatically use the `vercel.json` configuration and Node.js 22 runtime.

> [!IMPORTANT]
> **Data Persistence**: Note that SQLite storage on Vercel is ephemeral (data resets frequently). For persistent production use, migrate to a cloud database like Vercel Postgres.

## API Documentation

| Method | Path           | Auth   | Description                    |
|--------|----------------|--------|--------------------------------|
| POST   | /api/register  | No     | Register (fullName, email, pwd)|
| POST   | /api/login     | No     | Login; sets `bank_token` cookie|
| POST   | /api/chat      | No     | AI Chat Assistant Proxy        |
| GET    | /api/me        | Cookie | Current user profile           |
| GET    | /api/balance   | Cookie | Check Account Balance          |
| POST   | /api/send-money| Cookie | Transfer funds by email        |

---
Developed by Syed Mustafa Muzaffar
