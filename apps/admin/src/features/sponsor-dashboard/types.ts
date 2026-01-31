/**
 * Sponsor Dashboard Types
 */

export interface SponsorSummary {
    activeSponsorships: number;
    totalImpressions: number;
    totalClicks: number;
    revenue: number;
}

export interface SponsorSponsorship {
    id: string;
    targetType: 'EVENT' | 'POST';
    targetId: string;
    targetName: string;
    levelName: string;
    levelTier: string;
    status: 'PENDING' | 'ACTIVE' | 'EXPIRED' | 'CANCELLED';
    startsAt: string;
    endsAt: string;
    impressions: number;
    clicks: number;
}

export interface SponsorActivity {
    id: string;
    type: 'sponsorship_created' | 'sponsorship_approved' | 'sponsorship_expired' | 'coupon_used';
    description: string;
    timestamp: string;
}

export interface SponsorAnalytics {
    period: string;
    impressions: number;
    clicks: number;
    couponUsage: number;
}

export interface SponsorInvoice {
    id: string;
    invoiceNumber: string;
    date: string;
    amount: number;
    status: 'draft' | 'open' | 'paid' | 'void';
    pdfUrl?: string;
}

export interface SponsorshipFilters {
    status?: string;
    targetType?: string;
    page?: number;
    limit?: number;
}
