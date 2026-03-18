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

import { auth } from '../../lib/firebaseClient';

export class ApiError extends Error {
    status: number;
    code?: string;
    bodyText?: string;
    bodyJson?: unknown;

    constructor(
        message: string,
        { status, code, bodyText, bodyJson }: { status: number; code?: string; bodyText?: string; bodyJson?: unknown }
    ) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
        this.bodyText = bodyText;
        this.bodyJson = bodyJson;
    }
}

function normalizeBaseUrl(url: string): string {
    const trimmed = String(url || '').trim();
    if (!trimmed) return '';
    const noSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
    return noSlash.toLowerCase().endsWith('/api') ? noSlash.slice(0, -4) : noSlash;
}

// If VITE_API_URL is not set, default to same-origin (Vite proxy / production same-origin).
const BASE_URL: string = normalizeBaseUrl(import.meta.env.VITE_API_URL ?? '');

function normalizeApiPath(path: string): string {
    const p = path.startsWith('/') ? path : `/${path}`;
    if (p === '/api' || p.startsWith('/api/')) return p;
    return `/api${p}`;
}

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
        const errorBodyText = await response.text().catch(() => '');
        let errorBodyJson: any = undefined;
        try {
            errorBodyJson = errorBodyText ? JSON.parse(errorBodyText) : undefined;
        } catch {
            errorBodyJson = undefined;
        }

        const message =
            (typeof errorBodyJson?.detail === 'string' && errorBodyJson.detail) ||
            (typeof errorBodyJson?.error === 'string' && errorBodyJson.error) ||
            (typeof errorBodyJson?.message === 'string' && errorBodyJson.message) ||
            `API Error ${response.status} ${response.statusText}`;

        const code = typeof errorBodyJson?.code === 'string' ? errorBodyJson.code : undefined;

        throw new ApiError(message, {
            status: response.status,
            code,
            bodyText: errorBodyText,
            bodyJson: errorBodyJson,
        });
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
    const normalizedPath = normalizeApiPath(path);
    const url = `${BASE_URL}${normalizedPath}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
    };

    let response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401) {
        try {
            if (auth.currentUser) {
                const token = await auth.currentUser.getIdToken(true);
                localStorage.setItem('firebase-id-token', token);
                headers.Authorization = `Bearer ${token}`;
            } else {
                localStorage.removeItem('firebase-id-token');
                delete headers.Authorization;
            }

            response = await fetch(url, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
        } catch {
            localStorage.removeItem('firebase-id-token');
        }
    }

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
