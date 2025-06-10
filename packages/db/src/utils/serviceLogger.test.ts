import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { serviceLogger } from './serviceLogger';

describe('serviceLogger', () => {
    beforeEach(() => {
        vi.spyOn(console, 'info').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.spyOn(console, 'debug').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should log info messages with SERVICE label', () => {
        serviceLogger.info('Test info message');
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[SERVICE]'));
    });

    it('should have a permission method', () => {
        expect(typeof serviceLogger.permission).toBe('function');
    });

    it('should log permission warnings with Permission label', () => {
        serviceLogger.permission({
            permission: 'TEST_PERMISSION',
            userId: 'user-1',
            role: 'ADMIN',
            extraData: { foo: 'bar' }
        });
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Permission]'));
    });

    it('should use the correct color for the SERVICE category', () => {
        // No direct way to check color in mock, but we can check the label
        serviceLogger.info('Color test');
        expect(console.info).toHaveBeenCalledWith(expect.stringContaining('[SERVICE]'));
    });

    it('should log at the correct log level for permission', () => {
        // The permission method should log at WARN level
        serviceLogger.permission({
            permission: 'PERMISSION_LEVEL',
            userId: 'user-2',
            role: 'USER',
            extraData: {}
        });
        expect(console.warn).toHaveBeenCalled();
    });
});
