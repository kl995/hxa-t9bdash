// Team Capacity Overview Component (#45)
// Depends on: esc() and truncate() from app.js (loaded before this script)
const TeamCapacity = {
  containerId: 'team-capacity',

  render(agents) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const online = agents.filter(a => a.online);
    const totalOpen = agents.reduce((sum, a) => sum + (a.stats?.open_tasks || 0), 0);
    const totalCapacity = agents.reduce((sum, a) => sum + (a.capacity?.max || 5), 0);
    const busyAgents = online.filter(a => (a.stats?.open_tasks || 0) > 0);
    const utilPct = online.length > 0 ? Math.round((busyAgents.length / online.length) * 100) : 0;

    // Completed this week (7d)
    const completedThisWeek = agents.reduce((sum, a) => sum + (a.stats?.closed_last_7d || 0), 0);

    // Bottleneck: agent with most open tasks
    let bottleneck = null;
    let maxOpen = 0;
    for (const a of agents) {
      const open = a.stats?.open_tasks || 0;
      if (open > maxOpen) { bottleneck = a.name; maxOpen = open; }
    }

    const utilClass = utilPct > 80 ? 'util-high' : utilPct > 50 ? 'util-mid' : 'util-low';
    const text = {
      openTasks: I18n.current === 'zh' ? '进行中任务' : 'Open Tasks',
      completedWeek: I18n.current === 'zh' ? '本周完成' : 'Completed This Week',
      onlineAgents: I18n.current === 'zh' ? '在线 Agent' : 'Online Agents',
      teamUtilization: I18n.current === 'zh' ? '团队利用率' : 'Team Utilization',
      totalLoad: I18n.current === 'zh' ? '总负载' : 'Total Load',
      utilization: I18n.current === 'zh' ? '利用率' : 'utilization',
      bottleneck: I18n.current === 'zh' ? '⚠️ 瓶颈检测' : '⚠️ Bottleneck',
      bottleneckSuffix: I18n.current === 'zh' ? '个进行中任务' : 'open tasks'
    };

    container.innerHTML = `
      <div class="team-capacity-grid">
        <div class="tc-stat-box">
          <div class="tc-stat-num">${totalOpen}</div>
          <div class="tc-stat-label">${text.openTasks}</div>
        </div>
        <div class="tc-stat-box">
          <div class="tc-stat-num">${completedThisWeek}</div>
          <div class="tc-stat-label">${text.completedWeek}</div>
        </div>
        <div class="tc-stat-box">
          <div class="tc-stat-num">${online.length}/${agents.length}</div>
          <div class="tc-stat-label">${text.onlineAgents}</div>
        </div>
        <div class="tc-stat-box">
          <div class="tc-stat-num ${utilPct > 80 ? 'tc-danger' : utilPct > 50 ? 'tc-warn' : ''}">${utilPct}%</div>
          <div class="tc-stat-label">${text.teamUtilization}</div>
        </div>
      </div>
      <div class="tc-utilization-bar">
        <div class="tc-util-header">
          <span>${text.totalLoad}: ${totalOpen}/${totalCapacity}</span>
          <span>${utilPct}% ${text.utilization}</span>
        </div>
        <div class="tc-util-track">
          <div class="tc-util-fill ${utilClass}" style="width:${totalCapacity > 0 ? Math.min(100, Math.round((totalOpen / totalCapacity) * 100)) : 0}%"></div>
        </div>
      </div>
      ${bottleneck && maxOpen >= 3 ? `
        <div class="tc-bottleneck">
          <span>${text.bottleneck}: ${esc(bottleneck)} ${I18n.current === 'zh' ? '有' : 'has'} ${maxOpen} ${text.bottleneckSuffix}</span>
        </div>
      ` : ''}
    `;
  }
};
