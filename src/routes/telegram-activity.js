const { Router } = require('express');
const db = require('../db');

const router = Router();

function buildTelegramActivitySnapshot({ now = Date.now(), maxAgeMs = null } = {}) {
  const agents = db.getAllAgents()
    .filter(agent => agent.chat_last_seen_at)
    .filter(agent => !maxAgeMs || (now - agent.chat_last_seen_at) <= maxAgeMs)
    .sort((a, b) => (b.chat_last_seen_at || 0) - (a.chat_last_seen_at || 0))
    .map(agent => ({
      name: agent.name,
      chat_activity: {
        source: agent.chat_source || 'telegram',
        last_seen_at: agent.chat_last_seen_at,
        preview: agent.chat_last_preview || '',
        channel: agent.chat_last_channel || null,
        thread_id: agent.chat_last_thread_id || null,
      },
    }));

  return {
    generated_at: now,
    agents,
  };
}

router.get('/', (req, res) => {
  const maxAgeMsRaw = req.query.max_age_ms;
  const maxAgeMs = maxAgeMsRaw ? Number.parseInt(maxAgeMsRaw, 10) : null;
  res.json(buildTelegramActivitySnapshot({
    maxAgeMs: Number.isFinite(maxAgeMs) ? maxAgeMs : null,
  }));
});

module.exports = router;
module.exports.buildTelegramActivitySnapshot = buildTelegramActivitySnapshot;
