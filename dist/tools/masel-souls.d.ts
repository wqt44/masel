/**
 * MASEL Souls Tool
 *
 * Manage Agent Souls - list, get, update, reset
 */
interface SoulsOptions {
    action: "list" | "get" | "update" | "reset";
    agent_type?: string;
    content?: string;
    section?: string;
}
/**
 * Manage Agent Souls
 */
export declare function maselSouls(options: SoulsOptions): Promise<any>;
export default maselSouls;
//# sourceMappingURL=masel-souls.d.ts.map