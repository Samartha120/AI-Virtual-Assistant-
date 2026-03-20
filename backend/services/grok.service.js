const { OpenAI } = require('openai');
const dotenv = require('dotenv');

dotenv.config();

const GROK_KEY = (process.env.GROK_API_KEY || '').trim();

function detectKeyType(key) {
    const k = String(key || '').trim();
    if (!k) return 'missing';
    // Google API keys (often used for Firebase client config) commonly start with "AIza".
    if (/^AIza[0-9A-Za-z\-_]{20,}$/i.test(k)) return 'google';
    // Groq keys commonly start with "gsk_".
    if (/^gsk_/i.test(k)) return 'groq';
    // xAI/Grok keys do not have a universally-stable prefix across accounts.
    return 'unknown';
}

const GROK_KEY_TYPE = detectKeyType(GROK_KEY);
function computeBaseUrl() {
    const explicit = (process.env.GROK_BASE_URL || '').trim();
    if (explicit) return explicit;

    // Heuristic: keys starting with "gsk_" are commonly Groq API keys.
    // If the user provided such a key but didn't set a base URL, assume Groq.
    if (/^gsk_/i.test(GROK_KEY)) return 'https://api.groq.com/openai/v1';

    // Default: xAI (Grok)
    return 'https://api.x.ai/v1';
}

const GROK_BASE_URL = computeBaseUrl();
const GROK_MODEL = (process.env.GROK_MODEL || '').trim();

function getProviderName(baseUrl) {
    const u = String(baseUrl || '').toLowerCase();
    if (u.includes('groq.com')) return 'groq';
    if (u.includes('x.ai')) return 'xai';
    return 'openai-compatible';
}

const PROVIDER = getProviderName(GROK_BASE_URL);

class GrokError extends Error {
    constructor(message, { status = 500, code = 'GROK_ERROR', detail } = {}) {
        super(message);
        this.name = 'GrokError';
        this.status = status;
        this.code = code;
        this.detail = detail;
    }
}

function requireGrokKey() {
    if (!GROK_KEY) {
        throw new GrokError('GROK_API_KEY is missing from environment variables', {
            status: 500,
            code: 'GROK_KEY_MISSING',
        });
    }

    // Catch common misconfiguration: Firebase/Google web API key pasted into GROK_API_KEY.
    if (GROK_KEY_TYPE === 'google') {
        throw new GrokError(
            'GROK_API_KEY appears to be a Google/Firebase API key (starts with "AIza"). Set this to your xAI (Grok) key or a Groq key instead.',
            {
                status: 500,
                code: 'GROK_KEY_SUSPECT',
                detail: { keyPreview: `${GROK_KEY.slice(0, 8)}...`, keyType: GROK_KEY_TYPE },
            }
        );
    }
}

// Grok API (xAI) uses OpenAI-compatible endpoints
const openai = new OpenAI({
    apiKey: GROK_KEY || 'missing',
    baseURL: GROK_BASE_URL,
    timeout: 30000, // 30 seconds timeout
    maxRetries: 2,
});

let resolvedModel = null;
let resolvingModelPromise = null;

async function resolveModel() {
    // Respect explicit override if present
    if (GROK_MODEL) return GROK_MODEL;
    if (resolvedModel) return resolvedModel;
    if (resolvingModelPromise) return resolvingModelPromise;

    const preferred =
        PROVIDER === 'groq'
            ? [
                  // Common Groq-hosted models (OpenAI-compatible)
                  'llama-3.3-70b-versatile',
                  'llama-3.1-70b-versatile',
                  'llama3-70b-8192',
                  'mixtral-8x7b-32768',
              ]
            : [
                  // xAI Grok model names (may vary by account/availability)
                  'grok-2-latest',
                  'grok-2',
                  'grok-1',
                  'grok-beta',
              ];

    resolvingModelPromise = (async () => {
        try {
            const list = await openai.models.list();
            const ids = Array.isArray(list?.data) ? list.data.map((m) => m?.id).filter(Boolean) : [];
            const chosen = preferred.find((p) => ids.includes(p)) || ids.find((id) => /^grok/i.test(id)) || ids[0];
            const defaultModel = PROVIDER === 'groq' ? preferred[0] : 'grok-2-latest';
            resolvedModel = chosen || defaultModel;
            console.info('[grok] model_resolved', { provider: PROVIDER, model: resolvedModel, count: ids.length });
            return resolvedModel;
        } catch (err) {
            const status = err?.status;
            const message = typeof err?.message === 'string' ? err.message : '';

            // If the key is invalid/unauthorized, fail fast so callers get a clear 401.
            if (status === 401 || status === 403 || (status === 400 && /incorrect api key provided/i.test(message))) {
                console.error('[grok] auth_failure during model discovery', message);
                throw mapOpenAIError(err);
            }

            // If model discovery fails for other reasons, default to a commonly-accepted name.
            resolvedModel = PROVIDER === 'groq' ? preferred[0] : 'grok-2-latest';
            console.warn('[grok] model_resolve_failed; defaulting', {
                provider: PROVIDER,
                model: resolvedModel,
                status,
                message,
            });
            return resolvedModel;
        } finally {
            resolvingModelPromise = null;
        }
    })();

    return resolvingModelPromise;
}

function normalizeHistory(historyLines) {
    if (!Array.isArray(historyLines)) return [];
    return historyLines
        .filter((m) => m && typeof m === 'object')
        .map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: typeof m.content === 'string' ? m.content : '',
        }))
        .filter((m) => m.content.trim().length > 0);
}

function getSafeErrorDetail(err) {
    if (!err) return undefined;
    return {
        message: err.message,
        status: err.status,
        code: err.code,
        type: err.type,
        name: err.name,
    };
}

function mapOpenAIError(err) {
    const status = err?.status;
    const message = typeof err?.message === 'string' ? err.message : '';

    // Some upstreams (or SDK surfaces) return a 400 for invalid keys.
    if (status === 400 && /incorrect api key provided/i.test(message)) {
        return new GrokError('Invalid Grok API key', {
            status: 401,
            code: 'GROK_AUTH_INVALID',
            detail: getSafeErrorDetail(err),
        });
    }
    if (status === 401 || status === 403) {
        return new GrokError('Invalid Grok API key', {
            status: 401,
            code: 'GROK_AUTH_INVALID',
            detail: getSafeErrorDetail(err),
        });
    }
    if (status === 429) {
        return new GrokError('Grok API rate limit exceeded', {
            status: 429,
            code: 'GROK_RATE_LIMIT',
            detail: getSafeErrorDetail(err),
        });
    }
    if (typeof status === 'number' && status >= 500) {
        return new GrokError('Grok API upstream error', {
            status: 502,
            code: 'GROK_UPSTREAM',
            detail: getSafeErrorDetail(err),
        });
    }

    return new GrokError('Failed to call Grok API', {
        status: 500,
        code: 'GROK_REQUEST_FAILED',
        detail: getSafeErrorDetail(err),
    });
}

// Helper for generic completions
const callGrok = async (systemPrompt, userText, historyLines = [], { signal } = {}) => {
    try {
        requireGrokKey();
    } catch (err) {
        console.error('[grok] key_error', err.message);
        throw err;
    }

    let model;
    try {
        model = await resolveModel();
    } catch (err) {
        console.error('[grok] resolve_model_error', err.message);
        throw err;
    }

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push(...normalizeHistory(historyLines));
    messages.push({ role: 'user', content: userText });

    const startedAt = Date.now();
    console.info('[grok] request', {
        provider: PROVIDER,
        model,
        baseURL: GROK_BASE_URL,
        userChars: typeof userText === 'string' ? userText.length : 0,
        historyCount: Array.isArray(historyLines) ? historyLines.length : 0,
    });

    try {
        const response = await openai.chat.completions.create(
            {
                model,
                messages,
                temperature: 0.6,
            },
            { signal }
        );

        const text = response?.choices?.[0]?.message?.content ?? '';
        const elapsedMs = Date.now() - startedAt;

        console.info('[grok] response', {
            elapsedMs,
            hasText: Boolean(text && text.trim()),
            usage: response?.usage,
        });

        if (!text || !text.trim()) {
            throw new GrokError('Empty response from Grok API', {
                status: 502,
                code: 'GROK_EMPTY_RESPONSE',
            });
        }

        return text;
    } catch (err) {
        const mapped = err instanceof GrokError ? err : mapOpenAIError(err);
        console.error('[grok] error', mapped.code, mapped.status, mapped.detail || getSafeErrorDetail(err));
        throw mapped;
    }
};

const streamGrok = async function* (systemPrompt, userText, historyLines = [], { signal } = {}) {
    try {
        requireGrokKey();
    } catch (err) {
        console.error('[grok] stream_key_error', err.message);
        throw err;
    }

    let model;
    try {
        model = await resolveModel();
    } catch (err) {
        console.error('[grok] stream_resolve_model_error', err.message);
        throw err;
    }

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push(...normalizeHistory(historyLines));
    messages.push({ role: 'user', content: userText });

    const startedAt = Date.now();
    console.info('[grok] stream_request', {
        provider: PROVIDER,
        model,
        userChars: typeof userText === 'string' ? userText.length : 0,
        historyCount: Array.isArray(historyLines) ? historyLines.length : 0,
    });

    let sawAny = false;
    try {
        const stream = await openai.chat.completions.create(
            {
                model,
                messages,
                temperature: 0.6,
                stream: true,
            },
            { signal }
        );

        for await (const event of stream) {
            const delta = event?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta.length > 0) {
                sawAny = true;
                yield delta;
            }
        }

        const elapsedMs = Date.now() - startedAt;
        console.info('[grok] stream_done', { elapsedMs, sawAny });
        if (!sawAny) {
            throw new GrokError('Empty streamed response from Grok API', {
                status: 502,
                code: 'GROK_EMPTY_STREAM',
            });
        }
    } catch (err) {
        const mapped = err instanceof GrokError ? err : mapOpenAIError(err);
        console.error('[grok] stream_error', mapped.code, mapped.status, mapped.detail || getSafeErrorDetail(err));
        throw mapped;
    }
};

const SYSTEM_PROMPT = `You are NexusAI, an intelligent enterprise AI assistant. Be helpful, accurate, and concise.`;

// ─── Chat ─────────────────────────────────────────────────────────────────────
const generateGrokResponse = async (message, history = []) => {
    return callGrok(SYSTEM_PROMPT, message, history);
};

const streamGrokResponse = async (message, history = [], { signal } = {}) => {
    return streamGrok(SYSTEM_PROMPT, message, history, { signal });
};

// ─── Brainstorm Ideas ─────────────────────────────────────────────────────────
const brainstormIdeas = async (topic) => {
    const prompt = `Generate 7 innovative, actionable ideas for: "${topic}".\nReturn each idea on a new line prefixed with a number (e.g. "1. Idea here").`;
    try {
        return await callGrok(SYSTEM_PROMPT, prompt);
    } catch (err) {
        console.error('[grok] brainstorm_error', err.message);
        throw err;
    }
};

const cleanJsonResponse = (text) => {
    if (!text) return '';
    // Remove markdown code fences
    let cleaned = text.replace(/```json\s*/i, '').replace(/```\s*/i, '').replace(/\s*```/g, '').trim();
    
    // If there's still text before/after the JSON, try to find the actual JSON object/array
    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');
    const lastBrace = cleaned.lastIndexOf('}');
    const lastBracket = cleaned.lastIndexOf(']');
    
    let start = -1;
    let end = -1;
    
    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
        start = firstBrace;
        end = lastBrace;
    } else if (firstBracket !== -1) {
        start = firstBracket;
        end = lastBracket;
    }
    
    if (start !== -1 && end !== -1 && end > start) {
        cleaned = cleaned.substring(start, end + 1);
    }
    
    return cleaned;
};

// ─── Analyze Document ─────────────────────────────────────────────────────────
const analyzeDocument = async (text) => {
    const prompt = `Analyze the following content and return a JSON object with exactly these fields:
- "summary": A 3-sentence executive summary (string)
- "keyPoints": Array of 4-6 critical insights (array of strings)
- "actionItems": Array of 3-5 next steps (array of strings)

IMPORTANT: Return ONLY valid JSON. No markdown, no code fences, no introductory text.

Content:
${text.slice(0, 8000)}`;
    const result = await callGrok(SYSTEM_PROMPT, prompt);
    return cleanJsonResponse(result);
};

// ─── Task Analysis ────────────────────────────────────────────────────────────
const generateTaskAnalysis = async (taskStr) => {
    const prompt = `As a project manager, provide a concise strategic plan (3-5 sentences) for these tasks. Prioritize by impact and urgency.\n\nTasks: ${taskStr}`;
    return callGrok(SYSTEM_PROMPT, prompt);
};

// ─── Decompose Task ─────────────────────────────────────────────────────────
const decomposeTask = async (taskTitle) => {
    const prompt = `Break down this task into 3-5 actionable subtasks. Return ONLY a JSON array where each item has "title" (string) and "priority" ("low"|"medium"|"high"). No markdown, no extra text.\n\nTask: ${taskTitle}`;
    const result = await callGrok(SYSTEM_PROMPT, prompt);
    return cleanJsonResponse(result);
};

// ─── Vision Analysis ──────────────────────────────────────────────────────────
const analyzeImage = async (base64Image, prompt = "Describe this image in detail and extract any text you see.") => {
    try {
        requireGrokKey();
    } catch (err) {
        console.error('[grok-vision] key_error', err.message);
        throw err;
    }

    // Heuristic: Prefer grok-2-vision or llama-3.2-11b-vision
    const model = PROVIDER === 'groq' ? 'llama-3.2-11b-vision-preview' : 'grok-2-vision-1212';
    
    console.info('[grok-vision] request', {
        provider: PROVIDER,
        model,
        imageSize: base64Image.length
    });

    try {
        const response = await openai.chat.completions.create({
            model,
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: prompt },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 1024,
        });

        return response.choices[0].message.content;
    } catch (err) {
        console.error('[grok-vision] error', err.message);
        throw mapOpenAIError(err);
    }
};

module.exports = {
    generateGrokResponse: async (text, history) => callGrok(null, text, history),
    streamGrokResponse: streamGrok,
    brainstormIdeas,
    analyzeDocument,
    generateTaskAnalysis,
    decomposeTask,
    analyzeImage, // Export new vision function
};
