"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleLogger = void 0;
// ANSI color codes
const RESET = '\x1b[0m';
const BLUE = '\x1b[34m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const CYAN = '\x1b[36m';
class ConsoleLogger {
    groupDepth = 0;
    info(message) {
        const indent = this.getIndent();
        console.log(`${indent}${BLUE}ℹ${RESET} ${message}`);
    }
    warning(message) {
        const indent = this.getIndent();
        console.warn(`${indent}${YELLOW}⚠${RESET} ${YELLOW}${message}${RESET}`);
    }
    error(message) {
        const indent = this.getIndent();
        console.error(`${indent}${RED}✖${RESET} ${RED}${message}${RESET}`);
    }
    debug(message) {
        if (process.env.DEBUG || process.env.VERBOSE) {
            const indent = this.getIndent();
            console.log(`${indent}${GRAY}[debug]${RESET} ${GRAY}${message}${RESET}`);
        }
    }
    startGroup(name) {
        const indent = this.getIndent();
        console.log(`${indent}${BOLD}${CYAN}▸ ${name}${RESET}`);
        this.groupDepth++;
    }
    endGroup() {
        if (this.groupDepth > 0) {
            this.groupDepth--;
        }
    }
    getIndent() {
        return '  '.repeat(this.groupDepth);
    }
}
exports.ConsoleLogger = ConsoleLogger;
