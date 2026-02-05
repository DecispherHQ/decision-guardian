import { Decision } from './types';

interface TrieNode {
  children: Map<string, TrieNode>;
  decisions: Decision[]; // Decisions that match exactly at this node (e.g., "src/foo.ts")
  wildcardDecisions: Decision[]; // Decisions that have a wildcard at this level (e.g., "*.ts" or "**")
}

export class PatternTrie {
  private root: TrieNode;

  constructor(decisions: Decision[]) {
    this.root = this.createNode();
    for (const decision of decisions) {
      for (const pattern of decision.files) {
        this.insert(pattern, decision);
      }
    }
  }

  private createNode(): TrieNode {
    return {
      children: new Map(),
      decisions: [],
      wildcardDecisions: [],
    };
  }

  private insert(pattern: string, decision: Decision): void {
    const parts = pattern.split('/');
    this.insertRecursive(this.root, parts, decision);
  }

  private insertRecursive(node: TrieNode, parts: string[], decision: Decision): void {
    if (parts.length === 0) {
      node.decisions.push(decision);
      return;
    }

    const part = parts[0];
    const remaining = parts.slice(1);

    // Handle globstar (**) - matches zero or more path segments
    if (part === '**') {
      // Globstar matches at all depths, so add to wildcard decisions
      node.wildcardDecisions.push(decision);

      // Also continue down tree for more specific matches after **
      // Example: **/test.ts should match both at root and nested
      if (remaining.length > 0) {
        this.insertRecursive(node, remaining, decision);
      }
      return;
    }

    // Handle single-level wildcards (*, ?, {}, [])
    if (
      part.includes('*') ||
      part.includes('?') ||
      part.includes('{') ||
      part.includes('}') ||
      part.includes('[') ||
      part.includes(']')
    ) {
      node.wildcardDecisions.push(decision);
      return;
    }

    // Exact match - continue down the tree
    let child = node.children.get(part);
    if (!child) {
      child = this.createNode();
      node.children.set(part, child);
    }

    this.insertRecursive(child, remaining, decision);
  }

  /**
   * Returns a set of unique decisions that *might* match the given file path.
   * The file path should already be normalized (forward slashes).
   */
  findCandidates(file: string): Set<Decision> {
    const parts = file.split('/');
    const candidates = new Set<Decision>();

    this.collectCandidates(this.root, parts, candidates);

    return candidates;
  }

  private collectCandidates(node: TrieNode, parts: string[], candidates: Set<Decision>): void {
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
