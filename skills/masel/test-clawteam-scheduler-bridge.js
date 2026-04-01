const { decideNextAction } = require("./src/tools/clawteam-scheduler");
const {
  applySchedulerDecision,
  createSchedulerHandlers
} = require("./src/tools/clawteam-scheduler-actions");

async function testSchedulerBridgeFlow() {
  const report = {
    confidence: 0.45,
    blocked: false,
    needsReview: true
  };

  const taskState = {
    assignedRole: "backend",
    type: "coding",
    status: "running",
    attempts: 1
  };

  const decision = decideNextAction({ taskState, report });
  const result = await applySchedulerDecision(decision, {
    handlers: createSchedulerHandlers()
  });

  const ok = decision.action === "assign_reviewer" && result.type === "spawn_agent" && result.dryRun === true;

  console.log(`${ok ? "✅" : "❌"} scheduler bridge flow`);
  if (!ok) {
    console.log("Decision:", decision);
    console.log("Result:", result);
    process.exitCode = 1;
  }
}

async function testSemiAutoReviewerFlow() {
  const report = {
    confidence: 0.45,
    blocked: false,
    needsReview: true
  };

  const taskState = {
    assignedRole: "backend",
    type: "coding",
    status: "running",
    attempts: 1
  };

  const decision = decideNextAction({ taskState, report });
  const result = await applySchedulerDecision(decision, {
    handlers: createSchedulerHandlers({ executionMode: 'semi-auto' })
  });

  const ok = decision.action === "assign_reviewer" && result.type === "spawn_agent" && result.dryRun === false;

  console.log(`${ok ? "✅" : "❌"} scheduler semi-auto reviewer flow`);
  if (!ok) {
    console.log("Decision:", decision);
    console.log("Result:", result);
    process.exitCode = 1;
  }
}

async function testClarificationDryRunFlow() {
  const decision = {
    action: 'request_more_info',
    targetRole: 'backend',
    reason: 'known_error_pattern_hit'
  };

  const result = await applySchedulerDecision(decision, {
    handlers: createSchedulerHandlers({ taskId: 'task-clarify' })
  });

  const ok = result.type === 'request_clarification' && result.dryRun === true && result.executed === false;

  console.log(`${ok ? "✅" : "❌"} scheduler clarification dry-run flow`);
  if (!ok) {
    console.log('Result:', result);
    process.exitCode = 1;
  }
}

async function testCooldownFlow() {
  const decision = {
    action: 'request_more_info',
    targetRole: 'backend',
    reason: 'known_error_pattern_hit',
    fingerprint: 'cooldown::backend::request_more_info'
  };

  const handlers = createSchedulerHandlers({
    executionMode: 'semi-auto',
    teamId: 'cooldown-team',
    taskId: 'cooldown-task',
    failureThreshold: 1,
    cooldownMs: 60 * 1000,
    forceFailSend: true
  });

  const first = await applySchedulerDecision(decision, { handlers });
  const second = await applySchedulerDecision(decision, { handlers });

  const ok = first.ok === false && second.cooldown === true && second.error === 'cooldown_active';

  console.log(`${ok ? "✅" : "❌"} scheduler cooldown flow`);
  if (!ok) {
    console.log('First:', first);
    console.log('Second:', second);
    process.exitCode = 1;
  }
}

async function testPauseAndReportOverlayFlow() {
  const bridge = require('./src/tools/clawteam-bridge');
  const uniqueTeamId = 'overlay-team-' + Date.now();

  const result = await bridge.processWorkerReport(
    uniqueTeamId,
    'backend',
    'Issues found:\n- Scenario: auth retry\n- Error: token refresh loop\n- Fix: stop recursive retry\n[confidence: 0.8]\nstatus: blocked',
    {
      teamId: uniqueTeamId,
      taskId: 'task-overlay-1',
      taskTitle: 'repair auth retry flow',
      taskType: 'coding',
      taskStatus: 'blocked',
      role: 'backend',
      attempts: 2,
      executionMode: 'dry-run',
      history: [
        { status: 'failed' },
        { status: 'blocked' }
      ]
    }
  );

  const ok = result.paused === true
    && result.taskOverlayState
    && result.taskOverlayState.overlayState === 'paused_pending_leader';

  console.log(`${ok ? '✅' : '❌'} scheduler pause/report overlay flow`);
  if (!ok) {
    console.log('Result:', result);
    process.exitCode = 1;
  }
}

Promise.resolve()
  .then(testSchedulerBridgeFlow)
  .then(testSemiAutoReviewerFlow)
  .then(testClarificationDryRunFlow)
  .then(testCooldownFlow)
  .then(testPauseAndReportOverlayFlow)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
