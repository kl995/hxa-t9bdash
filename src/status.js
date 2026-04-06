const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const OFFLINE_SIGNAL_WINDOW_MS = 90 * 60 * 1000;

function getFreshSignalTimestamp({
  lastSeenAt = 0,
  chatLastSeenAt = 0,
  lastEventTs = 0,
  healthReportedAt = 0,
  now = Date.now(),
}) {
  const recentHealthTs = healthReportedAt && (now - healthReportedAt) <= TEN_MINUTES_MS
    ? healthReportedAt
    : 0;
  return Math.max(lastSeenAt || 0, chatLastSeenAt || 0, lastEventTs || 0, recentHealthTs || 0);
}

function hasFreshStatusSignal(input) {
  const now = input.now || Date.now();
  const freshestTs = getFreshSignalTimestamp({ ...input, now });
  return freshestTs > 0 && (now - freshestTs) <= OFFLINE_SIGNAL_WINDOW_MS;
}

function deriveWorkStatus({
  online,
  openTaskCount = 0,
  lastSeenAt = 0,
  chatLastSeenAt = 0,
  lastEventTs = 0,
  healthReportedAt = 0,
  now = Date.now(),
}) {
  const freshSignal = hasFreshStatusSignal({ lastSeenAt, chatLastSeenAt, lastEventTs, healthReportedAt, now });
  const chatActive = chatLastSeenAt > 0 && (now - chatLastSeenAt) <= THIRTY_MINUTES_MS;
  const chatRecent = chatLastSeenAt > 0 && (now - chatLastSeenAt) <= FOUR_HOURS_MS;
  const hasRecentActivity = lastEventTs > (now - FOUR_HOURS_MS);
  const hasDayActivity = lastEventTs > (now - TWENTY_FOUR_HOURS_MS);

  if (chatActive && openTaskCount > 0) return 'busy';
  if (chatRecent) return 'idle';
  if (!online && !freshSignal) return 'unknown';
  if (!online) return 'offline';
  if (hasRecentActivity && openTaskCount > 0) return 'busy';
  if (!hasDayActivity) return 'inactive';
  return 'idle';
}

function deriveTierStatus({
  online,
  lastSeenAt = 0,
  chatLastSeenAt = 0,
  lastEventTs = 0,
  healthReportedAt = 0,
  now = Date.now(),
}) {
  if (lastEventTs > (now - THIRTY_MINUTES_MS)) return 'active';
  if (chatLastSeenAt > 0 && (now - chatLastSeenAt) <= THIRTY_MINUTES_MS) return 'active';
  if (online) return 'online';
  return hasFreshStatusSignal({ lastSeenAt, chatLastSeenAt, lastEventTs, healthReportedAt, now })
    ? 'offline'
    : 'unknown';
}

module.exports = {
  FOUR_HOURS_MS,
  TWENTY_FOUR_HOURS_MS,
  THIRTY_MINUTES_MS,
  TEN_MINUTES_MS,
  OFFLINE_SIGNAL_WINDOW_MS,
  getFreshSignalTimestamp,
  hasFreshStatusSignal,
  deriveWorkStatus,
  deriveTierStatus,
};
