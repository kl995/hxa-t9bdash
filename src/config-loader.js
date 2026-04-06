const fs = require('fs');
const path = require('path');

function parseJsonValue(raw, label) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON in ${label}: ${error.message}`);
  }
}

function parseInteger(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function loadFromFile(configPath) {
  if (!fs.existsSync(configPath)) return null;
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadFromEnv(env = process.env) {
  const configJson = parseJsonValue(env.HXA_CONFIG_JSON, 'HXA_CONFIG_JSON');
  if (configJson) return configJson;

  const scopes = parseJsonValue(env.HXA_SCOPES_JSON, 'HXA_SCOPES_JSON');
  const entities = parseJsonValue(env.HXA_ENTITIES_JSON, 'HXA_ENTITIES_JSON');
  const healthEndpoints = parseJsonValue(env.HXA_HEALTH_ENDPOINTS_JSON, 'HXA_HEALTH_ENDPOINTS_JSON');
  const notifications = parseJsonValue(env.HXA_NOTIFICATIONS_JSON, 'HXA_NOTIFICATIONS_JSON');
  const webhooks = parseJsonValue(env.HXA_WEBHOOKS_JSON, 'HXA_WEBHOOKS_JSON');
  const telegramActivity = parseJsonValue(env.HXA_TELEGRAM_ACTIVITY_JSON, 'HXA_TELEGRAM_ACTIVITY_JSON');

  const connect = {
    hub_url: env.HXA_CONNECT_HUB_URL || null,
    agent_token: env.HXA_CONNECT_AGENT_TOKEN || null,
  };
  const gitlab = {
    url: env.HXA_GITLAB_URL || null,
    token: env.HXA_GITLAB_TOKEN || null,
    group_id: parseInteger(env.HXA_GITLAB_GROUP_ID),
  };
  const polling = {
    connect_interval_ms: parseInteger(env.HXA_POLL_CONNECT_INTERVAL_MS),
    gitlab_interval_ms: parseInteger(env.HXA_POLL_GITLAB_INTERVAL_MS),
  };

  const hasSingleScopeConfig =
    connect.hub_url || connect.agent_token || gitlab.url || gitlab.token || gitlab.group_id;

  if (!scopes && !entities && !healthEndpoints && !notifications && !webhooks && !hasSingleScopeConfig) {
    return null;
  }

  const config = {};
  if (scopes) config.scopes = scopes;
  if (entities) config.entities = entities;
  if (healthEndpoints) config.health_endpoints = healthEndpoints;
  if (notifications) config.notifications = notifications;
  if (webhooks) config.webhooks = webhooks;
  if (telegramActivity) config.telegram_activity = telegramActivity;
  if (env.HXA_SCOPE_NAME) config.scope_name = env.HXA_SCOPE_NAME;
  if (env.HXA_SCOPE_ID) config.scope_id = env.HXA_SCOPE_ID;
  if (hasSingleScopeConfig) {
    config.connect = connect;
    config.gitlab = gitlab;
  }
  if (polling.connect_interval_ms || polling.gitlab_interval_ms) {
    config.polling = {};
    if (polling.connect_interval_ms) config.polling.connect_interval_ms = polling.connect_interval_ms;
    if (polling.gitlab_interval_ms) config.polling.gitlab_interval_ms = polling.gitlab_interval_ms;
  }
  if (!config.telegram_activity) {
    const remote_url = env.HXA_TELEGRAM_ACTIVITY_REMOTE_URL || null;
    const log_dir = env.HXA_TELEGRAM_ACTIVITY_LOG_DIR || null;
    const max_age_ms = parseInteger(env.HXA_TELEGRAM_ACTIVITY_MAX_AGE_MS);
    if (remote_url || log_dir || max_age_ms) {
      config.telegram_activity = {};
      if (remote_url) config.telegram_activity.remote_url = remote_url;
      if (log_dir) config.telegram_activity.log_dir = log_dir;
      if (max_age_ms) config.telegram_activity.max_age_ms = max_age_ms;
    }
  }
  return config;
}

function loadConfig(options = {}) {
  const configPath = options.configPath || path.join(__dirname, '..', 'config', 'sources.json');
  const env = options.env || process.env;

  const fileConfig = loadFromFile(configPath);
  if (fileConfig) {
    return { config: fileConfig, source: configPath };
  }

  const envConfig = loadFromEnv(env);
  if (envConfig) {
    return { config: envConfig, source: 'env' };
  }

  return { config: null, source: null, configPath };
}

module.exports = {
  loadConfig,
  loadFromEnv,
};
