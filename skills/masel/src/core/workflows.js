/**
 * MASEL Workflows - 工作流引擎 v1.9.1
 * 
 * plan → execute → review → learn
 * 支持多步工作流和断点恢复
 */

class MaselWorkflows {
  constructor(options = {}) {
    this.onLog = options.onLog || (() => {});
    this.onStoreLesson = options.onStoreLesson || null;
  }

  /**
   * 完整工作流：plan → execute → review → learn
   */
  async complete(task, { workflowType = 'simple', plan, execute, review, learn, creativeRoute } = {}) {
    const log = this.onLog;
    const isCreative = creativeRoute?.handlerAvailable;

    // ── 1. Plan ──
    log(`📋 Planning: ${task}`);
    const planResult = await plan({ task, workflow_type: workflowType });

    if (isCreative) {
      planResult.creative_suite = {
        suite: creativeRoute.suite,
        workflowType: creativeRoute.workflowType,
        apps: creativeRoute.apps,
        primaryApp: creativeRoute.primaryApp,
      };
    }

    // ── 2. Execute ──
    log(`⚡ Executing: ${planResult.task_id}`);
    const executionResult = await execute({ plan: planResult });

    if (isCreative) {
      executionResult.creative_suite = planResult.creative_suite;
    }

    // ── 3. Review ──
    log(`🔍 Reviewing...`);
    const reviewResult = await review({
      results: executionResult.results,
      plan: planResult
    });

    // ── 4. Learn ──
    if (learn) {
      log(`📚 Learning...`);
      await learn({ plan: planResult, execution: executionResult, review: reviewResult });
    }

    // ── 5. Store lesson ──
    if (this.onStoreLesson && reviewResult.decision === 'APPROVE') {
      try {
        this.onStoreLesson({
          category: 'lesson',
          tier: 'important',
          key: 'workflow_success',
          value: `${task} → ${reviewResult.decision} (${reviewResult.overall_score}/100)`,
          type: 'lesson',
          weight: 0.7,
        });
      } catch (e) { /* 静默 */ }
    }

    return {
      plan: planResult,
      execution: executionResult,
      review: reviewResult,
      success: reviewResult.decision === 'APPROVE',
      creative_suite: isCreative ? planResult.creative_suite : null,
    };
  }

  /**
   * 仅规划
   */
  async planOnly(task, planFn, workflowType = 'simple') {
    return planFn({ task, workflow_type: workflowType });
  }

  /**
   * 仅执行
   */
  async executeOnly(plan, executeFn) {
    return executeFn({ plan });
  }

  /**
   * 仅审查
   */
  async reviewOnly(results, plan, reviewFn) {
    return reviewFn({ results, plan });
  }
}

module.exports = { MaselWorkflows };
