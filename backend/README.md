# NexusAI Enterprise OS - Backend

This backend is built with Node.js, Express, and Supabase. It powers the NexusAI Enterprise OS with features like AI Chat (Gemini), Document Analysis, and Task Management.

## Prerequisites

- Node.js (v18+)
- Supabase Account
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
    - Fill in your Supabase URL, Keys, and Gemini API Key.
    ```bash
    cp .env.example .env
    ```

4.  **Supabase Setup**:
    - Go to your Supabase Dashboard -> SQL Editor.
    - Run the contents of `supabase_setup.sql` to create the necessary tables and policies.
    - Create a storage bucket named `documents` and set it to public or properly authenticated.

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
- `POST /api/auth/signup` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/google` - Google Auth instructions

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

- `config/` - Configuration (Supabase)
- `controllers/` - Route logic
- `middleware/` - Auth and Upload middleware
- `routes/` - API route definitions
- `services/` - External services (Gemini, Supabase)
- `utils/` - Helpers (Response handler)
