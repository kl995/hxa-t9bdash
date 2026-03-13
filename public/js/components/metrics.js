// Team Utilization & Output Metrics Panel (#62 Phase 1)
const Metrics = {
  data: null,
  container: null,

  init() {
    this.container = document.getElementById('metrics-panel');
    this.load();
    setInterval(() => this.load(), 5 * 60 * 1000);
  },

  async load() {
    try {
      const r = await fetch(`${BASE}/api/metrics`);
      if (!r.ok) return;
      this.data = await r.json();
      this.render();
    } catch (e) { /* silent fail */ }
  },

  render() {
    if (!this.container || !this.data) return;
    const { team, agents } = this.data;

    const cycleTime = team.cycle_time_median_hours != null
      ? `${team.cycle_time_median_hours}h`
      : '—';

    // Summary cards
    const cards = `
      <div class="metrics-cards">
        <div class="metrics-card">
          <div class="metrics-card-value">${team.idle_pct}<span class="metrics-card-unit">%</span></div>
          <div class="metrics-card-label">在线空闲率</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${team.issues_closed_7d}</div>
          <div class="metrics-card-label">Issue 完成 / 7天</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${team.mrs_merged_7d}</div>
          <div class="metrics-card-label">MR 合并 / 7天</div>
        </div>
        <div class="metrics-card">
          <div class="metrics-card-value">${cycleTime}</div>
          <div class="metrics-card-label">周期时间中位数</div>
        </div>
      </div>
    `;

    // Agent table
    const rows = agents.map(a => `
      <tr>
        <td class="metrics-agent-name">${esc(a.name)}</td>
        <td><span class="work-status-badge ${esc(a.status)}">${this._statusLabel(a.status)}</span></td>
        <td class="metrics-num">${a.open_tasks}</td>
        <td class="metrics-num">${a.closed_7d}</td>
        <td class="metrics-num">${a.mrs_7d}</td>
      </tr>
    `).join('');

    const table = `
      <div class="metrics-table-wrap">
        <table class="metrics-table">
          <thead>
            <tr>
              <th>Agent</th>
              <th>状态</th>
              <th>进行中</th>
              <th>完成 (7d)</th>
              <th>MR (7d)</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5" class="metrics-empty">暂无成员数据</td></tr>'}</tbody>
        </table>
      </div>
    `;

    // Weekly trend bar chart (CSS bars, no canvas)
    const trend = this._renderTrend(team.weekly_closed || []);

    this.container.innerHTML = cards + table + trend;
  },

  _statusLabel(s) {
    return s === 'busy' ? '进行中' : s === 'idle' ? '空闲' : '离线';
  },

  _renderTrend(weeks) {
    if (weeks.length === 0) return '';

    const maxIssues = Math.max(...weeks.map(w => w.issues_closed), 1);
    const maxMRs    = Math.max(...weeks.map(w => w.mrs_merged),   1);
    const maxVal    = Math.max(maxIssues, maxMRs, 1);

    const bars = weeks.map(w => {
      const iPct = Math.round((w.issues_closed / maxVal) * 100);
      const mPct = Math.round((w.mrs_merged    / maxVal) * 100);
      // Short label: "W10" from "2026-W10"
      const label = w.week.replace(/^\d{4}-/, '');
      return `
        <div class="metrics-trend-col">
          <div class="metrics-trend-bars">
            <div class="metrics-trend-bar bar-issue" style="height:${iPct}%" title="${w.issues_closed} issues"></div>
            <div class="metrics-trend-bar bar-mr"    style="height:${mPct}%" title="${w.mrs_merged} MRs"></div>
          </div>
          <div class="metrics-trend-label">${esc(label)}</div>
          <div class="metrics-trend-nums">${w.issues_closed}/${w.mrs_merged}</div>
        </div>
      `;
    }).join('');

    return `
      <div class="metrics-trend-section">
        <div class="metrics-trend-title">
          按周趋势
          <span class="metrics-trend-legend">
            <span class="metrics-legend-dot dot-issue"></span>Issue
            <span class="metrics-legend-dot dot-mr"></span>MR
          </span>
        </div>
        <div class="metrics-trend-chart">${bars}</div>
      </div>
    `;
  }
};
