/**
 * Shared test utilities for Decision Guardian tests.
 */
import type { ILogger } from '../src/core/interfaces/logger';

/**
 * Creates a mock ILogger for testing.
 * All methods are jest.fn() so they can be asserted against.
 */
export function createMockLogger(): ILogger {
    return {
        debug: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(),
        startGroup: jest.fn(),
        endGroup: jest.fn(),
    };
}
