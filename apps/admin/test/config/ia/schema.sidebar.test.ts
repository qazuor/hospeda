/**
 * Tests for sidebar item schemas (T-003)
 *
 * Covers:
 * - LinkItemSchema: valid link with/without permissions
 * - GroupItemSchema: group with mixed children (link + separator)
 * - CRITICAL: nested group inside a group is rejected
 * - SeparatorItemSchema: requires id, rejects label/permissions fields
 * - SidebarSchema: enforces min 1 item
 */

import {
    GroupItemSchema,
    LinkItemSchema,
    SeparatorItemSchema,
    SidebarSchema
} from '@/config/ia/schema';
import { describe, expect, it } from 'vitest';

// ============================================================================
// Shared fixtures
// ============================================================================

const validLabel = { es: 'Etiqueta', en: 'Label', pt: 'Rótulo' } as const;

const validLink = {
    type: 'link' as const,
    id: 'dashboard',
    label: validLabel,
    route: '/inicio/dashboard'
};

const validLinkWithPerms = {
    ...validLink,
    id: 'aloj-list',
    route: '/catalogo/alojamientos',
    permissions: ['ACCOMMODATION_VIEW_ALL', 'ACCOMMODATION_VIEW_OWN']
};

const validSeparator = { type: 'separator' as const, id: 'sep-1' };

// ============================================================================
// LinkItemSchema
// ============================================================================

describe('LinkItemSchema', () => {
    describe('when given valid input', () => {
        it('should accept a link without permissions', () => {
            // Arrange + Act
            const result = LinkItemSchema.safeParse(validLink);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should accept a link with permissions', () => {
            // Arrange + Act
            const result = LinkItemSchema.safeParse(validLinkWithPerms);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should default exact to false when not provided', () => {
            // Arrange + Act
            const result = LinkItemSchema.safeParse(validLink);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.exact).toBe(false);
            }
        });

        it('should accept exact=true', () => {
            // Arrange
            const input = { ...validLink, exact: true };
            // Act
            const result = LinkItemSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
        });

        it('should default onMissing to "disable" when not provided', () => {
            // Arrange + Act
            const result = LinkItemSchema.safeParse(validLink);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.onMissing).toBe('disable');
            }
        });
    });

    describe('when given invalid input', () => {
        it('should reject a route without a leading slash', () => {
            // Arrange
            const input = { ...validLink, route: 'inicio/dashboard' };
            // Act + Assert
            expect(LinkItemSchema.safeParse(input).success).toBe(false);
        });

        it('should reject missing type', () => {
            // Arrange
            const { type: _type, ...input } = validLink;
            // Act + Assert
            expect(LinkItemSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// SeparatorItemSchema
// ============================================================================

describe('SeparatorItemSchema', () => {
    describe('when given valid input', () => {
        it('should accept a separator with only id', () => {
            // Arrange + Act + Assert
            expect(SeparatorItemSchema.safeParse(validSeparator).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a separator with an empty id', () => {
            // Arrange
            const input = { type: 'separator' as const, id: '' };
            // Act + Assert
            expect(SeparatorItemSchema.safeParse(input).success).toBe(false);
        });

        it('should reject when type is missing', () => {
            // Arrange
            const input = { id: 'sep-1' };
            // Act + Assert
            expect(SeparatorItemSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// GroupItemSchema
// ============================================================================

describe('GroupItemSchema', () => {
    describe('when given valid input', () => {
        it('should accept a group with mixed link and separator children', () => {
            // Arrange
            const input = {
                type: 'group' as const,
                id: 'alojamientos',
                label: validLabel,
                items: [validLinkWithPerms, validSeparator, validLink]
            };
            // Act + Assert
            expect(GroupItemSchema.safeParse(input).success).toBe(true);
        });

        it('should default defaultOpen to false', () => {
            // Arrange
            const input = {
                type: 'group' as const,
                id: 'g1',
                label: validLabel,
                items: [validLink]
            };
            // Act
            const result = GroupItemSchema.safeParse(input);
            // Assert
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.defaultOpen).toBe(false);
            }
        });

        it('should accept a group with defaultOpen=true', () => {
            // Arrange
            const input = {
                type: 'group' as const,
                id: 'g1',
                label: validLabel,
                defaultOpen: true,
                items: [validLink]
            };
            // Act + Assert
            expect(GroupItemSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input — nested group (CRITICAL lock)', () => {
        it('should reject a nested group inside a group', () => {
            // Arrange — GroupChildItemSchema only allows link|separator, not group
            const nestedGroup = {
                type: 'group' as const,
                id: 'nested',
                label: validLabel,
                items: [validLink]
            };
            const input = {
                type: 'group' as const,
                id: 'outer',
                label: validLabel,
                items: [nestedGroup]
            };
            // Act + Assert
            expect(GroupItemSchema.safeParse(input).success).toBe(false);
        });

        it('should reject a group with zero items', () => {
            // Arrange
            const input = {
                type: 'group' as const,
                id: 'empty-group',
                label: validLabel,
                items: []
            };
            // Act + Assert
            expect(GroupItemSchema.safeParse(input).success).toBe(false);
        });
    });
});

// ============================================================================
// SidebarSchema
// ============================================================================

describe('SidebarSchema', () => {
    describe('when given valid input', () => {
        it('should accept a sidebar with one link item', () => {
            // Arrange
            const input = { items: [validLink] };
            // Act + Assert
            expect(SidebarSchema.safeParse(input).success).toBe(true);
        });

        it('should accept a sidebar with a group and separator', () => {
            // Arrange
            const group = {
                type: 'group' as const,
                id: 'alojamientos',
                label: validLabel,
                items: [validLink]
            };
            const input = { items: [group, validSeparator, validLink] };
            // Act + Assert
            expect(SidebarSchema.safeParse(input).success).toBe(true);
        });
    });

    describe('when given invalid input', () => {
        it('should reject a sidebar with zero items', () => {
            // Arrange
            const input = { items: [] };
            // Act + Assert
            expect(SidebarSchema.safeParse(input).success).toBe(false);
        });
    });
});
