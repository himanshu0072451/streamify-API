# Streamify API

A powerful Node.js API that fetches songs using **yt-dlp** and **Spotify**, featuring a smart recommendation system based on genre, trends, and user behavior. Built for speed, flexibility, and music discovery.

---

## 📑 Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributors](#contributors)
- [License](#license)

---

## 🚀 Features

- 🎵 Fetch songs using YouTube and Spotify
- 📈 Trending music endpoint
- 🔍 Search capability for tracks and artists
- 🧠 Genre- and behavior-based recommendations
- ⚡ Redis for caching
- 🛠 Modular architecture for easy extensibility

---

## 🛠 Installation

```bash
# Clone the repo
git clone https://github.com/your-username/streamify-API.git
cd streamify-API

# Install dependencies
npm install
```

---

## ▶️ Usage

```bash
# Start the development server
npm run dev
```

Make sure your `.env` file is correctly set up before starting the server.

---

## 🌐 API Endpoints

| Endpoint           | Method | Description                        |
|--------------------|--------|------------------------------------|
| `/search`          | GET    | Search for music on Spotify        |
| `/getmp3`         | GET    | Fetch MP3 using YouTube            |
| `/trending`        | GET    | Get trending music recommendations |

---

## 🔐 Environment Variables

Create a `.env` file in the root directory and add the following:

```env
PORT=5000
YOUTUBE_API_KEY=your_youtube_api_key
REDIS_URL=your_redis_url
MONGO_URI=your_mongo_uri
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
SPOTIFY_REFRESH_TOKEN=your_spotify_refresh_token
AUTH_CODE=your_auth_code
```

---

## 🗂 Project Structure

```
streamify-API/
│
├── config/               # Database config
├── controllers/          # Route logic
├── middleware/           # Token middleware
├── models/               # Mongoose schemas
├── routes/               # API routes
├── services/             # Spotify, YouTube, Redis integration
├── utils/                # Helper functions and token handlers
├── server.js             # Entry point
├── package.json          # Project metadata and scripts
└── .env                  # Environment configuration
```

---

## 🧩 Troubleshooting

- **Invalid Token**: Double-check your Spotify refresh token and client credentials.
- **Redis errors**: Ensure your `REDIS_URL` is valid and Redis is running.
- **Missing MP3s**: YouTube video may be unavailable or region-restricted.

---

## 👥 Contributors

- **Himanshu** — Developer & Maintainer

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
