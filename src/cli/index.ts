#!/usr/bin/env node
import { parseArgs } from 'util';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { runCheck } from './commands/check';
import { runInit } from './commands/init';
import { runTemplate, listTemplates } from './commands/template';

function getVersion(): string {
    const candidates = [
        join(__dirname, '..', '..', 'package.json'),
        join(__dirname, '..', 'package.json'),
    ];
    for (const p of candidates) {
        if (existsSync(p)) {
            return JSON.parse(readFileSync(p, 'utf-8')).version;
        }
    }
    return 'unknown';
}

const VERSION = getVersion();

const HELP = `
decision-guardian v${VERSION}

Usage:
  decision-guardian check <path>    Check a decision file against local changes
  decision-guardian checkall        Auto-discover and check all .decispher/ files
  decision-guardian init            Scaffold .decispher/ directory
  decision-guardian template <name> Print a decision file template

Check flags:
  --staged            Compare staged changes (default)
  --branch <base>     Compare against a branch
  --all               Compare all uncommitted changes
  --fail-on-critical  Exit 1 if critical decisions are triggered

Template names:
  basic, advanced-rules, security, database, api

Global flags:
  --help, -h          Show this help
  --version, -v       Show version
`;

function main(): void {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        strict: false,
        options: {
            help: { type: 'boolean', short: 'h' },
            version: { type: 'boolean', short: 'v' },
            staged: { type: 'boolean' },
            branch: { type: 'string' },
            all: { type: 'boolean' },
            'fail-on-critical': { type: 'boolean' },
            template: { type: 'string', short: 't' },
            output: { type: 'string', short: 'o' },
            list: { type: 'boolean' },
        },
    });

    if (values.help) {
        console.log(HELP);
        process.exit(0);
    }

    if (values.version) {
        console.log(VERSION);
        process.exit(0);
    }

    const command = positionals[0];

    if (!command) {
        console.log(HELP);
        process.exit(0);
    }

    switch (command) {
        case 'check': {
            const filePath = positionals[1];
            if (!filePath) {
                console.error('Error: check requires a path argument\n');
                console.log('Usage: decision-guardian check <path> [--staged|--branch <base>|--all]');
                process.exit(1);
            }
            const mode = values.branch ? 'branch' : values.all ? 'all' : 'staged';
            runCheck({
                decisionFile: filePath,
                mode: mode as 'staged' | 'branch' | 'all',
                baseBranch: values.branch as string | undefined,
                failOnCritical: !!values['fail-on-critical'],
            });
            break;
        }

        case 'checkall': {
            const mode = values.branch ? 'branch' : values.all ? 'all' : 'staged';
            runCheck({
                decisionFile: '.decispher/',
                mode: mode as 'staged' | 'branch' | 'all',
                baseBranch: values.branch as string | undefined,
                failOnCritical: !!values['fail-on-critical'],
            });
            break;
        }

        case 'init': {
            const templateName = (values.template as string) || 'basic';
            runInit(templateName);
            break;
        }

        case 'template': {
            if (values.list) {
                listTemplates();
                break;
            }
            const name = positionals[1];
            if (!name) {
                console.error('Error: template requires a name\n');
                console.log('Available: basic, advanced-rules, security, database, api');
                console.log('Usage: decision-guardian template <name> [--output <path>]');
                process.exit(1);
            }
            runTemplate(name, values.output as string | undefined);
            break;
        }

        default:
            console.error(`Unknown command: ${command}\n`);
            console.log(HELP);
            process.exit(1);
    }
}

main();
