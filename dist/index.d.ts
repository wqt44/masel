/**
 * MASEL - Multi-Agent System with Error Learning
 *
 * Main entry point for the MASEL skill
 */
/**
 * Initialize MASEL skill
 */
export declare function initialize(openclaw: any): Promise<void>;
/**
 * Cleanup on unload
 */
export declare function cleanup(): Promise<void>;
export { maselPlan } from "./tools/index.js";
declare const _default: {
    initialize: typeof initialize;
    cleanup: typeof cleanup;
};
export default _default;
//# sourceMappingURL=index.d.ts.map