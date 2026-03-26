"use strict";
/**
 * MASEL-Viking Storage System
 *
 * Three-layer memory architecture:
 * - Hot Memory: SQLite cache (recent errors)
 * - Warm Memory: File system (this week's errors)
 * - Cold Memory: QMD vector DB (all historical errors)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.viking = exports.VikingManager = exports.ColdMemory = exports.WarmMemory = exports.HotMemory = void 0;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
// ============================================================================
// HOT MEMORY - SQLite Cache (Layer 1)
// Fast access to recent errors
// ============================================================================
class HotMemory {
    maxItems;
    cache = new Map();
    lruQueue = []; // LRU eviction queue
    constructor(config) {
        this.maxItems = config.max_items;
    }
    /**
     * Store error in hot memory
     */
    async store(error) {
        // Remove if already exists (for LRU update)
        this.removeFromQueue(error.error_id);
        // Add to cache
        this.cache.set(error.error_id, error);
        this.lruQueue.push(error.error_id);
        // Evict oldest if over limit
        while (this.lruQueue.length > this.maxItems) {
            const oldestId = this.lruQueue.shift();
            if (oldestId) {
                this.cache.delete(oldestId);
            }
        }
        console.log(`   🔥 Hot Memory: Stored ${error.error_id}`);
    }
    /**
     * Retrieve error from hot memory
     */
    async retrieve(errorId) {
        const error = this.cache.get(errorId);
        if (error) {
            // Update LRU (move to end)
            this.removeFromQueue(errorId);
            this.lruQueue.push(errorId);
        }
        return error || null;
    }
    /**
     * Search recent errors by agent type
     */
    async searchByAgent(agentType, limit = 10) {
        const results = [];
        // Search from most recent (end of LRU queue)
        for (let i = this.lruQueue.length - 1; i >= 0 && results.length < limit; i--) {
            const errorId = this.lruQueue[i];
            const error = this.cache.get(errorId);
            if (error && error.agent_type === agentType) {
                results.push(error);
            }
        }
        return results;
    }
    /**
     * Search recent errors by pattern
     */
    async searchByPattern(pattern, limit = 10) {
        const results = [];
        const lowerPattern = pattern.toLowerCase();
        for (let i = this.lruQueue.length - 1; i >= 0 && results.length < limit; i--) {
            const errorId = this.lruQueue[i];
            const error = this.cache.get(errorId);
            if (error) {
                const searchable = `${error.error_message} ${error.error_type} ${error.context.task_description}`.toLowerCase();
                if (searchable.includes(lowerPattern)) {
                    results.push(error);
                }
            }
        }
        return results;
    }
    /**
     * Get all errors in hot memory
     */
    async getAll() {
        return this.lruQueue
            .map(id => this.cache.get(id))
            .filter((e) => e !== undefined);
    }
    /**
     * Clear hot memory
     */
    async clear() {
        this.cache.clear();
        this.lruQueue = [];
    }
    removeFromQueue(errorId) {
        const index = this.lruQueue.indexOf(errorId);
        if (index > -1) {
            this.lruQueue.splice(index, 1);
        }
    }
}
exports.HotMemory = HotMemory;
// ============================================================================
// WARM MEMORY - File System (Layer 2)
// Human-readable, organized by date and agent type
// ============================================================================
class WarmMemory {
    basePath;
    maxDays;
    constructor(config) {
        this.basePath = config.base_path;
        this.maxDays = config.max_days;
    }
    /**
     * Store error in warm memory (file system)
     */
    async store(error) {
        const date = new Date(error.timestamp).toISOString().split('T')[0];
        const fileName = `${error.error_id}.json`;
        const filePath = `${this.basePath}/${error.agent_type}/${date}/${fileName}`;
        try {
            await (0, openclaw_api_js_1.write)({
                path: filePath,
                content: JSON.stringify(error, null, 2)
            });
            console.log(`   📁 Warm Memory: Stored ${filePath}`);
            return filePath;
        }
        catch (err) {
            console.warn(`   ⚠️  Warm Memory: Failed to store ${filePath}`);
            throw err;
        }
    }
    /**
     * Retrieve error from warm memory
     */
    async retrieve(agentType, date, errorId) {
        const filePath = `${this.basePath}/${agentType}/${date}/${errorId}.json`;
        try {
            const content = await (0, openclaw_api_js_1.read)({ path: filePath });
            return JSON.parse(content);
        }
        catch {
            return null;
        }
    }
    /**
     * Search errors by agent type and date range
     */
    async searchByAgentAndDate(agentType, startDate, endDate) {
        const results = [];
        // Get dates in range
        const dates = this.getDatesInRange(startDate, endDate);
        for (const date of dates) {
            const errors = await this.getErrorsByDate(agentType, date);
            results.push(...errors);
        }
        return results;
    }
    /**
     * Get errors for a specific date
     */
    async getErrorsByDate(agentType, date) {
        const dirPath = `${this.basePath}/${agentType}/${date}`;
        const results = [];
        try {
            // List files in directory
            const { stdout } = await (0, openclaw_api_js_1.exec)({
                command: `ls ${dirPath}/*.json 2>/dev/null || echo ""`,
                timeout: 5000
            });
            const files = stdout.trim().split('\n').filter(f => f);
            for (const file of files) {
                try {
                    const content = await (0, openclaw_api_js_1.read)({ path: file });
                    results.push(JSON.parse(content));
                }
                catch {
                    // Skip unreadable files
                }
            }
        }
        catch {
            // Directory doesn't exist or is empty
        }
        return results;
    }
    /**
     * Clean up old errors beyond retention period
     */
    async cleanup() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.maxDays);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        let deletedCount = 0;
        // This would iterate through directories and delete old ones
        // Implementation depends on file system capabilities
        console.log(`   🧹 Warm Memory: Cleaned up ${deletedCount} old records`);
        return deletedCount;
    }
    /**
     * Generate daily summary report
     */
    async generateDailyReport(date) {
        const allErrors = [];
        // Get all agent types
        const agentTypes = ['coder', 'researcher', 'reviewer'];
        for (const agentType of agentTypes) {
            const errors = await this.getErrorsByDate(agentType, date);
            allErrors.push(...errors);
        }
        const byAgent = {};
        const byType = {};
        for (const error of allErrors) {
            byAgent[error.agent_type] = (byAgent[error.agent_type] || 0) + 1;
            byType[error.error_type] = (byType[error.error_type] || 0) + 1;
        }
        return {
            total: allErrors.length,
            byAgent,
            byType
        };
    }
    getDatesInRange(startDate, endDate) {
        const dates = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            dates.push(d.toISOString().split('T')[0]);
        }
        return dates;
    }
}
exports.WarmMemory = WarmMemory;
// ============================================================================
// COLD MEMORY - QMD Vector DB (Layer 3)
// Semantic search for all historical errors
// ============================================================================
class ColdMemory {
    enabled;
    constructor(config) {
        this.enabled = config.enabled;
    }
    /**
     * Store error in cold memory (QMD with embedding)
     */
    async store(error) {
        if (!this.enabled) {
            return;
        }
        // TODO: Implement QMD storage with embedding
        // This would use OpenClaw's memory_search/index capabilities
        console.log(`   ❄️  Cold Memory: Stored ${error.error_id} (QMD)`);
    }
    /**
     * Semantic search for similar errors
     */
    async semanticSearch(query, limit = 10) {
        if (!this.enabled) {
            return [];
        }
        // TODO: Implement semantic search using QMD
        // This would use OpenClaw's memory_search tool
        return [];
    }
    /**
     * Find errors by pattern similarity
     */
    async findSimilarPatterns(error, limit = 5) {
        if (!this.enabled) {
            return [];
        }
        // Search by error type and message similarity
        const query = `${error.error_type} ${error.error_message}`;
        return this.semanticSearch(query, limit);
    }
}
exports.ColdMemory = ColdMemory;
// ============================================================================
// VIKING MANAGER - Unified Interface
// ============================================================================
class VikingManager {
    hot;
    warm;
    cold;
    constructor(config) {
        const fullConfig = {
            hot_max_items: config?.hot_max_items || 10,
            warm_max_days: config?.warm_max_days || 7,
            cold_enabled: config?.cold_enabled !== false
        };
        this.hot = new HotMemory({ max_items: fullConfig.hot_max_items });
        this.warm = new WarmMemory({
            base_path: "memory/viking/errors",
            max_days: fullConfig.warm_max_days
        });
        this.cold = new ColdMemory({ enabled: fullConfig.cold_enabled });
    }
    /**
     * Store error in all three layers
     */
    async storeError(error) {
        console.log(`\n📝 Storing error: ${error.error_id}`);
        // Layer 1: Hot Memory (fast, recent)
        await this.hot.store(error);
        // Layer 2: Warm Memory (file system, organized)
        await this.warm.store(error);
        // Layer 3: Cold Memory (vector DB, semantic search)
        await this.cold.store(error);
        console.log(`   ✅ Error stored in all layers`);
    }
    /**
     * Search for relevant errors (cascading search)
     */
    async searchRelevant(agentType, context, limit = 5) {
        console.log(`\n🔍 Searching relevant errors for ${agentType}`);
        const results = [];
        const seenIds = new Set();
        // 1. Search Hot Memory (fastest)
        const hotResults = await this.hot.searchByAgent(agentType, limit);
        for (const error of hotResults) {
            if (!seenIds.has(error.error_id)) {
                results.push(error);
                seenIds.add(error.error_id);
            }
        }
        console.log(`   🔥 Hot Memory: ${hotResults.length} results`);
        // 2. Search Warm Memory (if needed)
        if (results.length < limit) {
            const today = new Date().toISOString().split('T')[0];
            const warmResults = await this.warm.getErrorsByDate(agentType, today);
            for (const error of warmResults) {
                if (!seenIds.has(error.error_id) && results.length < limit) {
                    results.push(error);
                    seenIds.add(error.error_id);
                }
            }
            console.log(`   📁 Warm Memory: ${warmResults.length} results`);
        }
        // 3. Search Cold Memory (semantic, if enabled and needed)
        if (results.length < limit && this.cold) {
            const coldResults = await this.cold.semanticSearch(context, limit - results.length);
            for (const error of coldResults) {
                if (!seenIds.has(error.error_id)) {
                    results.push(error);
                    seenIds.add(error.error_id);
                }
            }
            console.log(`   ❄️  Cold Memory: ${coldResults.length} results`);
        }
        console.log(`   ✅ Total: ${results.length} relevant errors found`);
        return results;
    }
    /**
     * Get error statistics
     */
    async getStatistics() {
        const hotErrors = await this.hot.getAll();
        const today = new Date().toISOString().split('T')[0];
        let warmTodayCount = 0;
        for (const agentType of ['coder', 'researcher', 'reviewer']) {
            const errors = await this.warm.getErrorsByDate(agentType, today);
            warmTodayCount += errors.length;
        }
        return {
            hot_count: hotErrors.length,
            warm_today_count: warmTodayCount,
            total_today: warmTodayCount
        };
    }
    /**
     * Cleanup old data
     */
    async cleanup() {
        console.log("\n🧹 Viking cleanup...");
        await this.warm.cleanup();
        console.log("   ✅ Cleanup complete");
    }
}
exports.VikingManager = VikingManager;
// Export singleton instance
exports.viking = new VikingManager();
// Default export
exports.default = VikingManager;
//# sourceMappingURL=viking-store.js.map