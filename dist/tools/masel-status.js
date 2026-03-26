"use strict";
/**
 * MASEL Status Tool
 *
 * Monitor task execution status and system health
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselStatus = maselStatus;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
const viking_store_js_1 = require("../memory/viking-store.js");
const viking = new viking_store_js_1.VikingManager();
/**
 * Get task status
 */
async function maselStatus(options) {
    if (options.task_id) {
        return getTaskStatus(options.task_id);
    }
    else {
        return getSystemStatus();
    }
}
/**
 * Get specific task status
 */
async function getTaskStatus(taskId) {
    console.log(`📊 Task Status: ${taskId}`);
    try {
        // Try to read execution result
        const resultPath = `memory/executions/${taskId}.json`;
        const content = await (0, openclaw_api_js_1.read)({ path: resultPath });
        const execution = JSON.parse(content);
        const completed = execution.results.filter((r) => r.success).length;
        const failed = execution.results.filter((r) => !r.success).length;
        return {
            task_id: taskId,
            status: execution.status,
            progress: {
                total_subtasks: execution.results.length,
                completed,
                failed,
                pending: 0
            },
            execution_time: execution.total_execution_time,
            last_updated: new Date().toISOString()
        };
    }
    catch {
        // Check if plan exists (task not started)
        try {
            const planPath = `memory/plans/${taskId}.json`;
            await (0, openclaw_api_js_1.read)({ path: planPath });
            return {
                task_id: taskId,
                status: "unknown",
                progress: {
                    total_subtasks: 0,
                    completed: 0,
                    failed: 0,
                    pending: 0
                },
                execution_time: 0,
                last_updated: new Date().toISOString()
            };
        }
        catch {
            throw new Error(`Task ${taskId} not found`);
        }
    }
}
/**
 * Get system-wide status
 */
async function getSystemStatus() {
    console.log("📊 System Status");
    // Get memory statistics
    const memStats = await viking.getStatistics();
    // Count tasks
    const { stdout: planFiles } = await (0, openclaw_api_js_1.exec)({
        command: "ls memory/plans/*.json 2>/dev/null | wc -l || echo 0",
        timeout: 5000
    });
    const { stdout: execFiles } = await (0, openclaw_api_js_1.exec)({
        command: "ls memory/executions/*.json 2>/dev/null | wc -l || echo 0",
        timeout: 5000
    });
    return {
        version: "1.0.0",
        uptime: Date.now(), // TODO: Track actual uptime
        active_tasks: 0, // TODO: Track active
        completed_tasks: parseInt(execFiles.trim()) || 0,
        failed_tasks: memStats.total_today, // Approximation
        memory_stats: {
            hot_errors: memStats.hot_count,
            warm_errors_today: memStats.warm_today_count,
            total_errors: memStats.total_today
        },
        agent_stats: {
            coder: {
                tasks_completed: 0,
                success_rate: 0,
                common_errors: []
            },
            researcher: {
                tasks_completed: 0,
                success_rate: 0,
                common_errors: []
            },
            reviewer: {
                tasks_completed: 0,
                success_rate: 0,
                common_errors: []
            }
        }
    };
}
exports.default = maselStatus;
//# sourceMappingURL=masel-status.js.map