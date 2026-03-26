"use strict";
/**
 * MASEL Learn Tool
 *
 * Analyzes errors, extracts patterns, and updates Agent Souls
 * The core of self-evolution!
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselLearn = maselLearn;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
const viking_store_js_1 = require("../memory/viking-store.js");
// Initialize Viking
const viking = new viking_store_js_1.VikingManager();
/**
 * Main entry point for masel_learn tool
 */
async function maselLearn(options) {
    const { error, trajectory, review_report, auto_update = false } = options;
    console.log(`🧠 MASEL Learn: Starting error analysis and learning...`);
    const learning_id = `learn-${Date.now()}`;
    // Collect errors to analyze
    const errorsToAnalyze = [];
    if (error) {
        errorsToAnalyze.push(error);
    }
    if (review_report) {
        // Convert review issues to errors
        const reviewErrors = await convertReviewToErrors(review_report);
        errorsToAnalyze.push(...reviewErrors);
    }
    // Get recent errors from Viking for pattern analysis
    const recentErrors = await getRecentErrorsForAnalysis();
    errorsToAnalyze.push(...recentErrors);
    console.log(`   Errors to analyze: ${errorsToAnalyze.length}`);
    // Analyze each error
    const analyzedErrors = [];
    for (const err of errorsToAnalyze) {
        const analyzed = await analyzeError(err, trajectory);
        analyzedErrors.push(analyzed);
        console.log(`   ✅ Analyzed: ${err.error_id} → ${analyzed.pattern}`);
    }
    // Extract patterns
    console.log(`\n🔍 Extracting patterns...`);
    const patterns = extractPatterns(analyzedErrors);
    console.log(`   Found ${patterns.length} patterns`);
    // Generate Soul updates
    console.log(`\n📝 Generating Soul updates...`);
    const soulUpdates = generateSoulUpdates(patterns, analyzedErrors);
    console.log(`   ${soulUpdates.length} updates ready`);
    // Apply updates if auto_update enabled
    if (auto_update && soulUpdates.length > 0) {
        console.log(`\n🔄 Auto-updating Souls...`);
        for (const update of soulUpdates) {
            await applySoulUpdate(update);
            console.log(`   ✅ Updated ${update.agent_type}/${update.section}`);
        }
    }
    // Build learning result
    const result = {
        learning_id,
        timestamp: new Date().toISOString(),
        root_cause: analyzedErrors[0]?.root_cause || "Unknown",
        solution: analyzedErrors[0]?.solution || "No solution found",
        prevention: analyzedErrors[0]?.prevention || "No prevention strategy",
        pattern: analyzedErrors[0]?.pattern || "No pattern identified",
        extracted_patterns: patterns,
        soul_updates: soulUpdates,
        errors_analyzed: analyzedErrors.length,
        patterns_found: patterns.length,
        soul_sections_updated: soulUpdates.length
    };
    // Save learning result
    await saveLearningResult(result);
    console.log(`\n✅ Learning complete: ${learning_id}`);
    console.log(`   Patterns: ${result.patterns_found}`);
    console.log(`   Soul updates: ${result.soul_sections_updated}`);
    return result;
}
/**
 * Analyze a single error in depth
 */
async function analyzeError(error, trajectory) {
    // Search for similar historical errors
    const similarErrors = await viking.searchRelevant(error.agent_type, error.error_message, 5);
    // Find most common solution among similar errors
    const commonSolutions = findCommonSolutions(similarErrors);
    // Analyze error type
    const analysis = performErrorAnalysis(error, trajectory);
    return {
        ...error,
        root_cause: analysis.root_cause,
        solution: analysis.solution || commonSolutions[0] || "Investigate further",
        prevention: analysis.prevention,
        pattern: analysis.pattern,
        severity: determineSeverity(error, similarErrors.length)
    };
}
/**
 * Perform deep error analysis
 */
function performErrorAnalysis(error, trajectory) {
    const errorType = error.error_type;
    const message = error.error_message.toLowerCase();
    // Pattern matching for common error types
    const patterns = {
        "UnicodeDecodeError": {
            root_cause: "File encoding mismatch - assumed UTF-8 but file uses different encoding",
            solution: "Use chardet or similar library to detect encoding before decoding",
            prevention: "Always detect file encoding; never assume encoding",
            pattern: "encoding_mismatch"
        },
        "FileNotFoundError": {
            root_cause: "File path incorrect or file doesn't exist",
            solution: "Use absolute paths and verify file existence before access",
            prevention: "Use Path.resolve() and check exists() before file operations",
            pattern: "missing_file"
        },
        "TimeoutError": {
            root_cause: "Operation took longer than allowed timeout",
            solution: "Increase timeout or implement retry with exponential backoff",
            prevention: "Set appropriate timeouts based on operation complexity",
            pattern: "timeout"
        },
        "TypeError": {
            root_cause: "Variable used with wrong type or missing method",
            solution: "Add type checking and validation before operations",
            prevention: "Use type hints and validate inputs",
            pattern: "type_mismatch"
        },
        "PermissionError": {
            root_cause: "Insufficient permissions for operation",
            solution: "Check permissions before operation or request elevated access",
            prevention: "Always check permissions; handle permission errors gracefully",
            pattern: "permission_denied"
        }
    };
    // Check for known patterns
    if (patterns[errorType]) {
        return patterns[errorType];
    }
    // Analyze error message for clues
    if (message.includes("encoding") || message.includes("codec")) {
        return {
            root_cause: "Character encoding issue",
            solution: "Detect and handle encoding properly",
            prevention: "Always specify encoding explicitly",
            pattern: "encoding_issue"
        };
    }
    if (message.includes("not found") || message.includes("does not exist")) {
        return {
            root_cause: "Resource not found",
            solution: "Verify resource exists before access",
            prevention: "Check existence before operations",
            pattern: "resource_missing"
        };
    }
    if (message.includes("timeout") || message.includes("timed out")) {
        return {
            root_cause: "Operation timeout",
            solution: "Optimize operation or increase timeout",
            prevention: "Set realistic timeouts",
            pattern: "timeout"
        };
    }
    // Generic analysis
    return {
        root_cause: `Unknown - ${errorType}`,
        solution: "Review error details and implement specific fix",
        prevention: "Add error handling and validation",
        pattern: "unknown"
    };
}
/**
 * Find common solutions from similar errors
 */
function findCommonSolutions(similarErrors) {
    const solutions = similarErrors
        .filter(e => e.solution)
        .map(e => e.solution);
    // Count occurrences
    const counts = {};
    for (const sol of solutions) {
        counts[sol] = (counts[sol] || 0) + 1;
    }
    // Return sorted by frequency
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([sol]) => sol);
}
/**
 * Determine error severity
 */
function determineSeverity(error, similarCount) {
    // High: Blocking errors or recurring patterns
    if (similarCount >= 3)
        return "high";
    if (error.error_type.includes("Error") && !error.error_type.includes("Warning")) {
        return "high";
    }
    // Medium: Common errors
    if (["FileNotFoundError", "TimeoutError"].includes(error.error_type)) {
        return "medium";
    }
    // Low: Minor issues
    return "low";
}
/**
 * Extract patterns from analyzed errors
 */
function extractPatterns(analyzedErrors) {
    const patternGroups = {};
    // Group by pattern
    for (const error of analyzedErrors) {
        const pattern = error.pattern;
        if (!patternGroups[pattern]) {
            patternGroups[pattern] = [];
        }
        patternGroups[pattern].push(error);
    }
    // Create pattern objects
    const patterns = [];
    for (const [patternName, errors] of Object.entries(patternGroups)) {
        if (errors.length < 2)
            continue; // Need at least 2 occurrences
        const representative = errors[0];
        patterns.push({
            pattern_id: `pattern-${patternName}-${Date.now()}`,
            name: patternName,
            description: `Pattern: ${patternName} - ${representative.root_cause}`,
            trigger_conditions: errors.map(e => e.context.task_description),
            solution: representative.solution,
            prevention: representative.prevention,
            occurrence_count: errors.length,
            success_rate: calculateSuccessRate(errors)
        });
    }
    return patterns;
}
/**
 * Calculate success rate for a pattern
 */
function calculateSuccessRate(errors) {
    // In reality, this would track if the solution worked
    // For now, assume 80% success for analyzed errors
    return 0.8;
}
/**
 * Generate Soul updates from patterns
 */
function generateSoulUpdates(patterns, errors) {
    const updates = [];
    // Group patterns by agent type
    const byAgent = {};
    for (const pattern of patterns) {
        const agentTypes = new Set(errors
            .filter(e => e.pattern === pattern.name)
            .map(e => e.agent_type));
        for (const agentType of agentTypes) {
            if (!byAgent[agentType]) {
                byAgent[agentType] = [];
            }
            byAgent[agentType].push(pattern);
        }
    }
    // Generate updates for each agent
    for (const [agentType, agentPatterns] of Object.entries(byAgent)) {
        // Update "Common Error Patterns" section
        const errorPatternsContent = agentPatterns
            .map(p => `| ${p.name} | ${p.prevention} |`)
            .join("\n");
        updates.push({
            agent_type: agentType,
            section: "knowledge/error-patterns",
            change_type: "add",
            content: errorPatternsContent,
            reason: `Extracted from ${agentPatterns.length} recurring error patterns`
        });
        // Update "Red Lines" for high-severity patterns
        const highSeverityPatterns = agentPatterns.filter(p => {
            const relatedErrors = errors.filter(e => e.pattern === p.name);
            return relatedErrors.some(e => e.severity === "high");
        });
        if (highSeverityPatterns.length > 0) {
            const redLinesContent = highSeverityPatterns
                .map(p => `- **NEVER** ${p.trigger_conditions[0]} without ${p.prevention.toLowerCase()}`)
                .join("\n");
            updates.push({
                agent_type: agentType,
                section: "red-lines",
                change_type: "add",
                content: redLinesContent,
                reason: "High-severity error patterns require strict prevention"
            });
        }
    }
    return updates;
}
/**
 * Apply Soul update
 */
async function applySoulUpdate(update) {
    const soulPath = `souls/${update.agent_type}/soul.md`;
    try {
        // Read current soul
        let soulContent = "";
        try {
            soulContent = await (0, openclaw_api_js_1.read)({ path: soulPath });
        }
        catch {
            // Soul doesn't exist yet
            soulContent = createDefaultSoul(update.agent_type);
        }
        // Apply update based on section
        const updatedContent = applyUpdateToSection(soulContent, update);
        // Write updated soul
        await (0, openclaw_api_js_1.write)({
            path: soulPath,
            content: updatedContent
        });
    }
    catch (error) {
        console.warn(`Failed to update soul for ${update.agent_type}:`, error);
    }
}
/**
 * Create default soul template
 */
function createDefaultSoul(agentType) {
    return `---
agent_type: ${agentType}
version: 1.0.0
created: ${new Date().toISOString()}
updated: ${new Date().toISOString()}
---

# ${agentType.charAt(0).toUpperCase() + agentType.slice(1)} Agent Soul

## Identity
- **Name**: ${agentType}
- **Role**: ${agentType} specialist
- **Version**: 1.0.0

## Knowledge Base

### Common Error Patterns
| Pattern | Prevention |
|---------|------------|

## Red Lines

## Statistics
- Total Tasks: 0
- Success Rate: 0%
`;
}
/**
 * Apply update to specific section in soul
 */
function applyUpdateToSection(content, update) {
    // Simple section-based update
    // In production, this would use proper Markdown parsing
    const sectionHeader = `## ${update.section.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase())}`;
    if (content.includes(sectionHeader)) {
        // Append to existing section
        return content.replace(sectionHeader, `${sectionHeader}\n${update.content}\n`);
    }
    else {
        // Add new section before Statistics
        return content.replace("## Statistics", `${sectionHeader}\n${update.content}\n\n## Statistics`);
    }
}
/**
 * Get recent errors for batch analysis
 */
async function getRecentErrorsForAnalysis() {
    // Get from Hot Memory (recent)
    const hotErrors = await viking["hot"].getAll();
    // Get from Warm Memory (today)
    const today = new Date().toISOString().split('T')[0];
    const warmErrors = [];
    for (const agentType of ['coder', 'researcher', 'reviewer']) {
        const errors = await viking["warm"].getErrorsByDate(agentType, today);
        warmErrors.push(...errors);
    }
    // Combine and deduplicate
    const seen = new Set();
    const combined = [];
    for (const error of [...hotErrors, ...warmErrors]) {
        if (!seen.has(error.error_id)) {
            combined.push(error);
            seen.add(error.error_id);
        }
    }
    return combined;
}
/**
 * Convert review issues to errors
 */
async function convertReviewToErrors(review) {
    return review.issues
        .filter(issue => issue.severity === "high" || issue.severity === "medium")
        .map((issue, index) => ({
        error_id: `review-${review.review_id}-${index}`,
        task_id: review.review_id,
        subtask_id: "review",
        agent_type: "reviewer",
        timestamp: new Date().toISOString(),
        error_type: issue.category.replace(/\s+/g, ""),
        error_message: issue.description,
        context: {
            task_description: issue.category,
            subtask_name: "quality_review"
        },
        solution: issue.suggestion,
        prevention: issue.suggestion
    }));
}
/**
 * Save learning result
 */
async function saveLearningResult(result) {
    const path = `memory/learning/${result.learning_id}.json`;
    try {
        await (0, openclaw_api_js_1.write)({
            path,
            content: JSON.stringify(result, null, 2)
        });
    }
    catch (error) {
        console.warn("Failed to save learning result");
    }
}
// Export
exports.default = maselLearn;
//# sourceMappingURL=masel-learn.js.map