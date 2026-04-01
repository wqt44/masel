'use strict';

function formatOverlaySummaryBlock(summary) {
  if (!summary) return 'ClawTeam overlay: unavailable';

  const headline = [
    `ClawTeam overlay: ${summary.teams || 0} teams`,
    `${summary.pausedPendingLeader || 0} paused_pending_leader`,
    `${summary.activeOverlay || 0} active overlay`
  ].join(', ');

  const lines = [headline];

  if ((summary.filteredTeams || 0) > 0) {
    lines.push(`Filtered test teams: ${summary.filteredTeams}/${summary.rawTeams || summary.filteredTeams}`);
  }

  if (Array.isArray(summary.pausedTasks) && summary.pausedTasks.length) {
    summary.pausedTasks.slice(0, 3).forEach(task => {
      const bits = [];
      if (task.taskId) bits.push(task.taskId);
      if (task.taskTitle) bits.push(task.taskTitle);
      if (task.targetRole) bits.push('-> ' + task.targetRole);
      if (task.overlayMeta && task.overlayMeta.fallbackMode) bits.push('[' + task.overlayMeta.fallbackMode + ']');
      lines.push('Top paused: ' + bits.join(' '));
    });
  }

  return lines.join('\n');
}

module.exports = {
  formatOverlaySummaryBlock
};
