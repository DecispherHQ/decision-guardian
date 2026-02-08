const { minimatch } = require('minimatch');

const file = 'src/utils/logs/error.log';
const pattern = 'src/utils/{logs,temp}/*.log';

const options = {
    dot: true,
    matchBase: false,
    nocase: false,
    nobrace: false,
};

const result = minimatch(file, pattern, options);
console.log(`File: ${file}`);
console.log(`Pattern: ${pattern}`);
console.log(`Options:`, options);
console.log(`Match Result: ${result}`);

// Test alternative options if failed
if (!result) {
    console.log('--- Retrying with default options ---');
    console.log(`Result (defaults): ${minimatch(file, pattern)}`);
}
