# Rentra - Full Stack Real Estate Application

This is a full-stack real estate web application built with a modern tech stack.

## Tech Stack
-   **Frontend:** React, Vite, React Router, Zustand, Sass, Leaflet (Maps)
-   **Backend (API):** Node.js, Express, Prisma (MongoDB), JWT Authentication
-   **Real-time Communication:** Socket.io

## Project Structure
-   `/client`: Contains the React/Vite frontend application.
-   `/api`: Contains the Node.js/Express REST API backend.
-   `/socket`: Contains the Socket.io server for real-time messaging.

## Getting Started

### Prerequisites
Make sure you have Node.js and npm installed. Check `.env` requirements for the database and other secrets.

### 1. Running the API Server
```bash
cd api
npm install
npm run dev
```

### 2. Running the Frontend Client
```bash
cd client
npm install
npm run dev
```

### 3. Running the Socket Server
```bash
cd socket
npm install
node app.js
```

## Features
-   User Authentication (JWT)
-   Property Listings and Details
-   Real-time Messaging (Socket.io)
-   Interactive Maps (Leaflet)
