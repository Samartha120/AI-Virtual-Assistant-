# Firebase Data Storage (Auth + Firestore + Storage)

This project uses Firebase in two ways:

1) **Frontend (browser) Firebase Client SDK**
- Auth state is managed in the browser.
- Some data is read/written directly to Firestore from the client.

2) **Backend (Node/Express) Firebase Admin SDK**
- Verifies Firebase ID tokens on API requests.
- Reads/writes some Firestore collections on behalf of the user.
- Uploads files to the project’s Cloud Storage bucket.

---

## Firebase Auth

### Frontend initialization
- Firebase is initialized in [frontend/lib/firebaseClient.ts](../frontend/lib/firebaseClient.ts).
- Config is read from environment variables (Vite injects these at build-time):
  - `NEXT_PUBLIC_FIREBASE_API_KEY`
  - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
  - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
  - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
  - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
  - `NEXT_PUBLIC_FIREBASE_APP_ID`

### Auth persistence
- The frontend sets Firebase Auth persistence to `browserLocalPersistence`.
  - Practically: the user stays signed in across browser restarts (unless explicitly signed out).

### ID token caching for backend API calls
- The frontend caches the current Firebase **ID token** in `localStorage` under:
  - `firebase-id-token`
- This token is attached to backend requests as `Authorization: Bearer <token>` by:
  - [frontend/services/apiClient.ts](../frontend/services/apiClient.ts)
- The token is also refreshed and re-cached when possible by the Zustand auth listener:
  - [frontend/store/useStore.ts](../frontend/store/useStore.ts)

Backend verification:
- The backend verifies the bearer token with `adminAuth.verifyIdToken(token)`:
  - [backend/middleware/authMiddleware.js](../backend/middleware/authMiddleware.js)

---

## Firestore data model

There are **two Firestore “schemas” in use**:

- **Client-side per-user subcollections** under `users/{uid}/...` (camelCase fields)
- **Backend-side top-level collections** (snake_case fields + explicit `user_id`)

Important: some names exist in **both** styles (for example `tasks` and `knowledge_base`).
- Frontend: `users/{uid}/tasks`, `users/{uid}/knowledge_base`
- Backend: `tasks`, `knowledge_base`
They are different collection paths and store different document shapes.

### A) Client-side per-user subcollections (frontend)

These are accessed via the Firebase Client SDK (`firebase/firestore`) from the browser.

#### `users/{uid}/tasks`
Used by:
- [frontend/services/firestoreService.ts](../frontend/services/firestoreService.ts)

Queries:
- `orderBy('order', 'asc')`

Document fields written:
- `title`: string
- `status`: `'todo' | 'in-progress' | 'done'`
- `priority`: `'low' | 'medium' | 'high' | 'critical'`
- `deadline`: string | null
- `order`: number
- `createdAt`: Firestore server timestamp
- `updatedAt`: Firestore server timestamp

#### `users/{uid}/knowledge_base`
Used by:
- [frontend/services/firestoreService.ts](../frontend/services/firestoreService.ts)
- (duplicate helpers also exist in) [frontend/src/services/firestoreService.ts](../frontend/src/services/firestoreService.ts)

Queries:
- `orderBy('createdAt', 'desc')`

Document fields written:
- `title`: string
- `content`: string
- `type`: `'text' | 'research' | 'meeting'`
- `createdAt`: Firestore server timestamp
- `updatedAt`: Firestore server timestamp

#### `users/{uid}/goals`
Used by:
- [frontend/src/services/firestoreService.ts](../frontend/src/services/firestoreService.ts)

Queries:
- `orderBy('updatedAt', 'desc')`

Document fields written:
- `title`: string
- `description`: string
- `category`: `'work' | 'personal' | 'health' | 'learning'`
- `deadline`: string
- `keyResults`: array of objects (nested tasks allowed)
- `archived`: boolean
- `createdAt`: Firestore server timestamp
- `updatedAt`: Firestore server timestamp

#### `ai_interactions` (top-level)
Used by:
- [frontend/services/interactionService.ts](../frontend/services/interactionService.ts)
- Backend also logs these interactions for AI endpoints:
  - [backend/routes/ai.routes.js](../backend/routes/ai.routes.js)

Write pattern:
- Fire-and-forget logging (skips write if no authenticated user)

Document fields written:
- `userId`: string (Firebase Auth UID)
- `module`: string (e.g. `"Neural Chat"`, `"Doc Analyzer"`)
- `prompt`: string
- `response`: string
- `createdAt`: Firestore server timestamp

Additional fields written by the backend logger:
- `endpoint`: string | null (e.g. `/api/chat`, `/api/analyze`)
- `meta`: object | null (e.g. `{ action: 'decompose' }`)
- `source`: `'backend'` (lets you distinguish server logs)

---

### B) Backend-managed collections (Admin SDK)

These are accessed from the server via the Firebase Admin SDK (`firebase-admin/firestore`).

Collections are defined in:
- [backend/services/firebase.service.js](../backend/services/firebase.service.js)

#### `chat_messages`
Used by:
- [backend/controllers/chatController.js](../backend/controllers/chatController.js)
- [backend/routes/ai.routes.js](../backend/routes/ai.routes.js) (when a valid Firebase ID token is present, `/api/chat` will also append to history)

Document fields written:
- `user_id`: string (Firebase Auth UID)
- `role`: `'user' | 'assistant'`
- `content`: string
- `created_at`: Firestore server timestamp

Query pattern:
- `where('user_id', '==', userId).orderBy('created_at', 'asc').limit(N)`

#### `tasks`
Used by:
- [backend/controllers/tasksController.js](../backend/controllers/tasksController.js)

Document fields written:
- `user_id`: string
- `title`: string
- `description`: string
- `status`: string (defaults to `"todo"`)
- `priority`: string (defaults to `"medium"`)
- `due_date`: ISO string | null
- `created_at`: Firestore server timestamp
- `updated_at`: Firestore server timestamp (on updates)

Query pattern:
- `where('user_id', '==', userId).orderBy('created_at', 'desc')`

#### `knowledge_base`
Used by:
- [backend/controllers/knowledgeController.js](../backend/controllers/knowledgeController.js)

Document fields written:
- `user_id`: string
- `title`: string
- `content`: string
- `type`: string (defaults to `"text"`)
- `tags`: string[]
- `file_url`: string | null
- `created_at`: Firestore server timestamp

Query pattern:
- `where('user_id', '==', userId).orderBy('created_at', 'desc')`

#### `settings`
Used by:
- [backend/controllers/settingsController.js](../backend/controllers/settingsController.js)

Document ID:
- `settings/{userId}` (document ID is the Firebase UID)

Document fields written:
- Arbitrary settings blob (merged)
- `user_id`: string
- `created_at`: Firestore server timestamp
- `updated_at`: Firestore server timestamp

---

## Cloud Storage (file uploads)

- The backend uploads to the project’s default bucket using Admin SDK:
  - [backend/controllers/fileController.js](../backend/controllers/fileController.js)

Object path format:
- `<uid>/<timestamp>.<ext>`

Upload metadata:
- Includes `firebaseStorageDownloadTokens` in custom metadata.

Returned to the client:
- The backend generates and returns a **signed URL** valid for ~1 hour.

---

## Browser localStorage (non-Firebase persistence)

In addition to Firebase’s own auth persistence, the app also stores some UI/app data in `localStorage`:

### Auth/UI keys
- `firebase-id-token` (cached Firebase ID token used for backend API requests)
- `nexus-theme` (UI theme)
- `nexus-known-accounts` (list of previously used accounts)
- `nexus:lastEmail` (last used email on auth screen)
- `nexus:emailVerifySendHistory` (verify-email page rate-limit tracking)
- `nexus:otpSendHistory` (phone verification rate-limit tracking)

### Feature caching keys
These are simple JSON caches (not Firestore):
- `nexus_tasks`
- `nexus_knowledge`
- `nexus_ideas`

Implementation:
- [frontend/services/storageService.ts](../frontend/services/storageService.ts)

---

## Notes / gotchas

- **Duplicate Firestore helpers:** there are two similar modules:
  - [frontend/services/firestoreService.ts](../frontend/services/firestoreService.ts)
  - [frontend/src/services/firestoreService.ts](../frontend/src/services/firestoreService.ts)
  They both implement Knowledge Base helpers, but only `frontend/src/...` contains Goals.

- **Potential Firestore indexes:** queries that combine `where(user_id == ...)` with `orderBy(created_at)` may require composite indexes (Firestore will prompt in logs/console if missing).
