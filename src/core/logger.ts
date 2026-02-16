/**
 * Structured logging utility — platform-agnostic.
 */
import type { ILogger } from './interfaces/logger';

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
 * Log structured data using the provided logger instance.
 */
export function logStructured(
    logger: ILogger,
    level: 'info' | 'warning' | 'error',
    message: string,
    context?: LogContext,
): void {
    const logMessage = context ? `${message} | ${JSON.stringify(context)}` : message;

    switch (level) {
        case 'info':
            logger.info(logMessage);
            break;
        case 'warning':
            logger.warning(logMessage);
            break;
        case 'error':
            logger.error(logMessage);
            break;
    }
}
