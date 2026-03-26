# MASEL - Multi-Agent System with Error Learning

MASEL is a self-evolving multi-agent system for OpenClaw that orchestrates sub-agents to complete complex tasks while learning from errors to avoid repeating mistakes.

## Overview

MASEL treats task execution as a company workflow:
- **CEO**: Analyzes tasks, brainstorms solutions, refines specs, and delegates to departments
- **Dev Department**: Handles coding and testing with TDD workflow
- **Research Department**: Gathers and analyzes information
- **QA Department**: Reviews deliverables with automated quality assessment

## Key Features

### 1. Self-Evolving Architecture
- **Trajectory Recording**: Captures complete execution history
- **Loss Function**: Multi-dimensional quality assessment
- **Back-Propagation**: Automatic error attribution
- **Auto-Optimization**: Self-improving prompts and agent souls

### 2. MASEL-Viking Memory System
Three-layer storage for error memory:
- **Hot Memory** (SQLite): Recent 10 errors, millisecond access
- **Warm Memory** (File System): This week's errors, human-readable
- **Cold Memory** (QMD Vector DB): All historical errors, semantic search

### 3. Composable Workflow
Flexible workflow nodes:
- `brainstorm`: Explore multiple solutions
- `spec`: Refine requirements and acceptance criteria
- `plan`: Break down into subtasks
- `execute`: Run sub-agents with Worktree isolation
- `test`: TDD validation
- `review`: Quality assessment

### 4. Agency Organization
Hierarchical structure with clear roles:
```
CEO
├── DevManager
│   ├── Coder (×N)
│   └── Tester (×N)
├── ResearchManager
│   └── Researcher (×N)
└── Reviewer
```

## Usage

### Basic Task Execution
```typescript
const result = await maselExecute({
  task: "Analyze the codebase and generate a report",
  workflow: "research" // or "coding", "simple", "complex"
});
```

### Custom Workflow
```typescript
const result = await maselExecute({
  task: "Build a web scraper",
  workflow: ["brainstorm", "spec", "plan", "execute", "test", "review"]
});
```

### Silent Mode (No Intermediate Output)
```typescript
// Execute without showing sub-agent steps
const result = await maselExecute({
  plan: executionPlan,
  options: { silent: true }
});
```

### Resilience & Auto Cleanup
```typescript
// v1.2.0: Enable fallback and cleanup
const result = await maselExecute({
  plan: executionPlan,
  options: {
    enable_fallback: true,  // Sub-agent fails → main agent takes over
    enable_cleanup: true    // Auto cleanup after execution
  }
});
```

### Safe Learning
```typescript
// v1.2.0: Conservative learning with approval
const result = await maselLearn({
  review_report: review,
  auto_update: false,       // Default: requires approval
  require_approval: true,
  min_confidence: 0.7       // Only learn if >70% confident
});
```

### Auto Mode (Automatic Task Classification)
```javascript
const { masel } = require('./masel-wrapper');

// Automatically detect if task needs MASEL
const result = await masel.auto("Write a Python web scraper");
// If complex: executes with MASEL silently
// If simple: returns { auto_skipped: true }

// Silent execution
const result = await masel.silent("Implement a REST API");
// Returns final result without intermediate steps
```

## Architecture

```
Layer 5: Meta-Learning
└── Optimize evolution strategies

Layer 4: Evolution
├── Auto-optimize prompts
├── Update Agent Souls
└── Maintain Skill Library

Layer 3: Evaluation
├── Trajectory recording
├── Loss Function assessment
└── Back-propagation attribution

Layer 2: Execution
├── Brainstorm → Spec → Plan
├── Parallel execution (Worktree isolation)
├── Integration & Test
└── Code Review

Layer 1: Infrastructure
├── OpenClaw Runtime
├── MASEL-Viking Memory
└── Skill Library
```

## File Structure

```
skills/masel/
├── SKILL.md                    # This file
├── openclaw.plugin.json        # Plugin configuration
├── src/
│   ├── index.ts               # Entry point
│   ├── agency/                # Organization structure
│   │   ├── ceo.ts
│   │   ├── departments/
│   │   └── agency-chart.yaml
│   ├── workflow/              # Workflow nodes and templates
│   │   ├── nodes/
│   │   └── templates/
│   ├── self-improving/        # Self-evolution system
│   │   ├── trajectory-recorder.ts
│   │   ├── loss-function.ts
│   │   ├── back-propagation.ts
│   │   └── optimizer.ts
│   ├── memory/                # MASEL-Viking storage
│   │   ├── viking-store.ts
│   │   ├── hot-store.ts
│   │   └── cold-store.ts
│   └── tools/                 # OpenClaw tools
│       ├── masel-plan.ts
│       ├── masel-execute.ts
│       ├── masel-review.ts
│       └── masel-learn.ts
└── souls/                     # Agent soul templates
    ├── coder/soul.md
    ├── researcher/soul.md
    └── reviewer/soul.md
```

## Inspired By

- **DeerFlow 2.0**: Harness architecture, checkpointing, memory system
- **Gstack**: Role-based design, opinionated workflow
- **Superpowers**: Composable skills, TDD, Worktree isolation
- **Agency Swarm**: Agency organization, hierarchical structure
- **Self-Improving Agents**: Trajectory, loss function, back-propagation
- **OpenViking**: File system paradigm for memory
- **MemOS**: Unified memory API, rich memory types
- **MemGPT**: Virtual context management, layered storage

## License

MIT
