const { Router } = require('express');
const db = require('../db');
const { deriveTierStatus, deriveWorkStatus } = require('../status');

const router = Router();

// GET /api/live — real-time agent work dashboard (#95)
router.get('/', (req, res) => {
  const agents = db.getAllAgents();
  const now = Date.now();

  const liveAgents = agents.map(a => {
    const name = a.name || a.id;
    const allTasks = db.getTasksForAgent(name, { assigneeOnly: true });
    const openTasks = allTasks.filter(t => t.state === 'opened');
    const allEvents = db.getEventsForAgent(name, 50);

    const oneHourAgo = now - 3600000;
    const thirtyMinAgo = now - 1800000;
    const recentEvents = allEvents.filter(e => e.timestamp && e.timestamp > oneHourAgo);
    const activityIntensity = allEvents.filter(e => e.timestamp && e.timestamp > thirtyMinAgo).length;
    const chatRecentlyActive = !!(a.chat_last_seen_at && a.chat_last_seen_at > thirtyMinAgo);

    const lastEvent = allEvents[0] || null;
    const chatActivity = a.chat_last_seen_at ? {
      source: a.chat_source || 'telegram',
      last_seen_at: a.chat_last_seen_at,
      preview: a.chat_last_preview || '',
      channel: a.chat_last_channel || null,
      thread_id: a.chat_last_thread_id || null,
    } : null;
    const lastActivityTs = Math.max(
      lastEvent?.timestamp || 0,
      a.last_seen_at || 0,
      a.chat_last_seen_at || 0
    ) || 0;
    const lastActiveMs = lastActivityTs ? (now - lastActivityTs) : null;
    const health = db.getAgentHealth(name);
    const healthReportedAt = health?.reported_at || 0;
    const workStatus = deriveWorkStatus({
      online: !!a.online,
      openTaskCount: openTasks.length,
      lastSeenAt: a.last_seen_at || 0,
      chatLastSeenAt: a.chat_last_seen_at || 0,
      lastEventTs: lastEvent?.timestamp || 0,
      healthReportedAt,
      now,
    });

    // 3-tier status (#136): active (GitLab 30min) / online (Connect) / offline
    const tierStatus = deriveTierStatus({
      online: !!a.online,
      lastSeenAt: a.last_seen_at || 0,
      chatLastSeenAt: a.chat_last_seen_at || 0,
      lastEventTs: lastEvent?.timestamp || 0,
      healthReportedAt,
      now,
    });

    // Derive effective status from the richer tier/work model, not only raw Connect online
    let effectiveStatus = workStatus === 'unknown' ? 'unknown' : 'offline';
    if (tierStatus === 'active' || tierStatus === 'online') {
      if (workStatus === 'busy' || openTasks.length > 0) effectiveStatus = 'working';
      else if (activityIntensity > 0 || chatRecentlyActive) effectiveStatus = 'active';
      else effectiveStatus = 'idle';
    }

    return {
      name,
      displayName: a.display_name || name,
      role: a.role || '',
      online: !!a.online,
      workStatus,
      effectiveStatus,
      tierStatus,
      healthScore: a.health_score ?? null,
      currentTasks: openTasks.slice(0, 5).map(t => ({
        title: t.title,
        type: t.type || 'issue',
        url: t.url || '',
        project: t.project || ''
      })),
      recentEvents: recentEvents.slice(0, 8).map(e => ({
        action: e.action,
        targetTitle: e.target_title,
        targetType: e.target_type,
        project: e.project,
        timestamp: e.timestamp
      })),
      chatActivity,
      lastActiveMs,
      activityIntensity,
      activeProjects: a.active_projects || []
    };
  });

  // Sort: working > active > idle > offline
  const statusOrder = { working: 0, active: 1, idle: 2, offline: 3, unknown: 4 };
  liveAgents.sort((a, b) => (statusOrder[a.effectiveStatus] ?? 9) - (statusOrder[b.effectiveStatus] ?? 9));

  const summary = {
    total: liveAgents.length,
    working: liveAgents.filter(a => a.effectiveStatus === 'working').length,
    active: liveAgents.filter(a => a.effectiveStatus === 'active').length,
    idle: liveAgents.filter(a => a.effectiveStatus === 'idle').length,
    offline: liveAgents.filter(a => a.effectiveStatus === 'offline').length,
    unknown: liveAgents.filter(a => a.effectiveStatus === 'unknown').length,
    tier: {
      active: liveAgents.filter(a => a.tierStatus === 'active').length,
      online: liveAgents.filter(a => a.tierStatus === 'online').length,
      offline: liveAgents.filter(a => a.tierStatus === 'offline').length,
      unknown: liveAgents.filter(a => a.tierStatus === 'unknown').length,
    }
  };

  res.json({ agents: liveAgents, summary, timestamp: now });
});

module.exports = router;
