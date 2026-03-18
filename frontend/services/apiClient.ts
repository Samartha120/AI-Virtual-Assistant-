/// <reference types="vite/client" />
/**
 * apiClient.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised HTTP client for all backend REST API calls.
 *
 * Base URL is driven exclusively by the VITE_API_URL environment variable:
 *   • .env          → https://nexsus-ai.onrender.com   (production default)
 *   • .env.local    → http://localhost:5000             (local dev override)
 *
 * Usage:
 *   import { api } from '@/src/services/apiClient';
 *   const data = await api.get('/chat');
 *   const resp = await api.post('/tasks', { title: 'New task' });
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { auth } from '../lib/firebaseClient';

function normalizeBaseUrl(url: string): string {
    const trimmed = url.trim();
    if (!trimmed) return '';
    // Remove trailing slash so `${base}${/path}` doesn't become `//path`.
    return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

// If VITE_API_URL is not set, default to same-origin.
// - Local dev: Vite proxy handles `/api/*`.
// - Backend-served frontend: same-origin works automatically.
const BASE_URL: string = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? '');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
    try {
        if (auth.currentUser) {
            const token = await auth.currentUser.getIdToken();
            localStorage.setItem('firebase-id-token', token);
            return { Authorization: `Bearer ${token}` };
        }
    } catch {
        // Ignore token fetch errors; request will go without auth
    }

    const cachedToken = localStorage.getItem('firebase-id-token');
    return cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
            `API Error ${response.status} ${response.statusText}: ${errorBody}`
        );
    }
    // Return null for 204 No Content responses
    if (response.status === 204) return null as T;
    return response.json() as Promise<T>;
}

// ── Core request helper ───────────────────────────────────────────────────────

async function request<T>(
    method: string,
    path: string,
    body?: unknown
): Promise<T> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const url = `${BASE_URL}${normalizedPath}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
    };

    const response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    return handleResponse<T>(response);
}

// ── Public API object ─────────────────────────────────────────────────────────

export const api = {
    /** GET  /api/<path> */
    get: <T>(path: string) => request<T>('GET', path),

    /** POST /api/<path> with JSON body */
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),

    /** PUT  /api/<path> with JSON body */
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),

    /** PATCH /api/<path> with JSON body */
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),

    /** DELETE /api/<path> */
    delete: <T>(path: string) => request<T>('DELETE', path),
};

/** Convenience: exposes the resolved base URL for debugging */
export const API_BASE_URL = BASE_URL;
