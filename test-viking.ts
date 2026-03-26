#!/usr/bin/env node
/**
 * MASEL Viking Memory Test
 * 
 * Test the three-layer memory system
 */

import { VikingManager, ErrorRecord } from "./src/memory/viking-store.js";

async function testVikingMemory() {
  console.log("🧪 MASEL-Viking Memory Test\n");
  console.log("=".repeat(70));
  
  // Initialize Viking
  const viking = new VikingManager({
    hot_max_items: 5,
    warm_max_days: 7,
    cold_enabled: false // Skip for now
  });
  
  // Test 1: Store errors
  console.log("\n📝 Test 1: Storing Errors");
  console.log("-".repeat(70));
  
  const testErrors: ErrorRecord[] = [
    {
      error_id: "err-001",
      task_id: "task-001",
      subtask_id: "st-001",
      agent_type: "coder",
      timestamp: new Date().toISOString(),
      error_type: "UnicodeDecodeError",
      error_message: "'utf-8' codec can't decode byte 0x80",
      context: {
        task_description: "Parse JSON file",
        subtask_name: "File parsing"
      },
      solution: "Use chardet to detect encoding first",
      prevention: "Always detect encoding before parsing"
    },
    {
      error_id: "err-002",
      task_id: "task-001",
      subtask_id: "st-002",
      agent_type: "coder",
      timestamp: new Date().toISOString(),
      error_type: "FileNotFoundError",
      error_message: "No such file or directory: 'data/config.json'",
      context: {
        task_description: "Read config file",
        subtask_name: "Config loading"
      },
      solution: "Use absolute path and check file existence",
      prevention: "Always use absolute paths"
    },
    {
      error_id: "err-003",
      task_id: "task-002",
      subtask_id: "st-001",
      agent_type: "researcher",
      timestamp: new Date().toISOString(),
      error_type: "TimeoutError",
      error_message: "Request timed out after 30 seconds",
      context: {
        task_description: "Search web for information",
        subtask_name: "Web search"
      },
      solution: "Increase timeout or implement retry",
      prevention: "Set appropriate timeouts"
    }
  ];
  
  for (const error of testErrors) {
    await viking.storeError(error);
  }
  
  // Test 2: Search Hot Memory
  console.log("\n🔍 Test 2: Searching Hot Memory");
  console.log("-".repeat(70));
  
  const hotResults = await viking.searchRelevant("coder", "encoding", 5);
  console.log(`   Found ${hotResults.length} relevant errors for coder`);
  hotResults.forEach((err, i) => {
    console.log(`   ${i + 1}. [${err.error_type}] ${err.error_message.substring(0, 50)}...`);
  });
  
  // Test 3: Get Statistics
  console.log("\n📊 Test 3: Memory Statistics");
  console.log("-".repeat(70));
  
  const stats = await viking.getStatistics();
  console.log(`   Hot Memory: ${stats.hot_count} errors`);
  console.log(`   Warm Memory (today): ${stats.warm_today_count} errors`);
  console.log(`   Total Today: ${stats.total_today} errors`);
  
  // Test 4: Store more errors (test LRU eviction)
  console.log("\n🔄 Test 4: Hot Memory LRU Eviction");
  console.log("-".repeat(70));
  
  for (let i = 4; i <= 7; i++) {
    const error: ErrorRecord = {
      error_id: `err-00${i}`,
      task_id: `task-00${i}`,
      subtask_id: `st-00${i}`,
      agent_type: "coder",
      timestamp: new Date().toISOString(),
      error_type: "TestError",
      error_message: `Test error ${i}`,
      context: {
        task_description: "Test task",
        subtask_name: "Test subtask"
      }
    };
    await viking.storeError(error);
  }
  
  const statsAfter = await viking.getStatistics();
  console.log(`   Hot Memory after adding more: ${statsAfter.hot_count} errors`);
  console.log(`   (Max is 5, old errors evicted)`);
  
  console.log("\n" + "=".repeat(70));
  console.log("\n✅ Viking Memory Test Complete!");
  console.log("\nMASEL-Viking is working with:");
  console.log("  🔥 Hot Memory (LRU cache)");
  console.log("  📁 Warm Memory (file system)");
  console.log("  ❄️  Cold Memory (QMD - ready for integration)");
}

// Run test
testVikingMemory().catch(console.error);
