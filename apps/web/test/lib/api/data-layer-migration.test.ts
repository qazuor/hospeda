/**
 * Tests verifying the complete data layer migration from web-old to web-new.
 * Uses file-content-based assertions to confirm all exports and structures exist.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = resolve(__dirname, '../../../src/lib');
const API = resolve(SRC, 'api');

function readFile(path: string): string {
    return readFileSync(path, 'utf8');
}

describe('Data Layer Migration', () => {
    describe('endpoints.ts - destinationsApi methods', () => {
        const content = readFile(resolve(API, 'endpoints.ts'));

        it('should have getByPath method', () => {
            expect(content).toContain('getByPath(');
            expect(content).toContain('destinations/by-path');
        });

        it('should have getChildren method', () => {
            expect(content).toContain('getChildren(');
            expect(content).toContain('/children');
        });

        it('should have getDescendants method', () => {
            expect(content).toContain('getDescendants(');
            expect(content).toContain('/descendants');
        });

        it('should have getAncestors method', () => {
            expect(content).toContain('getAncestors(');
            expect(content).toContain('/ancestors');
        });

        it('should have getBreadcrumb method', () => {
            expect(content).toContain('getBreadcrumb(');
            expect(content).toContain('/breadcrumb');
        });

        it('should have getAccommodations method', () => {
            expect(content).toContain('getAccommodations(');
            expect(content).toContain('/accommodations');
        });
    });

    describe('endpoints-protected.ts - API namespaces and interfaces', () => {
        const content = readFile(resolve(API, 'endpoints-protected.ts'));

        it('should export authApi', () => {
            expect(content).toContain('export const authApi');
        });

        it('should export userBookmarksApi', () => {
            expect(content).toContain('export const userBookmarksApi');
        });

        it('should export userApi', () => {
            expect(content).toContain('export const userApi');
        });

        it('should export billingApi', () => {
            expect(content).toContain('export const billingApi');
        });

        it('should export tagsApi', () => {
            expect(content).toContain('export const tagsApi');
        });

        it('should export plansApi', () => {
            expect(content).toContain('export const plansApi');
        });

        it('should export exchangeRatesApi', () => {
            expect(content).toContain('export const exchangeRatesApi');
        });

        it('should export SubscriptionData interface', () => {
            expect(content).toContain('export interface SubscriptionData');
        });

        it('should export InvoiceItem interface', () => {
            expect(content).toContain('export interface InvoiceItem');
        });

        it('should export PaymentItem interface', () => {
            expect(content).toContain('export interface PaymentItem');
        });

        it('should export UsageSummary interface', () => {
            expect(content).toContain('export interface UsageSummary');
        });

        it('should export UserAddon interface', () => {
            expect(content).toContain('export interface UserAddon');
        });

        it('should export PlanItem interface', () => {
            expect(content).toContain('export interface PlanItem');
        });

        it('should export ExchangeRateItem interface', () => {
            expect(content).toContain('export interface ExchangeRateItem');
        });
    });

    describe('transforms.ts - new types and functions', () => {
        const content = readFile(resolve(API, 'transforms.ts'));

        it('should export AccommodationDetailedCardData interface', () => {
            expect(content).toContain('export interface AccommodationDetailedCardData');
        });

        it('should export toAccommodationDetailedProps function', () => {
            expect(content).toContain('export function toAccommodationDetailedProps');
        });

        it('should have expanded DestinationCardData with attractions', () => {
            expect(content).toContain('readonly attractions?');
        });

        it('should have expanded DestinationCardData with gallery', () => {
            expect(content).toContain('readonly gallery?');
        });

        it('should have expanded DestinationCardData with coordinates', () => {
            expect(content).toContain('readonly coordinates?');
        });

        it('should have expanded DestinationCardData with ratingDimensions', () => {
            expect(content).toContain('readonly ratingDimensions?');
        });

        it('should map attractions in toDestinationCardProps', () => {
            expect(content).toContain('attractions?.map');
        });
    });

    describe('index.ts - barrel re-exports', () => {
        const content = readFile(resolve(API, 'index.ts'));

        it('should re-export from client', () => {
            expect(content).toContain("from './client'");
        });

        it('should re-export from endpoints', () => {
            expect(content).toContain("from './endpoints'");
        });

        it('should re-export from endpoints-protected', () => {
            expect(content).toContain("from './endpoints-protected'");
        });

        it('should re-export from transforms', () => {
            expect(content).toContain("from './transforms'");
        });

        it('should re-export from types', () => {
            expect(content).toContain("from './types'");
        });

        it('should re-export AccommodationDetailedCardData type', () => {
            expect(content).toContain('AccommodationDetailedCardData');
        });
    });

    describe('tiptap-renderer.ts', () => {
        const content = readFile(resolve(SRC, 'tiptap-renderer.ts'));

        it('should export TiptapMark interface', () => {
            expect(content).toContain('export interface TiptapMark');
        });

        it('should export TiptapNode interface', () => {
            expect(content).toContain('export interface TiptapNode');
        });

        it('should export TiptapDocument interface', () => {
            expect(content).toContain('export interface TiptapDocument');
        });

        it('should export renderTiptapContent function', () => {
            expect(content).toContain('export function renderTiptapContent');
        });

        it('should escape HTML to prevent XSS', () => {
            expect(content).toContain('escapeHtml');
            expect(content).toContain('&amp;');
        });
    });

    describe('pricing-plans.ts', () => {
        const content = readFile(resolve(SRC, 'pricing-plans.ts'));

        it('should export PricingPlan interface', () => {
            expect(content).toContain('export interface PricingPlan');
        });

        it('should export fetchTouristPlans function', () => {
            expect(content).toContain('export async function fetchTouristPlans');
        });

        it('should export fetchOwnerPlans function', () => {
            expect(content).toContain('export async function fetchOwnerPlans');
        });

        it('should re-export fallback plans', () => {
            expect(content).toContain('export { TOURIST_FALLBACK_PLANS, OWNER_FALLBACK_PLANS }');
        });
    });

    describe('pricing-fallbacks.ts', () => {
        const content = readFile(resolve(SRC, 'pricing-fallbacks.ts'));

        it('should export TOURIST_FALLBACK_PLANS', () => {
            expect(content).toContain('export const TOURIST_FALLBACK_PLANS');
        });

        it('should export OWNER_FALLBACK_PLANS', () => {
            expect(content).toContain('export const OWNER_FALLBACK_PLANS');
        });

        it('should export TOURIST_CTA_LABELS', () => {
            expect(content).toContain('export const TOURIST_CTA_LABELS');
        });

        it('should export OWNER_CTA_LABELS', () => {
            expect(content).toContain('export const OWNER_CTA_LABELS');
        });

        it('should export OWNER_CTA_SUFFIX', () => {
            expect(content).toContain('export const OWNER_CTA_SUFFIX');
        });

        it('should have plans for all 3 locales', () => {
            expect(content).toContain('es:');
            expect(content).toContain('en:');
            expect(content).toContain('pt:');
        });
    });

    describe('owners-page-data.ts', () => {
        const content = readFile(resolve(SRC, 'owners-page-data.ts'));

        it('should export OWNER_HERO constant', () => {
            expect(content).toContain('export const OWNER_HERO');
        });

        it('should export OWNER_BENEFITS constant', () => {
            expect(content).toContain('export const OWNER_BENEFITS');
        });

        it('should export OWNER_HOW_IT_WORKS constant', () => {
            expect(content).toContain('export const OWNER_HOW_IT_WORKS');
        });

        it('should export OWNER_FAQ constant', () => {
            expect(content).toContain('export const OWNER_FAQ');
        });

        it('should export OWNER_FINAL_CTA constant', () => {
            expect(content).toContain('export const OWNER_FINAL_CTA');
        });

        it('should export OwnerHeroContent interface', () => {
            expect(content).toContain('export interface OwnerHeroContent');
        });

        it('should export OwnerBenefit interface', () => {
            expect(content).toContain('export interface OwnerBenefit');
        });

        it('should export OwnerStep interface', () => {
            expect(content).toContain('export interface OwnerStep');
        });

        it('should export OwnerFaqItem interface', () => {
            expect(content).toContain('export interface OwnerFaqItem');
        });

        it('should export OwnerFinalCtaContent interface', () => {
            expect(content).toContain('export interface OwnerFinalCtaContent');
        });
    });
});
