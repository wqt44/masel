#!/usr/bin/env node
/**
 * MASEL Integration Test
 * 
 * Test plan + execute workflow
 */

import { maselPlan } from "./src/tools/masel-plan.js";
import { maselExecute } from "./src/tools/masel-execute.js";

async function testMaselIntegration() {
  console.log("🧪 MASEL Integration Test: Plan + Execute\n");
  console.log("=".repeat(60));
  
  // Test: Simple coding task
  console.log("\n📝 Test: Simple Coding Task");
  console.log("-".repeat(60));
  
  try {
    // Step 1: Plan
    console.log("\n📋 Step 1: Planning...");
    const plan = await maselPlan({
      task: "Create a Python function to calculate factorial",
      workflow_type: "coding"
    });
    
    console.log(`\n✅ Plan created:`);
    console.log(`   Task ID: ${plan.task_id}`);
    console.log(`   Approach: ${plan.brainstorm.selected_approach}`);
    console.log(`   Subtasks: ${plan.subtasks.length}`);
    
    // Step 2: Execute
    console.log("\n🚀 Step 2: Executing...");
    const result = await maselExecute({
      plan: plan,
      options: {
        parallel: false,
        checkpoint: true,
        worktree_isolation: true
      }
    });
    
    console.log(`\n✅ Execution ${result.status}`);
    console.log(`   Total time: ${(result.total_execution_time / 1000).toFixed(2)}s`);
    console.log(`   Success: ${result.results.filter(r => r.success).length}/${result.results.length}`);
    console.log(`   Summary: ${result.summary}`);
    
    // Show detailed results
    console.log("\n📊 Detailed Results:");
    result.results.forEach((r, i) => {
      const status = r.success ? "✅" : "❌";
      console.log(`   ${status} ${r.subtask_id}: ${(r.execution_time / 1000).toFixed(2)}s`);
      if (!r.success && r.error) {
        console.log(`      Error: ${r.error.substring(0, 100)}...`);
      }
    });
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\n✨ Integration test completed!");
}

// Run test
testMaselIntegration().catch(console.error);
