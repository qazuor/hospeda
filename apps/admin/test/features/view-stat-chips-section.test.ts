/**
 * Section-wiring tests for view-stat chips (SPEC-197 T-016).
 *
 * Coverage:
 * - Chips section is present in view mode config for accommodation, post, event.
 * - Chips section is absent in edit mode for all three entities.
 * - Chips section has `customRender` (not a standard field section).
 * - Chips section has id === 'view-stat-chips'.
 *
 * These tests operate at the consolidated-config level; they do NOT render
 * React components, keeping them fast and independent of the test DOM.
 */

import { describe, expect, it, vi } from 'vitest';
import { filterSectionsByMode } from '../../src/components/entity-form/utils/section-filter.utils';
import { createAccommodationConsolidatedConfig } from '../../src/features/accommodations/config/accommodation-consolidated.config';
import { createEventConsolidatedConfig } from '../../src/features/events/config/event-consolidated.config';
import { createPostConsolidatedConfig } from '../../src/features/posts/config/post-consolidated.config';

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

const ENTITY_ID = 'test-entity-uuid-0001';

const mockAccommodationTypeOptions = [
    { value: 'HOTEL', label: 'Hotel' },
    { value: 'CABIN', label: 'Cabin' }
];

// ---------------------------------------------------------------------------
// Accommodation
// ---------------------------------------------------------------------------

describe('createAccommodationConsolidatedConfig — view-stat chips section (AC-22)', () => {
    it('should include view-stat-chips section when entityId is provided', () => {
        // Arrange + Act
        const config = createAccommodationConsolidatedConfig(
            mockT,
            mockAccommodationTypeOptions,
            ENTITY_ID
        );

        // Assert
        const chipsSection = config.sections.find((s) => s.id === 'view-stat-chips');
        expect(chipsSection).toBeDefined();
    });

    it('should NOT include view-stat-chips section when entityId is omitted', () => {
        // Arrange + Act
        const config = createAccommodationConsolidatedConfig(mockT, mockAccommodationTypeOptions);

        // Assert
        const chipsSection = config.sections.find((s) => s.id === 'view-stat-chips');
        expect(chipsSection).toBeUndefined();
    });

    it('chips section should appear in view mode', () => {
        // Arrange
        const config = createAccommodationConsolidatedConfig(
            mockT,
            mockAccommodationTypeOptions,
            ENTITY_ID
        );

        // Act
        const viewSections = filterSectionsByMode(config.sections, 'view');

        // Assert
        expect(viewSections.find((s) => s.id === 'view-stat-chips')).toBeDefined();
    });

    it('chips section should NOT appear in edit mode (AC-22)', () => {
        // Arrange
        const config = createAccommodationConsolidatedConfig(
            mockT,
            mockAccommodationTypeOptions,
            ENTITY_ID
        );

        // Act
        const editSections = filterSectionsByMode(config.sections, 'edit');

        // Assert
        expect(editSections.find((s) => s.id === 'view-stat-chips')).toBeUndefined();
    });

    it('chips section should have customRender function', () => {
        // Arrange
        const config = createAccommodationConsolidatedConfig(
            mockT,
            mockAccommodationTypeOptions,
            ENTITY_ID
        );
        const chipsSection = config.sections.find((s) => s.id === 'view-stat-chips');

        // Assert
        expect(typeof chipsSection?.customRender).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Post
// ---------------------------------------------------------------------------

describe('createPostConsolidatedConfig — view-stat chips section (AC-22)', () => {
    it('should include view-stat-chips section when entityId is provided', () => {
        // Arrange + Act
        const config = createPostConsolidatedConfig(mockT, ENTITY_ID);

        // Assert
        expect(config.sections.find((s) => s.id === 'view-stat-chips')).toBeDefined();
    });

    it('should NOT include view-stat-chips when entityId is omitted', () => {
        // Arrange + Act
        const config = createPostConsolidatedConfig(mockT);

        // Assert
        expect(config.sections.find((s) => s.id === 'view-stat-chips')).toBeUndefined();
    });

    it('chips section appears in view mode for post', () => {
        // Arrange
        const config = createPostConsolidatedConfig(mockT, ENTITY_ID);

        // Act
        const viewSections = filterSectionsByMode(config.sections, 'view');

        // Assert
        expect(viewSections.find((s) => s.id === 'view-stat-chips')).toBeDefined();
    });

    it('chips section absent in edit mode for post (AC-22)', () => {
        // Arrange
        const config = createPostConsolidatedConfig(mockT, ENTITY_ID);

        // Act
        const editSections = filterSectionsByMode(config.sections, 'edit');

        // Assert
        expect(editSections.find((s) => s.id === 'view-stat-chips')).toBeUndefined();
    });

    it('chips section has customRender for post', () => {
        // Arrange
        const config = createPostConsolidatedConfig(mockT, ENTITY_ID);
        const chipsSection = config.sections.find((s) => s.id === 'view-stat-chips');

        // Assert
        expect(typeof chipsSection?.customRender).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

describe('createEventConsolidatedConfig — view-stat chips section (AC-22)', () => {
    it('should include view-stat-chips section when entityId is provided', () => {
        // Arrange + Act
        const config = createEventConsolidatedConfig(mockT, ENTITY_ID);

        // Assert
        expect(config.sections.find((s) => s.id === 'view-stat-chips')).toBeDefined();
    });

    it('should NOT include view-stat-chips when entityId is omitted', () => {
        // Arrange + Act
        const config = createEventConsolidatedConfig(mockT);

        // Assert
        expect(config.sections.find((s) => s.id === 'view-stat-chips')).toBeUndefined();
    });

    it('chips section appears in view mode for event', () => {
        // Arrange
        const config = createEventConsolidatedConfig(mockT, ENTITY_ID);

        // Act
        const viewSections = filterSectionsByMode(config.sections, 'view');

        // Assert
        expect(viewSections.find((s) => s.id === 'view-stat-chips')).toBeDefined();
    });

    it('chips section absent in edit mode for event (AC-22)', () => {
        // Arrange
        const config = createEventConsolidatedConfig(mockT, ENTITY_ID);

        // Act
        const editSections = filterSectionsByMode(config.sections, 'edit');

        // Assert
        expect(editSections.find((s) => s.id === 'view-stat-chips')).toBeUndefined();
    });

    it('chips section has customRender for event', () => {
        // Arrange
        const config = createEventConsolidatedConfig(mockT, ENTITY_ID);
        const chipsSection = config.sections.find((s) => s.id === 'view-stat-chips');

        // Assert
        expect(typeof chipsSection?.customRender).toBe('function');
    });
});
