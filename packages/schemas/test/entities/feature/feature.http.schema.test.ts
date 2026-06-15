/**
 * Tests for feature HTTP schema converter functions.
 *
 * Verifies:
 * - FeatureSearchHttpSchema coerces string query params to typed fields
 * - httpToDomainFeatureSearch passes boolean flags through
 * - httpToDomainFeatureCreate maps HTTP fields to domain create input
 * - httpToDomainFeatureUpdate maps HTTP fields to domain update input
 */
import { describe, expect, it } from 'vitest';
import {
    FeatureSearchHttpSchema,
    httpToDomainFeatureCreate,
    httpToDomainFeatureSearch,
    httpToDomainFeatureUpdate
} from '../../../src/entities/feature/feature.http.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validI18nName = { es: 'Acceso a internet', en: 'Internet access', pt: 'Acesso à internet' };

// ---------------------------------------------------------------------------
// FeatureSearchHttpSchema — query string parsing
// ---------------------------------------------------------------------------

describe('FeatureSearchHttpSchema — safeParse', () => {
    it('should accept an empty object', () => {
        const result = FeatureSearchHttpSchema.safeParse({});
        expect(result.success).toBe(true);
    });

    it('should accept name and category string filters', () => {
        const result = FeatureSearchHttpSchema.safeParse({
            name: 'WiFi',
            category: 'connectivity'
        });
        expect(result.success).toBe(true);
    });

    it('should coerce isAvailable from string "true" to boolean', () => {
        const result = FeatureSearchHttpSchema.safeParse({ isAvailable: 'true' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isAvailable).toBe(true);
        }
    });

    it('should coerce isPremium from string "false" to boolean', () => {
        const result = FeatureSearchHttpSchema.safeParse({ isPremium: 'false' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isPremium).toBe(false);
        }
    });

    it('should coerce minPriority from string to number', () => {
        const result = FeatureSearchHttpSchema.safeParse({ minPriority: '10', maxPriority: '90' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.minPriority).toBe(10);
            expect(result.data.maxPriority).toBe(90);
        }
    });

    it('should reject minPriority above 100', () => {
        const result = FeatureSearchHttpSchema.safeParse({ minPriority: '101' });
        expect(result.success).toBe(false);
    });

    it('should accept categories as comma-separated string filter', () => {
        const result = FeatureSearchHttpSchema.safeParse({
            categories: 'connectivity,entertainment'
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.categories).toEqual(['connectivity', 'entertainment']);
        }
    });
});

// ---------------------------------------------------------------------------
// httpToDomainFeatureSearch
// ---------------------------------------------------------------------------

describe('httpToDomainFeatureSearch', () => {
    it('should pass through all boolean flags from HTTP params', () => {
        // Arrange
        const parsed = FeatureSearchHttpSchema.parse({
            isAvailable: 'true',
            hasIcon: 'false',
            hasDescription: 'true',
            isPopular: 'false',
            isPremium: 'true',
            requiresPayment: 'false',
            isUnused: 'true'
        });

        // Act
        const result = httpToDomainFeatureSearch(parsed);

        // Assert
        expect(result.isAvailable).toBe(true);
        expect(result.hasIcon).toBe(false);
        expect(result.hasDescription).toBe(true);
        expect(result.isPopular).toBe(false);
        expect(result.isPremium).toBe(true);
        expect(result.requiresPayment).toBe(false);
        expect(result.isUnused).toBe(true);
    });

    it('should pass through text filters', () => {
        // Arrange
        const parsed = FeatureSearchHttpSchema.parse({
            name: 'Pool',
            nameContains: 'ool',
            slug: 'pool'
        });

        // Act
        const result = httpToDomainFeatureSearch(parsed);

        // Assert
        expect(result.name).toBe('Pool');
        expect(result.nameContains).toBe('ool');
        expect(result.slug).toBe('pool');
    });

    it('should handle empty input gracefully', () => {
        // Arrange
        const parsed = FeatureSearchHttpSchema.parse({});

        // Act
        const result = httpToDomainFeatureSearch(parsed);

        // Assert
        expect(result.isAvailable).toBeUndefined();
        expect(result.isPopular).toBeUndefined();
    });
});

// ---------------------------------------------------------------------------
// httpToDomainFeatureCreate
// ---------------------------------------------------------------------------

describe('httpToDomainFeatureCreate', () => {
    it('should map i18n name to domain create input', () => {
        // Arrange
        const httpData = {
            name: validI18nName,
            priority: 60,
            isAvailable: true,
            isPremium: false,
            requiresPayment: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainFeatureCreate(httpData);

        // Assert
        expect(result.name).toEqual(validI18nName);
        expect(result.displayWeight).toBe(50);
    });

    it('should set isBuiltin to false and isFeatured to false by default', () => {
        // Arrange
        const httpData = {
            name: validI18nName,
            priority: 50,
            isAvailable: true,
            isPremium: false,
            requiresPayment: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainFeatureCreate(httpData);

        // Assert
        expect(result.isBuiltin).toBe(false);
        expect(result.isFeatured).toBe(false);
    });

    it('should pass optional slug through when provided', () => {
        // Arrange
        const httpData = {
            name: validI18nName,
            slug: 'internet-access',
            priority: 50,
            isAvailable: true,
            isPremium: false,
            requiresPayment: false,
            displayWeight: 75
        };

        // Act
        const result = httpToDomainFeatureCreate(httpData);

        // Assert
        expect(result.slug).toBe('internet-access');
        expect(result.displayWeight).toBe(75);
    });

    it('should pass optional description through when provided', () => {
        // Arrange
        const validDescription = {
            es: 'Descripción suficientemente larga para pasar validación',
            en: 'Description long enough to pass validation here',
            pt: 'Descrição longa o suficiente para passar na validação'
        };
        const httpData = {
            name: validI18nName,
            description: validDescription,
            priority: 50,
            isAvailable: true,
            isPremium: false,
            requiresPayment: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainFeatureCreate(httpData);

        // Assert
        expect(result.description).toEqual(validDescription);
    });

    it('should pass icon through when provided', () => {
        // Arrange
        const httpData = {
            name: validI18nName,
            icon: 'wifi',
            priority: 50,
            isAvailable: true,
            isPremium: false,
            requiresPayment: false,
            displayWeight: 50
        };

        // Act
        const result = httpToDomainFeatureCreate(httpData);

        // Assert
        expect(result.icon).toBe('wifi');
    });
});

// ---------------------------------------------------------------------------
// httpToDomainFeatureUpdate
// ---------------------------------------------------------------------------

describe('httpToDomainFeatureUpdate', () => {
    it('should map partial update with only name', () => {
        // Arrange
        const httpData = { name: validI18nName };

        // Act
        const result = httpToDomainFeatureUpdate(httpData);

        // Assert
        expect(result.name).toEqual(validI18nName);
        expect(result.slug).toBeUndefined();
        expect(result.icon).toBeUndefined();
    });

    it('should map slug update', () => {
        // Arrange
        const httpData = { slug: 'updated-slug' };

        // Act
        const result = httpToDomainFeatureUpdate(httpData);

        // Assert
        expect(result.slug).toBe('updated-slug');
        expect(result.name).toBeUndefined();
    });

    it('should map displayWeight update', () => {
        // Arrange
        const httpData = { displayWeight: 80 };

        // Act
        const result = httpToDomainFeatureUpdate(httpData);

        // Assert
        expect(result.displayWeight).toBe(80);
    });

    it('should handle empty update payload', () => {
        // Arrange
        const httpData = {};

        // Act
        const result = httpToDomainFeatureUpdate(httpData);

        // Assert
        expect(result.name).toBeUndefined();
        expect(result.slug).toBeUndefined();
        expect(result.description).toBeUndefined();
        expect(result.icon).toBeUndefined();
        expect(result.displayWeight).toBeUndefined();
    });
});
