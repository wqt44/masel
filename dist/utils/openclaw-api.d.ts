/**
 * OpenClaw API Utilities
 *
 * Mock implementations for development
 * In production, these would be provided by OpenClaw runtime
 */
/**
 * Read file content
 */
export declare function read(options: {
    path: string;
}): Promise<string>;
/**
 * Write file content
 */
export declare function write(options: {
    path: string;
    content: string;
}): Promise<void>;
/**
 * Search memory
 */
export declare function memory_search(options: {
    query: string;
    limit?: number;
}): Promise<any[]>;
/**
 * Spawn sub-agent
 */
export declare function sessions_spawn(options: {
    task: string;
    runtime?: string;
    mode?: string;
    timeoutSeconds?: number;
    masel_context?: any;
}): Promise<any>;
/**
 * Execute command
 */
export declare function exec(options: {
    command: string;
    timeout?: number;
}): Promise<{
    stdout: string;
    stderr: string;
}>;
//# sourceMappingURL=openclaw-api.d.ts.map