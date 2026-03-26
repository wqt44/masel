/**
 * MASEL Plan Tool
 * 
 * Analyzes user task, brainstorms solutions, refines specs,
 * and creates execution plan.
 */

import { read, write, memory_search } from "../../utils/openclaw-api.js";

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
  estimated_time: number; // minutes
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
  
  // Phase 1: Brainstorming
  brainstorm: {
    approaches: string[];
    selected_approach: string;
    rationale: string;
  };
  
  // Phase 2: Spec Refinement
  spec: {
    requirements: string[];
    acceptance_criteria: string[];
    constraints: string[];
    boundary_conditions: string[];
  };
  
  // Phase 3: Task Planning
  subtasks: Subtask[];
  
  // Metadata
  created_at: string;
  estimated_total_time: number;
}

/**
 * Main entry point for masel_plan tool
 */
export async function maselPlan(options: PlanOptions): Promise<ExecutionPlan> {
  const { task, workflow_type = "simple", context = {} } = options;
  
  console.log(`🎯 MASEL Plan: Analyzing task...`);
  console.log(`   Task: ${task.substring(0, 100)}...`);
  console.log(`   Workflow: ${workflow_type}`);
  
  // Generate unique task ID
  const task_id = `masel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Phase 1: Brainstorming
  console.log(`\n💡 Phase 1: Brainstorming...`);
  const brainstorm = await performBrainstorming(task, workflow_type);
  console.log(`   Selected approach: ${brainstorm.selected_approach}`);
  
  // Phase 2: Spec Refinement
  console.log(`\n📋 Phase 2: Spec Refinement...`);
  const spec = await refineSpec(task, brainstorm, workflow_type);
  console.log(`   Requirements: ${spec.requirements.length}`);
  console.log(`   Acceptance criteria: ${spec.acceptance_criteria.length}`);
  
  // Phase 3: Task Planning
  console.log(`\n📐 Phase 3: Task Planning...`);
  const subtasks = await createSubtasks(spec, workflow_type);
  console.log(`   Subtasks: ${subtasks.length}`);
  
  // Calculate estimated time
  const estimated_total_time = subtasks.reduce(
    (sum, st) => sum + st.estimated_time, 
    0
  );
  
  // Build execution plan
  const plan: ExecutionPlan = {
    task_id,
    original_task: task,
    workflow_type,
    brainstorm,
    spec,
    subtasks,
    created_at: new Date().toISOString(),
    estimated_total_time
  };
  
  // Save plan to file for persistence
  await savePlan(plan);
  
  console.log(`\n✅ Plan created: ${task_id}`);
  console.log(`   Estimated time: ${estimated_total_time} minutes`);
  
  return plan;
}

/**
 * Phase 1: Brainstorm possible approaches
 */
async function performBrainstorming(
  task: string, 
  workflow_type: string
): Promise<ExecutionPlan["brainstorm"]> {
  // Search for similar historical tasks
  const similar_tasks = await memory_search({
    query: `task similar to: ${task}`,
    limit: 5
  });
  
  // Generate approaches based on workflow type
  const approaches: string[] = [];
  
  switch (workflow_type) {
    case "coding":
      approaches.push(
        "Direct implementation: Write code immediately",
        "TDD approach: Write tests first, then implementation",
        "Prototype first: Build quick prototype, then refine",
        "Modular design: Break into reusable components"
      );
      break;
      
    case "research":
      approaches.push(
        "Broad search: Gather comprehensive information",
        "Deep dive: Focus on specific aspects",
        "Comparative analysis: Compare multiple sources",
        "Trend analysis: Identify patterns over time"
      );
      break;
      
    case "complex":
      approaches.push(
        "Waterfall: Sequential phases",
        "Iterative: Multiple iterations",
        "Parallel: Multiple workstreams",
        "Agile: Flexible adaptation"
      );
      break;
      
    default: // simple
      approaches.push(
        "Direct execution: Single step",
        "Two-phase: Quick check then execute"
      );
  }
  
  // Select best approach based on task characteristics
  const selected_approach = selectBestApproach(task, approaches, similar_tasks);
  
  return {
    approaches,
    selected_approach,
    rationale: `Selected "${selected_approach}" based on task complexity and historical success patterns`
  };
}

/**
 * Select best approach based on heuristics
 */
function selectBestApproach(
  task: string, 
  approaches: string[],
  similar_tasks: any[]
): string {
  // Check task complexity indicators
  const complexity_indicators = [
    "and", "then", "after", "before", "multiple", 
    "complex", "integrate", "system", "architecture"
  ];
  
  const complexity_score = complexity_indicators.reduce(
    (score, indicator) => score + (task.toLowerCase().includes(indicator) ? 1 : 0),
    0
  );
  
  // Simple tasks: use direct approach
  if (complexity_score <= 1) {
    return approaches[0];
  }
  
  // Medium complexity: use structured approach
  if (complexity_score <= 3) {
    return approaches[1] || approaches[0];
  }
  
  // High complexity: use modular/iterative approach
  return approaches[approaches.length - 1] || approaches[0];
}

/**
 * Phase 2: Refine specifications
 */
async function refineSpec(
  task: string,
  brainstorm: ExecutionPlan["brainstorm"],
  workflow_type: string
): Promise<ExecutionPlan["spec"]> {
  // Extract requirements from task
  const requirements = extractRequirements(task);
  
  // Generate acceptance criteria
  const acceptance_criteria = generateAcceptanceCriteria(task, workflow_type);
  
  // Identify constraints
  const constraints = identifyConstraints(task);
  
  // Define boundary conditions
  const boundary_conditions = defineBoundaryConditions(task);
  
  return {
    requirements,
    acceptance_criteria,
    constraints,
    boundary_conditions
  };
}

/**
 * Extract requirements from task description
 */
function extractRequirements(task: string): string[] {
  const requirements: string[] = [];
  
  // Look for explicit requirements ("need to", "must", "should")
  const requirement_patterns = [
    /need to\s+(.+?)(?:\.|,|;|$)/gi,
    /must\s+(.+?)(?:\.|,|;|$)/gi,
    /should\s+(.+?)(?:\.|,|;|$)/gi,
    /require\s+(.+?)(?:\.|,|;|$)/gi
  ];
  
  for (const pattern of requirement_patterns) {
    let match;
    while ((match = pattern.exec(task)) !== null) {
      requirements.push(match[1].trim());
    }
  }
  
  // If no explicit requirements, infer from task
  if (requirements.length === 0) {
    requirements.push(`Complete the task: ${task}`);
  }
  
  return [...new Set(requirements)]; // Remove duplicates
}

/**
 * Generate acceptance criteria
 */
function generateAcceptanceCriteria(task: string, workflow_type: string): string[] {
  const criteria: string[] = [];
  
  // Generic criteria
  criteria.push("Output is generated successfully");
  criteria.push("No errors during execution");
  
  // Workflow-specific criteria
  switch (workflow_type) {
    case "coding":
      criteria.push("Code passes all test cases");
      criteria.push("Code follows style guidelines");
      criteria.push("Code is properly documented");
      break;
      
    case "research":
      criteria.push("Information is from reliable sources");
      criteria.push("Multiple perspectives are considered");
      criteria.push("Report is well-structured");
      break;
      
    case "complex":
      criteria.push("All subtasks are completed");
      criteria.push("Integration is successful");
      criteria.push("End-to-end testing passes");
      break;
  }
  
  return criteria;
}

/**
 * Identify constraints
 */
function identifyConstraints(task: string): string[] {
  const constraints: string[] = [];
  
  // Time constraints
  if (task.match(/\d+\s*(minute|hour|day)/i)) {
    constraints.push("Time limit specified in task");
  }
  
  // Technology constraints
  if (task.toLowerCase().includes("python")) {
    constraints.push("Use Python language");
  }
  if (task.toLowerCase().includes("javascript") || task.toLowerCase().includes("typescript")) {
    constraints.push("Use JavaScript/TypeScript language");
  }
  
  // Resource constraints
  if (task.toLowerCase().includes("memory") || task.toLowerCase().includes("performance")) {
    constraints.push("Consider resource efficiency");
  }
  
  return constraints;
}

/**
 * Define boundary conditions
 */
function defineBoundaryConditions(task: string): string[] {
  return [
    "Handle empty input gracefully",
    "Handle very large input efficiently",
    "Handle invalid input with clear error messages",
    "Handle concurrent access if applicable"
  ];
}

/**
 * Phase 3: Create subtasks
 */
async function createSubtasks(
  spec: ExecutionPlan["spec"],
  workflow_type: string
): Promise<Subtask[]> {
  const subtasks: Subtask[] = [];
  
  switch (workflow_type) {
    case "coding":
      subtasks.push(
        {
          id: "st-001",
          name: "Analyze requirements",
          description: "Understand requirements and design approach",
          agent_type: "coder",
          dependencies: [],
          estimated_time: 10,
          test_cases: []
        },
        {
          id: "st-002",
          name: "Write tests",
          description: "Create test cases based on acceptance criteria",
          agent_type: "coder",
          dependencies: ["st-001"],
          estimated_time: 15,
          test_cases: []
        },
        {
          id: "st-003",
          name: "Implement code",
          description: "Write code to pass all tests",
          agent_type: "coder",
          dependencies: ["st-002"],
          estimated_time: 30,
          test_cases: spec.acceptance_criteria.map((criteria, i) => ({
            input: `test_input_${i}`,
            expected_output: `pass: ${criteria}`,
            description: criteria
          }))
        },
        {
          id: "st-004",
          name: "Review code",
          description: "Review code quality and correctness",
          agent_type: "reviewer",
          dependencies: ["st-003"],
          estimated_time: 10,
          test_cases: []
        }
      );
      break;
      
    case "research":
      subtasks.push(
        {
          id: "st-001",
          name: "Define research scope",
          description: "Clarify research questions and scope",
          agent_type: "researcher",
          dependencies: [],
          estimated_time: 10,
          test_cases: []
        },
        {
          id: "st-002",
          name: "Gather information",
          description: "Search and collect relevant information",
          agent_type: "researcher",
          dependencies: ["st-001"],
          estimated_time: 30,
          test_cases: []
        },
        {
          id: "st-003",
          name: "Analyze findings",
          description: "Analyze and synthesize findings",
          agent_type: "researcher",
          dependencies: ["st-002"],
          estimated_time: 20,
          test_cases: []
        },
        {
          id: "st-004",
          name: "Generate report",
          description: "Create structured research report",
          agent_type: "researcher",
          dependencies: ["st-003"],
          estimated_time: 15,
          test_cases: spec.acceptance_criteria.map((criteria, i) => ({
            input: "report_content",
            expected_output: `includes: ${criteria}`,
            description: criteria
          }))
        }
      );
      break;
      
    case "simple":
    default:
      subtasks.push(
        {
          id: "st-001",
          name: "Execute task",
          description: "Complete the requested task",
          agent_type: workflow_type === "coding" ? "coder" : "researcher",
          dependencies: [],
          estimated_time: 20,
          test_cases: spec.acceptance_criteria.map((criteria, i) => ({
            input: "task_input",
            expected_output: `success: ${criteria}`,
            description: criteria
          }))
        }
      );
  }
  
  return subtasks;
}

/**
 * Save plan to file for persistence
 */
async function savePlan(plan: ExecutionPlan): Promise<void> {
  const plan_path = `memory/plans/${plan.task_id}.json`;
  
  try {
    await write({
      path: plan_path,
      content: JSON.stringify(plan, null, 2)
    });
  } catch (error) {
    console.warn(`Warning: Could not save plan to ${plan_path}`);
  }
}

// Export for OpenClaw tool registration
export default maselPlan;
