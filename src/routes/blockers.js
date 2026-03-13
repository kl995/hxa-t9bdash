const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/blockers
// Detect project blockers: stale issues, unreviewed MRs, idle agents.
// Query params:
//   threshold_issue_h  - hours since last update to flag a stale issue (default: 72)
//   threshold_mr_h     - hours open to flag an unreviewed MR (default: 24)
//   threshold_agent_h  - hours since last_seen_at to flag an idle agent (default: 4)
router.get('/', (req, res) => {
  const threshold_issue_h = Math.max(1, parseInt(req.query.threshold_issue_h) || 72);
  const threshold_mr_h = Math.max(1, parseInt(req.query.threshold_mr_h) || 24);
  const threshold_agent_h = Math.max(1, parseInt(req.query.threshold_agent_h) || 4);

  const now = Date.now();
  const issueThresholdMs = threshold_issue_h * 3600000;
  const mrThresholdMs = threshold_mr_h * 3600000;
  const agentThresholdMs = threshold_agent_h * 3600000;

  const stale_issues = db.getStaleIssues(now, issueThresholdMs);
  const unreviewed_mrs = db.getUnreviewedMRs(now, mrThresholdMs);
  const idle_agents = db.getIdleAgents(now, agentThresholdMs);

  res.json({
    stale_issues,
    unreviewed_mrs,
    idle_agents,
    total: stale_issues.length + unreviewed_mrs.length + idle_agents.length,
  });
});

module.exports = router;
