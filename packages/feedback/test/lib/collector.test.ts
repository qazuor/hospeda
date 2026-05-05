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
                location: {
                    href: 'https://example.com/page?q=1',
                    origin: 'https://example.com',
                    pathname: '/page'
                },
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
            expect(result.currentUrl).toBe('https://example.com/page');
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

    describe('extended environment fields', () => {
        beforeEach(() => {
            vi.stubGlobal('window', {
                location: {
                    href: 'https://example.com/page?q=1',
                    origin: 'https://example.com',
                    pathname: '/page'
                },
                innerWidth: 1920,
                innerHeight: 1080,
                matchMedia: (query: string) => ({
                    matches: query.includes('dark'),
                    media: query
                }),
                localStorage: {
                    length: 3,
                    key: (i: number) =>
                        ['feature_dark_mode', 'ff_beta_panel', 'unrelated_key'][i] ?? null,
                    getItem: (k: string) => {
                        if (k === 'feature_dark_mode') return 'on';
                        if (k === 'ff_beta_panel') return 'true';
                        if (k === 'unrelated_key') return 'should-be-ignored';
                        return null;
                    }
                }
            });
            vi.stubGlobal('navigator', {
                userAgent: 'Mozilla/5.0 (mocked)',
                language: 'es-AR',
                connection: { effectiveType: '4g' }
            });
            vi.stubGlobal('document', {
                documentElement: { dataset: {} }
            });
        });

        afterEach(() => {
            vi.unstubAllGlobals();
        });

        it('should collect locale from navigator.language', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.locale).toBe('es-AR');
        });

        it('should collect a non-empty timezone', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(typeof result.timezone).toBe('string');
            expect((result.timezone ?? '').length).toBeGreaterThan(0);
        });

        it('should derive deviceType=desktop for wide viewports', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.deviceType).toBe('desktop');
        });

        it('should derive deviceType=mobile for narrow viewports', () => {
            vi.stubGlobal('window', {
                location: { origin: 'https://example.com', pathname: '/' },
                innerWidth: 480,
                innerHeight: 800,
                matchMedia: () => ({ matches: false }),
                localStorage: { length: 0, key: () => null, getItem: () => null }
            });
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.deviceType).toBe('mobile');
        });

        it('should derive deviceType=tablet for mid viewports', () => {
            vi.stubGlobal('window', {
                location: { origin: 'https://example.com', pathname: '/' },
                innerWidth: 800,
                innerHeight: 1024,
                matchMedia: () => ({ matches: false }),
                localStorage: { length: 0, key: () => null, getItem: () => null }
            });
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.deviceType).toBe('tablet');
        });

        it('should collect connectionType from navigator.connection', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.connectionType).toBe('4g');
        });

        it('should resolve colorScheme from prefers-color-scheme media query', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.colorScheme).toBe('dark');
        });

        it('should prefer document.documentElement.dataset.theme over media query', () => {
            vi.stubGlobal('document', {
                documentElement: { dataset: { theme: 'light' } }
            });
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.colorScheme).toBe('light');
        });

        it('should extract feature flags from localStorage with default prefixes', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.featureFlags).toEqual({
                feature_dark_mode: 'on',
                ff_beta_panel: 'true'
            });
            expect(result.featureFlags?.unrelated_key).toBeUndefined();
        });

        it('should respect a custom featureFlagPrefixes override', () => {
            const result = collectEnvironmentData({
                appSource: 'web',
                featureFlagPrefixes: ['unrelated_']
            });
            expect(result.featureFlags).toEqual({
                unrelated_key: 'should-be-ignored'
            });
        });

        it('should pass through navigationHistory and lastInteractions inputs', () => {
            const result = collectEnvironmentData({
                appSource: 'web',
                navigationHistory: ['/a', '/b'],
                lastInteractions: [
                    { type: 'BUTTON', selector: '#btn', timestamp: '2026-05-04T12:00:00Z' }
                ]
            });
            expect(result.navigationHistory).toEqual(['/a', '/b']);
            expect(result.lastInteractions).toHaveLength(1);
        });

        it('should pass through sentryEventId', () => {
            const result = collectEnvironmentData({
                appSource: 'web',
                sentryEventId: 'abc123def456'
            });
            expect(result.sentryEventId).toBe('abc123def456');
        });

        it('should truncate feature flag values to 200 characters', () => {
            const longValue = 'x'.repeat(500);
            vi.stubGlobal('window', {
                location: { origin: 'https://example.com', pathname: '/' },
                innerWidth: 1920,
                innerHeight: 1080,
                matchMedia: () => ({ matches: false }),
                localStorage: {
                    length: 1,
                    key: (i: number) => (i === 0 ? 'feature_long' : null),
                    getItem: (k: string) => (k === 'feature_long' ? longValue : null)
                }
            });
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.featureFlags?.feature_long).toHaveLength(200);
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

        it('should return undefined for the extended browser-only fields', () => {
            const result = collectEnvironmentData({ appSource: 'web' });
            expect(result.locale).toBeUndefined();
            expect(result.deviceType).toBeUndefined();
            expect(result.connectionType).toBeUndefined();
            expect(result.colorScheme).toBeUndefined();
            expect(result.featureFlags).toBeUndefined();
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
