/**
 * MASEL-Viking Storage System
 *
 * Three-layer memory architecture:
 * - Hot Memory: SQLite cache (recent errors)
 * - Warm Memory: File system (this week's errors)
 * - Cold Memory: QMD vector DB (all historical errors)
 */
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
export declare class HotMemory {
    private maxItems;
    private cache;
    private lruQueue;
    constructor(config: {
        max_items: number;
    });
    /**
     * Store error in hot memory
     */
    store(error: ErrorRecord): Promise<void>;
    /**
     * Retrieve error from hot memory
     */
    retrieve(errorId: string): Promise<ErrorRecord | null>;
    /**
     * Search recent errors by agent type
     */
    searchByAgent(agentType: string, limit?: number): Promise<ErrorRecord[]>;
    /**
     * Search recent errors by pattern
     */
    searchByPattern(pattern: string, limit?: number): Promise<ErrorRecord[]>;
    /**
     * Get all errors in hot memory
     */
    getAll(): Promise<ErrorRecord[]>;
    /**
     * Clear hot memory
     */
    clear(): Promise<void>;
    private removeFromQueue;
}
export declare class WarmMemory {
    private basePath;
    private maxDays;
    constructor(config: {
        base_path: string;
        max_days: number;
    });
    /**
     * Store error in warm memory (file system)
     */
    store(error: ErrorRecord): Promise<string>;
    /**
     * Retrieve error from warm memory
     */
    retrieve(agentType: string, date: string, errorId: string): Promise<ErrorRecord | null>;
    /**
     * Search errors by agent type and date range
     */
    searchByAgentAndDate(agentType: string, startDate: string, endDate: string): Promise<ErrorRecord[]>;
    /**
     * Get errors for a specific date
     */
    getErrorsByDate(agentType: string, date: string): Promise<ErrorRecord[]>;
    /**
     * Clean up old errors beyond retention period
     */
    cleanup(): Promise<number>;
    /**
     * Generate daily summary report
     */
    generateDailyReport(date: string): Promise<{
        total: number;
        byAgent: Record<string, number>;
        byType: Record<string, number>;
    }>;
    private getDatesInRange;
}
export declare class ColdMemory {
    private enabled;
    constructor(config: {
        enabled: boolean;
    });
    /**
     * Store error in cold memory (QMD with embedding)
     */
    store(error: ErrorRecord): Promise<void>;
    /**
     * Semantic search for similar errors
     */
    semanticSearch(query: string, limit?: number): Promise<ErrorRecord[]>;
    /**
     * Find errors by pattern similarity
     */
    findSimilarPatterns(error: ErrorRecord, limit?: number): Promise<ErrorRecord[]>;
}
export declare class VikingManager {
    private hot;
    private warm;
    private cold;
    constructor(config?: Partial<VikingConfig>);
    /**
     * Store error in all three layers
     */
    storeError(error: ErrorRecord): Promise<void>;
    /**
     * Search for relevant errors (cascading search)
     */
    searchRelevant(agentType: string, context: string, limit?: number): Promise<ErrorRecord[]>;
    /**
     * Get error statistics
     */
    getStatistics(): Promise<{
        hot_count: number;
        warm_today_count: number;
        total_today: number;
    }>;
    /**
     * Cleanup old data
     */
    cleanup(): Promise<void>;
}
export declare const viking: VikingManager;
export default VikingManager;
//# sourceMappingURL=viking-store.d.ts.map