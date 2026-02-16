/**
 * ConsoleLogger — ILogger implementation for CLI usage.
 */
import type { ILogger } from '../../core/interfaces/logger';

// ANSI color codes
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';

export class ConsoleLogger implements ILogger {
    private groupDepth = 0;

    info(message: string): void {
        const indent = this.getIndent();
        console.log(`${indent}${BLUE}ℹ${RESET} ${message}`);
    }

    warning(message: string): void {
        const indent = this.getIndent();
        console.warn(`${indent}${YELLOW}⚠${RESET} ${YELLOW}${message}${RESET}`);
    }

    error(message: string): void {
        const indent = this.getIndent();
        console.error(`${indent}${RED}✖${RESET} ${RED}${message}${RESET}`);
    }

    debug(message: string): void {
        if (process.env.DEBUG || process.env.VERBOSE) {
            const indent = this.getIndent();
            console.log(`${indent}${GRAY}[debug]${RESET} ${GRAY}${message}${RESET}`);
        }
    }

    startGroup(name: string): void {
        const indent = this.getIndent();
        console.log(`${indent}${BOLD}${CYAN}▸ ${name}${RESET}`);
        this.groupDepth++;
    }

    endGroup(): void {
        if (this.groupDepth > 0) {
            this.groupDepth--;
        }
    }

    private getIndent(): string {
        return '  '.repeat(this.groupDepth);
    }
}
