const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const OFFLINE_SIGNAL_WINDOW_MS = 90 * 60 * 1000;
const TELEGRAM_REPLY_ONLINE_WINDOW_MS = FOUR_HOURS_MS;
const TELEGRAM_MENTION_ONLINE_WINDOW_MS = 60 * 60 * 1000;

function isStrongTelegramSignal(chatSource) {
  return chatSource === 'telegram';
}

function isWeakTelegramSignal(chatSource) {
  return chatSource === 'telegram-mention';
}

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
  chatSource = '',
  lastEventTs = 0,
  healthReportedAt = 0,
  now = Date.now(),
}) {
  const chatAge = chatLastSeenAt > 0 ? (now - chatLastSeenAt) : Infinity;
  const chatActive = isStrongTelegramSignal(chatSource) && chatAge <= THIRTY_MINUTES_MS;
  const chatRecent = (
    (isStrongTelegramSignal(chatSource) && chatAge <= TELEGRAM_REPLY_ONLINE_WINDOW_MS) ||
    (isWeakTelegramSignal(chatSource) && chatAge <= TELEGRAM_MENTION_ONLINE_WINDOW_MS)
  );

  if (chatActive && openTaskCount > 0) return 'busy';
  if (chatRecent) return 'idle';
  return 'unknown';
}

function deriveTierStatus({
  online,
  lastSeenAt = 0,
  chatLastSeenAt = 0,
  chatSource = '',
  lastEventTs = 0,
  healthReportedAt = 0,
  now = Date.now(),
}) {
  if (isStrongTelegramSignal(chatSource) && chatLastSeenAt > 0 && (now - chatLastSeenAt) <= THIRTY_MINUTES_MS) return 'active';
  if (isWeakTelegramSignal(chatSource) && chatLastSeenAt > 0 && (now - chatLastSeenAt) <= TELEGRAM_MENTION_ONLINE_WINDOW_MS) {
    return 'online';
  }
  if (isStrongTelegramSignal(chatSource) && chatLastSeenAt > 0 && (now - chatLastSeenAt) <= TELEGRAM_REPLY_ONLINE_WINDOW_MS) {
    return 'online';
  }
  return 'unknown';
}

module.exports = {
  FOUR_HOURS_MS,
  TWENTY_FOUR_HOURS_MS,
  THIRTY_MINUTES_MS,
  TEN_MINUTES_MS,
  OFFLINE_SIGNAL_WINDOW_MS,
  TELEGRAM_REPLY_ONLINE_WINDOW_MS,
  TELEGRAM_MENTION_ONLINE_WINDOW_MS,
  isStrongTelegramSignal,
  isWeakTelegramSignal,
  getFreshSignalTimestamp,
  hasFreshStatusSignal,
  deriveWorkStatus,
  deriveTierStatus,
};
