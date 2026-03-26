#!/usr/bin/env node
/**
 * MASEL End-to-End Test
 * 
 * Complete workflow: Plan → Execute → Review
 */

import { maselPlan } from "./src/tools/masel-plan.js";
import { maselExecute } from "./src/tools/masel-execute.js";
import { maselReview } from "./src/tools/masel-review.js";

async function testMaselEndToEnd() {
  console.log("🚀 MASEL End-to-End Test: Plan → Execute → Review\n");
  console.log("=".repeat(70));
  
  // Test Case: Coding Task
  console.log("\n💻 Test Case: Coding Task");
  console.log("-".repeat(70));
  
  try {
    // ===== STEP 1: PLAN =====
    console.log("\n📋 STEP 1: Planning...");
    console.log("   Task: Create a Python function to validate email addresses");
    
    const plan = await maselPlan({
      task: "Create a Python function to validate email addresses with proper error handling",
      workflow_type: "coding"
    });
    
    console.log(`\n   ✅ Plan Created`);
    console.log(`   Task ID: ${plan.task_id}`);
    console.log(`   Approach: ${plan.brainstorm.selected_approach}`);
    console.log(`   Subtasks: ${plan.subtasks.length}`);
    plan.subtasks.forEach((st, i) => {
      console.log(`      ${i + 1}. ${st.name} (${st.agent_type})`);
    });
    
    // ===== STEP 2: EXECUTE =====
    console.log("\n⚙️  STEP 2: Executing...");
    
    const executionResult = await maselExecute({
      plan: plan,
      options: {
        parallel: false,
        checkpoint: true,
        worktree_isolation: true
      }
    });
    
    console.log(`\n   ✅ Execution ${executionResult.status}`);
    console.log(`   Total Time: ${(executionResult.total_execution_time / 1000).toFixed(2)}s`);
    console.log(`   Success Rate: ${executionResult.results.filter(r => r.success).length}/${executionResult.results.length}`);
    
    // ===== STEP 3: REVIEW =====
    console.log("\n🔍 STEP 3: Reviewing...");
    
    const reviewReport = await maselReview({
      results: executionResult.results,
      plan: plan,
      criteria: {
        correctness_weight: 0.35,
        completeness_weight: 0.25,
        efficiency_weight: 0.15,
        readability_weight: 0.15,
        robustness_weight: 0.10
      }
    });
    
    console.log(`\n   ✅ Review Complete`);
    console.log(`   Review ID: ${reviewReport.review_id}`);
    console.log(`   Overall Score: ${reviewReport.overall_score.toFixed(1)}/100`);
    console.log(`   Decision: ${reviewReport.decision}`);
    
    console.log("\n   Dimension Scores:");
    reviewReport.dimensions.forEach(dim => {
      const bar = "█".repeat(Math.round(dim.score / 10)) + "░".repeat(10 - Math.round(dim.score / 10));
      console.log(`      ${dim.name.padEnd(15)} ${bar} ${dim.score.toFixed(1)}`);
    });
    
    if (reviewReport.issues.length > 0) {
      console.log("\n   Issues Found:");
      reviewReport.issues.forEach((issue, i) => {
        const icon = issue.severity === "high" ? "🔴" : issue.severity === "medium" ? "🟡" : "🟢";
        console.log(`      ${icon} [${issue.severity.toUpperCase()}] ${issue.category}`);
        console.log(`         ${issue.description.substring(0, 60)}...`);
      });
    }
    
    console.log("\n   Recommendations:");
    reviewReport.recommendations.slice(0, 3).forEach((rec, i) => {
      console.log(`      ${i + 1}. ${rec}`);
    });
    
    // ===== SUMMARY =====
    console.log("\n" + "=".repeat(70));
    console.log("📊 EXECUTION SUMMARY");
    console.log("=".repeat(70));
    console.log(`Task:        ${plan.original_task.substring(0, 50)}...`);
    console.log(`Plan ID:     ${plan.task_id}`);
    console.log(`Subtasks:    ${plan.subtasks.length}`);
    console.log(`Status:      ${executionResult.status}`);
    console.log(`Quality:     ${reviewReport.overall_score.toFixed(1)}/100`);
    console.log(`Decision:    ${reviewReport.decision}`);
    console.log(`Summary:     ${reviewReport.summary}`);
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    console.error(error.stack);
  }
  
  console.log("\n" + "=".repeat(70));
  console.log("\n✨ End-to-End test completed!");
  console.log("\nMASEL is now a fully functional multi-agent system! 🎉");
}

// Run test
testMaselEndToEnd().catch(console.error);
