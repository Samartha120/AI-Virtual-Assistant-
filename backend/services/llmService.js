const axios = require('axios');

const HF_TIMEOUT_MS = 5000;
const OLLAMA_HEALTH_TIMEOUT_MS = 2000;
const OLLAMA_TIMEOUT_MS = 8000;

function getEnv(name, fallback = '') {
  const v = process.env[name];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}

function isDebugEnabled() {
  const flag = getEnv('LLM_DEBUG', '').toLowerCase();
  if (flag === 'true' || flag === '1' || flag === 'yes') return true;
  if (flag === 'false' || flag === '0' || flag === 'no') return false;
  // Default: on in non-production for easier local debugging.
  return (process.env.NODE_ENV || 'development') !== 'production';
}

function debugLog(...args) {
  if (!isDebugEnabled()) return;
  // Keep logs unprefixed so `concurrently` can prefix with `[api]` (matches expected terminal output).
  // eslint-disable-next-line no-console
  console.log(...args);
}

function friendlyModelName(model) {
  const m = String(model || '').trim();
  if (!m) return 'Model';
  if (/qwen/i.test(m)) return 'Qwen';
  if (/llama/i.test(m)) return 'LLaMA';
  const parts = m.split('/').filter(Boolean);
  return parts[parts.length - 1] || m;
}

function normalizeBaseUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

function buildMessages(prompt, history = [], systemContext = '') {
  const messages = [];
  messages.push({
    role: 'system',
    content: systemContext && systemContext.trim()
      ? systemContext.trim()
      : 'You are a helpful and intelligent AI assistant.',
  });

  if (Array.isArray(history) && history.length) {
    for (const msg of history) {
      if (!msg || typeof msg !== 'object') continue;
      const role = msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' ? msg.role : 'user';
      const content = typeof msg.content === 'string' ? msg.content : '';
      if (content.trim()) messages.push({ role, content: content.trim() });
    }
  }

  messages.push({ role: 'user', content: String(prompt || '').trim() });
  return messages;
}

function buildPlainPromptFromMessages(messages) {
  // Ollama /api/generate uses a plain prompt string.
  // Keep it simple and deterministic.
  return (messages || [])
    .map((m) => {
      const role = String(m.role || 'user').toUpperCase();
      const content = String(m.content || '').trim();
      return content ? `${role}: ${content}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function assertNonEmptyText(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Empty ${label}`);
  }
  return value.trim();
}

function extractTextFromHfResponse(data) {
  const choice = data?.choices?.[0];

  // OpenAI-compatible chat.completions
  let content = choice?.message?.content;

  // Some providers may return `text` instead of `message.content`
  if (!content) content = choice?.text;

  // Streaming-style fields should not appear with non-stream responses,
  // but tolerate them to avoid false negatives.
  if (!content) content = choice?.delta?.content;

  // HF Inference API style
  if (!content) content = data?.generated_text;

  // Content can be an array in some multimodal responses
  if (Array.isArray(content)) {
    content = content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        return String(part.text || part.content || '').trim();
      })
      .filter(Boolean)
      .join(' ');
  }

  return typeof content === 'string' ? content : '';
}

async function callHuggingFace(messages) {
  const hfKey = getEnv('HF_API_KEY');
  if (!hfKey) throw new Error('HF_API_KEY missing');

  const hfBaseUrl = normalizeBaseUrl(getEnv('HF_BASE_URL', 'https://router.huggingface.co/v1'));
  const url = `${hfBaseUrl}/chat/completions`;
  const model = getEnv('HF_MODEL', 'Qwen/Qwen2.5-7B-Instruct');

  debugLog(`Trying ${friendlyModelName(model)} model...`);

  const resp = await axios.post(
    url,
    {
      model,
      messages,
    },
    {
      timeout: HF_TIMEOUT_MS,
      headers: {
        Authorization: `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    }
  );

  if (resp.status < 200 || resp.status >= 300) {
    debugLog('HF non-2xx response', { status: resp.status, data: resp.data });
    throw new Error(`HF HTTP ${resp.status}`);
  }

  debugLog('HF RESPONSE:', resp.data);

  const content = extractTextFromHfResponse(resp.data);
  return assertNonEmptyText(content, 'HF response');
}

async function checkOllamaHealth() {
  const base = normalizeBaseUrl(getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'));
  if (!base) throw new Error('OLLAMA_BASE_URL missing');
  const url = `${base}/api/tags`;

  debugLog(`Checking Ollama health base='${base}' timeoutMs=${OLLAMA_HEALTH_TIMEOUT_MS}`);

  const resp = await axios.get(url, {
    timeout: OLLAMA_HEALTH_TIMEOUT_MS,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    debugLog('Ollama health non-2xx response', { status: resp.status, data: resp.data });
    throw new Error(`Ollama health HTTP ${resp.status}`);
  }

  debugLog('Ollama health OK', { models: resp.data?.models?.length });
  return true;
}

async function callOllama(modelName, prompt) {
  const base = normalizeBaseUrl(getEnv('OLLAMA_BASE_URL', 'http://localhost:11434'));
  if (!base) throw new Error('OLLAMA_BASE_URL missing');
  const url = `${base}/api/generate`;

  debugLog(`Trying Ollama model='${modelName}' base='${base}' timeoutMs=${OLLAMA_TIMEOUT_MS}`);

  const resp = await axios.post(
    url,
    {
      model: String(modelName),
      prompt: String(prompt),
      stream: false,
    },
    {
      timeout: OLLAMA_TIMEOUT_MS,
      validateStatus: () => true,
    }
  );

  if (resp.status < 200 || resp.status >= 300) {
    debugLog('Ollama non-2xx response', { status: resp.status, data: resp.data });
    throw new Error(`Ollama HTTP ${resp.status}`);
  }

  const content = resp.data?.response;
  debugLog('Ollama response meta', {
    model: resp.data?.model,
    total_duration: resp.data?.total_duration,
    eval_count: resp.data?.eval_count,
    eval_duration: resp.data?.eval_duration,
    contentPreview: typeof content === 'string' ? content.slice(0, 180) : '',
  });
  return assertNonEmptyText(content, 'Ollama response');
}

/**
 * Robust LLM router:
 * 1) Hugging Face (primary)
 * 2) Ollama primary model (qwen2)
 * 3) Ollama fallback model (llama3)
 */
async function generateResponse(prompt, history = [], systemContext = '') {
  const messages = buildMessages(prompt, history, systemContext);

  try {
    const hf = await callHuggingFace(messages);
    console.log('[LLM] provider=huggingface');
    return { provider: 'huggingface', content: hf };
  } catch (hfError) {
    console.warn('[LLM] HF failed → switching to Ollama:', hfError?.message || hfError);

    // Ollama availability check (critical requirement)
    try {
      await checkOllamaHealth();
    } catch (healthError) {
      console.warn('[LLM] Ollama unreachable, skipping fallback:', healthError?.message || healthError);
      return { provider: 'unavailable', content: 'AI service temporarily unavailable' };
    }

    const modelPrimary = getEnv('OLLAMA_MODEL_PRIMARY', 'qwen2:1.5b');
    const modelFallback = getEnv('OLLAMA_MODEL_FALLBACK', 'llama3');
    console.warn(`[LLM] Switching to local Ollama model: ${modelPrimary}`);

    const switchMessage = '⚠️ Switching to local AI (Qwen)...';
    const plainPrompt = buildPlainPromptFromMessages(messages);

    try {
      const o1 = await callOllama(modelPrimary, plainPrompt);
      console.log('[LLM] provider=ollama_qwen');
      return { provider: 'ollama_qwen', content: o1, notice: switchMessage };
    } catch (ollamaError) {
      console.warn('[LLM] Ollama Qwen failed → switching to LLaMA:', ollamaError?.message || ollamaError);
      const secondSwitch = '⚠️ Switching to backup AI (LLaMA)...';
      try {
        console.warn(`[LLM] Switching to backup Ollama model: ${modelFallback}`);
        const o2 = await callOllama(modelFallback, plainPrompt);
        console.log('[LLM] provider=ollama_llama');
        return { provider: 'ollama_llama', content: o2, notice: secondSwitch };
      } catch (ollamaFallbackError) {
        console.warn('[LLM] Ollama LLaMA failed:', ollamaFallbackError?.message || ollamaFallbackError);
        return { provider: 'unavailable', content: 'AI service temporarily unavailable' };
      }
    }
  }
}

module.exports = {
  generateResponse,
  checkOllamaHealth,
};
