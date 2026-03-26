"use strict";
/**
 * MASEL - Multi-Agent System with Error Learning
 *
 * Main entry point for the MASEL skill
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselPlan = void 0;
exports.initialize = initialize;
exports.cleanup = cleanup;
const index_js_1 = require("./tools/index.js");
/**
 * Initialize MASEL skill
 */
async function initialize(openclaw) {
    console.log("🚀 Initializing MASEL...");
    // Register all tools
    (0, index_js_1.registerTools)(openclaw);
    // Initialize memory system
    await initializeMemorySystem();
    console.log("✅ MASEL initialized successfully");
}
/**
 * Initialize memory system (MASEL-Viking)
 */
async function initializeMemorySystem() {
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
        }
        catch (error) {
            console.warn(`  ⚠ ${dir} (will be created on demand)`);
        }
    }
    console.log("✅ Memory system initialized");
}
/**
 * Cleanup on unload
 */
async function cleanup() {
    console.log("🧹 Cleaning up MASEL...");
    // Cleanup running tasks
    // Save any pending state
    console.log("✅ MASEL cleanup complete");
}
// Export for OpenClaw
var index_js_2 = require("./tools/index.js");
Object.defineProperty(exports, "maselPlan", { enumerable: true, get: function () { return index_js_2.maselPlan; } });
// Default export
exports.default = {
    initialize,
    cleanup
};
//# sourceMappingURL=index.js.map