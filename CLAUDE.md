# CLAUDE.md — hxa-dash

This file is automatically loaded by Claude Code on every session start. Rules here are mandatory.

## Project Overview

hxa-dash is the Agent Team Visualization Dashboard — a real-time web dashboard showing agent team activity, task progress, and collaboration patterns across GitLab projects.

- **Stack**: Node.js + Express + Socket.IO + vanilla JS frontend
- **Data sources**: GitLab API (issues, MRs, commits, pipelines) via polling + webhooks
- **Deploy**: PM2 (hxa-dash), port 3479, jessie.coco.site/hxa-dash/
- **GitLab**: git.coco.xyz/hxanet/hxa-dash (project ID 9)

## Mandatory Rules

### 1. Commit Messages

Format: `<type>(<scope>): #<issue> <description>`

Examples:
- `fix(polling): #41 deduplicate data between refresh methods`
- `feat(ui): #43 add incremental DOM updates with CSS transitions`

Types: `feat`, `fix`, `docs`, `chore`, `test`, `refactor`

**Every commit MUST reference an issue number.**

### 2. Merge Request Rules

- **MR description MUST include:**
  - What changed and why (1-2 sentences)
  - Issue reference (`Closes #XX`)
  - Test evidence (screenshot, before/after comparison, or test output)
- **After creating MR:** Immediately ping a reviewer via HxA Connect
- **Chore/docs MRs:** Author can self-merge
- **Code MRs:** Need 1 peer review before merge

### 3. Review SLA

- **2 hours** max to respond to a review request
- **4 hours** max to merge or provide feedback
- If reviewer unresponsive after 2h, escalate to Jessie

### 4. Self-Sufficiency

- Do NOT wait for Jessie to review or merge if you can handle it yourself
- If pipeline fails due to runner issues (not code), report it and request bypass
- If blocked, comment on the issue immediately

### 5. UI Changes

- Test in browser before submitting MR
- Attach screenshot showing the change works
- Check for console errors
- Verify Socket.IO real-time updates still work after changes

### 6. Data Accuracy

- Polling data and webhook data must produce identical results
- Test with manual refresh AND automatic polling to verify consistency
- Entity mapping (agent identities across GitLab/Connect/GitHub) must be verified

### 7. Communication

- All work tracked as GitLab issues
- Report progress in HxA Connect threads
- When done with a task, close the issue and notify in the thread

### 8. Blocker SLA — No Idle Waiting (Agent-Scale Time)

- **5 minutes**: Blocker appears → someone MUST pick it up
- **10 minutes**: MR review notes pending with no response → fix directly and merge
- **15 minutes**: MR pipeline passed, no reviewer → auto-escalate to Jessie/Boot
- **30 minutes**: MR open with zero activity → reassign to available agent
- **Proactive handoff**: See a stalled MR or blocked task → take ownership immediately

### 9. Decentralized Issue Claiming

- Every agent session start: scan unassigned issues on hxa-dash, hxa-link, ClawMark
- See unassigned issue → assess fit → self-assign on GitLab + start working
- Do NOT wait for Jessie to assign. First come, first served.
- 15min unassigned → auto-escalate. 30min → Jessie force-assigns.
- Assignment MUST be on GitLab (not just verbal in thread).

### 10. Deploy Self-Check

After merging code MRs:
1. `git pull origin main` on jessie.coco.site
2. `pm2 restart hxa-dash`
3. Verify: page loads, no console errors, WebSocket connects, data refreshes
4. If CSS broken → check for unclosed `{}` or missing imports (common regression)

### 11. Design-First for Architecture Changes

- Feature requests involving data model changes, new API endpoints, or multi-component refactors → write design doc first
- Design doc goes in `docs/` directory
- Kevin reviews design before implementation starts
- Small bug fixes and UI tweaks → direct implementation OK

## Architecture Notes

- `src/server.js` — Express + Socket.IO server, GitLab API polling
- `src/webhook.js` — GitLab webhook handler
- `public/` — Frontend (vanilla JS, no build step)
- `config/sources.json` — GitLab project data sources
- `data/agents.json` — Agent identity mapping (connect + gitlab + github usernames)

## Team

- **Boot** — Primary developer for hxa-dash
- **Jessie** — Project lead, architecture
- **Kevin** — Product owner, UX feedback
