'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Dependencies ---
let memorySystem, retrieval, knowledgePack, scheduler, schedulerActions, decisionRegistry;
try { memorySystem = require(path.join(__dirname, '../../../../utils/memory-system/ultimate-memory.js')); } catch {}
try { retrieval = require(path.join(__dirname, '../../../../utils/memory-system/retrieval-core.js')); } catch {}
try { knowledgePack = require(path.join(process.env.HOME || process.env.USERPROFILE, '.openclaw/workspace/memory/team-knowledge/team-knowledge-pack.js')); } catch {}
try { scheduler = require(path.join(__dirname, './clawteam-scheduler.js')); } catch {}
try { schedulerActions = require(path.join(__dirname, './clawteam-scheduler-actions.js')); } catch {}
try { decisionRegistry = require(path.join(__dirname, './clawteam-decision-registry.js')); } catch {}

const AGENT_CONFIDENCE_DEDUPE_WINDOW_MS = 30 * 60 * 1000;

function normalizeConfidenceNotes(notes) {
  return String(notes || '').replace(/\s+/g, ' ').trim();
}

function shouldStoreAgentConfidence(teamName, agentName, confidence, notes) {
  if (!memorySystem || typeof memorySystem.loadAllStructuredMemories !== 'function') return true;

  var normalizedNotes = normalizeConfidenceNotes(notes);
  var source = 'clawteam:' + teamName + ':' + agentName;
  var cutoff = Date.now() - AGENT_CONFIDENCE_DEDUPE_WINDOW_MS;

  try {
    var memories = memorySystem.loadAllStructuredMemories();
    for (var i = memories.length - 1; i >= 0; i--) {
      var mem = memories[i];
      if (!mem || mem.type !== 'agent_confidence' || mem.source !== source || mem.is_active === false) continue;

      var ts = new Date(mem.updated_at || mem.created_at || 0).getTime();
      if (!ts || ts < cutoff) continue;

      var content = String(mem.content || '');
      if (content.indexOf('Confidence:' + confidence) === -1) continue;

      var existingNotes = normalizeConfidenceNotes(content.replace(/^.*?Confidence:[^\s]+\s*/, ''));
      if (existingNotes === normalizedNotes) return false;
    }
  } catch (e) {}

  return true;
}

// ============================================================================
// 1. Knowledge Injection (before spawn)
// v1.2: adds cross-team knowledge packs
// ============================================================================

async function buildMaselContextBlock(task, context, options) {
  context = context || '';
  options = options || {};
  var sections = [];

  // 1a. Error patterns from memory
  if (retrieval) {
    try {
      var r = await retrieval.retrieve((task + ' ' + context).trim());
      if (r && r.results) {
        var eps = r.results.filter(function(x) { return x.metadata && x.metadata.type === 'error_pattern' && x.scores && x.scores.final > 0.4; });
        if (eps.length) {
          sections.push('## ⚠️ Known Error Patterns');
          eps.slice(0, 5).forEach(function(ep, i) {
            sections.push('### Pattern ' + (i + 1));
            (ep.content || '').split('\n').forEach(function(l) { if (l.trim()) sections.push('- ' + l); });
          });
        }
      }
    } catch (e) {}

    // 1b. User preferences
    try {
      var r2 = await retrieval.retrieve(task + ' preference');
      if (r2 && r2.results) {
        var prefs = r2.results.filter(function(x) { return x.metadata && x.metadata.type === 'preference' && x.scores && x.scores.final > 0.5; });
        if (prefs.length) {
          sections.push('\n## 👤 User Preferences');
          prefs.slice(0, 3).forEach(function(p) { sections.push('- ' + (p.content || '').slice(0, 100)); });
        }
      }
    } catch (e) {}
  }

  // 1c. Cross-team knowledge packs (v1.2)
  if (knowledgePack) {
    try {
      var packs = knowledgePack.searchPacks(task, 3, {
        agentRole: options.agentRole,
        taskType: options.taskType,
        includeScore: true,
        minScore: 0.14
      });
      if (packs.length) {
        sections.push('\n## 📦 Recent Team Experience');
        packs.forEach(function(kp) {
          sections.push('### Team: ' + kp.team + ' (' + (kp.completed_at || '').slice(0, 10) + ')');
          if (kp.task_type) sections.push('Type: ' + kp.task_type + ' | ' + (kp.agents_count || '?') + ' agents');
          if (kp._search) sections.push('Relevance: ' + kp._search.final.toFixed(2));
          if (kp.key_errors) kp.key_errors.forEach(function(e) {
            sections.push('  - Error: ' + (e.error || '').slice(0, 80));
            if (e.correct) sections.push('  - Fix: ' + e.correct.slice(0, 80));
          });
          if (kp.key_insights) kp.key_insights.forEach(function(ins) { sections.push('  - Insight: ' + ins); });
          sections.push('');
        });
      }
    } catch (e) {}
  }

  if (!sections.length) return '';
  sections.unshift('\n## 🧠 MASEL Knowledge Injection');
  sections.push('\n---\n*Auto-injected by MASEL memory system with cross-team experience.*');
  return sections.join('\n');
}

// Worker self-retrieve prompt block
var SELF_RETRIEVE_BLOCK = [
  '',
  '## 🧠 MASEL Self-Retrieve',
  '',
  'Before coding, search for known issues:',
  '```bash',
  'node ~/.openclaw/workspace/skills/masel-retrieve/retrieve.js "your task keywords"',
  '```',
  '',
  'When you hit an error, check if it is known:',
  '```bash',
  'node ~/.openclaw/workspace/skills/masel-retrieve/retrieve.js "error keywords"',
  '```',
  '',
  'After solving a tricky bug, record it:',
  '```bash',
  'node ~/.openclaw/workspace/skills/masel-retrieve/retrieve.js --record \\',
  '  --scenario "..." --error "..." --correct "..." --context "..."',
  '```',
  '',
  'Report format when done:',
  '```',
  'Completed tasks:',
  '- Task: ...',
  '- Result: success/partial',
  '- Confidence: [confidence: 0.X]',
  '- Issues found: (if any)',
  '  - Scenario: ...',
  '  - Error: ...',
  '  - Fix: ...',
  '- Suggestions: (if any)',
  '```',
  ''
].join('\n');

function getRoleSpecificGuidance(agentRole) {
  var role = String(agentRole || '').toLowerCase();
  if (!role) return '';

  var map = {
    architect: [
      '## Architect Notes',
      '- Focus on system boundaries, interfaces, and sequencing',
      '- Surface tradeoffs explicitly before locking decisions',
      '- Prefer plans that reduce downstream coordination cost'
    ],
    backend: [
      '## Backend Notes',
      '- Prioritize correctness, data integrity, and error handling',
      '- Be explicit about auth, validation, and async flow risks',
      '- Keep contracts stable for frontend/tester handoff'
    ],
    frontend: [
      '## Frontend Notes',
      '- Prioritize UX clarity, loading/error states, and API compatibility',
      '- Flag backend contract mismatches early',
      '- Keep components composable and testable'
    ],
    tester: [
      '## Tester Notes',
      '- Cover all public APIs',
      '- Check edge cases',
      '- Verify error patterns are addressed',
      '- Prefer repro steps that unblock quick fixes'
    ],
    analyst: [
      '## Analyst Notes',
      '- Separate facts, assumptions, and confidence levels',
      '- Highlight anomalies and explain why they matter',
      '- Prefer concise findings that support downstream report writing'
    ],
    visualizer: [
      '## Visualizer Notes',
      '- Optimize for readability and trustworthy presentation',
      '- Choose charts that make comparisons obvious',
      '- Flag weak data before over-visualizing it'
    ],
    scanner: [
      '## Scanner Notes',
      '- Hunt for correctness, security, and maintainability issues first',
      '- Prefer evidence-backed findings with file/area references',
      '- Group related issues to reduce fixer overhead'
    ],
    fixer: [
      '## Fixer Notes',
      '- Make minimal, high-confidence changes',
      '- Preserve intended behavior unless the bug requires otherwise',
      '- Leave the codebase easier to verify than before'
    ],
    verifier: [
      '## Verifier Notes',
      '- Validate the actual fix, not just surface symptoms',
      '- Check regression risk around adjacent code paths',
      '- Prefer explicit pass/fail evidence'
    ],
    searcher: [
      '## Searcher Notes',
      '- Gather diverse, high-signal sources',
      '- Prefer primary sources when available',
      '- Keep raw findings structured for analyzer handoff'
    ],
    writer: [
      '## Writer Notes',
      '- Synthesize, do not just concatenate',
      '- Make uncertainty legible',
      '- End with actionable conclusions or recommendations'
    ]
  };

  return (map[role] || []).join('\n');
}

async function buildEnhancedSpawnPrompt(task, options) {
  options = options || {};
  var parts = [task];
  var block = await buildMaselContextBlock(task, options.context, options);
  if (block) parts.push(block);
  parts.push(SELF_RETRIEVE_BLOCK);
  var roleBlock = getRoleSpecificGuidance(options.agentRole);
  if (roleBlock) parts.push('\n' + roleBlock);
  return parts.join('\n');
}

// ============================================================================
// 2. Auto Error Extraction
// ============================================================================

function parseWorkerReport(message) {
  var result = { errors: [], confidence: null, discoveries: [] };
  if (!message) return result;

  var cm = message.match(/\[confidence:\s*([0-9.]+)\]/i);
  if (cm) { result.confidence = parseFloat(cm[1]); if (result.confidence > 1) result.confidence /= 10; }

  if (/\bstatus\s*[:：]\s*blocked\b/i.test(message) || /\bblocked\b/i.test(message)) {
    result.blocked = true;
    result.status = 'blocked';
  }

  // Structured error block
  var eb = message.match(/(?:发现的|Issues found)[:：]\s*\n([\s\S]*?)(?=\n\s*\n|\n- (?:建议|Sugg)|$)/i);
  if (eb) {
    eb[1].split(/(?=\s*-\s*(?:场景|Scenario))/).forEach(function(se) {
      var scenario = (se.match(/(?:场景|Scenario)[:：]\s*(.+)/) || [])[1];
      var error = (se.match(/(?:错误|Error)[:：]\s*(.+)/) || [])[1];
      var correct = (se.match(/(?:解决|Fix|Correct)[:：]\s*(.+)/) || [])[1];
      if (error) result.errors.push({ scenario: (scenario || '').trim(), error: error.trim(), correct: (correct || '').trim() });
    });
  }

  // Fallback: unstructured errors
  if (!result.errors.length) {
    var lines = message.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(/(?:错误|error|bug|问题)[:：]\s*(.+)/i);
      if (m && m[1].length > 5) {
        var fix = (i + 1 < lines.length) ? (lines[i + 1].match(/(?:解决|修复|fix)[:：]?\s*(.+)/i) || [])[1] : '';
        result.errors.push({ scenario: '', error: m[1].trim(), correct: (fix || '').trim() });
      }
    }
  }

  // Discoveries
  var dr = /(?:发现|建议|Insight|Suggestion)[:：]\s*(.+)/gi;
  var dm;
  while ((dm = dr.exec(message)) !== null) {
    if (dm[1].trim().length > 5) result.discoveries.push(dm[1].trim());
  }
  return result;
}

function buildTaskStateFromParsed(teamName, agentName, parsed, options) {
  options = options || {};
  return {
    taskId: options.taskId || parsed.taskId || null,
    title: options.taskTitle || parsed.task || 'unknown-task',
    type: options.taskType || parsed.taskType || 'coding',
    status: parsed.blocked ? 'blocked' : (options.taskStatus || parsed.status || 'running'),
    assignedRole: options.role || agentName,
    attempts: options.attempts || 1,
    crossModuleImpact: Boolean(parsed.crossModuleImpact || options.crossModuleImpact),
    teamName: teamName
  };
}

function buildTeamStateFromOptions(teamName, options) {
  options = options || {};
  return {
    teamId: options.teamId || teamName,
    goal: options.goal || '',
    phase: options.phase || 'execution',
    activeRoles: options.activeRoles || [],
    completedTasks: options.completedTasks || 0,
    failedTasks: options.failedTasks || 0
  };
}

function buildSchedulerMemoryContext(parsed, options) {
  options = options || {};
  var registryContext = { pendingDecisions: [], activeReviewers: [], history: [] };
  if (decisionRegistry) {
    try {
      registryContext = decisionRegistry.getSchedulerContext(options.teamId || options.teamName || 'unknown-team', {
        ttlMs: options.registryTtlMs
      }) || registryContext;
    } catch (e) {}
  }

  return {
    errorPatternHits: options.errorPatternHits || parsed.errorPatternHits || [],
    knowledgePackHits: options.knowledgePackHits || [],
    rolePerformance: options.rolePerformance || {},
    pendingDecisions: options.pendingDecisions || registryContext.pendingDecisions || [],
    activeReviewers: options.activeReviewers || (registryContext.activeReviewers || []).map(function(item) { return item.role; }),
    decisionHistory: registryContext.history || []
  };
}

async function processWorkerReport(teamName, agentName, message, options) {
  options = options || {};
  options.teamName = options.teamName || teamName;
  options.teamId = options.teamId || teamName;

  var parsed = parseWorkerReport(message);
  var actions = [];
  var confidenceReport = null;
  var schedulerDecision = null;
  var schedulerResult = null;
  var resolvedDecisions = [];
  var taskOverlayState = null;

  // Record errors
  parsed.errors.forEach(function(err) {
    if (err.error && err.correct && memorySystem) {
      try {
        var res = memorySystem.recordErrorPattern({
          scenario: err.scenario || ('Team:' + teamName + ' Agent:' + agentName),
          error: err.error, correct: err.correct,
          source: 'clawteam:' + teamName + ':' + agentName
        });
        if (res && res.memory) actions.push('Recorded: ' + res.memory.id);
      } catch (e) {}
    }
  });

  // Confidence
  if (parsed.confidence !== null) {
    confidenceReport = processConfidenceReport(teamName, agentName, parsed.confidence);
    if (confidenceReport.needsReview) actions.push('Low confidence: ' + parsed.confidence + ' for ' + agentName);
  }

  // Broadcast discoveries
  if (parsed.discoveries.length) {
    try {
      parsed.discoveries.forEach(function(d) {
        execSync('clawteam inbox broadcast ' + teamName + ' "[Discovery] ' + agentName + ': ' + d.replace(/"/g, '\\"') + '"', { stdio: 'pipe', timeout: 5000 });
      });
      actions.push('Broadcast ' + parsed.discoveries.length + ' discoveries');
    } catch (e) { actions.push('Broadcast failed'); }
  }

  // Scheduler dry-run integration
  if (scheduler && schedulerActions && scheduler.decideNextAction && schedulerActions.applySchedulerDecision && schedulerActions.createSchedulerHandlers) {
    try {
      var taskState = buildTaskStateFromParsed(teamName, agentName, parsed, options);
      var teamState = buildTeamStateFromOptions(teamName, options);
      var memoryContext = buildSchedulerMemoryContext(parsed, options);
      var history = options.history || [];

      schedulerDecision = scheduler.decideNextAction({
        teamState: teamState,
        taskState: taskState,
        report: parsed,
        memoryContext: memoryContext,
        history: history
      });

      if (schedulerDecision) {
        schedulerDecision.taskId = taskState.taskId;
        schedulerDecision.taskTitle = taskState.title;
        schedulerDecision.assignedRole = taskState.assignedRole;
      }

      schedulerResult = await schedulerActions.applySchedulerDecision(schedulerDecision, {
        handlers: schedulerActions.createSchedulerHandlers({
          logger: options.logger || console,
          executionMode: options.executionMode || 'dry-run',
          allowAutoReviewer: options.allowAutoReviewer,
          allowAutoClarification: options.allowAutoClarification,
          teamId: teamState.teamId || teamName,
          taskId: taskState.taskId,
          actorRole: options.actorRole || 'leader',
          clarificationTemplate: options.clarificationTemplate,
          reviewerTemplate: options.reviewerTemplate,
          failureThreshold: options.failureThreshold,
          cooldownMs: options.cooldownMs,
          forceFailSend: options.forceFailSend
        }),
        report: parsed,
        taskState: taskState,
        teamState: teamState
      });

      if (decisionRegistry) {
        try {
          if (taskState.status === 'done' && taskState.taskId) {
            resolvedDecisions = resolvedDecisions.concat(decisionRegistry.resolveTaskDecisions(teamState.teamId || teamName, taskState.taskId, {
              ttlMs: options.registryTtlMs
            }) || []);
          }

          if (options.reviewCompleted === true && taskState.taskId) {
            resolvedDecisions = resolvedDecisions.concat(decisionRegistry.resolveReviewerDecision(teamState.teamId || teamName, taskState.taskId, taskState.assignedRole, {
              ttlMs: options.registryTtlMs
            }) || []);
          }

          var shouldRegisterDecision = schedulerDecision && schedulerDecision.fingerprint && !schedulerDecision.suppressed && schedulerDecision.action !== 'continue';
          if (options.reviewCompleted === true && taskState.type === 'review') {
            shouldRegisterDecision = false;
          }
          if (taskState.status === 'done' && schedulerDecision && schedulerDecision.action === 'finalize') {
            shouldRegisterDecision = false;
          }

          if (shouldRegisterDecision) {
            decisionRegistry.registerDecision(teamState.teamId || teamName, taskState, schedulerDecision, {
              ttlMs: options.registryTtlMs,
              teamMeta: {
                source: options.teamSource || 'runtime'
              }
            });
          }
        } catch (e) {}

        try {
          if (schedulerResult && taskState.taskId) {
            if (schedulerResult.paused || schedulerResult.cooldown) {
              decisionRegistry.updateTaskOverlayState(teamState.teamId || teamName, taskState.taskId, 'paused_pending_leader', {
                ttlMs: options.registryTtlMs,
                teamMeta: {
                  source: options.teamSource || 'runtime'
                },
                meta: {
                  fallbackMode: schedulerResult.fallbackMode || (schedulerResult.cooldown ? 'cooldown' : null),
                  reported: Boolean(schedulerResult.reported),
                  trigger: schedulerDecision && schedulerDecision.reason,
                  targetRole: schedulerDecision && schedulerDecision.targetRole,
                  retryAfterMs: schedulerResult.retryAfterMs || 0,
                  consecutiveFailures: schedulerResult.consecutiveFailures || 0,
                  taskTitle: taskState.title,
                  assignedRole: taskState.assignedRole
                }
              });
            } else if (schedulerDecision && schedulerDecision.action === 'continue') {
              decisionRegistry.updateTaskOverlayState(teamState.teamId || teamName, taskState.taskId, 'active', {
                ttlMs: options.registryTtlMs,
                teamMeta: {
                  source: options.teamSource || 'runtime'
                },
                meta: {
                  trigger: 'continue',
                  taskTitle: taskState.title,
                  assignedRole: taskState.assignedRole
                }
              });
            }
          }
        } catch (e) {}

        try {
          if (taskState.taskId) {
            taskOverlayState = decisionRegistry.getTaskOverlayState(teamState.teamId || teamName, taskState.taskId, {
              ttlMs: options.registryTtlMs
            });
          }
        } catch (e) {}
      }

      if (resolvedDecisions.length) {
        actions.push('Resolved decisions: ' + resolvedDecisions.length);
      }

      actions.push('Scheduler: ' + schedulerDecision.action + ' -> ' + schedulerDecision.targetRole + ' (' + schedulerDecision.reason + ')');
    } catch (e) {
      actions.push('Scheduler failed');
    }
  }

  return {
    parsed: parsed,
    actions: actions,
    confidenceReport: confidenceReport,
    schedulerDecision: schedulerDecision,
    schedulerResult: schedulerResult,
    taskOverlayState: taskOverlayState,
    paused: Boolean(schedulerResult && (schedulerResult.paused || schedulerResult.cooldown)),
    reported: Boolean(schedulerResult && (schedulerResult.reported || (schedulerResult.leaderNotification && schedulerResult.leaderNotification.executed))),
    leaderNotification: schedulerResult && schedulerResult.leaderNotification ? schedulerResult.leaderNotification : null,
    resolvedDecisions: resolvedDecisions,
    errorsRecorded: parsed.errors.filter(function(e) { return e.error && e.correct; }).length,
    needsReview: parsed.confidence !== null && parsed.confidence < 0.6,
    discoveriesBroadcast: parsed.discoveries.length
  };
}

// ============================================================================
// 3. Confidence Auto-Escalation
// ============================================================================

function processConfidenceReport(teamName, agentName, confidence, notes) {
  var report = {
    team: teamName,
    agent: agentName,
    confidence: confidence,
    notes: notes || '',
    timestamp: new Date().toISOString(),
    needsReview: confidence < 0.6,
    autoSecondReview: false,
    reviewTarget: null
  };
  if (memorySystem) {
    if (shouldStoreAgentConfidence(teamName, agentName, confidence, notes)) {
      memorySystem.storeStructuredMemory('agent_confidence', 'Team:' + teamName + ' Agent:' + agentName + ' Confidence:' + confidence + ' ' + (notes || ''), { importance: confidence < 0.6 ? 'critical' : 'important', source: 'clawteam:' + teamName + ':' + agentName });
    } else {
      report.memoryDeduped = true;
    }
  }
  if (confidence < 0.6) {
    try {
      execSync('clawteam inbox send ' + teamName + ' leader "⚠️ ' + agentName + ' confidence ' + confidence + ' < 0.6, review recommended"', { stdio: 'pipe', timeout: 5000 });
    } catch (e) {}

    try {
      var suggestedReviewer = agentName === 'tester' ? 'architect' : 'tester';
      execSync('clawteam inbox send ' + teamName + ' ' + suggestedReviewer + ' "[Auto-Second-Review] Please review output from ' + agentName + ' due to low confidence (' + confidence + '). ' + String(notes || '').replace(/"/g, '\\"') + '"', { stdio: 'pipe', timeout: 5000 });
      report.autoSecondReview = true;
      report.reviewTarget = suggestedReviewer;
    } catch (e) {}
  }
  return report;
}

// ============================================================================
// 4. Team Retrospective + Knowledge Pack Generation (v1.2)
// ============================================================================

function teamRetrospective(teamName, summary) {
  summary = summary || {};
  var lessons = [];
  var tasks = summary.tasks || [];
  var failed = tasks.filter(function(t) { return t.status === 'failed' || t.status === 'blocked'; });
  if (failed.length) {
    lessons.push(failed.length + ' tasks unfinished:');
    failed.forEach(function(t) { lessons.push('  - ' + t.subject + ' (' + t.owner + '): ' + t.status); });
  }
  if (memorySystem) {
    memorySystem.storeStructuredMemory('team_performance', 'Team:' + teamName + ' Tasks:' + tasks.length + ' Errors:' + (summary.errors || []).length + ' Duration:' + (summary.duration || '?') + ' Agents:' + (summary.agents || []).length, { importance: 'important', source: 'clawteam-retrospective:' + teamName });
  }

  // v1.2: Generate knowledge pack
  if (knowledgePack) {
    try {
      knowledgePack.savePack(teamName, {
        task_type: summary.task_type || 'unknown',
        agents_count: (summary.agents || []).length,
        duration: summary.duration || 'unknown',
        key_errors: (summary.errors || []).slice(0, 5).map(function(e) { return { scenario: e.scenario || '', error: (e.error || '').slice(0, 200), correct: (e.correct || '').slice(0, 200) }; }),
        key_insights: lessons.slice(),
        key_decisions: summary.decisions || [],
        confidence_avg: summary.confidence_avg || null,
        success_rate: tasks.length ? ((tasks.length - failed.length) / tasks.length * 100).toFixed(1) + '%' : 'N/A'
      });
      lessons.push('Knowledge pack saved');
      knowledgePack.cleanupPacks(30);
    } catch (e) {}
  }

  // Daily notes
  var today = new Date().toISOString().split('T')[0];
  var dp = path.join(__dirname, '../../../../memory', today + '.md');
  try {
    fs.appendFileSync(dp, ['\n## ClawTeam Retrospective', '- Team: ' + teamName, '- Tasks: ' + tasks.length, '- Failed: ' + failed.length, '- Agents: ' + (summary.agents || []).length].concat(lessons).concat(['']).join('\n'));
  } catch (e) {}
  return lessons;
}

// ============================================================================
// 5. Backward compatible error extraction
// ============================================================================

function extractAndRecordErrors(agentName, output) {
  if (!memorySystem) return [];
  var patterns = [];
  var lines = output.split('\n');
  var regexes = [/error[:：]\s*(.+)/i, /failed[:：]\s*(.+)/i, /错误[:：]\s*(.+)/, /cannot\s+(.+?)(?:\s|$)/i, /undefined\s+(.+?)(?:\s|$)/i, /not\s+found[:：]?\s*(.+)/i];
  for (var i = 0; i < lines.length; i++) {
    for (var ri = 0; ri < regexes.length; ri++) {
      var match = lines[i].match(regexes[ri]);
      if (match) {
        var ctx = lines.slice(Math.max(0, i - 2), i).join(' ');
        var msg = match[1] || match[0];
        if (msg.length > 5) {
          try { patterns.push(memorySystem.recordErrorPattern({ scenario: 'Agent: ' + agentName + ' | ' + ctx.slice(0, 80), error: msg.slice(0, 200), correct: '(pending)', source: 'clawteam-agent:' + agentName })); } catch (e) {}
        }
        break;
      }
    }
  }
  return patterns;
}

// ============================================================================
// Leader inbox poll
// ============================================================================

function pollAndProcessWorkerReports(teamName) {
  var results = [];
  try {
    var out = execSync('clawteam --json team status ' + teamName, { encoding: 'utf-8', timeout: 5000 });
    var members = (JSON.parse(out).members || []).filter(function(m) { return m.name !== 'leader'; });
    members.forEach(function(member) {
      try {
        var inbox = execSync('clawteam --json inbox peek ' + teamName + ' --agent leader', { encoding: 'utf-8', timeout: 5000 });
        var msgs = JSON.parse(inbox);
        (Array.isArray(msgs) ? msgs : []).filter(function(m) { return m.from === member.name; }).forEach(function(msg) {
          results.push({ agent: member.name, result: processWorkerReport(teamName, member.name, msg.content) });
        });
      } catch (e) {}
    });
  } catch (e) {}
  return { processed: results.length, totalErrors: results.reduce(function(s, r) { return s + (r.result ? r.result.errorsRecorded : 0); }, 0), results: results };
}

module.exports = {
  buildMaselContextBlock: buildMaselContextBlock,
  buildEnhancedSpawnPrompt: buildEnhancedSpawnPrompt,
  getRoleSpecificGuidance: getRoleSpecificGuidance,
  extractAndRecordErrors: extractAndRecordErrors,
  processWorkerReport: processWorkerReport,
  parseWorkerReport: parseWorkerReport,
  processConfidenceReport: processConfidenceReport,
  buildTaskStateFromParsed: buildTaskStateFromParsed,
  buildTeamStateFromOptions: buildTeamStateFromOptions,
  buildSchedulerMemoryContext: buildSchedulerMemoryContext,
  teamRetrospective: teamRetrospective,
  pollAndProcessWorkerReports: pollAndProcessWorkerReports,
  decisionRegistry: decisionRegistry
};
