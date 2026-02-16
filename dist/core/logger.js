"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStructured = logStructured;
/**
 * Log structured data using the provided logger instance.
 */
function logStructured(logger, level, message, context) {
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
