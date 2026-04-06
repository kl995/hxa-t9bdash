import { describe, expect, it } from 'vitest';

const status = await import('../src/status.js').then(m => m.default || m);

describe('status signal freshness', () => {
  it('treats stale offline agents as unknown when there is no recent signal', () => {
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

  it('keeps recent offline agents classified as offline', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentSeen = now - (20 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      lastSeenAt: recentSeen,
      now,
    })).toBe('offline');

    expect(status.deriveTierStatus({
      online: false,
      lastSeenAt: recentSeen,
      now,
    })).toBe('offline');
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

  it('preserves busy and inactive states for online agents', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);

    expect(status.deriveWorkStatus({
      online: true,
      openTaskCount: 2,
      lastEventTs: now - (30 * 60 * 1000),
      now,
    })).toBe('busy');

    expect(status.deriveWorkStatus({
      online: true,
      openTaskCount: 0,
      lastEventTs: now - (30 * 60 * 60 * 1000),
      now,
    })).toBe('inactive');
  });

  it('treats fresh Telegram activity as an active signal', () => {
    const now = Date.UTC(2026, 3, 6, 8, 0, 0);
    const recentChat = now - (10 * 60 * 1000);

    expect(status.deriveWorkStatus({
      online: false,
      openTaskCount: 0,
      chatLastSeenAt: recentChat,
      lastEventTs: 0,
      now,
    })).toBe('idle');

    expect(status.deriveTierStatus({
      online: false,
      chatLastSeenAt: recentChat,
      lastEventTs: 0,
      now,
    })).toBe('active');
  });
});
