const { decideNextAction } = require("./src/tools/clawteam-scheduler");

function runTest(name, input, expected) {
  const result = decideNextAction(input);

  const ok =
    result.action === expected.action &&
    result.targetRole === expected.targetRole &&
    result.reason === expected.reason &&
    (expected.suppressed === undefined || result.suppressed === expected.suppressed) &&
    (expected.suppressionReason === undefined || result.suppressionReason === expected.suppressionReason);

  console.log(`${ok ? "✅" : "❌"} ${name}`);
  if (!ok) {
    console.log("Expected:", expected);
    console.log("Received:", result);
    process.exitCode = 1;
  }
}

runTest(
  "低置信度自动加 reviewer",
  {
    taskState: {
      assignedRole: "backend",
      type: "coding",
      status: "running",
      attempts: 1,
      taskId: "task-1"
    },
    report: {
      confidence: 0.48,
      blocked: false,
      needsReview: true
    }
  },
  {
    action: "assign_reviewer",
    targetRole: "tester",
    reason: "low_confidence"
  }
);

runTest(
  "连续失败自动换 fixer",
  {
    taskState: {
      assignedRole: "backend",
      type: "bugfix",
      status: "blocked",
      attempts: 2,
      taskId: "task-2"
    },
    report: {
      confidence: 0.4,
      blocked: true
    },
    history: [
      { status: "failed" },
      { status: "blocked" }
    ]
  },
  {
    action: "reassign",
    targetRole: "fixer",
    reason: "repeated_failure"
  }
);

runTest(
  "跨模块风险升级 architect",
  {
    taskState: {
      assignedRole: "backend",
      type: "coding",
      status: "running",
      attempts: 1,
      crossModuleImpact: true,
      taskId: "task-3"
    },
    report: {
      confidence: 0.82,
      blocked: false
    }
  },
  {
    action: "assign_reviewer",
    targetRole: "architect",
    reason: "cross_module_risk"
  }
);

runTest(
  "命中错误模式请求补充信息",
  {
    taskState: {
      assignedRole: "frontend",
      type: "bugfix",
      status: "running",
      attempts: 1,
      taskId: "task-4"
    },
    report: {
      confidence: 0.88,
      blocked: false
    },
    memoryContext: {
      errorPatternHits: [{ id: "err-1" }]
    }
  },
  {
    action: "request_more_info",
    targetRole: "frontend",
    reason: "known_error_pattern_hit"
  }
);

runTest(
  "编码完成后指派 verifier",
  {
    taskState: {
      assignedRole: "backend",
      type: "coding",
      status: "done",
      attempts: 1,
      taskId: "task-5"
    },
    report: {
      confidence: 0.91,
      blocked: false
    }
  },
  {
    action: "assign_reviewer",
    targetRole: "verifier",
    reason: "post_implementation_validation"
  }
);

runTest(
  "研究完成后直接 finalize",
  {
    taskState: {
      assignedRole: "analyst",
      type: "research",
      status: "done",
      attempts: 1,
      taskId: "task-6"
    },
    report: {
      confidence: 0.93,
      blocked: false
    }
  },
  {
    action: "finalize",
    targetRole: "analyst",
    reason: "task_completed"
  }
);

runTest(
  "重复决策会被抑制",
  {
    taskState: {
      assignedRole: "backend",
      type: "coding",
      status: "running",
      attempts: 1,
      taskId: "task-7"
    },
    report: {
      confidence: 0.4,
      blocked: false
    },
    memoryContext: {
      pendingDecisions: ["task-7::backend::assign_reviewer::tester::low_confidence"]
    }
  },
  {
    action: "assign_reviewer",
    targetRole: "tester",
    reason: "low_confidence",
    suppressed: true,
    suppressionReason: "duplicate_decision"
  }
);

runTest(
  "已有 reviewer 时不重复派发",
  {
    taskState: {
      assignedRole: "backend",
      type: "coding",
      status: "running",
      attempts: 1,
      taskId: "task-8"
    },
    report: {
      confidence: 0.42,
      blocked: false
    },
    memoryContext: {
      activeReviewers: ["tester"]
    }
  },
  {
    action: "assign_reviewer",
    targetRole: "tester",
    reason: "low_confidence",
    suppressed: true,
    suppressionReason: "reviewer_already_assigned"
  }
);
