/**
 * MASEL Tools Registration
 *
 * Registers all MASEL tools with OpenClaw
 */
import maselPlan from "./masel-plan.js";
import maselExecute from "./masel-execute.js";
import maselReview from "./masel-review.js";
import maselLearn from "./masel-learn.js";
import maselStatus from "./masel-status.js";
import maselSouls from "./masel-souls.js";
/**
 * Tool definitions for OpenClaw
 */
export declare const toolDefinitions: ({
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            task: {
                type: string;
                description: string;
            };
            workflow_type: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
            context: {
                type: string;
                description: string;
                default: {};
            };
            plan?: undefined;
            options?: undefined;
            results?: undefined;
            criteria?: undefined;
            error?: undefined;
            trajectory?: undefined;
            review_report?: undefined;
            auto_update?: undefined;
            task_id?: undefined;
            show_all?: undefined;
            action?: undefined;
            agent_type?: undefined;
            content?: undefined;
            section?: undefined;
        };
        required: string[];
    };
    handler: typeof maselPlan;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            plan: {
                type: string;
                description: string;
            };
            options: {
                type: string;
                properties: {
                    parallel: {
                        type: string;
                        default: boolean;
                    };
                    checkpoint: {
                        type: string;
                        default: boolean;
                    };
                    worktree_isolation: {
                        type: string;
                        default: boolean;
                    };
                    silent: {
                        type: string;
                        default: boolean;
                        description: string;
                    };
                };
            };
            task?: undefined;
            workflow_type?: undefined;
            context?: undefined;
            results?: undefined;
            criteria?: undefined;
            error?: undefined;
            trajectory?: undefined;
            review_report?: undefined;
            auto_update?: undefined;
            task_id?: undefined;
            show_all?: undefined;
            action?: undefined;
            agent_type?: undefined;
            content?: undefined;
            section?: undefined;
        };
        required: string[];
    };
    handler: typeof maselExecute;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            results: {
                type: string;
                description: string;
            };
            criteria: {
                type: string;
                description: string;
            };
            plan: {
                type: string;
                description: string;
            };
            task?: undefined;
            workflow_type?: undefined;
            context?: undefined;
            options?: undefined;
            error?: undefined;
            trajectory?: undefined;
            review_report?: undefined;
            auto_update?: undefined;
            task_id?: undefined;
            show_all?: undefined;
            action?: undefined;
            agent_type?: undefined;
            content?: undefined;
            section?: undefined;
        };
        required: string[];
    };
    handler: typeof maselReview;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            error: {
                type: string;
                description: string;
            };
            trajectory: {
                type: string;
                description: string;
            };
            review_report: {
                type: string;
                description: string;
            };
            auto_update: {
                type: string;
                default: boolean;
                description: string;
            };
            task?: undefined;
            workflow_type?: undefined;
            context?: undefined;
            plan?: undefined;
            options?: undefined;
            results?: undefined;
            criteria?: undefined;
            task_id?: undefined;
            show_all?: undefined;
            action?: undefined;
            agent_type?: undefined;
            content?: undefined;
            section?: undefined;
        };
        required?: undefined;
    };
    handler: typeof maselLearn;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            task_id: {
                type: string;
                description: string;
            };
            show_all: {
                type: string;
                default: boolean;
            };
            task?: undefined;
            workflow_type?: undefined;
            context?: undefined;
            plan?: undefined;
            options?: undefined;
            results?: undefined;
            criteria?: undefined;
            error?: undefined;
            trajectory?: undefined;
            review_report?: undefined;
            auto_update?: undefined;
            action?: undefined;
            agent_type?: undefined;
            content?: undefined;
            section?: undefined;
        };
        required?: undefined;
    };
    handler: typeof maselStatus;
} | {
    name: string;
    description: string;
    parameters: {
        type: string;
        properties: {
            action: {
                type: string;
                enum: string[];
                description: string;
            };
            agent_type: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
            section: {
                type: string;
                description: string;
            };
            task?: undefined;
            workflow_type?: undefined;
            context?: undefined;
            plan?: undefined;
            options?: undefined;
            results?: undefined;
            criteria?: undefined;
            error?: undefined;
            trajectory?: undefined;
            review_report?: undefined;
            auto_update?: undefined;
            task_id?: undefined;
            show_all?: undefined;
        };
        required: string[];
    };
    handler: typeof maselSouls;
})[];
/**
 * Register all tools with OpenClaw
 */
export declare function registerTools(openclaw: any): void;
export { maselPlan, maselExecute, maselReview, maselLearn, maselStatus, maselSouls };
//# sourceMappingURL=index.d.ts.map