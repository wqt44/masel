"use strict";
/**
 * MASEL Review Tool
 *
 * Reviews sub-agent outputs with Loss Function quality assessment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselReview = maselReview;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
/**
 * Main entry point for masel_review tool
 */
async function maselReview(options) {
    const { results, criteria = {}, plan } = options;
    console.log(`🔍 MASEL Review: Starting quality assessment...`);
    console.log(`   Results to review: ${results.length}`);
    const review_id = `review-${Date.now()}`;
    // Calculate dimension scores using Loss Function
    console.log(`\n📊 Calculating dimension scores...`);
    const dimensions = await calculateDimensions(results, criteria, plan);
    // Calculate overall score (weighted average)
    const overall_score = calculateOverallScore(dimensions);
    console.log(`   Overall score: ${overall_score.toFixed(1)}/100`);
    // Identify issues
    console.log(`\n🔎 Identifying issues...`);
    const issues = await identifyIssues(results, plan);
    console.log(`   Issues found: ${issues.length}`);
    issues.forEach(issue => {
        console.log(`   - [${issue.severity.toUpperCase()}] ${issue.category}: ${issue.description.substring(0, 60)}...`);
    });
    // Make decision
    const decision = makeDecision(overall_score, issues);
    console.log(`\n🎯 Decision: ${decision}`);
    // Generate recommendations
    const recommendations = generateRecommendations(issues, dimensions);
    // Generate summary
    const summary = generateReviewSummary(dimensions, issues, decision);
    const report = {
        review_id,
        task_id: plan?.task_id || "unknown",
        overall_score,
        dimensions,
        issues,
        decision,
        summary,
        recommendations
    };
    // Save review report
    await saveReviewReport(report);
    // If there are errors, record them for learning
    if (issues.length > 0) {
        await recordIssuesForLearning(report);
    }
    console.log(`\n✅ Review complete: ${review_id}`);
    return report;
}
/**
 * Calculate dimension scores using Loss Function
 */
async function calculateDimensions(results, criteria, plan) {
    // Default weights
    const weights = {
        correctness: criteria.correctness_weight ?? 0.30,
        completeness: criteria.completeness_weight ?? 0.25,
        efficiency: criteria.efficiency_weight ?? 0.15,
        readability: criteria.readability_weight ?? 0.15,
        robustness: criteria.robustness_weight ?? 0.15
    };
    const dimensions = [];
    // 1. Correctness (30%)
    const correctnessScore = await evaluateCorrectness(results, plan);
    dimensions.push({
        name: "Correctness",
        score: correctnessScore.score,
        weight: weights.correctness,
        comments: correctnessScore.comments
    });
    // 2. Completeness (25%)
    const completenessScore = await evaluateCompleteness(results, plan);
    dimensions.push({
        name: "Completeness",
        score: completenessScore.score,
        weight: weights.completeness,
        comments: completenessScore.comments
    });
    // 3. Efficiency (15%)
    const efficiencyScore = evaluateEfficiency(results);
    dimensions.push({
        name: "Efficiency",
        score: efficiencyScore.score,
        weight: weights.efficiency,
        comments: efficiencyScore.comments
    });
    // 4. Readability (15%)
    const readabilityScore = await evaluateReadability(results);
    dimensions.push({
        name: "Readability",
        score: readabilityScore.score,
        weight: weights.readability,
        comments: readabilityScore.comments
    });
    // 5. Robustness (15%)
    const robustnessScore = await evaluateRobustness(results);
    dimensions.push({
        name: "Robustness",
        score: robustnessScore.score,
        weight: weights.robustness,
        comments: robustnessScore.comments
    });
    return dimensions;
}
/**
 * Evaluate correctness dimension
 */
async function evaluateCorrectness(results, plan) {
    const comments = [];
    let totalScore = 0;
    for (const result of results) {
        if (!result.success) {
            comments.push(`Subtask ${result.subtask_id} failed: ${result.error}`);
            totalScore += 0;
        }
        else {
            // Check if output matches expected format
            const formatScore = checkOutputFormat(result.output);
            totalScore += formatScore;
            if (formatScore < 100) {
                comments.push(`Subtask ${result.subtask_id} output format issues`);
            }
        }
    }
    const score = results.length > 0 ? totalScore / results.length : 0;
    if (score === 100) {
        comments.push("All outputs are correct and well-formed");
    }
    return { score, comments };
}
/**
 * Check output format
 */
function checkOutputFormat(output) {
    // Check for common format issues
    let score = 100;
    // Check for error messages in output
    if (output.toLowerCase().includes("error") ||
        output.toLowerCase().includes("exception")) {
        score -= 30;
    }
    // Check for empty or minimal output
    if (output.length < 10) {
        score -= 20;
    }
    // Check for proper structure (has headers, sections, etc.)
    if (!output.includes("##") && !output.includes(":") && output.length > 100) {
        score -= 10; // Unstructured long output
    }
    return Math.max(0, score);
}
/**
 * Evaluate completeness dimension
 */
async function evaluateCompleteness(results, plan) {
    const comments = [];
    if (!plan) {
        return { score: 50, comments: ["No plan available for completeness check"] };
    }
    // Check if all acceptance criteria are addressed
    const criteria = plan.spec.acceptance_criteria;
    let addressedCount = 0;
    const combinedOutput = results.map(r => r.output).join("\n").toLowerCase();
    for (const criterion of criteria) {
        // Simple heuristic: check if criterion keywords appear in output
        const keywords = criterion.toLowerCase().split(" ").filter(w => w.length > 3);
        const matchCount = keywords.filter(kw => combinedOutput.includes(kw)).length;
        if (matchCount >= keywords.length * 0.5) {
            addressedCount++;
        }
    }
    const score = criteria.length > 0
        ? (addressedCount / criteria.length) * 100
        : 50;
    comments.push(`${addressedCount}/${criteria.length} acceptance criteria addressed`);
    return { score, comments };
}
/**
 * Evaluate efficiency dimension
 */
function evaluateEfficiency(results) {
    const comments = [];
    if (results.length === 0) {
        return { score: 0, comments: ["No results to evaluate"] };
    }
    const totalTime = results.reduce((sum, r) => sum + r.execution_time, 0);
    const avgTime = totalTime / results.length;
    // Score based on execution time (faster is better, but not at cost of quality)
    let score = 100;
    if (avgTime > 60000) { // > 1 minute average
        score -= 20;
        comments.push("Execution time is high");
    }
    else if (avgTime > 30000) { // > 30 seconds
        score -= 10;
        comments.push("Execution time is moderate");
    }
    else {
        comments.push("Good execution efficiency");
    }
    // Check for timeout failures
    const timeoutFailures = results.filter(r => !r.success && r.error?.includes("timeout")).length;
    if (timeoutFailures > 0) {
        score -= timeoutFailures * 10;
        comments.push(`${timeoutFailures} subtask(s) timed out`);
    }
    return { score: Math.max(0, score), comments };
}
/**
 * Evaluate readability dimension
 */
async function evaluateReadability(results) {
    const comments = [];
    let totalScore = 0;
    for (const result of results) {
        let score = 100;
        // Check for structure
        if (result.output.includes("#") || result.output.includes("##")) {
            score += 5; // Has headers
        }
        else {
            score -= 10; // No structure
        }
        // Check for lists
        if (result.output.includes("- ") || result.output.includes("* ")) {
            score += 5; // Has lists
        }
        // Check for code blocks
        if (result.output.includes("```")) {
            score += 5; // Has code blocks
        }
        // Check for very long lines
        const lines = result.output.split("\n");
        const longLines = lines.filter(l => l.length > 100).length;
        if (longLines > lines.length * 0.3) {
            score -= 15; // Too many long lines
        }
        totalScore += Math.min(100, score);
    }
    const avgScore = results.length > 0 ? totalScore / results.length : 0;
    if (avgScore > 80) {
        comments.push("Output is well-structured and readable");
    }
    else if (avgScore > 60) {
        comments.push("Output is readable but could be better structured");
    }
    else {
        comments.push("Output needs better formatting and structure");
    }
    return { score: avgScore, comments };
}
/**
 * Evaluate robustness dimension
 */
async function evaluateRobustness(results) {
    const comments = [];
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    // Score based on success rate
    const successRate = results.length > 0 ? successCount / results.length : 0;
    let score = successRate * 100;
    if (failureCount === 0) {
        comments.push("All subtasks completed successfully - high robustness");
    }
    else if (failureCount <= results.length * 0.2) {
        comments.push(`${failureCount} subtask(s) failed - acceptable robustness`);
        score -= 10;
    }
    else {
        comments.push(`${failureCount} subtask(s) failed - low robustness`);
        score -= 30;
    }
    // Check error types
    const errorTypes = new Set(results
        .filter(r => !r.success && r.error)
        .map(r => r.error.split(":")[0]));
    if (errorTypes.size > 2) {
        comments.push("Multiple error types indicate instability");
        score -= 10;
    }
    return { score: Math.max(0, score), comments };
}
/**
 * Calculate overall score (weighted average)
 */
function calculateOverallScore(dimensions) {
    const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
    const weightedSum = dimensions.reduce((sum, d) => sum + d.score * d.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
/**
 * Identify specific issues
 */
async function identifyIssues(results, plan) {
    const issues = [];
    for (const result of results) {
        if (!result.success) {
            issues.push({
                severity: "high",
                category: "Execution Failure",
                description: result.error || "Unknown error",
                location: `Subtask ${result.subtask_id}`,
                suggestion: "Review error message and retry with fixes"
            });
        }
        // Check output quality
        if (result.output.length < 50) {
            issues.push({
                severity: "medium",
                category: "Output Quality",
                description: "Output is very short, may be incomplete",
                location: `Subtask ${result.subtask_id}`,
                suggestion: "Verify all requirements were addressed"
            });
        }
        // Check for common error patterns in output
        if (result.output.toLowerCase().includes("i don't know") ||
            result.output.toLowerCase().includes("i cannot")) {
            issues.push({
                severity: "medium",
                category: "Capability Gap",
                description: "Agent indicated inability to complete task",
                location: `Subtask ${result.subtask_id}`,
                suggestion: "Break down task into simpler subtasks"
            });
        }
    }
    return issues;
}
/**
 * Make approval decision
 */
function makeDecision(overall_score, issues) {
    const highSeverityCount = issues.filter(i => i.severity === "high").length;
    if (highSeverityCount > 0) {
        return "REJECT";
    }
    if (overall_score >= 80 && issues.length === 0) {
        return "APPROVE";
    }
    if (overall_score >= 60) {
        return "NEEDS_REVISION";
    }
    return "REJECT";
}
/**
 * Generate recommendations
 */
function generateRecommendations(issues, dimensions) {
    const recommendations = [];
    // Based on issues
    for (const issue of issues) {
        recommendations.push(`[${issue.severity.toUpperCase()}] ${issue.suggestion}`);
    }
    // Based on low-scoring dimensions
    const lowDimensions = dimensions.filter(d => d.score < 70);
    for (const dim of lowDimensions) {
        recommendations.push(`Improve ${dim.name.toLowerCase()} (current: ${dim.score.toFixed(1)})`);
    }
    if (recommendations.length === 0) {
        recommendations.push("No improvements needed - excellent work!");
    }
    return recommendations;
}
/**
 * Generate review summary
 */
function generateReviewSummary(dimensions, issues, decision) {
    const avgScore = dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length;
    const issueCount = issues.length;
    let summary = `Review completed with overall score ${avgScore.toFixed(1)}/100. `;
    summary += `${issueCount} issue(s) identified. `;
    if (decision === "APPROVE") {
        summary += "Output meets quality standards and is approved for delivery.";
    }
    else if (decision === "NEEDS_REVISION") {
        summary += "Output needs revision before approval.";
    }
    else {
        summary += "Output does not meet quality standards and requires significant rework.";
    }
    return summary;
}
/**
 * Save review report
 */
async function saveReviewReport(report) {
    const reportPath = `memory/reviews/${report.review_id}.json`;
    try {
        await (0, openclaw_api_js_1.write)({
            path: reportPath,
            content: JSON.stringify(report, null, 2)
        });
    }
    catch (error) {
        console.warn(`Warning: Could not save review report`);
    }
}
/**
 * Record issues for learning
 */
async function recordIssuesForLearning(report) {
    // This will be used by masel-learn
    console.log(`   📝 ${report.issues.length} issue(s) recorded for learning`);
}
// Export for OpenClaw tool registration
exports.default = maselReview;
//# sourceMappingURL=masel-review.js.map