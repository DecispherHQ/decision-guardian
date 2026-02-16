"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternTrie = void 0;
class PatternTrie {
    root;
    constructor(decisions) {
        this.root = this.createNode();
        for (const decision of decisions) {
            for (const pattern of decision.files) {
                this.insert(pattern, decision);
            }
        }
    }
    createNode() {
        return {
            children: new Map(),
            decisions: [],
            wildcardDecisions: [],
        };
    }
    insert(pattern, decision) {
        const parts = pattern.split('/');
        this.insertRecursive(this.root, parts, decision);
    }
    insertRecursive(node, parts, decision) {
        if (parts.length === 0) {
            node.decisions.push(decision);
            return;
        }
        const part = parts[0];
        const remaining = parts.slice(1);
        if (part === '**') {
            node.wildcardDecisions.push(decision);
            if (remaining.length > 0) {
                this.insertRecursive(node, remaining, decision);
            }
            return;
        }
        if (part.includes('*') ||
            part.includes('?') ||
            part.includes('{') ||
            part.includes('}') ||
            part.includes('[') ||
            part.includes(']')) {
            node.wildcardDecisions.push(decision);
            return;
        }
        let child = node.children.get(part);
        if (!child) {
            child = this.createNode();
            node.children.set(part, child);
        }
        this.insertRecursive(child, remaining, decision);
    }
    /**
     * Returns a set of unique decisions that *might* match the given file path.
     */
    findCandidates(file) {
        const parts = file.split('/');
        const candidates = new Set();
        this.collectCandidates(this.root, parts, candidates);
        return candidates;
    }
    collectCandidates(node, parts, candidates) {
        for (const decision of node.wildcardDecisions) {
            candidates.add(decision);
        }
        if (parts.length === 0) {
            for (const decision of node.decisions) {
                candidates.add(decision);
            }
            return;
        }
        const part = parts[0];
        const child = node.children.get(part);
        if (child) {
            this.collectCandidates(child, parts.slice(1), candidates);
        }
    }
}
exports.PatternTrie = PatternTrie;
