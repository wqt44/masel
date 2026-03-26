"use strict";
/**
 * MASEL Souls Tool
 *
 * Manage Agent Souls - list, get, update, reset
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.maselSouls = maselSouls;
const openclaw_api_js_1 = require("../utils/openclaw-api.js");
/**
 * Manage Agent Souls
 */
async function maselSouls(options) {
    const { action, agent_type, content, section } = options;
    switch (action) {
        case "list":
            return listSouls();
        case "get":
            if (!agent_type)
                throw new Error("agent_type required for get");
            return getSoul(agent_type);
        case "update":
            if (!agent_type || !content)
                throw new Error("agent_type and content required for update");
            return updateSoul(agent_type, content, section);
        case "reset":
            if (!agent_type)
                throw new Error("agent_type required for reset");
            return resetSoul(agent_type);
        default:
            throw new Error(`Unknown action: ${action}`);
    }
}
/**
 * List all souls
 */
async function listSouls() {
    const souls = [];
    const agentTypes = ["coder", "researcher", "reviewer"];
    for (const agentType of agentTypes) {
        try {
            const soulContent = await (0, openclaw_api_js_1.read)({ path: `souls/${agentType}/soul.md` });
            const stats = parseSoulStats(soulContent);
            souls.push({
                agent_type: agentType,
                version: stats.version || "1.0.0",
                created: stats.created || "unknown",
                updated: stats.updated || "unknown",
                size: soulContent.length
            });
        }
        catch {
            // Soul doesn't exist
        }
    }
    return souls;
}
/**
 * Get specific soul
 */
async function getSoul(agentType) {
    try {
        return await (0, openclaw_api_js_1.read)({ path: `souls/${agentType}/soul.md` });
    }
    catch {
        throw new Error(`Soul for ${agentType} not found`);
    }
}
/**
 * Update soul
 */
async function updateSoul(agentType, content, section) {
    try {
        const soulPath = `souls/${agentType}/soul.md`;
        if (section) {
            // Update specific section
            const currentSoul = await (0, openclaw_api_js_1.read)({ path: soulPath });
            const updatedSoul = updateSection(currentSoul, section, content);
            await (0, openclaw_api_js_1.write)({
                path: soulPath,
                content: updatedSoul
            });
        }
        else {
            // Replace entire soul
            await (0, openclaw_api_js_1.write)({
                path: soulPath,
                content
            });
        }
        return {
            success: true,
            message: `Soul for ${agentType} updated successfully`
        };
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to update soul: ${error}`
        };
    }
}
/**
 * Reset soul to default
 */
async function resetSoul(agentType) {
    const defaultSoul = createDefaultSoul(agentType);
    try {
        await (0, openclaw_api_js_1.write)({
            path: `souls/${agentType}/soul.md`,
            content: defaultSoul
        });
        return {
            success: true,
            message: `Soul for ${agentType} reset to default`
        };
    }
    catch (error) {
        return {
            success: false,
            message: `Failed to reset soul: ${error}`
        };
    }
}
/**
 * Parse soul stats from content
 */
function parseSoulStats(content) {
    const stats = {};
    const lines = content.split('\n');
    for (const line of lines) {
        if (line.startsWith('version:')) {
            stats.version = line.split(':')[1].trim();
        }
        else if (line.startsWith('created:')) {
            stats.created = line.split(':')[1].trim();
        }
        else if (line.startsWith('updated:')) {
            stats.updated = line.split(':')[1].trim();
        }
    }
    return stats;
}
/**
 * Update specific section in soul
 */
function updateSection(content, section, newContent) {
    const sectionHeader = `## ${section}`;
    if (content.includes(sectionHeader)) {
        // Replace existing section
        const regex = new RegExp(`${sectionHeader}\\n[\\s\\S]*?(?=\\n## |$)`);
        return content.replace(regex, `${sectionHeader}\n${newContent}\n\n`);
    }
    else {
        // Add new section before Statistics
        return content.replace("## Statistics", `${sectionHeader}\n${newContent}\n\n## Statistics`);
    }
}
/**
 * Create default soul
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
exports.default = maselSouls;
//# sourceMappingURL=masel-souls.js.map