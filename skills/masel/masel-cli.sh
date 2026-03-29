#!/bin/bash
# MASEL Quick Commands for OpenClaw
# 将以下函数添加到 .bashrc 或 .zshrc 中使用

# MASEL 快捷指令
masel() {
  case "$1" in
    plan)
      echo "🚀 MASEL Plan: $2"
      echo "cd /home/tong0121/.openclaw/workspace/skills/masel && npx ts-node -e \"
        const { maselPlan } = require('./src/tools/index.js');
        maselPlan({ task: '$2', workflow_type: '${3:-simple}' }).then(p => {
          console.log('Plan created:', p.task_id);
          console.log('Subtasks:', p.subtasks.length);
        });
      \""
      ;;
      
    status)
      echo "📊 MASEL Status"
      cd /home/tong0121/.openclaw/workspace/skills/masel
      node -e "
        const fs = require('fs');
        const plans = fs.readdirSync('memory/plans').filter(f => f.endsWith('.json'));
        const execs = fs.readdirSync('memory/executions').filter(f => f.endsWith('.json'));
        console.log('Plans:', plans.length);
        console.log('Executions:', execs.length);
      " 2>/dev/null || echo "No data yet"
      ;;
      
    demo)
      echo "🎬 Running MASEL Demo..."
      cd /home/tong0121/.openclaw/workspace/skills/masel
      node demo-masel.js
      ;;
      
    test)
      echo "🧪 Running MASEL Tests..."
      cd /home/tong0121/.openclaw/workspace/skills/masel
      node test-run.js
      ;;
      
    help|*)
      echo "MASEL - Multi-Agent System with Error Learning"
      echo ""
      echo "Usage: maseI <command> [args]"
      echo ""
      echo "Commands:"
      echo "  plan 'task' [type]  - Plan a task (type: simple/coding/research)"
      echo "  status              - Show system status"
      echo "  demo                - Run demo"
      echo "  test                - Run tests"
      echo "  help                - Show this help"
      echo ""
      echo "Examples:"
      echo "  maseI plan 'Create a Python script' coding"
      echo "  maseI status"
      echo "  maseI demo"
      ;;
  esac
}

# 快捷别名
alias mp='masel plan'
alias ms='masel status'
alias md='masel demo'
alias mt='masel test'
