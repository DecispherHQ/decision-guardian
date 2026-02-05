import * as dotenv from 'dotenv';
import * as path from 'path';
import { DecisionParser } from '../src/parser';
import { FileMatcher } from '../src/matcher';
import { getChangedFiles } from '../src/github-utils';

import { CommentManager } from '../src/comment';

// Load environment variables
dotenv.config();

async function runE2E() {
    console.log('🤖 Starting Decision Guardian E2E Test');

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

    try {
        // 2. Parse Decisions
        // Resolve absolute path if needed, or assume relative to CWD
        // For E2E, we might want to point to a specific file or the repo's file
        // Here we assume running from project root
        console.log(`\n📂 Loading decisions from: ${decisionFile}`);
        const parser = new DecisionParser();
        const parseResult = await parser.parseFile(decisionFile);

        if (parseResult.errors.length > 0) {
            console.error(`❌ Found ${parseResult.errors.length} parse errors:`);
            parseResult.errors.forEach(e => console.error(`   Line ${e.line}: ${e.message}`));
            // We might want to continue depending on test goals, but let's stop for now on errors
            process.exit(1);
        }
        console.log(`✅ Loaded ${parseResult.decisions.length} decisions`);

        // 3. Fetch Changed Files
        console.log(`\n⬇️ Fetching changed files for PR #${prNumber} in ${owner}/${repo}...`);
        const files = await getChangedFiles(token, { owner, repo, pull_number: prNumber });
        console.log(`✅ Found ${files.length} changed files`);
        files.forEach(f => console.log(`   - ${f}`));

        // 4. Match
        console.log(`\n🔍 Matching against decisions...`);
        const matcher = new FileMatcher(parseResult.decisions);
        const matches = await matcher.findMatches(files);
        const grouped = matcher.groupBySeverity(matches);

        console.log(`\n📊 Results:`);
        console.log(`   - Matches: ${matches.length}`);
        console.log(`   - Critical: ${grouped.critical.length}`);
        console.log(`   - Warning: ${grouped.warning.length}`);
        console.log(`   - Info: ${grouped.info.length}`);

        if (matches.length > 0) {
            console.log(`\n📋 Matches Details:`);
            matches.forEach(m => {
                console.log(`   [${m.decision.severity.toUpperCase()}] ${m.file} (Matches: ${m.matchedPattern}) -> ${m.decision.title}`);
            });

            // 5. Post Comment (if enabled)
            if (process.env.POST_COMMENT === 'true') {
                console.log(`\n💬 Posting comment to PR #${prNumber}...`);
                // CommentManager imported statically at top
                console.log(`\n💬 Posting comment to PR #${prNumber}...`);
                const commentManager = new CommentManager(token);
                await commentManager.postAlert(matches, { owner, repo, number: prNumber });
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
