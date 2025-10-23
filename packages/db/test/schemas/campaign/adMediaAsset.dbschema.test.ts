import { describe, expect, it } from 'vitest';
import {
    adMediaAssetRelations,
    adMediaAssets
} from '../../../src/schemas/campaign/adMediaAsset.dbschema';

describe('AD_MEDIA_ASSET Database Schema - Fase 2.6', () => {
    describe('schema compilation', () => {
        it('should import adMediaAsset schema without errors', () => {
            expect(adMediaAssets).toBeDefined();
            expect(typeof adMediaAssets).toBe('object');
        });

        it('should import adMediaAsset relations without errors', () => {
            expect(adMediaAssetRelations).toBeDefined();
            expect(typeof adMediaAssetRelations).toBe('object');
        });

        it('should have valid table structure', () => {
            // The schema should be a valid Drizzle table object
            expect(adMediaAssets).toBeDefined();
            expect(typeof adMediaAssets).toBe('object');
            // Basic validation that it's a proper table definition
            expect(adMediaAssets).toHaveProperty('id');
        });

        it('should have expected columns for ad media asset', () => {
            expect(adMediaAssets).toHaveProperty('id');
            expect(adMediaAssets).toHaveProperty('campaignId');
            expect(adMediaAssets).toHaveProperty('type');
            expect(adMediaAssets).toHaveProperty('url');
            expect(adMediaAssets).toHaveProperty('specs');
            expect(adMediaAssets).toHaveProperty('createdAt');
            expect(adMediaAssets).toHaveProperty('updatedAt');
            expect(adMediaAssets).toHaveProperty('createdById');
            expect(adMediaAssets).toHaveProperty('updatedById');
            expect(adMediaAssets).toHaveProperty('deletedAt');
            expect(adMediaAssets).toHaveProperty('deletedById');
            expect(adMediaAssets).toHaveProperty('adminInfo');
        });
    });
});
