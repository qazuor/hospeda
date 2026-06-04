import { describe, expect, it } from 'vitest';

describe('@repo/ai-core barrel', () => {
    describe('when the package is imported', () => {
        it('should import without throwing', async () => {
            // Arrange — dynamic import so any top-level side-effect error surfaces
            // Act
            const act = () => import('../src/index.js');

            // Assert
            await expect(act()).resolves.toBeDefined();
        });

        it('should export a module object (not null/undefined)', async () => {
            // Arrange + Act
            const mod = await import('../src/index.js');

            // Assert
            expect(mod).toBeDefined();
            expect(typeof mod).toBe('object');
        });
    });
});
