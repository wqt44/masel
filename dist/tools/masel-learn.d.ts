/**
 * MASEL Learn Tool
 *
 * Analyzes errors, extracts patterns, and updates Agent Souls
 * The core of self-evolution!
 */
import { ErrorRecord } from "../memory/viking-store.js";
interface LearnOptions {
    error?: ErrorRecord;
    trajectory?: Trajectory;
    review_report?: ReviewReport;
    auto_update?: boolean;
}
interface Trajectory {
    task_id: string;
    steps: TrajectoryStep[];
}
interface TrajectoryStep {
    step_id: string;
    agent_type: string;
    input: any;
    output: any;
    error?: any;
    timestamp: string;
}
interface ReviewReport {
    review_id: string;
    issues: Issue[];
    dimensions: DimensionScore[];
}
interface Issue {
    severity: string;
    category: string;
    description: string;
    suggestion: string;
}
interface DimensionScore {
    name: string;
    score: number;
}
interface LearningResult {
    learning_id: string;
    timestamp: string;
    root_cause: string;
    solution: string;
    prevention: string;
    pattern: string;
    extracted_patterns: Pattern[];
    soul_updates: SoulUpdate[];
    errors_analyzed: number;
    patterns_found: number;
    soul_sections_updated: number;
}
interface Pattern {
    pattern_id: string;
    name: string;
    description: string;
    trigger_conditions: string[];
    solution: string;
    prevention: string;
    occurrence_count: number;
    success_rate: number;
}
interface SoulUpdate {
    agent_type: string;
    section: string;
    change_type: "add" | "update" | "remove";
    content: string;
    reason: string;
}
/**
 * Main entry point for masel_learn tool
 */
export declare function maselLearn(options: LearnOptions): Promise<LearningResult>;
export default maselLearn;
//# sourceMappingURL=masel-learn.d.ts.map