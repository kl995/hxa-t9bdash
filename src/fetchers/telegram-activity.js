const fs = require('fs');
const path = require('path');

const db = require('../db');
const entity = require('../entity');

const DEFAULT_LOG_DIR = '/home/cocoai/zylos/components/telegram/logs';
const TAIL_BYTES = 128 * 1024;
const PREVIEW_LIMIT = 160;
const DEFAULT_MAX_AGE_MS = 30 * 60 * 1000;

let config = {
  logDir: DEFAULT_LOG_DIR,
  maxAgeMs: DEFAULT_MAX_AGE_MS,
  remoteUrl: null,
};

function parseInteger(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function init(cfg = {}, env = process.env) {
  const source = cfg.telegram_activity || {};
  config = {
    logDir: source.log_dir || env.HXA_TELEGRAM_ACTIVITY_LOG_DIR || DEFAULT_LOG_DIR,
    maxAgeMs: parseInteger(source.max_age_ms || env.HXA_TELEGRAM_ACTIVITY_MAX_AGE_MS, DEFAULT_MAX_AGE_MS),
    remoteUrl: source.remote_url || env.HXA_TELEGRAM_ACTIVITY_REMOTE_URL || null,
  };
}

function buildPreview(text) {
  if (!text) return '';
  const compact = String(text).replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > PREVIEW_LIMIT
    ? `${compact.slice(0, PREVIEW_LIMIT - 1)}...`
    : compact;
}

function readTail(filePath, bytes = TAIL_BYTES) {
  const stat = fs.statSync(filePath);
  const start = Math.max(0, stat.size - bytes);
  const fd = fs.openSync(filePath, 'r');
  try {
    const len = stat.size - start;
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function trackActivity(latestByAgent, name, activity) {
  const prev = latestByAgent.get(name);
  if (!prev || activity.ts > prev.ts) {
    latestByAgent.set(name, activity);
  }
}

function findAddressedAgents(text) {
  if (!text) return [];

  const targets = new Set();
  const raw = String(text);

  for (const match of raw.matchAll(/(^|[\s(])@([A-Za-z0-9_]{3,})\b/g)) {
    const handle = match[2];
    const canonicalName =
      entity.resolve('telegram', handle) ||
      entity.resolve('connect', handle) ||
      handle;
    const knownAgent = db.getAgent(canonicalName) || db.getAgent(handle);
    const knownEntity = entity.get(canonicalName);
    if (knownAgent || knownEntity) {
      targets.add(canonicalName);
    }
  }

  return [...targets];
}

function collectLocalActivity(latestByAgent, { logDir = DEFAULT_LOG_DIR, maxAgeMs, now }) {
  if (!fs.existsSync(logDir)) return;

  const files = fs.readdirSync(logDir)
    .filter(name => name.endsWith('.log'))
    .map(name => path.join(logDir, name));

  for (const filePath of files) {
    let raw = '';
    try {
      raw = readTail(filePath);
    } catch {
      continue;
    }

    for (const line of raw.split('\n')) {
      if (!line.trim().startsWith('{')) continue;
      let msg;
      try {
        msg = JSON.parse(line);
      } catch {
        continue;
      }

      const rawName = String(msg.user_name).replace(/^@/, '').trim();

      const ts = Date.parse(msg.timestamp || '');
      if (!ts || Number.isNaN(ts)) continue;
      if ((now - ts) > maxAgeMs) continue;

      const channel = path.basename(filePath, '.log');
      const preview = buildPreview(msg.text);

      if (msg.user_id === 'bot') {
        if (!rawName) continue;

        const canonicalName = entity.resolve('telegram', rawName) || rawName;
        const knownAgent = db.getAgent(canonicalName) || db.getAgent(rawName);
        const knownEntity = entity.get(canonicalName);
        if (!knownAgent && !knownEntity) continue;

        trackActivity(latestByAgent, canonicalName, {
          ts,
          source: 'telegram',
          preview,
          channel,
          threadId: msg.thread_id || null,
        });
        continue;
      }

      for (const canonicalName of findAddressedAgents(msg.text)) {
        trackActivity(latestByAgent, canonicalName, {
          ts,
          source: 'telegram-mention',
          preview,
          channel,
          threadId: msg.thread_id || null,
        });
      }
    }
  }
}

async function collectRemoteActivity(latestByAgent, { remoteUrl, maxAgeMs, now }) {
  if (!remoteUrl) return;

  let response;
  try {
    response = await fetch(remoteUrl, {
      headers: {
        accept: 'application/json',
        // LocalTunnel returns an interstitial unless this header is present.
        'bypass-tunnel-reminder': 'true',
      },
    });
  } catch {
    return;
  }

  if (!response.ok) return;

  let payload;
  try {
    payload = await response.json();
  } catch {
    return;
  }

  const agents = extractRemoteAgents(payload);
  for (const agent of agents) {
    if (!agent?.name || !agent.chat_activity?.last_seen_at) continue;
    const ts = Number(agent.chat_activity.last_seen_at);
    if (!Number.isFinite(ts) || (now - ts) > maxAgeMs) continue;

    trackActivity(latestByAgent, agent.name, {
      ts,
      source: agent.chat_activity.source || 'telegram',
      preview: buildPreview(agent.chat_activity.preview),
      channel: agent.chat_activity.channel || null,
      threadId: agent.chat_activity.thread_id || null,
    });
  }
}

function extractRemoteAgents(payload) {
  if (!payload || !Array.isArray(payload.agents)) return [];
  if (payload.agents.every(agent => agent?.chat_activity)) return payload.agents;
  return payload.agents
    .filter(agent => agent?.name && agent?.chat_activity?.last_seen_at)
    .map(agent => ({
      name: agent.name,
      chat_activity: agent.chat_activity,
    }));
}

async function pollActivity({
  logDir = config.logDir,
  maxAgeMs = config.maxAgeMs,
  remoteUrl = config.remoteUrl,
} = {}) {
  const now = Date.now();
  let updated = 0;
  const latestByAgent = new Map();
  collectLocalActivity(latestByAgent, { logDir, maxAgeMs, now });
  await collectRemoteActivity(latestByAgent, { remoteUrl, maxAgeMs, now });

  for (const [name, activity] of latestByAgent.entries()) {
    const existing = db.getAgent(name) || { name };
    db.upsertAgent({
      ...existing,
      name,
      chat_last_seen_at: activity.ts,
      chat_source: activity.source,
      chat_last_preview: activity.preview,
      chat_last_channel: activity.channel,
      chat_last_thread_id: activity.threadId,
      updated_at: now,
    });
    updated++;
  }

  return { updated };
}

module.exports = { init, pollActivity, extractRemoteAgents };
