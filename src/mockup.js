function isHealthyMockup(req) {
  return req?.query?.mockup === 'healthy';
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeAgent(agent, index) {
  const cloned = clone(agent);
  const now = Date.now();
  const lastActiveAt = now - (index + 1) * 3 * 60 * 1000;
  const openTasks = cloned.stats?.open_tasks ?? cloned.open_tasks ?? cloned.current_tasks?.length ?? 0;
  const role = cloned.role || 'AI Operator';

  cloned.online = true;
  cloned.role = role;
  cloned.work_status = openTasks > 0 ? 'busy' : 'idle';
  cloned.tier_status = openTasks > 0 ? 'active' : 'online';
  cloned.health_score = Math.max(cloned.health_score || 0, 88 - (index % 4) * 3);
  cloned.last_seen_at = lastActiveAt;
  cloned.last_active_at = lastActiveAt;
  cloned.events_7d = Math.max(cloned.events_7d || 0, 12 + index * 2);
  cloned.closed_7d = Math.max(cloned.closed_7d || 0, 3 + (index % 4));
  cloned.blocking_mrs = [];
  cloned.capacity = cloned.capacity || { current: openTasks, max: 5 };
  cloned.capacity.current = Math.min(cloned.capacity.max || 5, Math.max(openTasks, cloned.capacity.current || 0));
  cloned.current_tasks = (cloned.current_tasks || []).slice(0, 3);
  cloned.hardware = {
    disk_pct: 41 + (index % 5) * 4,
    disk_status: 'ok',
    mem_pct: 46 + (index % 4) * 5,
    mem_status: 'ok',
    cpu_pct: 18 + (index % 5) * 7,
    pm2_online: 12,
    pm2_total: 12,
    stale: false,
    reported_at: now
  };

  if (cloned.stats) {
    cloned.stats.open_tasks = openTasks;
    cloned.stats.recent_events = Math.max(cloned.stats.recent_events || 0, 5);
    cloned.stats.closed_last_7d = Math.max(cloned.stats.closed_last_7d || 0, 3 + (index % 3));
    cloned.stats.closed_last_30d = Math.max(cloned.stats.closed_last_30d || 0, 14 + index * 2);
  }

  const existingChat = cloned.chat_activity || {};
  cloned.chat_activity = {
    source: existingChat.source || 'telegram',
    last_seen_at: lastActiveAt - 60 * 1000,
    preview: existingChat.preview || 'Healthy telemetry confirmed and responding normally.',
    channel: existingChat.channel || null,
    thread_id: existingChat.thread_id || null
  };

  if (cloned.latest_event) {
    cloned.latest_event.timestamp = lastActiveAt - 90 * 1000;
  }

  return cloned;
}

function applyHealthyMockupToTeam(payload) {
  const cloned = clone(payload);
  cloned.agents = (cloned.agents || []).map(normalizeAgent);
  const total = cloned.agents.length;
  const active = cloned.agents.filter(agent => agent.tier_status === 'active').length;
  cloned.stats = {
    ...(cloned.stats || {}),
    total,
    online: total,
    offline: 0,
    tier: {
      active,
      online: total - active,
      offline: 0,
      unknown: 0
    }
  };
  return cloned;
}

function applyHealthyMockupToLive(payload) {
  const cloned = clone(payload);
  cloned.agents = (cloned.agents || []).map((agent, index) => {
    const normalized = clone(agent);
    normalized.online = true;
    normalized.tierStatus = normalized.currentTasks?.length ? 'active' : 'online';
    normalized.workStatus = normalized.currentTasks?.length ? 'busy' : 'idle';
    normalized.effectiveStatus = normalized.currentTasks?.length ? 'working' : (index % 2 === 0 ? 'active' : 'idle');
    normalized.healthScore = Math.max(normalized.healthScore || 0, 90 - (index % 3) * 3);
    normalized.activityIntensity = Math.max(normalized.activityIntensity || 0, 2 + (index % 4));
    normalized.lastActiveMs = (index + 1) * 4 * 60 * 1000;
    normalized.recentEvents = (normalized.recentEvents || []).slice(0, 4);
    normalized.chatActivity = normalized.chatActivity || {
      source: 'telegram',
      last_seen_at: Date.now() - (index + 2) * 5 * 60 * 1000,
      preview: 'Healthy mockup mode active for presentation.',
      channel: null,
      thread_id: null
    };
    return normalized;
  });

  const total = cloned.agents.length;
  const working = cloned.agents.filter(agent => agent.effectiveStatus === 'working').length;
  const active = cloned.agents.filter(agent => agent.effectiveStatus === 'active').length;
  const idle = cloned.agents.filter(agent => agent.effectiveStatus === 'idle').length;
  const tierActive = cloned.agents.filter(agent => agent.tierStatus === 'active').length;
  cloned.summary = {
    total,
    working,
    active,
    idle,
    offline: 0,
    unknown: 0,
    tier: {
      active: tierActive,
      online: total - tierActive,
      offline: 0,
      unknown: 0
    }
  };

  return cloned;
}

function applyHealthyMockupToDiagnostics(payload) {
  const cloned = clone(payload);
  const now = Date.now();

  cloned.timestamp = now;
  cloned.overall = 'ok';
  cloned.cpu = {
    ...(cloned.cpu || {}),
    status: 'ok',
    pct: 24,
    cores: cloned.cpu?.cores || cloned.system?.cpu_count || 4
  };
  cloned.memory = {
    ...(cloned.memory || {}),
    status: 'ok',
    pct: 52
  };
  cloned.disk = {
    ...(cloned.disk || {}),
    status: 'ok',
    pct: 47
  };

  cloned.pm2 = clone(cloned.pm2 || { services: [] });
  cloned.pm2.status = 'ok';
  cloned.pm2.services = (cloned.pm2.services || []).map((service, index) => ({
    ...service,
    status: 'online',
    pid: service.pid || 3000 + index,
    restarts: Math.min(service.restarts || 0, 1),
    cpu: service.cpu ?? 1,
    memory: service.memory ?? 64 * 1024 * 1024
  }));
  cloned.pm2.total = cloned.pm2.services.length;
  cloned.pm2.online = cloned.pm2.services.length;

  cloned.services = (cloned.services || []).map((service, index) => ({
    ...service,
    status: 'ok',
    http_status: 200,
    latency_ms: 80 + index * 12
  }));

  const agents = cloned.agents?.list || [];
  cloned.agents = {
    status: 'ok',
    online: agents.length,
    total: agents.length,
    list: agents.map((agent, index) => ({
      ...agent,
      online: true,
      status: index % 3 === 0 ? 'idle' : 'active',
      tier_status: index % 3 === 0 ? 'online' : 'active',
      last_seen_at: now - (index + 1) * 4 * 60 * 1000,
      last_active: now - (index + 1) * 5 * 60 * 1000,
      open_tasks: Math.max(agent.open_tasks || 0, index % 3),
      system_health_stale: false,
      system_health: {
        cpu: { pct: 20 + index * 3, cores: cloned.system?.cpu_count || 4, load_avg: cloned.system?.load_avg || [0.3, 0.4, 0.5] },
        disk: { status: 'ok', pct: 40 + index * 2, used: cloned.disk?.used || '20G', total: cloned.disk?.total || '50G' },
        memory: { status: 'ok', pct: 45 + index * 3, used_gb: 1.2 + index * 0.1, total_gb: 4 },
        pm2: { online: 12, total: 12 },
        reported_at: now
      }
    }))
  };

  return cloned;
}

module.exports = {
  isHealthyMockup,
  applyHealthyMockupToTeam,
  applyHealthyMockupToLive,
  applyHealthyMockupToDiagnostics
};
