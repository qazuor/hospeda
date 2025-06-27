import type { AccommodationType, DestinationType } from '@repo/types';
import { z } from 'zod';

export const GetAccommodationsInputSchema = z.object({
    destinationId: z.string().min(1)
});
export type GetAccommodationsInput = z.infer<typeof GetAccommodationsInputSchema>;

export const GetStatsInputSchema = z.object({
    destinationId: z.string().min(1)
});
export type GetStatsInput = z.infer<typeof GetStatsInputSchema>;

export const GetSummaryInputSchema = z.object({
    destinationId: z.string().min(1)
});
export type GetSummaryInput = z.infer<typeof GetSummaryInputSchema>;

export type DestinationStats = {
    accommodationsCount: number;
    reviewsCount: number;
    averageRating: number;
    // Add more stats fields as needed
};

export type DestinationSummary = {
    destination: DestinationType;
    stats: DestinationStats;
    accommodations: AccommodationType[];
    highlights?: string[];
};

export type DestinationSummaryType = {
    id: string;
    slug: string;
    name: string;
    country: string;
    media: DestinationType['media'];
    location: DestinationType['location'];
    isFeatured: boolean;
    averageRating: number;
    reviewsCount: number;
    accommodationsCount: number;
};
