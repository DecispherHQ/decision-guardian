module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    verbose: true,
    clearMocks: true,
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': ['ts-jest', {
            useESM: true,
            isolatedModules: true,
        }],
    },
    extensionsToTreatAsEsm: ['.ts']
};
