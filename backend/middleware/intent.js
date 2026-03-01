/**
 * Intent Detection Middleware
 * ----------------------------
 * Analyzes the incoming user message and classifies it into a structured intent.
 * Attaches `req.intent` to the request so downstream controllers can act on it.
 *
 * Intent shape:
 * {
 *   type: string,       // e.g. 'create_task', 'chat', 'knowledge_query', ...
 *   confidence: number, // 0–1
 *   entities: object    // extracted key data from the message
 * }
 *
 * Detection Strategy: Keyword / regex-based (no extra API call required).
 * Extend the INTENT_PATTERNS array to add more intents.
 */

// ─── Intent Pattern Definitions ────────────────────────────────────────────────

const INTENT_PATTERNS = [
    // ── Task intents ──────────────────────────────────────────────────────────
    {
        type: 'create_task',
        confidence: 0.9,
        patterns: [
            /\b(create|add|make|set up|schedule|remind me (to|about))\b.{0,40}\b(task|todo|reminder|to-do)\b/i,
            /\b(i need to|don[''`]?t forget to|remember to)\b/i,
        ],
        extractEntities: (message) => ({
            rawMessage: message
        })
    },
    {
        type: 'list_tasks',
        confidence: 0.9,
        patterns: [
            /\b(show|list|get|what are|fetch|display)\b.{0,30}\b(my\s+)?(tasks?|todos?|reminders?|to-dos?)\b/i,
            /\bwhat (do i have|tasks are)\b/i,
        ],
        extractEntities: () => ({})
    },
    {
        type: 'complete_task',
        confidence: 0.85,
        patterns: [
            /\b(mark|set|complete|finish|done|close)\b.{0,30}\b(task|todo|reminder)\b/i,
            /\btask.{0,30}\b(as done|completed|finished)\b/i,
        ],
        extractEntities: (message) => ({
            rawMessage: message
        })
    },

    // ── Knowledge Base intents ────────────────────────────────────────────────
    {
        type: 'knowledge_query',
        confidence: 0.85,
        patterns: [
            /\b(what (is|are|do you know about)|tell me about|explain|describe|define|search (for|my))\b/i,
            /\b(look up|find|retrieve).{0,30}\b(knowledge|info|information|notes?|docs?|document)\b/i,
        ],
        extractEntities: (message) => {
            // Try to extract a topic from common "what is X" / "tell me about X" structures
            const topic = message
                .replace(/^(what (is|are)|tell me about|explain|describe|define)\s+/i, '')
                .replace(/\?$/, '')
                .trim();
            return { topic };
        }
    },
    {
        type: 'save_knowledge',
        confidence: 0.85,
        patterns: [
            /\b(save|store|remember|add|note down|keep a note of)\b.{0,30}\b(this|that|following|note|info|information|knowledge)\b/i,
            /\b(add|save).{0,20}\b(to (my\s+)?(knowledge base|notes?|docs?))\b/i,
        ],
        extractEntities: (message) => ({
            rawMessage: message
        })
    },

    // ── File / Document intents ───────────────────────────────────────────────
    {
        type: 'file_query',
        confidence: 0.85,
        patterns: [
            /\b(analyze|summarize|read|review|process|extract)\b.{0,30}\b(file|document|pdf|upload|attachment)\b/i,
            /\b(what does (this|the|my) (file|document|pdf) say)\b/i,
        ],
        extractEntities: (message) => ({
            rawMessage: message
        })
    },

    // ── Settings intents ──────────────────────────────────────────────────────
    {
        type: 'update_settings',
        confidence: 0.9,
        patterns: [
            /\b(change|update|set|modify|configure|turn (on|off)|enable|disable)\b.{0,30}\b(setting|preference|theme|language|notification|mode)\b/i,
        ],
        extractEntities: (message) => ({
            rawMessage: message
        })
    },

    // ── Dashboard / Analytics intents ─────────────────────────────────────────
    {
        type: 'dashboard_query',
        confidence: 0.85,
        patterns: [
            /\b(show|open|go to|give me|display)\b.{0,20}\b(dashboard|overview|summary|analytics|stats|statistics)\b/i,
            /\bhow (am i doing|many tasks|much progress)\b/i,
        ],
        extractEntities: () => ({})
    },

    // ── Greeting intents ──────────────────────────────────────────────────────
    {
        type: 'greeting',
        confidence: 0.95,
        patterns: [
            /^\s*(hi+|hello|hey+|good\s*(morning|afternoon|evening|night)|howdy|greetings|sup|what'?s up)\s*[!.]?\s*$/i,
        ],
        extractEntities: () => ({})
    },

    // ── Help / Capability intents ─────────────────────────────────────────────
    {
        type: 'help',
        confidence: 0.9,
        patterns: [
            /\b(help|what can you do|how do (i|you)|capabilities|features|commands)\b/i,
        ],
        extractEntities: () => ({})
    },
];

// ─── Default / Fallback ────────────────────────────────────────────────────────

const DEFAULT_INTENT = {
    type: 'chat',
    confidence: 0.5,
    entities: {}
};

// ─── Core Detection Logic ─────────────────────────────────────────────────────

/**
 * Detects intent from a plain-text message.
 * Returns the first matching intent pattern; falls back to 'chat'.
 *
 * @param {string} message
 * @returns {{ type: string, confidence: number, entities: object }}
 */
const detectIntent = (message) => {
    if (!message || typeof message !== 'string') {
        return { ...DEFAULT_INTENT };
    }

    const trimmed = message.trim();

    for (const intentDef of INTENT_PATTERNS) {
        const matched = intentDef.patterns.some((pattern) => pattern.test(trimmed));
        if (matched) {
            return {
                type: intentDef.type,
                confidence: intentDef.confidence,
                entities: intentDef.extractEntities(trimmed)
            };
        }
    }

    return { ...DEFAULT_INTENT, entities: {} };
};

// ─── Express Middleware ───────────────────────────────────────────────────────

/**
 * Express middleware — attaches detected intent to `req.intent`.
 * Always calls next(); it never blocks the request.
 */
const detectIntentMiddleware = (req, res, next) => {
    try {
        const message = req.body?.message || '';
        const intent = detectIntent(message);

        req.intent = intent;

        // Optional: log intent in development
        if (process.env.NODE_ENV === 'development') {
            console.log(`[Intent] type="${intent.type}" confidence=${intent.confidence} message="${message.substring(0, 80)}"`);
        }
    } catch (err) {
        // Never block the request due to intent detection failure
        console.error('[Intent Middleware Error]', err.message);
        req.intent = { ...DEFAULT_INTENT };
    }

    next();
};

module.exports = {
    detectIntentMiddleware,
    detectIntent // Export for direct use in controllers / tests
};
