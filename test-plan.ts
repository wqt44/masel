#!/usr/bin/env node
/**
 * MASEL Test Script
 * 
 * Test the masel_plan tool with sample tasks
 */

import { maselPlan } from "./src/tools/masel-plan.js";

async function testMaselPlan() {
  console.log("🧪 Testing MASEL Plan Tool\n");
  
  // Test 1: Simple task
  console.log("Test 1: Simple Task");
  console.log("===================");
  try {
    const plan1 = await maselPlan({
      task: "Read a file and count the lines",
      workflow_type: "simple"
    });
    console.log("\n✅ Test 1 passed");
    console.log(`   Task ID: ${plan1.task_id}`);
    console.log(`   Subtasks: ${plan1.subtasks.length}`);
    console.log(`   Estimated time: ${plan1.estimated_total_time} minutes`);
  } catch (error) {
    console.error("❌ Test 1 failed:", error);
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 2: Coding task
  console.log("Test 2: Coding Task");
  console.log("===================");
  try {
    const plan2 = await maselPlan({
      task: "Create a Python script to parse JSON files and validate the schema",
      workflow_type: "coding"
    });
    console.log("\n✅ Test 2 passed");
    console.log(`   Task ID: ${plan2.task_id}`);
    console.log(`   Selected approach: ${plan2.brainstorm.selected_approach}`);
    console.log(`   Requirements: ${plan2.spec.requirements.length}`);
    console.log(`   Acceptance criteria: ${plan2.spec.acceptance_criteria.length}`);
    console.log(`   Subtasks: ${plan2.subtasks.length}`);
    console.log(`   Estimated time: ${plan2.estimated_total_time} minutes`);
    
    console.log("\n   Subtasks:");
    plan2.subtasks.forEach((st, i) => {
      console.log(`     ${i + 1}. ${st.name} (${st.estimated_time}min) - ${st.agent_type}`);
    });
  } catch (error) {
    console.error("❌ Test 2 failed:", error);
  }
  
  console.log("\n" + "=".repeat(50) + "\n");
  
  // Test 3: Research task
  console.log("Test 3: Research Task");
  console.log("=====================");
  try {
    const plan3 = await maselPlan({
      task: "Research the latest AI agent frameworks in 2026 and compare their features",
      workflow_type: "research"
    });
    console.log("\n✅ Test 3 passed");
    console.log(`   Task ID: ${plan3.task_id}`);
    console.log(`   Selected approach: ${plan3.brainstorm.selected_approach}`);
    console.log(`   Subtasks: ${plan3.subtasks.length}`);
    console.log(`   Estimated time: ${plan3.estimated_total_time} minutes`);
  } catch (error) {
    console.error("❌ Test 3 failed:", error);
  }
  
  console.log("\n" + "=".repeat(50));
  console.log("\n✨ All tests completed!");
}

// Run tests
testMaselPlan().catch(console.error);
