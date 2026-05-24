/**
 * Tests for TabSchema and TabsConfigSchema (T-004)
 *
 * Covers:
 * - 9 tabs accepted (max boundary)
 * - 10 tabs rejected (exceeds max)
 * - 0 tabs rejected (violates min 1)
 * - Tab without permissions is valid
 */

import { TabSchema, TabsConfigSchema } from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Shared fixtures
// ============================================================================

const validLabel = { es: 'Pestaña', en: 'Tab', pt: 'Aba' } as const;

const makeTab = (id: string) => ({ id, label: validLabel });

// ============================================================================
// TabSchema
// ============================================================================

describe('TabSchema', () => {
    describe('when given valid input', () => {
        it('should accept a tab without permissions', () => {
            // Arrange
            const input = makeTab('overview');
            // Act + Assert
            expect(TabSchema.safeParse(input).success).toBe(true);
        });

        it('should accept a tab with permissions', () => {
            // Arrange
            const input = {
                ...makeTab('gallery'),
                permissions: ['ACCOMMODATION_MEDIA_VIEW'],
                onMissing: 'hide' as const
            };
            // Act + Assert
            expect(TabSchema.safeParse(input).success).toBe(true);
        });

        it('should default onMissing to "disable" when not provided', () => {
            // Arrange + Act
            const result = TabSchema.safeParse(makeTab('info'));
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onMissing).toBe('disable');
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject a tab with an empty id', () => {
            // Arrange
            const input = { id: '', label: validLabel };
            // Act + Assert
            expect(TabSchema.safeParse(input).success).toBe(false);
        });

        it('should reject a tab missing the label', () => {
            // Arrange
            const input = { id: 'overview' };
            // Act + Assert
            expect(TabSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// TabsConfigSchema
// ============================================================================

describe('TabsConfigSchema', () => {
    describe('when given valid input', () => {
        it('should accept exactly 9 tabs (max boundary)', () => {
            // Arrange
            const tabs = Array.from({ length: 9 }, (_, i) => makeTab(`tab-${i}`));
            const input = { entity: 'accommodation', tabs };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept 1 tab (min boundary)', () => {
            // Arrange
            const input = { entity: 'post', tabs: [makeTab('content')] };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(true);
        });

        it('should accept a tab config without permissions on any tab', () => {
            // Arrange
            const input = {
                entity: 'event',
                tabs: [makeTab('info'), makeTab('schedule')]
            };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject 10 tabs (exceeds max of 9)', () => {
            // Arrange
            const tabs = Array.from({ length: 10 }, (_, i) => makeTab(`tab-${i}`));
            const input = { entity: 'accommodation', tabs };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject 0 tabs (violates min 1)', () => {
            // Arrange
            const input = { entity: 'accommodation', tabs: [] };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject a missing entity field', () => {
            // Arrange
            const input = { tabs: [makeTab('info')] };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(false);
        });

        it('should reject an empty entity string', () => {
            // Arrange
            const input = { entity: '', tabs: [makeTab('info')] };
            // Act + Assert
            expect(TabsConfigSchema.safeParse(input).success).toBe(false);
        });
    });
});
