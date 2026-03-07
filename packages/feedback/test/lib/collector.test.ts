/**
 * Tests for the collectEnvironmentData utility.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { collectEnvironmentData } from '../../src/lib/collector.js';

// ---------------------------------------------------------------------------
// UAParser mock – returns deterministic browser/OS info
// ---------------------------------------------------------------------------
vi.mock('ua-parser-js', () => {
    const mockInstance = {
        getBrowser: () => ({ name: 'Chrome', version: '120.0.0' }),
        getOS: () => ({ name: 'Windows', version: '11' })
    };
    return {
        UAParser: vi.fn().mockImplementation(() => mockInstance)
    };
});

describe('collectEnvironmentData', () => {
    describe('browser environment', () => {
        beforeEach(() => {
            // Simulate a browser-like environment
            vi.stubGlobal('window', {
                location: { href: 'https://example.com/page?q=1' },
                innerWidth: 1920,
                innerHeight: 1080
            });
            vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (mocked)' });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return currentUrl from window.location.href', () => {
            // Arrange / Act
            const result = collectEnvironmentData({ appSource: 'web' });

            // Assert
            expect(result.currentUrl).toBe('https://example.com/page?q=1');
        });

        it('should return viewport as WIDTHxHEIGHT string', () => {
            // Arrange / Act
            const result = collectEnvironmentData({ appSource: 'web' });

            // Assert
            expect(result.viewport).toBe('1920x1080');
        });

        it('should return browser name and version from UAParser', () => {
            // Arrange / Act
            const result = collectEnvironmentData({ appSource: 'web' });

            // Assert
            expect(result.browser).toBe('Chrome 120.0.0');
        });

        it('should return os name and version from UAParser', () => {
            // Arrange / Act
            const result = collectEnvironmentData({ appSource: 'web' });

            // Assert
            expect(result.os).toBe('Windows 11');
        });

        it('should include a valid ISO timestamp', () => {
            // Arrange / Act
            const before = new Date().toISOString();
            const result = collectEnvironmentData({ appSource: 'web' });
            const after = new Date().toISOString();

            // Assert
            expect(result.timestamp >= before).toBe(true);
            expect(result.timestamp <= after).toBe(true);
        });

        it('should pass through appSource', () => {
            const result = collectEnvironmentData({ appSource: 'admin' });
            expect(result.appSource).toBe('admin');
        });

        it('should pass through deployVersion', () => {
            const result = collectEnvironmentData({ appSource: 'web', deployVersion: 'abc1234' });
            expect(result.deployVersion).toBe('abc1234');
        });

        it('should pass through userId', () => {
            const result = collectEnvironmentData({ appSource: 'web', userId: 'usr_001' });
            expect(result.userId).toBe('usr_001');
        });

        it('should pass through consoleErrors array', () => {
            // Arrange
            const errors = ['Error: foo', 'Error: bar'];

            // Act
            const result = collectEnvironmentData({ appSource: 'web', consoleErrors: errors });

            // Assert
            expect(result.consoleErrors).toEqual(errors);
        });

        it('should pass through errorInfo object', () => {
            // Arrange
            const errorInfo = { message: 'Crash', stack: 'at App.tsx:10' };

            // Act
            const result = collectEnvironmentData({ appSource: 'web', errorInfo });

            // Assert
            expect(result.errorInfo).toEqual(errorInfo);
        });

        it('should leave optional input fields undefined when not provided', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.deployVersion).toBeUndefined();
            expect(result.userId).toBeUndefined();
            expect(result.consoleErrors).toBeUndefined();
            expect(result.errorInfo).toBeUndefined();
        });
    });

    describe('SSR environment (no window / navigator)', () => {
        beforeEach(() => {
            // Remove browser globals to simulate SSR
            vi.stubGlobal('window', undefined);
            vi.stubGlobal('navigator', undefined);
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should return undefined for currentUrl', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.currentUrl).toBeUndefined();
        });

        it('should return undefined for viewport', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.viewport).toBeUndefined();
        });

        it('should return undefined for browser', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.browser).toBeUndefined();
        });

        it('should return undefined for os', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.os).toBeUndefined();
        });

        it('should still return appSource and timestamp', () => {
            const result = collectEnvironmentData({ appSource: 'standalone' });
            expect(result.appSource).toBe('standalone');
            expect(result.timestamp).toBeTruthy();
        });

        it('should still pass through all scalar input fields', () => {
            // Arrange
            const input = {
                appSource: 'admin' as const,
                deployVersion: 'v1.0.0',
                userId: 'usr_ssr',
                consoleErrors: ['err1'],
                errorInfo: { message: 'SSR crash' }
            };

            // Act
            const result = collectEnvironmentData(input);

            // Assert
            expect(result.deployVersion).toBe('v1.0.0');
            expect(result.userId).toBe('usr_ssr');
            expect(result.consoleErrors).toEqual(['err1']);
            expect(result.errorInfo).toEqual({ message: 'SSR crash' });
        });
    });
});
