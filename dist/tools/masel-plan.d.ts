/**
 * MASEL Plan Tool
 *
 * Analyzes user task, brainstorms solutions, refines specs,
 * and creates execution plan.
 */
interface PlanOptions {
    task: string;
    workflow_type?: "simple" | "complex" | "research" | "coding";
    context?: Record<string, any>;
}
interface Subtask {
    id: string;
    name: string;
    description: string;
    agent_type: "coder" | "researcher" | "reviewer";
    dependencies: string[];
    estimated_time: number;
    test_cases?: {
        input: any;
        expected_output: any;
        description: string;
    }[];
}
interface ExecutionPlan {
    task_id: string;
    original_task: string;
    workflow_type: string;
    brainstorm: {
        approaches: string[];
        selected_approach: string;
        rationale: string;
    };
    spec: {
        requirements: string[];
        acceptance_criteria: string[];
        constraints: string[];
        boundary_conditions: string[];
    };
    subtasks: Subtask[];
    created_at: string;
    estimated_total_time: number;
}
/**
 * Main entry point for masel_plan tool
 */
export declare function maselPlan(options: PlanOptions): Promise<ExecutionPlan>;
export default maselPlan;
//# sourceMappingURL=masel-plan.d.ts.map