# NexusAI Enterprise OS - Backend

This backend is built with Node.js and Express, using Firebase Admin SDK for authentication verification, Firestore for data, and Firebase Storage for uploads. It powers the NexusAI Enterprise OS with features like AI Chat (Gemini), Document Analysis, and Task Management.

## Prerequisites

- Node.js (v18+)
- Firebase project (Firestore + Authentication + Storage enabled)
- Google Cloud Account (for Gemini API)

## Setup

1.  **Clone the repository** (if you haven't already).
2.  **Install dependencies**:
    ```bash
    cd backend
    npm install
    ```
3.  **Environment Variables**:
    - Copy `.env.example` to `.env`.
    - Fill in your Firebase Admin credentials and Gemini API Key.
    ```bash
    cp .env.example .env
    ```

4.  **Firebase Setup**:
    - Enable **Authentication** (Email/Password).
    - Enable **Firestore**.
    - Enable **Storage** (optional if you use uploads).
    - Create a service account and set:
      - `FIREBASE_PROJECT_ID`
      - `FIREBASE_CLIENT_EMAIL`
      - `FIREBASE_PRIVATE_KEY`

## Running the Server

-   **Development**:
    ```bash
    npm run dev
    ```
-   **Production**:
    ```bash
    npm start
    ```

## API Endpoints

### Auth
- Auth is handled on the frontend via Firebase Client SDK.
- Protected endpoints require `Authorization: Bearer <Firebase ID token>`.

### AI Chat
- `POST /api/ai/chat` - Send message to Gemini
- `GET /api/ai/history` - Get chat history
- `DELETE /api/ai/history` - Clear chat history

### Files
- `POST /api/files/upload` - Upload document

### Settings
- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update user settings

## Project Structure

- `config/` - Configuration (Firebase Admin)
- `controllers/` - Route logic
- `middleware/` - Auth and Upload middleware
- `routes/` - API route definitions
- `services/` - External services (Gemini, Firestore service)
- `utils/` - Helpers (Response handler)
