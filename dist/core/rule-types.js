"use strict";
/**
 * Rule Types for Advanced Decision Rules System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_RULE_DEPTH = void 0;
exports.isFileRule = isFileRule;
exports.isRuleCondition = isRuleCondition;
/** Safety limit for nested rules to prevent stack overflow */
exports.MAX_RULE_DEPTH = 10;
/**
 * Type guard to check if a condition is a FileRule
 */
function isFileRule(condition) {
    return (condition.type === 'file' && typeof condition.pattern === 'string');
}
/**
 * Type guard to check if a condition is a nested RuleCondition
 */
function isRuleCondition(condition) {
    return Array.isArray(condition.conditions);
}
