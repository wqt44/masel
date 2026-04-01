const { execSync } = require('child_process');
const actionAudit = require('./clawteam-action-audit');

async function applySchedulerDecision(decision, ctx = {}) {
  const {
    spawnAgent,
    reassignTask,
    notifyLeader,
    requestClarification,
    finalizeTask,
    logger = console
  } = ctx.handlers || {};

  if (!decision || !decision.action) {
    return { ok: false, error: "invalid_decision" };
  }

  logger.log?.("[scheduler] applying decision:", decision);

  if (decision.suppressed) {
    return {
      ok: true,
      type: "suppressed",
      dryRun: true,
      skipped: true,
      reason: decision.reason,
      suppressionReason: decision.suppressionReason,
      schedulerDecision: decision
    };
  }

  switch (decision.action) {
    case "continue":
      return {
        ok: true,
        action: "continue",
        skipped: true,
        reason: decision.reason,
        dryRun: true
      };

    case "assign_reviewer":
      if (!spawnAgent) {
        return { ok: false, error: "missing_handler_spawnAgent", decision };
      }
      return spawnAgent({
        role: decision.targetRole,
        purpose: "review",
        trigger: decision.reason,
        schedulerDecision: decision
      });

    case "reassign":
      if (!reassignTask) {
        return { ok: false, error: "missing_handler_reassignTask", decision };
      }
      return reassignTask({
        role: decision.targetRole,
        trigger: decision.reason,
        schedulerDecision: decision
      });

    case "request_more_info":
      if (!requestClarification) {
        return { ok: false, error: "missing_handler_requestClarification", decision };
      }
      return requestClarification({
        role: decision.targetRole,
        trigger: decision.reason,
        schedulerDecision: decision
      });

    case "escalate_to_leader":
      if (!notifyLeader) {
        return { ok: false, error: "missing_handler_notifyLeader", decision };
      }
      return notifyLeader({
        role: decision.targetRole,
        trigger: decision.reason,
        schedulerDecision: decision
      });

    case "finalize":
      if (!finalizeTask) {
        return { ok: false, error: "missing_handler_finalizeTask", decision };
      }
      return finalizeTask({
        role: decision.targetRole,
        trigger: decision.reason,
        schedulerDecision: decision
      });

    default:
      return {
        ok: false,
        error: "unknown_scheduler_action",
        decision
      };
  }
}

function createSchedulerHandlers(deps = {}) {
  const logger = deps.logger || console;
  const executionMode = deps.executionMode || 'dry-run';
  const allowAutoReviewer = executionMode === 'semi-auto' || deps.allowAutoReviewer === true;
  const allowAutoClarification = executionMode === 'semi-auto' || deps.allowAutoClarification === true;
  const allowAutoLeaderNotify = executionMode === 'semi-auto' || deps.allowAutoLeaderNotify === true;
  const allowAutoReassign = executionMode === 'semi-auto' || deps.allowAutoReassign === true;
  const teamId = deps.teamId || 'unknown-team';
  const taskId = deps.taskId || 'unknown-task';
  const actorRole = deps.actorRole || 'leader';
  const clarificationTemplate = deps.clarificationTemplate || '[Clarification Request] Please provide more detail for task {taskId}. Trigger: {trigger}';
  const reviewerTemplate = deps.reviewerTemplate || '[Review Request] Please review task {taskId}. Trigger: {trigger}';
  const leaderFallbackTemplate = deps.leaderFallbackTemplate || '[Leader Fallback] Task {taskId} has been paused and reported. Trigger: {trigger}. Suggested fallback role: {role}.{details}';
  const failureThreshold = Number.isFinite(deps.failureThreshold) ? deps.failureThreshold : 2;
  const cooldownMs = Number.isFinite(deps.cooldownMs) ? deps.cooldownMs : 10 * 60 * 1000;
  const forceFailSend = deps.forceFailSend === true;

  function recordAudit(entry) {
    try {
      return actionAudit.appendAudit(teamId, {
        taskId,
        actorRole,
        ...entry
      });
    } catch (error) {
      logger.log?.('[scheduler] audit failed:', error.message);
      return null;
    }
  }

  function shouldCooldown(fingerprint) {
    if (!fingerprint) return { active: false, consecutiveFailures: 0 };
    const summary = actionAudit.summarizeRecentFailures(teamId, fingerprint, 30);
    if (!summary.lastFailureAt || summary.consecutiveFailures < failureThreshold) {
      return { active: false, consecutiveFailures: summary.consecutiveFailures };
    }
    const elapsed = Date.now() - new Date(summary.lastFailureAt).getTime();
    return {
      active: elapsed < cooldownMs,
      consecutiveFailures: summary.consecutiveFailures,
      retryAfterMs: Math.max(cooldownMs - elapsed, 0)
    };
  }

  function renderClarification(role, trigger) {
    return clarificationTemplate
      .replace(/\{taskId\}/g, String(taskId))
      .replace(/\{role\}/g, String(role || 'worker'))
      .replace(/\{trigger\}/g, String(trigger || 'unknown'));
  }

  function renderReviewer(role, trigger, purpose) {
    return reviewerTemplate
      .replace(/\{taskId\}/g, String(taskId))
      .replace(/\{role\}/g, String(role || 'reviewer'))
      .replace(/\{trigger\}/g, String(trigger || 'unknown'))
      .replace(/\{purpose\}/g, String(purpose || 'review'));
  }

  function renderLeaderFallback(role, trigger, meta) {
    const details = [];
    if (meta && meta.taskTitle) details.push(' Title: ' + meta.taskTitle + '.');
    if (meta && meta.assignedRole) details.push(' Current role: ' + meta.assignedRole + '.');
    if (meta && Number.isFinite(meta.consecutiveFailures)) details.push(' Consecutive failures: ' + meta.consecutiveFailures + '.');
    if (meta && Number.isFinite(meta.retryAfterMs) && meta.retryAfterMs > 0) details.push(' Cooldown remaining: ' + Math.ceil(meta.retryAfterMs / 1000) + 's.');
    if (meta && meta.sourceType) details.push(' Source: ' + meta.sourceType + '.');

    return leaderFallbackTemplate
      .replace(/\{taskId\}/g, String((meta && meta.taskId) || taskId))
      .replace(/\{role\}/g, String(role || 'fallback'))
      .replace(/\{trigger\}/g, String(trigger || 'unknown'))
      .replace(/\{details\}/g, details.join(''));
  }

  async function sendLeaderFallback({ role, trigger, schedulerDecision, reason, meta, bypassDryRun }) {
    const fallbackMeta = {
      ...(meta || {}),
      taskId: (meta && meta.taskId) || (schedulerDecision && schedulerDecision.taskId) || taskId,
      taskTitle: (meta && meta.taskTitle) || (schedulerDecision && schedulerDecision.taskTitle) || taskId,
      assignedRole: (meta && meta.assignedRole) || (schedulerDecision && schedulerDecision.assignedRole) || actorRole
    };
    const message = renderLeaderFallback(role, trigger, fallbackMeta);
    const fingerprint = schedulerDecision && schedulerDecision.fingerprint;
    const canSend = bypassDryRun || allowAutoLeaderNotify;

    if (!canSend) {
      const result = {
        ok: true,
        type: 'notify_leader',
        dryRun: true,
        executed: false,
        role,
        trigger,
        actorRole,
        message,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta,
        schedulerDecision
      };
      result.audit = recordAudit({
        type: 'notify_leader',
        mode: 'dry-run',
        ok: true,
        targetRole: role,
        trigger,
        fingerprint,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta
      });
      return result;
    }

    try {
      if (forceFailSend) throw new Error('forced_send_failure');
      execSync('clawteam inbox send ' + teamId + ' leader ' + JSON.stringify(message), {
        stdio: 'pipe',
        timeout: 5000
      });
      const result = {
        ok: true,
        type: 'notify_leader',
        dryRun: false,
        executed: true,
        role,
        trigger,
        actorRole,
        message,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta,
        schedulerDecision
      };
      result.audit = recordAudit({
        type: 'notify_leader',
        mode: 'semi-auto',
        ok: true,
        targetRole: 'leader',
        trigger,
        fingerprint,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta
      });
      return result;
    } catch (error) {
      const result = {
        ok: false,
        type: 'notify_leader',
        dryRun: false,
        executed: false,
        role,
        trigger,
        actorRole,
        message,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta,
        schedulerDecision,
        error: error.message,
        fallback: 'dry-run'
      };
      result.audit = recordAudit({
        type: 'notify_leader',
        mode: 'semi-auto',
        ok: false,
        targetRole: 'leader',
        trigger,
        fingerprint,
        reason: reason || 'leader_fallback_notify',
        meta: fallbackMeta,
        error: error.message,
        fallback: 'dry-run'
      });
      return result;
    }
  }

  async function buildCooldownResult(base) {
    const leaderNotification = await sendLeaderFallback({
      role: base.role,
      trigger: base.trigger,
      schedulerDecision: base.schedulerDecision,
      reason: 'cooldown_active',
      meta: {
        paused: true,
        consecutiveFailures: base.cooldownInfo.consecutiveFailures,
        retryAfterMs: base.cooldownInfo.retryAfterMs || 0,
        sourceType: base.type,
        taskTitle: base.schedulerDecision && base.schedulerDecision.taskTitle,
        assignedRole: base.schedulerDecision && base.schedulerDecision.assignedRole
      },
      bypassDryRun: true
    });

    const result = {
      ok: false,
      type: base.type,
      dryRun: true,
      executed: false,
      role: base.role,
      trigger: base.trigger,
      actorRole,
      schedulerDecision: base.schedulerDecision,
      cooldown: true,
      paused: true,
      reported: Boolean(leaderNotification && leaderNotification.executed),
      leaderNotification,
      consecutiveFailures: base.cooldownInfo.consecutiveFailures,
      retryAfterMs: base.cooldownInfo.retryAfterMs || 0,
      error: 'cooldown_active'
    };
    result.audit = recordAudit({
      type: base.type,
      mode: 'cooldown',
      ok: false,
      targetRole: base.role,
      trigger: base.trigger,
      fingerprint: base.schedulerDecision && base.schedulerDecision.fingerprint,
      error: 'cooldown_active',
      paused: true,
      reported: result.reported,
      consecutiveFailures: base.cooldownInfo.consecutiveFailures,
      retryAfterMs: base.cooldownInfo.retryAfterMs || 0
    });
    return result;
  }

  return {
    logger,

    spawnAgent: async ({ role, purpose, trigger, schedulerDecision }) => {
      const message = renderReviewer(role, trigger, purpose);
      const fingerprint = schedulerDecision && schedulerDecision.fingerprint;
      const cooldownInfo = shouldCooldown(fingerprint);

      if (cooldownInfo.active) {
        return await buildCooldownResult({
          type: 'spawn_agent',
          role,
          trigger,
          schedulerDecision,
          cooldownInfo
        });
      }

      if (!allowAutoReviewer) {
        const result = {
          ok: true,
          type: "spawn_agent",
          dryRun: true,
          executed: false,
          role,
          purpose,
          trigger,
          message,
          schedulerDecision
        };
        result.audit = recordAudit({
          type: 'spawn_agent',
          mode: 'dry-run',
          ok: true,
          targetRole: role,
          trigger,
          fingerprint
        });
        return result;
      }

      try {
        if (forceFailSend) throw new Error('forced_send_failure');
        execSync('clawteam inbox send ' + teamId + ' ' + role + ' ' + JSON.stringify(message), {
          stdio: 'pipe',
          timeout: 5000
        });
        const result = {
          ok: true,
          type: "spawn_agent",
          dryRun: false,
          executed: true,
          role,
          purpose,
          trigger,
          actorRole,
          message,
          schedulerDecision
        };
        result.audit = recordAudit({
          type: 'spawn_agent',
          mode: 'semi-auto',
          ok: true,
          targetRole: role,
          trigger,
          fingerprint
        });
        return result;
      } catch (error) {
        const result = {
          ok: false,
          type: "spawn_agent",
          dryRun: false,
          executed: false,
          role,
          purpose,
          trigger,
          actorRole,
          message,
          schedulerDecision,
          error: error.message,
          fallback: 'dry-run'
        };
        result.audit = recordAudit({
          type: 'spawn_agent',
          mode: 'semi-auto',
          ok: false,
          targetRole: role,
          trigger,
          fingerprint,
          error: error.message,
          fallback: 'dry-run'
        });
        return result;
      }
    },

    reassignTask: async ({ role, trigger, schedulerDecision }) => {
      const fingerprint = schedulerDecision && schedulerDecision.fingerprint;
      const shouldPauseAndReport = trigger === 'repeated_failure';

      if (shouldPauseAndReport) {
        const leaderNotification = await sendLeaderFallback({
          role,
          trigger,
          schedulerDecision,
          reason: 'repeated_failure',
          meta: {
            paused: true,
            sourceType: 'reassign_task',
            taskTitle: schedulerDecision && schedulerDecision.taskTitle,
            assignedRole: schedulerDecision && schedulerDecision.assignedRole
          },
          bypassDryRun: true
        });

        const result = {
          ok: allowAutoReassign,
          type: "reassign_task",
          dryRun: !allowAutoReassign,
          executed: false,
          role,
          trigger,
          schedulerDecision,
          paused: true,
          reported: Boolean(leaderNotification && leaderNotification.executed),
          leaderNotification,
          fallbackMode: 'pause_and_report'
        };
        result.audit = recordAudit({
          type: 'reassign_task',
          mode: allowAutoReassign ? 'semi-auto-paused' : 'pause-and-report',
          ok: result.ok,
          targetRole: role,
          trigger,
          fingerprint,
          paused: true,
          reported: result.reported,
          fallbackMode: 'pause_and_report'
        });
        return result;
      }

      return {
        ok: true,
        type: "reassign_task",
        dryRun: true,
        executed: false,
        role,
        trigger,
        schedulerDecision
      };
    },

    requestClarification: async ({ role, trigger, schedulerDecision }) => {
      const message = renderClarification(role, trigger);
      const fingerprint = schedulerDecision && schedulerDecision.fingerprint;
      const cooldownInfo = shouldCooldown(fingerprint);

      if (cooldownInfo.active) {
        return await buildCooldownResult({
          type: 'request_clarification',
          role,
          trigger,
          schedulerDecision,
          cooldownInfo
        });
      }

      if (!allowAutoClarification) {
        const result = {
          ok: true,
          type: "request_clarification",
          dryRun: true,
          executed: false,
          role,
          trigger,
          message,
          schedulerDecision
        };
        result.audit = recordAudit({
          type: 'request_clarification',
          mode: 'dry-run',
          ok: true,
          targetRole: role,
          trigger,
          fingerprint
        });
        return result;
      }

      try {
        if (forceFailSend) throw new Error('forced_send_failure');
        execSync('clawteam inbox send ' + teamId + ' ' + role + ' ' + JSON.stringify(message), {
          stdio: 'pipe',
          timeout: 5000
        });
        const result = {
          ok: true,
          type: "request_clarification",
          dryRun: false,
          executed: true,
          role,
          trigger,
          actorRole,
          message,
          schedulerDecision
        };
        result.audit = recordAudit({
          type: 'request_clarification',
          mode: 'semi-auto',
          ok: true,
          targetRole: role,
          trigger,
          fingerprint
        });
        return result;
      } catch (error) {
        const result = {
          ok: false,
          type: "request_clarification",
          dryRun: false,
          executed: false,
          role,
          trigger,
          actorRole,
          message,
          schedulerDecision,
          error: error.message,
          fallback: 'dry-run'
        };
        result.audit = recordAudit({
          type: 'request_clarification',
          mode: 'semi-auto',
          ok: false,
          targetRole: role,
          trigger,
          fingerprint,
          error: error.message,
          fallback: 'dry-run'
        });
        return result;
      }
    },

    notifyLeader: async ({ role, trigger, schedulerDecision }) => {
      return sendLeaderFallback({
        role,
        trigger,
        schedulerDecision,
        reason: 'notify_leader'
      });
    },

    finalizeTask: async ({ role, trigger, schedulerDecision }) => ({
      ok: true,
      type: "finalize_task",
      dryRun: true,
      executed: false,
      role,
      trigger,
      schedulerDecision
    })
  };
}

module.exports = {
  applySchedulerDecision,
  createSchedulerHandlers
};
