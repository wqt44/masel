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
export const toolDefinitions = [
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
    handler: maselPlan
  },
  
  {
    name: "masel_execute",
    description: "Execute subtasks with parallel sub-agents, Worktree isolation, and security checks",
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
            silent: { type: "boolean", default: false, description: "Silent mode: suppress intermediate output" },
            enable_cleanup: { type: "boolean", default: true, description: "Auto cleanup old files after execution" },
            enable_fallback: { type: "boolean", default: true, description: "Enable fallback to main agent on failure" },
            enable_security: { type: "boolean", default: true, description: "Enable security scanning and sandbox" }
          }
        }
      },
      required: ["plan"]
    },
    handler: maselExecute
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
    handler: maselReview
  },
  
  {
    name: "masel_learn",
    description: "Analyze errors, extract patterns, and update Agent Souls with safe learning",
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
        },
        require_approval: {
          type: "boolean",
          default: true,
          description: "Require approval for soul updates (safe learning)"
        },
        min_confidence: {
          type: "number",
          default: 0.7,
          description: "Minimum confidence threshold for learning (0-1)"
        }
      }
    },
    handler: maselLearn
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
    handler: maselStatus
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
    handler: maselSouls
  }
];

/**
 * Register all tools with OpenClaw
 */
export function registerTools(openclaw: any): void {
  for (const tool of toolDefinitions) {
    openclaw.registerTool(tool.name, tool.handler, tool.parameters);
    console.log(`✅ Registered tool: ${tool.name}`);
  }
}

export { maselPlan, maselExecute, maselReview, maselLearn, maselStatus, maselSouls };
