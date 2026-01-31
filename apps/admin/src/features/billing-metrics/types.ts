/**
 * Customer search result
 */
export interface CustomerSearchResult {
    id: string;
    email: string;
    name: string | null;
    category: 'owner' | 'complex' | 'tourist';
    planSlug: string | null;
    planName: string | null;
}

/**
 * Limit usage information
 */
export interface LimitUsage {
    limitKey: string;
    limitName: string;
    limitDescription: string;
    currentValue: number;
    maxValue: number;
    percentage: number;
    unit: string;
}

/**
 * Customer usage summary
 */
export interface CustomerUsageSummary {
    customer: CustomerSearchResult;
    limits: LimitUsage[];
    totalLimits: number;
    limitsAtCapacity: number;
}

/**
 * Plan usage statistics
 */
export interface PlanUsageStats {
    planSlug: string;
    planName: string;
    customerCount: number;
    averageUsage: Record<string, number>; // limitKey -> average percentage
}

/**
 * System-wide usage statistics
 */
export interface SystemUsageStats {
    totalCustomers: number;
    customersByCategory: Record<'owner' | 'complex' | 'tourist', number>;
    planStats: PlanUsageStats[];
    topLimits: Array<{
        limitKey: string;
        limitName: string;
        averageUsage: number;
        customersAtCapacity: number;
    }>;
}

/**
 * Customer approaching limit
 */
export interface CustomerApproachingLimit {
    customerId: string;
    customerEmail: string;
    customerName: string | null;
    category: 'owner' | 'complex' | 'tourist';
    planSlug: string | null;
    planName: string | null;
    limitKey: string;
    limitName: string;
    currentValue: number;
    maxValue: number;
    percentage: number;
}

/**
 * Approaching limits response
 */
export interface ApproachingLimitsResponse {
    threshold: number;
    customers: CustomerApproachingLimit[];
    totalCustomers: number;
}
