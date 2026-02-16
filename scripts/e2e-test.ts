import * as dotenv from 'dotenv';
import * as path from 'path';
import * as github from '@actions/github';
import { DecisionParser } from '../src/core/parser';
import { FileMatcher } from '../src/core/matcher';
import { GitHubProvider } from '../src/adapters/github/github-provider';
import { ConsoleLogger } from '../src/adapters/local/console-logger';

// Load environment variables
dotenv.config();

async function runE2E() {
    console.log('🤖 Starting Decision Guardian E2E Test');

    const logger = new ConsoleLogger();

    // 1. Validate Env Vars
    const token = process.env.GITHUB_TOKEN;
    const repoString = process.env.GITHUB_REPOSITORY;
    const prNumberString = process.env.PR_NUMBER;
    const decisionFile = process.env.DECISION_FILE || '.decispher/decisions.md';

    if (!token) {
        console.error('❌ Missing GITHUB_TOKEN');
        process.exit(1);
    }
    if (!repoString) {
        console.error('❌ Missing GITHUB_REPOSITORY (format: owner/repo)');
        process.exit(1);
    }
    if (!prNumberString) {
        console.error('❌ Missing PR_NUMBER');
        process.exit(1);
    }

    const [owner, repo] = repoString.split('/');
    if (!owner || !repo) {
        console.error('❌ Invalid GITHUB_REPOSITORY format. Expected owner/repo');
        process.exit(1);
    }

    const prNumber = parseInt(prNumberString, 10);
    if (isNaN(prNumber)) {
        console.error('❌ Invalid PR_NUMBER');
        process.exit(1);
    }

    // MOCK CONTEXT for GitHubProvider
    Object.defineProperty(github.context, 'repo', {
        get: () => ({ owner, repo }),
        configurable: true
    });
    github.context.payload = {
        pull_request: {
            number: prNumber
        }
    } as any;

    try {
        // 2. Parse Decisions
        console.log(`\n📂 Loading decisions from: ${decisionFile}`);
        const parser = new DecisionParser();
        const parseResult = await parser.parseFile(decisionFile);

        if (parseResult.errors.length > 0) {
            console.error(`❌ Found ${parseResult.errors.length} parse errors:`);
            parseResult.errors.forEach(e => console.error(`   Line ${e.line}: ${e.message}`));
            process.exit(1);
        }
        console.log(`✅ Loaded ${parseResult.decisions.length} decisions`);

        // 3. Fetch Changed Files
        console.log(`\n⬇️ Fetching changed files for PR #${prNumber} in ${owner}/${repo}...`);

        const provider = new GitHubProvider(token, logger);
        const files = await provider.getChangedFiles();

        console.log(`✅ Found ${files.length} changed files`);
        files.forEach(f => console.log(`   - ${f}`));

        // 4. Match
        console.log(`\n🔍 Matching against decisions...`);
        const matcher = new FileMatcher(parseResult.decisions, logger);

        // We need diffs for advanced matching, but if getting diffs is complex, we fallback to simple matching
        // provider.getFileDiffs() gets diffs.
        let matches;
        try {
            const fileDiffs = await provider.getFileDiffs();
            matches = await matcher.findMatchesWithDiffs(fileDiffs);
        } catch (e) {
            console.warn('⚠️ Could not fetch file diffs, falling back to simple file matching');
            matches = await matcher.findMatches(files);
        }

        const grouped = matcher.groupBySeverity(matches);

        console.log(`\n📊 Results:`);
        console.log(`   - Matches: ${matches.length}`);
        console.log(`   - Critical: ${grouped.critical.length}`);
        console.log(`   - Warning: ${grouped.warning.length}`);
        console.log(`   - Info: ${grouped.info.length}`);

        if (matches.length > 0) {
            console.log(`\n📋 Matches Details:`);
            matches.forEach(m => {
                console.log(`   [${m.decision.severity.toUpperCase()}] ${m.file} -> ${m.decision.title}`);
            });

            // 5. Post Comment (if enabled)
            if (process.env.POST_COMMENT === 'true') {
                console.log(`\n💬 Posting comment to PR #${prNumber}...`);
                await provider.postComment(matches);
                console.log(`✅ Comment posted successfully`);
            } else {
                console.log(`\nℹ️  Skipping comment posting (set POST_COMMENT=true to enable)`);
            }
        }

        console.log('\n✅ E2E Test Completed Successfully');

    } catch (error) {
        console.error('\n❌ E2E System Error:', error);
        process.exit(1);
    }
}


runE2E();
