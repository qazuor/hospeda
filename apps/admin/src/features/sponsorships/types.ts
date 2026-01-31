import type { Sponsorship, SponsorshipLevel, SponsorshipPackage } from '@repo/schemas';

/**
 * Extended sponsorship with related data
 */
export interface SponsorshipWithRelations extends Sponsorship {
    sponsorUser?: {
        id: string;
        name: string;
        email: string;
    };
    level?: {
        name: string;
        tier: string;
    };
    target?: {
        id: string;
        title?: string;
        name?: string;
    };
}

/**
 * Sponsorship filters for UI
 */
export interface SponsorshipFilters {
    status?: string;
    targetType?: string;
    page?: number;
    limit?: number;
}

/**
 * Sponsorship level filters for UI
 */
export interface SponsorshipLevelFilters {
    targetType?: string;
    tier?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
}

/**
 * Sponsorship package filters for UI
 */
export interface SponsorshipPackageFilters {
    isActive?: boolean;
    page?: number;
    limit?: number;
}

export type { Sponsorship, SponsorshipLevel, SponsorshipPackage };
