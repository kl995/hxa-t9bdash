import { describe, it, expect } from 'vitest';

const { loadFromEnv } = require('../src/config-loader');

describe('config-loader', () => {
  it('builds config from single-scope environment variables', () => {
    const config = loadFromEnv({
      HXA_CONNECT_HUB_URL: 'https://connect.example.com/hub',
      HXA_CONNECT_AGENT_TOKEN: 'agent-token',
      HXA_GITLAB_URL: 'https://gitlab.example.com',
      HXA_GITLAB_TOKEN: 'gitlab-token',
      HXA_GITLAB_GROUP_ID: '42',
      HXA_POLL_CONNECT_INTERVAL_MS: '15000',
      HXA_POLL_GITLAB_INTERVAL_MS: '45000',
      HXA_SCOPE_NAME: 'Railway Scope',
    });

    expect(config.connect.hub_url).toBe('https://connect.example.com/hub');
    expect(config.gitlab.group_id).toBe(42);
    expect(config.polling.connect_interval_ms).toBe(15000);
    expect(config.scope_name).toBe('Railway Scope');
  });

  it('prefers full JSON config when HXA_CONFIG_JSON is set', () => {
    const config = loadFromEnv({
      HXA_CONFIG_JSON: JSON.stringify({
        scopes: [{ org_id: 'org-1', name: 'Org 1' }],
        polling: { connect_interval_ms: 20000 },
      }),
      HXA_CONNECT_HUB_URL: 'https://should-not-be-used.example.com',
    });

    expect(config.scopes).toHaveLength(1);
    expect(config.polling.connect_interval_ms).toBe(20000);
    expect(config.connect).toBeUndefined();
  });
});
