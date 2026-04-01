function finalizeAction(action, targetRole, reason, priority, extra = {}) {
  return {
    action,
    targetRole,
    reason,
    priority,
    timestamp: new Date().toISOString(),
    ...extra
  };
}

function selectFallbackRole(taskState) {
  const fallbackMap = {
    backend: "fixer",
    frontend: "fixer",
    tester: "architect",
    analyst: "architect",
    writer: "reviewer",
    visualizer: "architect",
    verifier: "architect",
    searcher: "analyst"
  };

  return fallbackMap[taskState?.assignedRole] || "architect";
}

function selectReviewRole(taskState) {
  if (taskState?.assignedRole === "tester") return "architect";
  if (taskState?.assignedRole === "architect") return "verifier";
  if (taskState?.type === "research") return "analyst";
  if (taskState?.type === "coding" || taskState?.type === "bugfix") return "tester";
  return "verifier";
}

function hasKnownErrorPattern(memoryContext = {}) {
  return Array.isArray(memoryContext.errorPatternHits) && memoryContext.errorPatternHits.length > 0;
}

function hasRecentFailures(history = []) {
  const recent = history.slice(-2);
  return recent.length >= 2 && recent.every(item => item.status === "failed" || item.status === "blocked");
}

function buildDecisionFingerprint(taskState = {}, decision = {}) {
  return [
    taskState.taskId || taskState.title || "unknown-task",
    taskState.assignedRole || "unknown-role",
    decision.action || "unknown-action",
    decision.targetRole || "unknown-target",
    decision.reason || "unknown-reason"
  ].join("::");
}

function isDuplicateDecision(taskState = {}, memoryContext = {}, decision = {}) {
  const pending = Array.isArray(memoryContext.pendingDecisions) ? memoryContext.pendingDecisions : [];
  const fingerprint = buildDecisionFingerprint(taskState, decision);
  return pending.some(item => {
    if (!item) return false;
    if (typeof item === "string") return item === fingerprint;
    return item.fingerprint === fingerprint;
  });
}

function markSuppressed(decision, taskState, reason = "duplicate_decision") {
  return {
    ...decision,
    suppressed: true,
    suppressionReason: reason,
    fingerprint: buildDecisionFingerprint(taskState, decision)
  };
}

function decideNextAction({
  teamState = {},
  taskState = {},
  report = {},
  memoryContext = {},
  history = []
}) {
  void teamState;

  if (!taskState.assignedRole) {
    const decision = finalizeAction("escalate_to_leader", "architect", "missing_assigned_role", "high");
    return markSuppressed(decision, taskState, "invalid_task_state");
  }

  if (!report || Object.keys(report).length === 0) {
    const decision = finalizeAction("request_more_info", taskState.assignedRole, "missing_report", "medium");
    decision.fingerprint = buildDecisionFingerprint(taskState, decision);
    return decision;
  }

  let decision = null;

  if (report.blocked === true) {
    if ((taskState.attempts || 0) >= 2 || hasRecentFailures(history)) {
      decision = finalizeAction("reassign", selectFallbackRole(taskState), "repeated_failure", "high");
    } else {
      decision = finalizeAction("escalate_to_leader", "architect", "worker_blocked", "high");
    }
  } else if (typeof report.confidence === "number" && report.confidence < 0.6) {
    decision = finalizeAction("assign_reviewer", selectReviewRole(taskState), "low_confidence", "high", {
      confidence: report.confidence
    });
  } else if (taskState.crossModuleImpact) {
    decision = finalizeAction("assign_reviewer", "architect", "cross_module_risk", "medium");
  } else if (hasKnownErrorPattern(memoryContext)) {
    decision = finalizeAction("request_more_info", taskState.assignedRole, "known_error_pattern_hit", "high", {
      errorPatternHits: memoryContext.errorPatternHits.length
    });
  } else if (report.needsReview === true) {
    decision = finalizeAction("assign_reviewer", selectReviewRole(taskState), "report_requested_review", "medium");
  } else if (taskState.status === "done" && ["coding", "bugfix"].includes(taskState.type)) {
    decision = finalizeAction("assign_reviewer", "verifier", "post_implementation_validation", "medium");
  } else if (taskState.status === "done" && ["review", "research"].includes(taskState.type)) {
    decision = finalizeAction("finalize", taskState.assignedRole, "task_completed", "low");
  } else {
    decision = finalizeAction("continue", taskState.assignedRole, "no_intervention_needed", "low");
  }

  decision.fingerprint = buildDecisionFingerprint(taskState, decision);

  if (decision.action !== "continue" && isDuplicateDecision(taskState, memoryContext, decision)) {
    return markSuppressed(decision, taskState, "duplicate_decision");
  }

  if (
    decision.action === "assign_reviewer" &&
    Array.isArray(memoryContext.activeReviewers) &&
    memoryContext.activeReviewers.includes(decision.targetRole)
  ) {
    return markSuppressed(decision, taskState, "reviewer_already_assigned");
  }

  return decision;
}

module.exports = {
  decideNextAction,
  selectFallbackRole,
  selectReviewRole,
  hasKnownErrorPattern,
  hasRecentFailures,
  buildDecisionFingerprint,
  isDuplicateDecision,
  markSuppressed,
  finalizeAction
};
