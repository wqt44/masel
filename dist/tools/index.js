"use strict";
/**
 * MASEL Tools Registration
 *
 * Registers all MASEL tools with OpenClaw
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselSouls = exports.maselStatus = exports.maselLearn = exports.maselReview = exports.maselExecute = exports.maselPlan = exports.toolDefinitions = void 0;
exports.registerTools = registerTools;
const masel_plan_js_1 = __importDefault(require("./masel-plan.js"));
exports.maselPlan = masel_plan_js_1.default;
const masel_execute_js_1 = __importDefault(require("./masel-execute.js"));
exports.maselExecute = masel_execute_js_1.default;
const masel_review_js_1 = __importDefault(require("./masel-review.js"));
exports.maselReview = masel_review_js_1.default;
const masel_learn_js_1 = __importDefault(require("./masel-learn.js"));
exports.maselLearn = masel_learn_js_1.default;
const masel_status_js_1 = __importDefault(require("./masel-status.js"));
exports.maselStatus = masel_status_js_1.default;
const masel_souls_js_1 = __importDefault(require("./masel-souls.js"));
exports.maselSouls = masel_souls_js_1.default;
/**
 * Tool definitions for OpenClaw
 */
exports.toolDefinitions = [
    {
        name: "masel_plan",
        description: "Analyze task and create execution plan with brainstorm, spec refinement, and task breakdown",
        parameters: {
            type: "object",
            properties: {
                task: {
                    type: "string",
                    description: "User task description"
                },
                workflow_type: {
                    type: "string",
                    enum: ["simple", "complex", "research", "coding"],
                    default: "simple",
                    description: "Type of workflow to use"
                },
                context: {
                    type: "object",
                    description: "Additional context for the task",
                    default: {}
                }
            },
            required: ["task"]
        },
        handler: masel_plan_js_1.default
    },
    {
        name: "masel_execute",
        description: "Execute subtasks with parallel sub-agents and Worktree isolation",
        parameters: {
            type: "object",
            properties: {
                plan: {
                    type: "object",
                    description: "Execution plan from masel_plan"
                },
                options: {
                    type: "object",
                    properties: {
                        parallel: { type: "boolean", default: false },
                        checkpoint: { type: "boolean", default: true },
                        worktree_isolation: { type: "boolean", default: true },
                        silent: { type: "boolean", default: false, description: "Silent mode: suppress intermediate output" }
                    }
                }
            },
            required: ["plan"]
        },
        handler: masel_execute_js_1.default
    },
    {
        name: "masel_review",
        description: "Review sub-agent outputs with Loss Function quality assessment",
        parameters: {
            type: "object",
            properties: {
                results: {
                    type: "array",
                    description: "Sub-agent execution results"
                },
                criteria: {
                    type: "object",
                    description: "Review criteria weights"
                },
                plan: {
                    type: "object",
                    description: "Original execution plan"
                }
            },
            required: ["results"]
        },
        handler: masel_review_js_1.default
    },
    {
        name: "masel_learn",
        description: "Analyze errors, extract patterns, and update Agent Souls",
        parameters: {
            type: "object",
            properties: {
                error: {
                    type: "object",
                    description: "Error record to analyze"
                },
                trajectory: {
                    type: "object",
                    description: "Execution trajectory for context"
                },
                review_report: {
                    type: "object",
                    description: "Review report with issues"
                },
                auto_update: {
                    type: "boolean",
                    default: false,
                    description: "Automatically update Souls"
                }
            }
        },
        handler: masel_learn_js_1.default
    },
    {
        name: "masel_status",
        description: "Check MASEL task execution status and system health",
        parameters: {
            type: "object",
            properties: {
                task_id: {
                    type: "string",
                    description: "Task ID to check (omit for system status)"
                },
                show_all: {
                    type: "boolean",
                    default: false
                }
            }
        },
        handler: masel_status_js_1.default
    },
    {
        name: "masel_souls",
        description: "Manage Agent Souls - list, get, update, or reset",
        parameters: {
            type: "object",
            properties: {
                action: {
                    type: "string",
                    enum: ["list", "get", "update", "reset"],
                    description: "Action to perform"
                },
                agent_type: {
                    type: "string",
                    description: "Target agent type"
                },
                content: {
                    type: "string",
                    description: "New content (for update)"
                },
                section: {
                    type: "string",
                    description: "Section to update (optional)"
                }
            },
            required: ["action"]
        },
        handler: masel_souls_js_1.default
    }
];
/**
 * Register all tools with OpenClaw
 */
function registerTools(openclaw) {
    for (const tool of exports.toolDefinitions) {
        openclaw.registerTool(tool.name, tool.handler, tool.parameters);
        console.log(`✅ Registered tool: ${tool.name}`);
    }
}
//# sourceMappingURL=index.js.map