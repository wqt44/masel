/**
 * MASEL Review Tool
 *
 * Reviews sub-agent outputs with Loss Function quality assessment
 */
interface ReviewOptions {
    results: SubtaskResult[];
    criteria?: ReviewCriteria;
    plan?: ExecutionPlan;
}
interface SubtaskResult {
    subtask_id: string;
    success: boolean;
    output: string;
    error?: string;
    execution_time: number;
}
interface ExecutionPlan {
    task_id: string;
    original_task: string;
    spec: {
        requirements: string[];
        acceptance_criteria: string[];
    };
    subtasks: {
        id: string;
        name: string;
        agent_type: string;
    }[];
}
interface ReviewCriteria {
    correctness_weight?: number;
    completeness_weight?: number;
    efficiency_weight?: number;
    readability_weight?: number;
    robustness_weight?: number;
}
interface DimensionScore {
    name: string;
    score: number;
    weight: number;
    comments: string[];
}
interface ReviewReport {
    review_id: string;
    task_id: string;
    overall_score: number;
    dimensions: DimensionScore[];
    issues: Issue[];
    decision: "APPROVE" | "NEEDS_REVISION" | "REJECT";
    summary: string;
    recommendations: string[];
}
interface Issue {
    severity: "high" | "medium" | "low";
    category: string;
    description: string;
    location?: string;
    suggestion: string;
}
/**
 * Main entry point for masel_review tool
 */
export declare function maselReview(options: ReviewOptions): Promise<ReviewReport>;
export default maselReview;
//# sourceMappingURL=masel-review.d.ts.map