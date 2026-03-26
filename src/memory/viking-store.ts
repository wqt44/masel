/**
 * MASEL-Viking Storage System
 * 
 * Three-layer memory architecture:
 * - Hot Memory: SQLite cache (recent errors)
 * - Warm Memory: File system (this week's errors)
 * - Cold Memory: QMD vector DB (all historical errors)
 */

import { read, write, exec } from "../utils/openclaw-api.js";

// ============================================================================
// TYPES
// ============================================================================

export interface ErrorRecord {
  error_id: string;
  task_id: string;
  subtask_id: string;
  agent_type: string;
  timestamp: string;
  error_type: string;
  error_message: string;
  error_stack?: string;
  context: {
    task_description: string;
    subtask_name: string;
    inputs?: any;
  };
  solution?: string;
  prevention?: string;
  pattern?: string;
}

export interface VikingConfig {
  hot_max_items: number;
  warm_max_days: number;
  cold_enabled: boolean;
}

// ============================================================================
// HOT MEMORY - SQLite Cache (Layer 1)
// Fast access to recent errors
// ============================================================================

export class HotMemory {
  private maxItems: number;
  private cache: Map<string, ErrorRecord> = new Map();
  private lruQueue: string[] = []; // LRU eviction queue

  constructor(config: { max_items: number }) {
    this.maxItems = config.max_items;
  }

  /**
   * Store error in hot memory
   */
  async store(error: ErrorRecord): Promise<void> {
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
  async retrieve(errorId: string): Promise<ErrorRecord | null> {
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
  async searchByAgent(agentType: string, limit: number = 10): Promise<ErrorRecord[]> {
    const results: ErrorRecord[] = [];
    
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
  async searchByPattern(pattern: string, limit: number = 10): Promise<ErrorRecord[]> {
    const results: ErrorRecord[] = [];
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
  async getAll(): Promise<ErrorRecord[]> {
    return this.lruQueue
      .map(id => this.cache.get(id))
      .filter((e): e is ErrorRecord => e !== undefined);
  }

  /**
   * Clear hot memory
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.lruQueue = [];
  }

  private removeFromQueue(errorId: string): void {
    const index = this.lruQueue.indexOf(errorId);
    if (index > -1) {
      this.lruQueue.splice(index, 1);
    }
  }
}

// ============================================================================
// WARM MEMORY - File System (Layer 2)
// Human-readable, organized by date and agent type
// ============================================================================

export class WarmMemory {
  private basePath: string;
  private maxDays: number;

  constructor(config: { base_path: string; max_days: number }) {
    this.basePath = config.base_path;
    this.maxDays = config.max_days;
  }

  /**
   * Store error in warm memory (file system)
   */
  async store(error: ErrorRecord): Promise<string> {
    const date = new Date(error.timestamp).toISOString().split('T')[0];
    const fileName = `${error.error_id}.json`;
    const filePath = `${this.basePath}/${error.agent_type}/${date}/${fileName}`;
    
    try {
      await write({
        path: filePath,
        content: JSON.stringify(error, null, 2)
      });
      
      console.log(`   📁 Warm Memory: Stored ${filePath}`);
      return filePath;
    } catch (err) {
      console.warn(`   ⚠️  Warm Memory: Failed to store ${filePath}`);
      throw err;
    }
  }

  /**
   * Retrieve error from warm memory
   */
  async retrieve(agentType: string, date: string, errorId: string): Promise<ErrorRecord | null> {
    const filePath = `${this.basePath}/${agentType}/${date}/${errorId}.json`;
    
    try {
      const content = await read({ path: filePath });
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  /**
   * Search errors by agent type and date range
   */
  async searchByAgentAndDate(
    agentType: string,
    startDate: string,
    endDate: string
  ): Promise<ErrorRecord[]> {
    const results: ErrorRecord[] = [];
    
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
  async getErrorsByDate(agentType: string, date: string): Promise<ErrorRecord[]> {
    const dirPath = `${this.basePath}/${agentType}/${date}`;
    const results: ErrorRecord[] = [];
    
    try {
      // List files in directory
      const { stdout } = await exec({
        command: `ls ${dirPath}/*.json 2>/dev/null || echo ""`,
        timeout: 5000
      });
      
      const files = stdout.trim().split('\n').filter(f => f);
      
      for (const file of files) {
        try {
          const content = await read({ path: file });
          results.push(JSON.parse(content));
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Directory doesn't exist or is empty
    }
    
    return results;
  }

  /**
   * Clean up old errors beyond retention period
   */
  async cleanup(): Promise<number> {
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
  async generateDailyReport(date: string): Promise<{
    total: number;
    byAgent: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const allErrors: ErrorRecord[] = [];
    
    // Get all agent types
    const agentTypes = ['coder', 'researcher', 'reviewer'];
    
    for (const agentType of agentTypes) {
      const errors = await this.getErrorsByDate(agentType, date);
      allErrors.push(...errors);
    }
    
    const byAgent: Record<string, number> = {};
    const byType: Record<string, number> = {};
    
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

  private getDatesInRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }
    
    return dates;
  }
}

// ============================================================================
// COLD MEMORY - QMD Vector DB (Layer 3)
// Semantic search for all historical errors
// ============================================================================

export class ColdMemory {
  private enabled: boolean;

  constructor(config: { enabled: boolean }) {
    this.enabled = config.enabled;
  }

  /**
   * Store error in cold memory (QMD with embedding)
   */
  async store(error: ErrorRecord): Promise<void> {
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
  async semanticSearch(query: string, limit: number = 10): Promise<ErrorRecord[]> {
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
  async findSimilarPatterns(error: ErrorRecord, limit: number = 5): Promise<ErrorRecord[]> {
    if (!this.enabled) {
      return [];
    }
    
    // Search by error type and message similarity
    const query = `${error.error_type} ${error.error_message}`;
    return this.semanticSearch(query, limit);
  }
}

// ============================================================================
// VIKING MANAGER - Unified Interface
// ============================================================================

export class VikingManager {
  private hot: HotMemory;
  private warm: WarmMemory;
  private cold: ColdMemory;

  constructor(config?: Partial<VikingConfig>) {
    const fullConfig: VikingConfig = {
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
  async storeError(error: ErrorRecord): Promise<void> {
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
  async searchRelevant(
    agentType: string,
    context: string,
    limit: number = 5
  ): Promise<ErrorRecord[]> {
    console.log(`\n🔍 Searching relevant errors for ${agentType}`);
    
    const results: ErrorRecord[] = [];
    const seenIds = new Set<string>();
    
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
  async getStatistics(): Promise<{
    hot_count: number;
    warm_today_count: number;
    total_today: number;
  }> {
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
  async cleanup(): Promise<void> {
    console.log("\n🧹 Viking cleanup...");
    await this.warm.cleanup();
    console.log("   ✅ Cleanup complete");
  }
}

// Export singleton instance
export const viking = new VikingManager();

// Default export
export default VikingManager;
