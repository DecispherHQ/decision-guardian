/**
 * ISCMProvider — Source Control Management provider interface.
 */

import type { FileDiff, DecisionMatch } from '../types';

export interface ISCMProvider {
    /** Get list of changed file paths */
    getChangedFiles(): Promise<string[]>;

    /** Get file diffs with patch content for advanced rule matching */
    getFileDiffs(): Promise<FileDiff[]>;

    /** Stream file diffs for very large changesets (optional) */
    streamFileDiffs?(): AsyncGenerator<FileDiff[], void, unknown>;

    /** Post results as a comment/note on the changeset (optional, SCM-specific) */
    postComment?(matches: DecisionMatch[]): Promise<void>;
}
