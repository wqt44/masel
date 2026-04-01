---
name: masel
description: Multi-agent execution system for OpenClaw. Use when a task is complex enough to benefit from planning, delegated execution, testing/review, and learning from errors rather than direct one-step completion.
---

# MASEL

MASEL is a multi-agent execution system for OpenClaw that breaks complex tasks into planning, execution, review, and learning steps.

## Route here when

Use `MASEL` when the task is mainly:
- complex enough to benefit from planning before execution
- best handled by multiple roles or sub-agents
- likely to need review, testing, or iterative refinement
- worth recording lessons from failures or quality checks

Do not use MASEL for trivial one-step tasks that can be completed directly.

## Core model

MASEL treats execution like an organized workflow:
- planning
- delegated execution
- testing/review
- learning from errors

Common roles:
- CEO / planner
- development/coding
- research
- QA / reviewer

## Default workflow

Typical nodes are:
- `brainstorm`
- `spec`
- `plan`
- `execute`
- `test`
- `review`

Use the shortest workflow that still matches the task.

## Fast path

### Execute a task

```typescript
const result = await maselExecute({
  task: "Analyze the codebase and generate a report",
  workflow: "research"
});
```

### Custom workflow

```typescript
const result = await maselExecute({
  task: "Build a web scraper",
  workflow: ["brainstorm", "spec", "plan", "execute", "test", "review"]
});
```

### Auto mode

```javascript
const { masel } = require('./masel-wrapper');
const result = await masel.auto("Write a Python web scraper");
```

### Silent mode

```javascript
const result = await masel.silent("Implement a REST API");
```

## Practical rules

- Use MASEL for complex work, not for everything.
- Prefer `auto()` when task complexity is unclear.
- Prefer silent execution when intermediate chatter is not useful.
- Enable fallback and cleanup for longer or riskier runs.
- Keep learning conservative; require confidence before updating behavior.

## Key subsystems

- workflow orchestration
- sub-agent execution
- review and quality checks
- layered memory
- self-improvement / learning

## Read next

Read implementation files when you need exact workflow nodes, memory behavior, or tool surfaces.
