/* eslint-disable no-console */
// Simple end-to-end smoke test for NexusAI backend Grok integration.
// Usage:
//   cd backend
//   npm run smoke
// Env:
//   BASE_URL=http://localhost:5000   (optional)
//
// Exits:
//   0 = OK
//   2 = GROK_API_KEY not set (ai-status keySet false)
//   1 = other failure

const BASE_URL = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');

async function httpJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await resp.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!resp.ok) {
    const err = new Error(`HTTP ${resp.status} ${resp.statusText} for ${path}`);
    err.status = resp.status;
    err.bodyText = text;
    err.bodyJson = json;
    throw err;
  }

  return json;
}

async function streamSse(path, body) {
  const url = `${BASE_URL}${path}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Stream HTTP ${resp.status} ${resp.statusText}: ${text}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let fullText = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = frame.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const data = trimmed.replace(/^data:\s*/, '');
        if (data === '[DONE]') return fullText;

        // Expect JSON frames: { delta } or { error, code }
        try {
          const parsed = JSON.parse(data);
          if (parsed?.error) {
            const err = new Error(parsed.error);
            err.code = parsed.code;
            throw err;
          }
          if (typeof parsed?.delta === 'string') {
            fullText += parsed.delta;
          }
        } catch {
          // Ignore non-JSON frames
        }
      }
    }
  }

  return fullText;
}

function preview(s, n = 120) {
  if (!s) return '';
  const clean = String(s).replace(/\s+/g, ' ').trim();
  return clean.length > n ? `${clean.slice(0, n)}…` : clean;
}

async function main() {
  console.log(`BASE_URL=${BASE_URL}`);

  const status = await httpJson('/api/ai-status', { method: 'GET' });
  console.log('ai-status:', status);

  if (!status?.keySet) {
    console.error('GROK_API_KEY is not set on backend. Set it in backend/.env and restart the server.');
    process.exit(2);
  }

  const chat = await httpJson('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      message: 'Say: Grok is connected. Reply in one short sentence.',
      history: [],
    }),
  });
  console.log('chat.reply:', preview(chat?.reply));

  const brainstorm = await httpJson('/api/brainstorm', {
    method: 'POST',
    body: JSON.stringify({
      topic: 'AI virtual assistant onboarding for new users',
    }),
  });
  console.log('brainstorm.ideas:', preview(brainstorm?.ideas));

  const analyze = await httpJson('/api/analyze', {
    method: 'POST',
    body: JSON.stringify({
      text: 'This document describes Q1 OKRs: Improve retention by 10%, reduce latency by 20%, and ship Grok migration by March. Risks: rate limits, token costs. Action: add caching, add retries, monitor errors.',
    }),
  });
  console.log('analyze.result:', preview(JSON.stringify(analyze?.result)));

  const tasksAnalyze = await httpJson('/api/tasks/ai', {
    method: 'POST',
    body: JSON.stringify({
      action: 'analyze',
      tasks: '1) Migrate AI provider to Grok\n2) Add SSE streaming\n3) Update docs\n4) Smoke test modules',
    }),
  });
  console.log('tasks.analyze.advice:', preview(tasksAnalyze?.advice));

  const tasksDecompose = await httpJson('/api/tasks/ai', {
    method: 'POST',
    body: JSON.stringify({
      action: 'decompose',
      taskTitle: 'Finalize Grok migration verification',
    }),
  });
  console.log('tasks.decompose.subtasks:', tasksDecompose?.subtasks);

  const streamed = await streamSse('/api/chat/stream', {
    message: 'Stream: say hi in one short sentence.',
    history: [],
  });
  console.log('streamed.text:', preview(streamed));

  console.log('SMOKE_OK');
}

main().catch((err) => {
  console.error('SMOKE_FAILED');
  console.error(err?.message || err);
  if (err?.bodyJson) console.error('bodyJson:', err.bodyJson);
  if (err?.bodyText && !err?.bodyJson) console.error('bodyText:', err.bodyText);

  if (err?.bodyJson?.code === 'GROK_AUTH_INVALID' || err?.status === 401 || err?.status === 403) {
    console.error('Hint: GROK_API_KEY is set but invalid/unauthorized. Get a valid key from https://console.x.ai and restart the backend.');
    process.exitCode = 3;
    return;
  }

  process.exitCode = 1;
});
