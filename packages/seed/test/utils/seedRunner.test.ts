import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHistory } from '../../src/utils/errorHistory.js';
import { IdMapper } from '../../src/utils/idMapper.js';
import { logger } from '../../src/utils/logger.js';
import { createSeedContext, type SeedContext } from '../../src/utils/seedContext.js';
import { seedRunner } from '../../src/utils/seedRunner.js';

/**
 * Builds a minimal `SeedContext` for exercising `seedRunner` directly,
 * bypassing `createSeedFactory` entirely so each branch can be triggered
 * with precise, isolated inputs.
 */
function buildContext(overrides?: Partial<SeedContext>): SeedContext {
    return createSeedContext({
        idMapper: new IdMapper(true),
        ...overrides
    });
}

describe('seedRunner', () => {
    beforeEach(() => {
        vi.spyOn(logger, 'info').mockImplementation(() => undefined);
        vi.spyOn(logger, 'success').mockImplementation(() => undefined);
        vi.spyOn(logger, 'error').mockImplementation(() => undefined);
        vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        vi.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('skips processing an undefined item without calling process or logging success for it', async () => {
        // Arrange
        const process = vi.fn().mockResolvedValue(undefined);
        const context = buildContext();

        // Act
        await seedRunner({
            entityName: 'Widgets',
            items: [undefined],
            process,
            context
        });

        // Assert: the undefined slot is skipped entirely
        expect(process).not.toHaveBeenCalled();
    });

    it('logs the default entity label when getEntityInfo is not provided', async () => {
        // Arrange
        const process = vi.fn().mockResolvedValue(undefined);
        const successSpy = vi.spyOn(logger, 'success').mockImplementation(() => undefined);
        const context = buildContext();

        // Act
        await seedRunner({
            entityName: 'Widgets',
            items: [{ id: 'w1' }],
            process,
            context
            // no getEntityInfo passed
        });

        // Assert: falls back to "Widgets #1" instead of a custom entity label
        const successCall = successSpy.mock.calls.find((call) =>
            String((call[0] as { msg: string }).msg).includes('Widgets #1')
        );
        expect(successCall).toBeDefined();
        expect((successCall?.[0] as { msg: string }).msg).toMatch(/^\[1 of 1\] - .* Widgets #1$/);
    });

    it('records the error with a default label, calls onError, and continues without throwing when continueOnError is true', async () => {
        // Arrange
        const process = vi.fn().mockRejectedValue(new Error('boom'));
        const onError = vi.fn();
        const recordErrorSpy = vi
            .spyOn(errorHistory, 'recordError')
            .mockImplementation(() => undefined);
        // No currentFile set on context, so the fallback file label is used.
        const context = buildContext({ continueOnError: true });

        // Act: should resolve, not reject, because continueOnError is true
        await expect(
            seedRunner({
                entityName: 'Widgets',
                items: [{ id: 'w1' }],
                process,
                context,
                onError
                // no getEntityInfo passed -> default "Widgets #1" label used in the error path too
            })
        ).resolves.toBeUndefined();

        // Assert: errorHistory recorded with the default entity label and fallback file name
        expect(recordErrorSpy).toHaveBeenCalledWith(
            'Widgets',
            'item-1',
            expect.stringContaining('Failed to process Widgets #1: boom'),
            expect.any(Error)
        );
        // Assert: onError was invoked with the original item, index and error
        expect(onError).toHaveBeenCalledWith({ id: 'w1' }, 0, expect.any(Error));
    });

    it('logs a warning summary (not a success summary) when errors occurred but continueOnError allowed completion', async () => {
        // Arrange
        const process = vi.fn().mockRejectedValue(new Error('boom'));
        const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
        const successSpy = vi.spyOn(logger, 'success').mockImplementation(() => undefined);
        vi.spyOn(errorHistory, 'recordError').mockImplementation(() => undefined);
        const context = buildContext({ continueOnError: true });

        // Act
        await seedRunner({
            entityName: 'Widgets',
            items: [{ id: 'w1' }],
            process,
            context
        });

        // Assert: the final summary line reports "0 successful, 1 errors" via logger.warn,
        // never the all-success logger.success summary
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('0 successful, 1 errors'));
        const finalSuccessSummaryCalls = successSpy.mock.calls.filter((call) =>
            String((call[0] as { msg: string }).msg).includes('items processed successfully')
        );
        expect(finalSuccessSummaryCalls).toHaveLength(0);
    });

    it('re-throws the error and stops processing when continueOnError is false', async () => {
        // Arrange
        const process = vi.fn().mockRejectedValue(new Error('fatal'));
        vi.spyOn(errorHistory, 'recordError').mockImplementation(() => undefined);
        const context = buildContext({ continueOnError: false });

        // Act + Assert
        await expect(
            seedRunner({
                entityName: 'Widgets',
                items: [{ id: 'w1' }, { id: 'w2' }],
                process,
                context
            })
        ).rejects.toThrow('fatal');

        // Assert: processing stopped after the first item, the second was never attempted
        expect(process).toHaveBeenCalledTimes(1);
    });
});
