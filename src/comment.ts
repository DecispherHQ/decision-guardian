import * as github from '@actions/github';
import * as core from '@actions/core';
import { DecisionMatch } from './types';
import * as crypto from 'crypto';

export class CommentManager {
  private readonly octokit: ReturnType<typeof github.getOctokit>;
  private readonly MARKER = '<!-- decision-guardian-v1 -->';
  private readonly ALL_CLEAR_HASH = 'all-clear';
  private readonly MAX_COMMENT_LENGTH = 60000; // GitHub API limit is 65536

  constructor(token: string) {
    this.octokit = github.getOctokit(token);
  }

  /**
   * Post or update comment on PR with decision alerts
   */
  async postAlert(matches: DecisionMatch[], prContext?: { owner: string; repo: string; number: number }): Promise<void> {
    const MAX_RETRIES = 3;

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        await this._postAlertAttempt(matches, prContext);
        return;
      } catch (error: unknown) {
        const errWithStatus = error as { status?: number };
        if (errWithStatus.status === 409 && retry < MAX_RETRIES - 1) {
          core.warning(
            `Conflict detected when posting comment, retrying... (${retry + 1}/${MAX_RETRIES})`,
          );
          await new Promise((r) => setTimeout(r, 1000 * (retry + 1)));
          continue;
        }
        throw error;
      }
    }
  }

  /**
   * Core logic for posting or updating comment
   */
  private async _postAlertAttempt(matches: DecisionMatch[], prContext?: { owner: string; repo: string; number: number }): Promise<void> {

    matches.sort((a, b) => {
      const idCompare = a.decision.id.localeCompare(b.decision.id);
      if (idCompare !== 0) return idCompare;
      return a.file.localeCompare(b.file);
    });

    let owner: string;
    let repo: string;
    let pull_number: number;

    if (prContext) {
      owner = prContext.owner;
      repo = prContext.repo;
      pull_number = prContext.number;
    } else {
      const context = github.context;

      if (!context.payload.pull_request) {
        core.warning('Not a pull request event, skipping comment');
        return;
      }

      owner = context.repo.owner;
      repo = context.repo.repo;
      pull_number = context.payload.pull_request.number;
    }

    const newHash = this.hashContent(matches);
    const newBody = this.formatComment(matches, newHash);

    const existingComments = await this.findExistingComments(owner, repo, pull_number);
    let targetComment = existingComments.length > 0 ? existingComments[0] : null;

    if (existingComments.length > 1) {
      core.info(`Found ${existingComments.length} duplicate comments, cleaning up...`);
      for (let i = 1; i < existingComments.length; i++) {
        try {
          await this.octokit.rest.issues.deleteComment({ owner, repo, comment_id: existingComments[i].id });
        } catch (error) {
          core.warning(`Failed to delete duplicate comment ${existingComments[i].id}: ${error}`);
        }
      }
    }

    if (targetComment) {
      const oldHash = this.extractHash(targetComment.body);

      if (oldHash === newHash) {
        core.info('Existing comment is up-to-date, skipping update');
        return;
      }

      try {
        await this.octokit.rest.issues.updateComment({ owner, repo, comment_id: targetComment.id, body: newBody });
        core.info(`Updated existing comment (${matches.length} matches)`);
        return;
      } catch (error: unknown) {
        const errWithStatus = error as { status?: number };
        if (errWithStatus.status === 404) {
          core.warning(`Comment ${targetComment.id} was deleted, creating new one`);
          targetComment = null;
        } else {
          const message = error instanceof Error ? error.message : String(error);
          core.error(`Failed to update comment: ${message}`);
          throw error;
        }
      }
    }

    if (!targetComment) {
      try {
        await this.octokit.rest.issues.createComment({ owner, repo, issue_number: pull_number, body: newBody });
        core.info(`Posted new decision alert (${matches.length} matches)`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        core.error(`Failed to post comment: ${message}`);
        throw error;
      }
    }
  }

  /**
   * Update existing comment to "All Clear" status when no matches are found.
   * Only updates if there was a previous Decision Guardian comment.
   */
  async postAllClear(prContext?: { owner: string; repo: string; number: number }): Promise<void> {
    let owner: string;
    let repo: string;
    let pull_number: number;

    if (prContext) {
      owner = prContext.owner;
      repo = prContext.repo;
      pull_number = prContext.number;
    } else {
      const context = github.context;

      if (!context.payload.pull_request) {
        core.warning('Not a pull request event, skipping all-clear comment');
        return;
      }

      owner = context.repo.owner;
      repo = context.repo.repo;
      pull_number = context.payload.pull_request.number;
    }

    const existingComments = await this.findExistingComments(owner, repo, pull_number);

    if (existingComments.length === 0) {
      core.info('No existing Decision Guardian comment found, skipping all-clear update');
      return;
    }

    const targetComment = existingComments[0];
    const oldHash = this.extractHash(targetComment.body);

    if (oldHash === this.ALL_CLEAR_HASH) {
      core.info('Comment is already showing all-clear status, skipping update');
      return;
    }

    if (existingComments.length > 1) {
      core.info(`Found ${existingComments.length} duplicate comments, cleaning up...`);
      for (let i = 1; i < existingComments.length; i++) {
        try {
          await this.octokit.rest.issues.deleteComment({ owner, repo, comment_id: existingComments[i].id });
        } catch (error) {
          core.warning(`Failed to delete duplicate comment ${existingComments[i].id}: ${error}`);
        }
      }
    }

    const allClearBody = this.buildAllClearComment();

    try {
      await this.octokit.rest.issues.updateComment({ owner, repo, comment_id: targetComment.id, body: allClearBody });
      core.info('Updated comment to all-clear status');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      core.warning(`Failed to update comment to all-clear status: ${message}`);
    }
  }

  /**
   * Find all existing Decision Guardian comments
   */
  private async findExistingComments(owner: string, repo: string, issue_number: number): Promise<{ id: number; body: string }[]> {
    try {
      const { data: comments } = await this.octokit.rest.issues.listComments({ owner, repo, issue_number, });
      return comments.filter((c) => c.body?.includes(this.MARKER)).map((c) => ({ id: c.id, body: c.body || '' }));
    } catch (error) {
      core.warning('Failed to fetch existing comments, will create new');
      return [];
    }
  }

  /**
   * Generate content hash based on decision IDs, files, and matched patterns
   */
  private hashContent(matches: DecisionMatch[]): string {
    const key = matches
      .map((m) => `${m.decision.id}:${m.file}:${m.matchDetails?.matchedPatterns?.join(',') || ''}`)
      .sort()
      .join('|');

    return crypto.createHash('sha256').update(key, 'utf8').digest('hex').substring(0, 16);
  }

  /**
   * Extract hash from existing comment
   */
  private extractHash(commentBody: string): string | null {
    // Match both hex hashes (16 chars) and special hashes like 'all-clear'
    const match = commentBody.match(/<!-- hash:([a-z0-9-]+) -->/);
    return match ? match[1] : null;
  }

  /**
   * Format matches into markdown comment
   */
  private formatComment(matches: DecisionMatch[], hash: string): string {
    const fullComment = this.buildFullComment(matches, hash);

    if (fullComment.length > this.MAX_COMMENT_LENGTH) {
      core.warning(`Comment would exceed ${this.MAX_COMMENT_LENGTH} chars (${fullComment.length}), truncating...`);
      return this.buildTruncatedComment(matches, hash);
    }

    return fullComment;
  }

  /**
   * Build the full comment without truncation
   */
  private buildFullComment(matches: DecisionMatch[], hash: string): string {
    const grouped = this.groupBySeverity(matches);
    const uniqueFiles = new Set(matches.map(m => m.file)).size;
    const uniqueDecisions = new Set(matches.map(m => m.decision.id)).size;

    let comment = `${this.MARKER}\n`;
    comment += `<!-- hash:${hash} -->\n\n`;
    comment += `## ⚠️ Decision Context Alert\n\n`;
    comment += `This PR modifies **${uniqueFiles} file(s)** that trigger **${uniqueDecisions} architectural decision(s)**.\n\n`;

    if (grouped.critical.length > 0) {
      comment += `### 🔴 Critical Decisions (${grouped.critical.length})\n\n`;
      for (const match of grouped.critical) {
        comment += this.formatMatch(match);
      }
    }

    if (grouped.warning.length > 0) {
      comment += `### 🟡 Important Decisions (${grouped.warning.length})\n\n`;
      for (const match of grouped.warning) {
        comment += this.formatMatch(match);
      }
    }

    if (grouped.info.length > 0) {
      comment += `### ℹ️ Informational (${grouped.info.length})\n\n`;
      for (const match of grouped.info) {
        comment += this.formatMatch(match);
      }
    }

    comment += `\n---\n`;
    comment += `*🤖 Generated by [Decision Guardian](https://github.com/DecispherHQ/decision-guardian). `;
    comment += `Update decisions in your \`.decispher/\` folder if needed.*\n`;

    return comment;
  }

  /**
   * Build the "All Clear" comment when no decision rules are triggered
   */
  private buildAllClearComment(): string {
    let comment = `${this.MARKER}\n`;
    comment += `<!-- hash:${this.ALL_CLEAR_HASH} -->\n\n`;
    comment += `## ✅ Decision Guardian - All Clear\n\n`;
    comment += `This PR no longer modifies any files protected by architectural decisions.\n\n`;
    comment += `> **Great job!** All previously flagged decision contexts have been resolved.\n\n`;
    comment += `---\n`;
    comment += `*🤖 Generated by [Decision Guardian](https://github.com/DecispherHQ/decision-guardian). `;
    comment += `Update decisions in your \`.decispher/\` folder if needed.*\n`;

    return comment;
  }

  /**
   * Build truncated comment when full comment exceeds GitHub's limit
   */
  private buildTruncatedComment(matches: DecisionMatch[], hash: string): string {
    const detailLimits = [20, 10, 5, 2, 0];
    const fileLimitsPerDecision = [10, 5, 3, 1];

    for (const maxDetailed of detailLimits) {
      for (const maxFilesPerDecision of fileLimitsPerDecision) {
        const comment = this.buildTruncatedCommentWithLimits(matches, hash, maxDetailed, maxFilesPerDecision);

        if (comment.length <= this.MAX_COMMENT_LENGTH) {
          return comment;
        }
      }
    }

    const ultraCompact = this.buildUltraCompactComment(matches, hash);
    if (ultraCompact.length <= this.MAX_COMMENT_LENGTH) {
      return ultraCompact;
    }

    core.warning(`Comment still too long (${ultraCompact.length} chars), applying hard truncation`);
    return this.hardTruncate(ultraCompact);
  }

  /**
   * Build truncated comment with specific limits for detailed matches and files per decision
   */
  private buildTruncatedCommentWithLimits(matches: DecisionMatch[], hash: string, maxDetailedMatches: number, maxFilesPerDecision: number): string {
    const grouped = this.groupBySeverity(matches);
    const uniqueFiles = new Set(matches.map(m => m.file)).size;
    const uniqueDecisions = new Set(matches.map(m => m.decision.id)).size;

    let comment = `${this.MARKER}\n`;
    comment += `<!-- hash:${hash} -->\n\n`;
    comment += `## ⚠️ Decision Context Alert\n\n`;
    comment += `> **Large PR**: **${uniqueFiles} file(s)** trigger **${uniqueDecisions} decision(s)** - showing summary.\n\n`;

    let detailedCount = 0;
    const remainingMatches: DecisionMatch[] = [];

    if (grouped.critical.length > 0) {
      comment += `### 🔴 Critical Decisions (${grouped.critical.length})\n\n`;
      for (const match of grouped.critical) {
        if (detailedCount < maxDetailedMatches) {
          comment += this.formatMatch(match);
          detailedCount++;
        } else {
          remainingMatches.push(match);
        }
      }
    }

    if (grouped.warning.length > 0) {
      comment += `### 🟡 Important Decisions (${grouped.warning.length})\n\n`;
      for (const match of grouped.warning) {
        if (detailedCount < maxDetailedMatches) {
          comment += this.formatMatch(match);
          detailedCount++;
        } else {
          remainingMatches.push(match);
        }
      }
    }

    if (grouped.info.length > 0) {
      comment += `### ℹ️ Informational (${grouped.info.length})\n\n`;
      for (const match of grouped.info) {
        if (detailedCount < maxDetailedMatches) {
          comment += this.formatMatch(match);
          detailedCount++;
        } else {
          remainingMatches.push(match);
        }
      }
    }

    if (remainingMatches.length > 0) {
      comment += this.buildSummarySectionForRemainingWithLimit(remainingMatches, maxFilesPerDecision);
    }

    comment += `\n---\n`;
    comment += `*🤖 Generated by [Decision Guardian](https://github.com/DecispherHQ/decision-guardian). `;
    comment += `Showing ${detailedCount} of ${matches.length} matches.*\n`;

    return comment;
  }

  /**
   * Build ultra-compact comment showing only counts (last resort before hard truncation)
   */
  private buildUltraCompactComment(matches: DecisionMatch[], hash: string): string {
    const grouped = this.groupBySeverity(matches);

    const byDecision = new Map<string, { count: number; severity: string }>();
    for (const match of matches) {
      const existing = byDecision.get(match.decision.id);
      if (existing) {
        existing.count++;
      } else {
        byDecision.set(match.decision.id, {
          count: 1,
          severity: match.decision.severity || 'info',
        });
      }
    }

    const uniqueFiles = new Set(matches.map(m => m.file)).size;

    let comment = `${this.MARKER}\n`;
    comment += `<!-- hash:${hash} -->\n\n`;
    comment += `## ⚠️ Decision Context Alert\n\n`;
    comment += `> ⚠️ **Very Large PR**: **${uniqueFiles} file(s)** trigger **${byDecision.size} decision(s)**.\n\n`;

    comment += `### Summary\n\n`;
    comment += `| Severity | Count |\n`;
    comment += `|----------|-------|\n`;
    comment += `| 🔴 Critical | ${grouped.critical.length} |\n`;
    comment += `| 🟡 Warning | ${grouped.warning.length} |\n`;
    comment += `| ℹ️ Info | ${grouped.info.length} |\n\n`;

    comment += `### Decisions Triggered\n\n`;

    const sortedDecisions = [...byDecision.entries()].sort((a, b) => b[1].count - a[1].count);
    const maxDecisionsToShow = 50;

    for (let i = 0; i < Math.min(sortedDecisions.length, maxDecisionsToShow); i++) {
      const [id, info] = sortedDecisions[i];
      const icon = info.severity === 'critical' ? '🔴' : info.severity === 'warning' ? '🟡' : 'ℹ️';
      comment += `- ${icon} **${id}**: ${info.count} file(s)\n`;
    }

    if (sortedDecisions.length > maxDecisionsToShow) {
      comment += `- *...and ${sortedDecisions.length - maxDecisionsToShow} more decisions*\n`;
    }

    comment += `\n---\n`;
    comment += `*🤖 Generated by [Decision Guardian](https://github.com/DecispherHQ/decision-guardian). `;
    comment += `Details truncated.*\n`;

    return comment;
  }

  /**
   * Hard truncate comment as final safety measure
   */
  private hardTruncate(comment: string): string {
    const truncationNotice = `\n\n---\n*⚠️ Comment truncated due to GitHub's 65536 character limit.*\n`;
    const maxLength = this.MAX_COMMENT_LENGTH - truncationNotice.length;

    let breakPoint = comment.lastIndexOf('\n', maxLength);
    if (breakPoint < maxLength * 0.8) {
      breakPoint = maxLength;
    }

    return comment.substring(0, breakPoint) + truncationNotice;
  }

  /**
   * Build a compact summary section for matches that couldn't be shown in detail
   */
  private buildSummarySectionForRemaining(matches: DecisionMatch[]): string {
    return this.buildSummarySectionForRemainingWithLimit(matches, 10);
  }

  /**
   * Build a compact summary section with configurable file limit per decision
   */
  private buildSummarySectionForRemainingWithLimit(matches: DecisionMatch[], maxFilesPerDecision: number): string {
    const byDecision = new Map<string, string[]>();

    for (const match of matches) {
      const files = byDecision.get(match.decision.id) || [];
      files.push(match.file);
      byDecision.set(match.decision.id, files);
    }

    let section = `\n### 📋 Additional Matches (${matches.length} more)\n\n`;
    section += `<details>\n<summary>Click to expand summary of remaining files</summary>\n\n`;

    for (const [decisionId, files] of byDecision) {
      section += `**${decisionId}** (${files.length} files):\n`;
      const displayFiles = files.slice(0, maxFilesPerDecision);
      const remainingCount = files.length - displayFiles.length;

      for (const file of displayFiles) {
        section += `- \`${file}\`\n`;
      }

      if (remainingCount > 0) {
        section += `- *...and ${remainingCount} more files*\n`;
      }
      section += `\n`;
    }

    section += `</details>\n\n`;

    return section;
  }

  /**
   * Format a single match with link to source, blockquote context, and collapsible for long content
   */
  private formatMatch(match: DecisionMatch): string {
    const escapeMarkdown = (str: string): string => {
      return str.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&');
    };

    const { file, decision, matchedPattern, matchDetails } = match;

    let patternDisplay = matchedPattern;
    if (matchDetails && matchDetails.matchedPatterns && matchDetails.matchedPatterns.length > 0) {
      patternDisplay = matchDetails.matchedPatterns.slice(0, 3).join(', ');
      if (matchDetails.matchedPatterns.length > 3) {
        patternDisplay += ` (+${matchDetails.matchedPatterns.length - 3} more)`;
      }
    }

    const matchType = matchDetails ? 'Rule-based' : 'File pattern';

    // Build source file link (full GitHub blob URL)
    const workspaceRoot = process.env.GITHUB_WORKSPACE || process.cwd();
    let relativeSourceFile = decision.sourceFile;

    const normalizedSource = decision.sourceFile.replace(/\\/g, '/');
    const normalizedWorkspace = workspaceRoot.replace(/\\/g, '/');

    if (normalizedSource.startsWith(normalizedWorkspace)) {
      relativeSourceFile = normalizedSource.substring(normalizedWorkspace.length).replace(/^\//, '');
    }

    // Construct full GitHub blob URL for the source file (if context available)
    let sourceLink: string;
    const context = github.context;

    if (context?.repo?.owner && context?.repo?.repo) {
      const repoUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}`;
      const ref = context.payload?.pull_request?.head?.sha || context.sha || 'HEAD';
      const blobUrl = `${repoUrl}/blob/${ref}/${relativeSourceFile}`;

      sourceLink = decision.lineNumber > 0
        ? `[${relativeSourceFile}](${blobUrl}#L${decision.lineNumber})`
        : `[${relativeSourceFile}](${blobUrl})`;
    } else {
      // Fallback when context is not available
      sourceLink = `\`${relativeSourceFile}\``;
    }

    // Format context with blockquote, collapsible if long (>300 chars)
    const contextText = decision.context.trim();
    const CONTEXT_THRESHOLD = 300;
    let contextSection: string;

    if (contextText.length > CONTEXT_THRESHOLD) {
      // Long context: use collapsible
      const preview = contextText.substring(0, 150).trim() + '...';
      contextSection = `> ${escapeMarkdown(preview)}\n\n`;
      contextSection += `<details>\n<summary>📖 Read full context</summary>\n\n`;
      contextSection += `> ${escapeMarkdown(contextText).split('\n').join('\n> ')}\n\n`;
      contextSection += `</details>\n`;
    } else {
      // Short context: use simple blockquote
      contextSection = `> ${escapeMarkdown(contextText).split('\n').join('\n> ')}\n`;
    }

    return `
#### ${escapeMarkdown(decision.id)}: ${escapeMarkdown(decision.title)}

| | |
|---|---|
| **File** | \`${escapeMarkdown(file)}\` |
| **Pattern** | \`${escapeMarkdown(patternDisplay)}\` |
| **Type** | ${matchType} |
| **Date** | ${escapeMarkdown(decision.date)} |
| **Source** | ${sourceLink} |

${contextSection}
---

`;
  }

  /**
   * Group matches by severity
   */
  private groupBySeverity(matches: DecisionMatch[]): { critical: DecisionMatch[], warning: DecisionMatch[], info: DecisionMatch[] } {
    return {
      critical: matches.filter((m) => m.decision.severity === 'critical'),
      warning: matches.filter((m) => m.decision.severity === 'warning'),
      info: matches.filter((m) => m.decision.severity === 'info'),
    };
  }
}
