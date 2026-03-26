/**
 * MASEL Execute Tool
 *
 * Executes subtasks with parallel sub-agents and Worktree isolation
 */
interface ExecuteOptions {
    plan: ExecutionPlan;
    options?: {
        parallel?: boolean;
        checkpoint?: boolean;
        worktree_isolation?: boolean;
        silent?: boolean;
    };
}
interface ExecutionPlan {
    task_id: string;
    original_task: string;
    subtasks: Subtask[];
}
interface Subtask {
    id: string;
    name: string;
    description: string;
    agent_type: "coder" | "researcher" | "reviewer";
    dependencies: string[];
    estimated_time: number;
    test_cases?: any[];
}
interface SubtaskResult {
    subtask_id: string;
    success: boolean;
    output: string;
    error?: string;
    execution_time: number;
    worktree_path?: string;
    checkpoint_id?: string;
}
interface ExecutionResult {
    task_id: string;
    status: "completed" | "failed" | "partial";
    results: SubtaskResult[];
    total_execution_time: number;
    summary: string;
}
/**
 * Main entry point for masel_execute tool
 */
export declare function maselExecute(options: ExecuteOptions): Promise<ExecutionResult>;
export default maselExecute;
//# sourceMappingURL=masel-execute.d.ts.map