/**
 * MASEL Status Tool
 *
 * Monitor task execution status and system health
 */
interface StatusOptions {
    task_id?: string;
    show_all?: boolean;
}
interface TaskStatus {
    task_id: string;
    status: "running" | "completed" | "failed" | "unknown";
    progress: {
        total_subtasks: number;
        completed: number;
        failed: number;
        pending: number;
    };
    execution_time: number;
    current_subtask?: string;
    last_updated: string;
}
interface SystemStatus {
    version: string;
    uptime: number;
    active_tasks: number;
    completed_tasks: number;
    failed_tasks: number;
    memory_stats: {
        hot_errors: number;
        warm_errors_today: number;
        total_errors: number;
    };
    agent_stats: Record<string, {
        tasks_completed: number;
        success_rate: number;
        common_errors: string[];
    }>;
}
/**
 * Get task status
 */
export declare function maselStatus(options: StatusOptions): Promise<TaskStatus | SystemStatus>;
export default maselStatus;
//# sourceMappingURL=masel-status.d.ts.map