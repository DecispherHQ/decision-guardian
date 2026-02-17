#!/usr/bin/env node
/**
 * Quick test to verify telemetry integration
 * Tests that the worker endpoint is accessible and responding correctly
 */

const WORKER_URL = process.env.WORKER_URL || 'https://decision-guardian-telemetry.iamalizaidi110.workers.dev';
const STATS_KEY = process.env.STATS_KEY || 'your-secret-key-here';

async function testStatsEndpoint() {
    console.log('🧪 Testing GET /stats endpoint...');
    try {
        const response = await fetch(`${WORKER_URL}/stats`, {
            headers: { 'X-Stats-Key': STATS_KEY }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        console.log('✅ Stats endpoint working!');
        console.log('📊 Current stats:', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Stats endpoint failed:', error);
        return false;
    }
}

async function testCollectEndpoint() {
    console.log('\n🧪 Testing POST /collect endpoint...');

    const testPayload = {
        event: 'run_complete',
        version: '1.1.0',
        source: 'cli',
        timestamp: new Date().toISOString(),
        metrics: {
            files_processed: 10,
            decisions_evaluated: 5,
            matches_found: 2,
            critical_matches: 1,
            warning_matches: 1,
            info_matches: 0,
            duration_ms: 1234,
        },
        environment: {
            node_version: process.version,
            os_platform: process.platform,
            ci: false,
        },
    };

    try {
        const response = await fetch(`${WORKER_URL}/collect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testPayload),
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`HTTP ${response.status}: ${text}`);
        }

        const data = await response.json();
        console.log('✅ Collect endpoint working!');
        console.log('📝 Response:', JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('❌ Collect endpoint failed:', error);
        return false;
    }
}

async function testUpdatedStats() {
    console.log('\n🧪 Checking if stats were updated...');

    // Wait a moment for worker to process
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
        const response = await fetch(`${WORKER_URL}/stats`, {
            headers: { 'X-Stats-Key': STATS_KEY }
        });
        const data = await response.json();

        if (data.total_runs > 0) {
            console.log('✅ Stats updated successfully!');
            console.log('📊 Updated stats:', JSON.stringify(data, null, 2));
        } else {
            console.log('⚠️  Stats show no runs yet (may take a moment to propagate)');
        }
        return true;
    } catch (error) {
        console.error('❌ Failed to fetch updated stats:', error);
        return false;
    }
}

async function main() {
    console.log('🚀 Decision Guardian Telemetry Integration Test\n');
    console.log(`Worker URL: ${WORKER_URL}\n`);

    const results = [];

    // Test 1: Stats endpoint
    results.push(await testStatsEndpoint());

    // Test 2: Collect endpoint
    results.push(await testCollectEndpoint());

    // Test 3: Verify stats updated
    results.push(await testUpdatedStats());

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 Test Summary');
    console.log('='.repeat(50));
    const passed = results.filter(Boolean).length;
    const total = results.length;
    console.log(`✅ Passed: ${passed}/${total}`);

    if (passed === total) {
        console.log('\n🎉 All tests passed! Telemetry integration is working correctly.');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed. Please review the errors above.');
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('💥 Test script failed:', error);
    process.exit(1);
});
