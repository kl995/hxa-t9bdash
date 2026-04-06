import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const db = require('../src/db.js');
const entity = require('../src/entity.js');
const telegramActivity = require('../src/fetchers/telegram-activity.js');
const { buildTelegramActivitySnapshot } = require('../src/routes/telegram-activity.js');

describe('telegram activity fetcher', () => {
  const tempDirs = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('captures recent Telegram reply metadata for known agents', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hxa-dash-telegram-'));
    tempDirs.push(dir);

    db.upsertAgent({ name: 'the9bit_cocobot', online: false });

    const now = new Date();
    const recentTs = new Date(now.getTime() - (5 * 60 * 1000)).toISOString();
    const staleTs = new Date(now.getTime() - (2 * 60 * 60 * 1000)).toISOString();

    fs.writeFileSync(path.join(dir, 'chat.log'), [
      JSON.stringify({ timestamp: staleTs, user_id: 'bot', user_name: 'the9bit_cocobot', text: 'old update', thread_id: 1 }),
      JSON.stringify({ timestamp: recentTs, user_id: 'bot', user_name: 'the9bit_cocobot', text: 'Latest Telegram reply\nwith two lines', thread_id: 7 }),
    ].join('\n'));

    const result = await telegramActivity.pollActivity({ logDir: dir, maxAgeMs: 30 * 60 * 1000 });
    const agent = db.getAgent('the9bit_cocobot');

    expect(result.updated).toBe(1);
    expect(agent.chat_source).toBe('telegram');
    expect(agent.chat_last_channel).toBe('chat');
    expect(agent.chat_last_thread_id).toBe(7);
    expect(agent.chat_last_preview).toBe('Latest Telegram reply with two lines');
    expect(agent.chat_last_seen_at).toBeGreaterThan(0);
  });

  it('maps Telegram aliases onto canonical agent identities', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hxa-dash-telegram-'));
    tempDirs.push(dir);

    entity.register('ops-bot', { connect: 'ops-bot', telegram: 'ops_updates_bot' });

    const recentTs = new Date(Date.now() - (3 * 60 * 1000)).toISOString();
    fs.writeFileSync(path.join(dir, 'ops.log'), [
      JSON.stringify({ timestamp: recentTs, user_id: 'bot', user_name: 'ops_updates_bot', text: 'Recent status sync', thread_id: 11 }),
    ].join('\n'));

    const result = await telegramActivity.pollActivity({ logDir: dir, maxAgeMs: 30 * 60 * 1000 });
    const agent = db.getAgent('ops-bot');

    expect(result.updated).toBe(1);
    expect(agent).toBeTruthy();
    expect(agent.chat_last_channel).toBe('ops');
    expect(agent.chat_last_thread_id).toBe(11);
    expect(agent.chat_last_preview).toBe('Recent status sync');
  });

  it('imports remote Telegram activity when local logs are unavailable', async () => {
    db.upsertAgent({ name: 'the9bit_cocobot', online: false });

    const remoteTs = Date.now() - (2 * 60 * 1000);
    const originalFetch = global.fetch;
    const fetchCalls = [];
    global.fetch = async (url, options = {}) => {
      fetchCalls.push({ url, options });
      return ({
      ok: true,
      async json() {
        return {
          generated_at: Date.now(),
          agents: [
            {
              name: 'the9bit_cocobot',
              chat_activity: {
                source: 'telegram',
                last_seen_at: remoteTs,
                preview: 'Bridge refresh from remote dashboard',
                channel: '1027254751',
                thread_id: null,
              },
            },
          ],
        };
      },
      });
    };

    try {
      const result = await telegramActivity.pollActivity({
        logDir: path.join(os.tmpdir(), 'missing-telegram-logs'),
        maxAgeMs: 30 * 60 * 1000,
        remoteUrl: 'https://example.com/api/team',
      });
      const agent = db.getAgent('the9bit_cocobot');

      expect(result.updated).toBe(1);
      expect(agent.chat_last_seen_at).toBe(remoteTs);
      expect(agent.chat_last_preview).toBe('Bridge refresh from remote dashboard');
      expect(agent.chat_last_channel).toBe('1027254751');
      expect(fetchCalls).toHaveLength(1);
      expect(fetchCalls[0].options.headers).toMatchObject({
        accept: 'application/json',
        'bypass-tunnel-reminder': 'true',
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('exports a compact Telegram activity snapshot for remote consumers', () => {
    const now = Date.now();
    db.upsertAgent({
      name: 'the9bit_cocobot',
      chat_last_seen_at: now - 60_000,
      chat_source: 'telegram',
      chat_last_preview: 'Latest remote-visible reply',
      chat_last_channel: '1027254751',
      chat_last_thread_id: 9,
    });

    const snapshot = buildTelegramActivitySnapshot({ now, maxAgeMs: 5 * 60 * 1000 });

    expect(snapshot.agents).toContainEqual({
      name: 'the9bit_cocobot',
      chat_activity: {
        source: 'telegram',
        last_seen_at: now - 60_000,
        preview: 'Latest remote-visible reply',
        channel: '1027254751',
        thread_id: 9,
      },
    });
  });
});
