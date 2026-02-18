import { DecisionMatch } from '../core/types';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const DIM = '\x1b[2m';

const SEVERITY_ICON: Record<string, string> = {
  critical: `${RED}●${RESET}`,
  warning: `${YELLOW}●${RESET}`,
  info: `${CYAN}●${RESET}`,
};

export function formatMatchesTable(matches: DecisionMatch[]): string {
  if (matches.length === 0) {
    return `\n  ${GREEN}✔${RESET} No decision violations found.\n`;
  }

  const lines: string[] = [];
  lines.push('');

  const grouped = groupBySeverity(matches);

  if (grouped.critical.length > 0) {
    lines.push(`  ${RED}${BOLD}Critical (${grouped.critical.length})${RESET}`);
    for (const m of grouped.critical) lines.push(formatRow(m));
    lines.push('');
  }

  if (grouped.warning.length > 0) {
    lines.push(`  ${YELLOW}${BOLD}Warning (${grouped.warning.length})${RESET}`);
    for (const m of grouped.warning) lines.push(formatRow(m));
    lines.push('');
  }

  if (grouped.info.length > 0) {
    lines.push(`  ${CYAN}${BOLD}Info (${grouped.info.length})${RESET}`);
    for (const m of grouped.info) lines.push(formatRow(m));
    lines.push('');
  }

  return lines.join('\n');
}

function formatRow(match: DecisionMatch): string {
  const icon = SEVERITY_ICON[match.decision.severity] || SEVERITY_ICON.info;
  const id = `${BOLD}${match.decision.id}${RESET}`;
  const file = `${DIM}${match.file}${RESET}`;
  const pattern = `${GRAY}${match.matchedPattern}${RESET}`;
  return `    ${icon} ${id}  ${file}  ${pattern}`;
}

export function formatSummary(stats: {
  filesProcessed: number;
  decisionsEvaluated: number;
  matchesFound: number;
  critical: number;
  warning: number;
  info: number;
  durationMs: number;
}): string {
  const lines: string[] = [];
  lines.push(`  ${GRAY}─────────────────────────────${RESET}`);
  lines.push(`  Files scanned:    ${BOLD}${stats.filesProcessed}${RESET}`);
  lines.push(`  Decisions checked:${BOLD} ${stats.decisionsEvaluated}${RESET}`);
  lines.push(
    `  Matches:          ${BOLD}${stats.matchesFound}${RESET} ${GRAY}(${stats.critical} critical, ${stats.warning} warning, ${stats.info} info)${RESET}`,
  );
  lines.push(`  Duration:         ${GRAY}${stats.durationMs}ms${RESET}`);
  lines.push('');
  return lines.join('\n');
}

function groupBySeverity(matches: DecisionMatch[]) {
  return {
    critical: matches.filter((m) => m.decision.severity === 'critical'),
    warning: matches.filter((m) => m.decision.severity === 'warning'),
    info: matches.filter((m) => m.decision.severity === 'info'),
  };
}
