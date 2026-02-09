import * as core from '@actions/core';

export interface LogContext {
  pr_number?: number;
  file_count?: number;
  decision_count?: number;
  match_count?: number;
  critical_count?: number;
  duration_ms?: number;
  errors?: string[];
  [key: string]: string | number | string[] | undefined;
}

/**
 * Log structured data to the GitHub Action log in a consistent format.
 */
export function logStructured(
  level: 'info' | 'warning' | 'error',
  message: string,
  context?: LogContext,
) {
  const logMessage = context ? `${message} | ${JSON.stringify(context)}` : message;

  switch (level) {
    case 'info':
      core.info(logMessage);
      break;
    case 'warning':
      core.warning(logMessage);
      break;
    case 'error':
      core.error(logMessage);
      break;
  }
}
