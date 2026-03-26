"use strict";
/**
 * MASEL Execute Tool
 *
 * Executes subtasks with parallel sub-agents and Worktree isolation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselExecute = maselExecute;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
const viking_store_js_1 = require("../memory/viking-store.js");
/**
 * Main entry point for masel_execute tool
 */
async function maselExecute(options) {
    const { plan, options: execOptions = {} } = options;
    const { parallel = false, checkpoint = true, worktree_isolation = true, silent = false } = execOptions;
    const log = silent ? () => { } : console.log;
    log(`🚀 MASEL Execute: Starting execution...`);
    log(`   Task ID: ${plan.task_id}`);
    log(`   Subtasks: ${plan.subtasks.length}`);
    log(`   Parallel: ${parallel}`);
    log(`   Worktree isolation: ${worktree_isolation}`);
    log(`   Silent mode: ${silent}`);
    const startTime = Date.now();
    const results = [];
    const completedSubtasks = new Set();
    // Build dependency graph
    const dependencyGraph = buildDependencyGraph(plan.subtasks);
    // Execute subtasks
    if (parallel) {
        // Parallel execution: execute subtasks without dependencies in parallel
        await executeParallel(plan, dependencyGraph, results, completedSubtasks, worktree_isolation, silent);
    }
    else {
        // Sequential execution: execute in order respecting dependencies
        await executeSequential(plan, dependencyGraph, results, completedSubtasks, worktree_isolation, silent);
    }
    const totalExecutionTime = Date.now() - startTime;
    // Determine overall status
    const failedCount = results.filter(r => !r.success).length;
    const status = failedCount === 0
        ? "completed"
        : failedCount === results.length
            ? "failed"
            : "partial";
    // Generate summary
    const summary = generateSummary(results, status);
    const executionResult = {
        task_id: plan.task_id,
        status,
        results,
        total_execution_time: totalExecutionTime,
        summary
    };
    // Save execution result
    await saveExecutionResult(executionResult);
    log(`\n✅ Execution ${status}`);
    log(`   Total time: ${(totalExecutionTime / 1000).toFixed(2)}s`);
    log(`   Success: ${results.filter(r => r.success).length}/${results.length}`);
    return executionResult;
}
/**
 * Build dependency graph from subtasks
 */
function buildDependencyGraph(subtasks) {
    const graph = new Map();
    for (const subtask of subtasks) {
        graph.set(subtask.id, subtask.dependencies);
    }
    return graph;
}
/**
 * Execute subtasks sequentially respecting dependencies
 */
async function executeSequential(plan, dependencyGraph, results, completedSubtasks, worktree_isolation, silent = false) {
    const pendingSubtasks = [...plan.subtasks];
    while (pendingSubtasks.length > 0) {
        // Find subtask with all dependencies satisfied
        const executableIndex = pendingSubtasks.findIndex(st => st.dependencies.every(dep => completedSubtasks.has(dep)));
        if (executableIndex === -1) {
            // Deadlock or circular dependency
            throw new Error("Dependency resolution failed - possible circular dependency");
        }
        const subtask = pendingSubtasks.splice(executableIndex, 1)[0];
        // Execute subtask
        const result = await executeSubtask(subtask, plan.task_id, worktree_isolation, silent);
        results.push(result);
        if (result.success) {
            completedSubtasks.add(subtask.id);
        }
        else {
            // Record error for learning
            await recordError(plan.task_id, subtask, result);
            // Continue with other subtasks or stop?
            // For now, continue but mark as failed
            console.warn(`   ⚠ Subtask ${subtask.id} failed, continuing...`);
            completedSubtasks.add(subtask.id); // Mark as completed to unblock dependents
        }
    }
}
/**
 * Execute subtasks in parallel where possible
 */
async function executeParallel(plan, dependencyGraph, results, completedSubtasks, worktree_isolation, silent = false) {
    const pendingSubtasks = [...plan.subtasks];
    const executingPromises = new Map();
    while (pendingSubtasks.length > 0 || executingPromises.size > 0) {
        // Find all subtasks with satisfied dependencies
        const executableSubtasks = pendingSubtasks.filter(st => st.dependencies.every(dep => completedSubtasks.has(dep)));
        // Start executing them
        for (const subtask of executableSubtasks) {
            // Remove from pending
            const index = pendingSubtasks.indexOf(subtask);
            pendingSubtasks.splice(index, 1);
            // Start execution
            const promise = executeSubtask(subtask, plan.task_id, worktree_isolation, silent);
            executingPromises.set(subtask.id, promise);
        }
        // Wait for at least one to complete
        if (executingPromises.size > 0) {
            const [completedId, result] = await waitForAny(executingPromises);
            executingPromises.delete(completedId);
            results.push(result);
            if (result.success) {
                completedSubtasks.add(completedId);
            }
            else {
                await recordError(plan.task_id, plan.subtasks.find(st => st.id === completedId), result);
                completedSubtasks.add(completedId); // Unblock dependents
            }
        }
    }
}
/**
 * Wait for any promise to complete
 */
async function waitForAny(promises) {
    const entries = Array.from(promises.entries());
    const results = await Promise.race(entries.map(async ([id, promise]) => {
        const result = await promise;
        return [id, result];
    }));
    return results;
}
/**
 * Execute a single subtask
 */
async function executeSubtask(subtask, taskId, worktree_isolation, silent = false) {
    const log = silent ? () => { } : console.log;
    log(`\n📋 Executing: ${subtask.name}`);
    log(`   Agent: ${subtask.agent_type}`);
    log(`   Estimated: ${subtask.estimated_time} minutes`);
    const startTime = Date.now();
    // Create worktree if isolation enabled
    let worktreePath;
    if (worktree_isolation) {
        worktreePath = await createWorktree(taskId, subtask.id);
        log(`   Worktree: ${worktreePath}`);
    }
    try {
        // Load agent soul
        const soul = await loadAgentSoul(subtask.agent_type);
        // Search for relevant historical errors
        const similarErrors = await searchSimilarErrors(subtask);
        // Build task prompt
        const prompt = buildTaskPrompt(subtask, soul, similarErrors);
        // Execute with sub-agent
        const result = await (0, openclaw_api_js_1.sessions_spawn)({
            task: prompt,
            runtime: "subagent",
            mode: "run",
            timeoutSeconds: subtask.estimated_time * 60,
            masel_context: {
                task_id: taskId,
                subtask_id: subtask.id,
                agent_type: subtask.agent_type,
                worktree_path: worktreePath
            }
        });
        const executionTime = Date.now() - startTime;
        if (result.success) {
            log(`   ✅ Success (${(executionTime / 1000).toFixed(2)}s)`);
            // Save checkpoint
            const checkpointId = await saveCheckpoint(taskId, subtask.id, result);
            return {
                subtask_id: subtask.id,
                success: true,
                output: result.output,
                execution_time: executionTime,
                worktree_path: worktreePath,
                checkpoint_id: checkpointId
            };
        }
        else {
            throw new Error(result.error || "Sub-agent execution failed");
        }
    }
    catch (error) {
        const executionTime = Date.now() - startTime;
        log(`   ❌ Failed (${(executionTime / 1000).toFixed(2)}s)`);
        return {
            subtask_id: subtask.id,
            success: false,
            output: "",
            error: error instanceof Error ? error.message : String(error),
            execution_time: executionTime,
            worktree_path: worktreePath
        };
    }
}
/**
 * Create isolated worktree for subtask
 */
async function createWorktree(taskId, subtaskId) {
    const worktreePath = `workspace/agents/${taskId}/${subtaskId}`;
    try {
        // Create directory
        await (0, openclaw_api_js_1.exec)({
            command: `mkdir -p ${worktreePath}`,
            timeout: 5000
        });
        return worktreePath;
    }
    catch (error) {
        console.warn(`Warning: Could not create worktree at ${worktreePath}`);
        return worktreePath; // Return path anyway, will fail later if truly inaccessible
    }
}
/**
 * Load agent soul
 */
async function loadAgentSoul(agentType) {
    try {
        const soulPath = `souls/${agentType}/soul.md`;
        return await (0, openclaw_api_js_1.read)({ path: soulPath });
    }
    catch (error) {
        console.warn(`Warning: Could not load soul for ${agentType}`);
        return ""; // Return empty if not found
    }
}
/**
 * Search for similar historical errors
 */
async function searchSimilarErrors(subtask) {
    try {
        // Search in memory for similar errors
        const errors = []; // TODO: Implement memory search
        return errors;
    }
    catch (error) {
        return [];
    }
}
/**
 * Build task prompt for sub-agent
 */
function buildTaskPrompt(subtask, soul, similarErrors) {
    let prompt = `# Task: ${subtask.name}\n\n`;
    prompt += `## Description\n${subtask.description}\n\n`;
    if (soul) {
        prompt += `## Agent Soul\n${soul}\n\n`;
    }
    if (similarErrors.length > 0) {
        prompt += `## Historical Errors to Avoid\n`;
        similarErrors.forEach((err, i) => {
            prompt += `${i + 1}. ${err.description}\n`;
        });
        prompt += `\n`;
    }
    if (subtask.test_cases && subtask.test_cases.length > 0) {
        prompt += `## Test Cases\n`;
        subtask.test_cases.forEach((tc, i) => {
            prompt += `Test ${i + 1}: ${tc.description}\n`;
            prompt += `  Input: ${JSON.stringify(tc.input)}\n`;
            prompt += `  Expected: ${JSON.stringify(tc.expected_output)}\n\n`;
        });
    }
    prompt += `## Instructions\n`;
    prompt += `1. Complete the task described above\n`;
    prompt += `2. Follow the guidelines in your Agent Soul\n`;
    prompt += `3. Avoid the historical errors listed\n`;
    prompt += `4. Ensure all test cases pass\n`;
    prompt += `5. Report your progress and any issues\n`;
    return prompt;
}
/**
 * Save checkpoint
 */
async function saveCheckpoint(taskId, subtaskId, result) {
    const checkpointId = `chk-${Date.now()}`;
    const checkpointPath = `memory/checkpoints/${taskId}/${subtaskId}/${checkpointId}.json`;
    try {
        await (0, openclaw_api_js_1.write)({
            path: checkpointPath,
            content: JSON.stringify({
                checkpoint_id: checkpointId,
                task_id: taskId,
                subtask_id: subtaskId,
                timestamp: new Date().toISOString(),
                result
            }, null, 2)
        });
        return checkpointId;
    }
    catch (error) {
        console.warn(`Warning: Could not save checkpoint`);
        return checkpointId;
    }
}
// Initialize Viking
const viking = new viking_store_js_1.VikingManager();
/**
 * Record error for learning using Viking
 */
async function recordError(taskId, subtask, result) {
    const errorRecord = {
        error_id: `err-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        task_id: taskId,
        subtask_id: subtask.id,
        agent_type: subtask.agent_type,
        timestamp: new Date().toISOString(),
        error_type: result.error?.split(':')[0] || 'UnknownError',
        error_message: result.error || 'Unknown error',
        context: {
            task_description: subtask.description,
            subtask_name: subtask.name
        }
    };
    // Store in Viking (all three layers)
    try {
        await viking.storeError(errorRecord);
    }
    catch (error) {
        console.warn(`Warning: Could not record error to Viking`);
    }
}
/**
 * Save execution result
 */
async function saveExecutionResult(result) {
    const resultPath = `memory/executions/${result.task_id}.json`;
    try {
        await (0, openclaw_api_js_1.write)({
            path: resultPath,
            content: JSON.stringify(result, null, 2)
        });
    }
    catch (error) {
        console.warn(`Warning: Could not save execution result`);
    }
}
/**
 * Generate execution summary
 */
function generateSummary(results, status) {
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    const successRate = (successCount / totalCount * 100).toFixed(1);
    let summary = `Execution ${status}. `;
    summary += `${successCount}/${totalCount} subtasks succeeded (${successRate}%). `;
    if (status === "completed") {
        summary += "All objectives achieved.";
    }
    else if (status === "partial") {
        summary += "Some objectives achieved, review recommended.";
    }
    else {
        summary += "Execution failed, manual intervention required.";
    }
    return summary;
}
// Export for OpenClaw tool registration
exports.default = maselExecute;
//# sourceMappingURL=masel-execute.js.map