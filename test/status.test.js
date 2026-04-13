import { describe, expect, it } from 'vitest';

const status = await import('../src/status.js').then(m => m.default || m);

describe('status signal freshness', () => {
  it('treats agents with no recent Telegram signal as unknown', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const staleSeen = now - (3 * 60 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      lastSeenAt: staleSeen,
      lastEventTs: 0,
      healthReportedAt: 0,
      now,
    })).toBe('unknown');

    expect(status.deriveTierStatus({
      online: false,
      lastSeenAt: staleSeen,
      lastEventTs: 0,
      healthReportedAt: 0,
      now,
    })).toBe('unknown');
  });

  it('does not use recent console presence to classify Telegram status', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentSeen = now - (20 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: true,
      lastSeenAt: recentSeen,
      now,
    })).toBe('unknown');

    expect(status.deriveTierStatus({
      online: true,
      lastSeenAt: recentSeen,
      now,
    })).toBe('unknown');
  });

  it('uses only fresh health reports as offline evidence', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);

    expect(status.hasFreshStatusSignal({
      lastSeenAt: 0,
      lastEventTs: 0,
      healthReportedAt: now - (5 * 60 * 1000),
      now,
    })).toBe(true);

    expect(status.hasFreshStatusSignal({
      lastSeenAt: 0,
      lastEventTs: 0,
      healthReportedAt: now - (20 * 60 * 1000),
      now,
    })).toBe(false);
  });

  it('marks Telegram-active agents with open tasks as busy', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentReply = now - (10 * 60 * 1000);

    expect(status.deriveWorkStatus({
      openTaskCount: 2,
      chatLastSeenAt: recentReply,
      chatSource: 'telegram',
      now,
    })).toBe('busy');
  });

  it('treats fresh Telegram activity as an active signal', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentChat = now - (10 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      openTaskCount: 0,
      chatLastSeenAt: recentChat,
      chatSource: 'telegram',
      lastEventTs: 0,
      now,
    })).toBe('idle');

    expect(status.deriveTierStatus({
      online: false,
      chatLastSeenAt: recentChat,
      chatSource: 'telegram',
      lastEventTs: 0,
      now,
    })).toBe('active');
  });

  it('treats Telegram mentions as weaker online signals than actual bot replies', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentMention = now - (10 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      openTaskCount: 0,
      chatLastSeenAt: recentMention,
      chatSource: 'telegram-mention',
      lastEventTs: 0,
      now,
    })).toBe('idle');

    expect(status.deriveTierStatus({
      online: false,
      chatLastSeenAt: recentMention,
      chatSource: 'telegram-mention',
      lastEventTs: 0,
      now,
    })).toBe('online');
  });

  it('keeps older Telegram replies online before they fall back to unknown', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const olderReply = now - (90 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      chatLastSeenAt: olderReply,
      chatSource: 'telegram',
      now,
    })).toBe('idle');

    expect(status.deriveTierStatus({
      online: false,
      chatLastSeenAt: olderReply,
      chatSource: 'telegram',
      now,
    })).toBe('online');
  });
});
