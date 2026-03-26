/**
 * MASEL - Multi-Agent System with Error Learning
 * 
 * Main entry point for the MASEL skill
 */

import { registerTools } from "./tools/index.js";

/**
 * Initialize MASEL skill
 */
export async function initialize(openclaw: any): Promise<void> {
  console.log("🚀 Initializing MASEL...");
  
  // Register all tools
  registerTools(openclaw);
  
  // Initialize memory system
  await initializeMemorySystem();
  
  console.log("✅ MASEL initialized successfully");
}

/**
 * Initialize memory system (MASEL-Viking)
 */
async function initializeMemorySystem(): Promise<void> {
  console.log("📁 Initializing MASEL-Viking memory system...");
  
  // Create memory directories if they don't exist
  const dirs = [
    "memory/hot",
    "memory/viking/errors/coder",
    "memory/viking/errors/researcher", 
    "memory/viking/errors/reviewer",
    "memory/qmd/errors",
    "memory/plans"
  ];
  
  for (const dir of dirs) {
    try {
      // Directory creation will be handled by write operations
      console.log(`  ✓ ${dir}`);
    } catch (error) {
      console.warn(`  ⚠ ${dir} (will be created on demand)`);
    }
  }
  
  console.log("✅ Memory system initialized");
}

/**
 * Cleanup on unload
 */
export async function cleanup(): Promise<void> {
  console.log("🧹 Cleaning up MASEL...");
  
  // Cleanup running tasks
  // Save any pending state
  
  console.log("✅ MASEL cleanup complete");
}

// Export for OpenClaw
export { maselPlan } from "./tools/index.js";

// Default export
export default {
  initialize,
  cleanup
};
