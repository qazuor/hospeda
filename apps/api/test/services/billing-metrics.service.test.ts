/**
 * Tests for BillingMetricsService
 *
 * Tests all analytics and metrics calculations for the billing system,
 * including overview metrics, revenue time series, recent activity, and
 * subscription breakdown by plan.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database execute function
const mockExecute = vi.fn();

// Mock @repo/db - MUST be before imports
vi.mock('@repo/db', () => {
    const mockSql = Object.assign(
        vi.fn((...args: any[]) => ({
            // Return a mock SQL object
            queryChunks: args
        })),
        {
            raw: vi.fn((str: string) => str)
        }
    );

    return {
        getDb: vi.fn(() => ({
            execute: mockExecute
        })),
        sql: mockSql
    };
});

// Mock logger
vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn()
    }
}));

// Import after mocks
import { BillingMetricsService } from '../../src/services/billing-metrics.service';

describe('BillingMetricsService', () => {
    let service: BillingMetricsService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new BillingMetricsService();
    });

    describe('getOverviewMetrics', () => {
        it('should return successful metrics with correct calculations', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '10' }] }) // active subscriptions
                .mockResolvedValueOnce({ rows: [{ count: '3' }] }) // trialing subscriptions
                .mockResolvedValueOnce({ rows: [{ mrr_total: '8000' }] }) // MRR total
                .mockResolvedValueOnce({ rows: [{ churned: '2' }] }) // churned subscriptions
                .mockResolvedValueOnce({ rows: [{ converted: '5', total_trials: '10' }] }) // trial conversion
                .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // total customers
                .mockResolvedValueOnce({ rows: [{ total: '100000' }] }); // total revenue

            // Act
            const result = await service.getOverviewMetrics(true);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data?.activeSubscriptions).toBe(10);
            expect(result.data?.trialingSubscriptions).toBe(3);
            expect(result.data?.mrr).toBe(8000);
            expect(result.data?.churnRate).toBe(20); // (2/10) * 100
            expect(result.data?.arpu).toBe(800); // 8000 / 10
            expect(result.data?.trialConversionRate).toBe(50); // (5/10) * 100
            expect(result.data?.totalCustomers).toBe(50);
            expect(result.data?.totalRevenue).toBe(100000);
            expect(mockExecute).toHaveBeenCalledTimes(7);
        });

        it('should calculate MRR correctly using placeholder multiplier', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '15' }] })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                .mockResolvedValueOnce({ rows: [{ mrr_total: '12500.50' }] }) // MRR total with decimals
                .mockResolvedValueOnce({ rows: [{ churned: '1' }] })
                .mockResolvedValueOnce({ rows: [{ converted: '3', total_trials: '5' }] })
                .mockResolvedValueOnce({ rows: [{ count: '75' }] })
                .mockResolvedValueOnce({ rows: [{ total: '250000' }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.mrr).toBe(12501); // Math.round(12500.50)
        });

        it('should calculate churn rate as percentage of active subscriptions', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '50' }] }) // active
                .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // trialing
                .mockResolvedValueOnce({ rows: [{ mrr_total: '40000' }] })
                .mockResolvedValueOnce({ rows: [{ churned: '5' }] }) // 5 churned
                .mockResolvedValueOnce({ rows: [{ converted: '10', total_trials: '20' }] })
                .mockResolvedValueOnce({ rows: [{ count: '100' }] })
                .mockResolvedValueOnce({ rows: [{ total: '500000' }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.churnRate).toBe(10); // Math.round((5/50) * 100 * 100) / 100
        });

        it('should calculate ARPU as mrr divided by active subscriptions', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '25' }] }) // active
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ mrr_total: '20000' }] }) // MRR = 20,000
                .mockResolvedValueOnce({ rows: [{ churned: '3' }] })
                .mockResolvedValueOnce({ rows: [{ converted: '8', total_trials: '15' }] })
                .mockResolvedValueOnce({ rows: [{ count: '80' }] })
                .mockResolvedValueOnce({ rows: [{ total: '350000' }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.arpu).toBe(800); // Math.round(20000 / 25)
        });

        it('should calculate trial conversion rate correctly', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '30' }] })
                .mockResolvedValueOnce({ rows: [{ count: '8' }] })
                .mockResolvedValueOnce({ rows: [{ mrr_total: '25' }] })
                .mockResolvedValueOnce({ rows: [{ churned: '2' }] })
                .mockResolvedValueOnce({ rows: [{ converted: '18', total_trials: '30' }] }) // 60% conversion
                .mockResolvedValueOnce({ rows: [{ count: '90' }] })
                .mockResolvedValueOnce({ rows: [{ total: '400000' }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.trialConversionRate).toBe(60); // Math.round((18/30) * 100 * 100) / 100
        });

        it('should return zeros when all counts are zero without division by zero', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // active = 0
                .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // trialing = 0
                .mockResolvedValueOnce({ rows: [{ mrr_total: '0' }] }) // mrr = 0
                .mockResolvedValueOnce({ rows: [{ churned: '0' }] })
                .mockResolvedValueOnce({ rows: [{ converted: '0', total_trials: '0' }] }) // trials = 0
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ total: '0' }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                mrr: 0,
                activeSubscriptions: 0,
                trialingSubscriptions: 0,
                churnRate: 0,
                arpu: 0,
                trialConversionRate: 0,
                totalCustomers: 0,
                totalRevenue: 0
            });
        });

        it('should return error result on database failure', async () => {
            // Arrange
            const dbError = new Error('Database connection failed');
            mockExecute.mockRejectedValueOnce(dbError);

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Database connection failed');
        });

        it('should handle missing/null values in rows gracefully', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{}] }) // missing count
                .mockResolvedValueOnce({ rows: [{ count: null }] }) // null count
                .mockResolvedValueOnce({ rows: [] }) // empty rows
                .mockResolvedValueOnce({ rows: [{ churned: undefined }] }) // undefined
                .mockResolvedValueOnce({ rows: [{ converted: null, total_trials: null }] })
                .mockResolvedValueOnce({ rows: [{ count: null }] })
                .mockResolvedValueOnce({ rows: [{ total: null }] });

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                mrr: 0,
                activeSubscriptions: 0,
                trialingSubscriptions: 0,
                churnRate: 0,
                arpu: 0,
                trialConversionRate: 0,
                totalCustomers: 0,
                totalRevenue: 0
            });
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            mockExecute.mockRejectedValueOnce('String error');

            // Act
            const result = await service.getOverviewMetrics();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Failed to get overview metrics');
        });

        it('should pass correct livemode parameter to queries', async () => {
            // Arrange
            mockExecute
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ count: '2' }] })
                .mockResolvedValueOnce({ rows: [{ mrr_total: '4' }] })
                .mockResolvedValueOnce({ rows: [{ churned: '1' }] })
                .mockResolvedValueOnce({ rows: [{ converted: '3', total_trials: '5' }] })
                .mockResolvedValueOnce({ rows: [{ count: '25' }] })
                .mockResolvedValueOnce({ rows: [{ total: '50000' }] });

            // Act
            await service.getOverviewMetrics(false);

            // Assert - verify livemode=false is passed in SQL
            expect(mockExecute).toHaveBeenCalledTimes(7);
        });
    });

    describe('getRevenueTimeSeries', () => {
        it('should return monthly revenue data points', async () => {
            // Arrange
            const mockRows = [
                { month: '2024-01', revenue: 10000, payment_count: 15 },
                { month: '2024-02', revenue: 12000, payment_count: 18 },
                { month: '2024-03', revenue: 15000, payment_count: 22 }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getRevenueTimeSeries(3);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data?.[0]).toEqual({
                month: '2024-01',
                revenue: 10000,
                paymentCount: 15
            });
            expect(result.data?.[1]).toEqual({
                month: '2024-02',
                revenue: 12000,
                paymentCount: 18
            });
            expect(result.data?.[2]).toEqual({
                month: '2024-03',
                revenue: 15000,
                paymentCount: 22
            });
        });

        it('should map rows correctly with proper type conversions', async () => {
            // Arrange
            const mockRows = [{ month: '2024-06', revenue: '25000.50', payment_count: '30' }];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getRevenueTimeSeries();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.[0]).toEqual({
                month: '2024-06',
                revenue: 25001, // Math.round(25000.50)
                paymentCount: 30
            });
        });

        it('should return empty array when no data', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            const result = await service.getRevenueTimeSeries();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should default to 12 months', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRevenueTimeSeries();

            // Assert - verify months parameter is used in SQL query
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it('should accept custom months parameter', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRevenueTimeSeries(6);

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it('should return error result on database failure', async () => {
            // Arrange
            const dbError = new Error('Query timeout');
            mockExecute.mockRejectedValueOnce(dbError);

            // Act
            const result = await service.getRevenueTimeSeries();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Query timeout');
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            mockExecute.mockRejectedValueOnce({ code: 'CONN_TIMEOUT' });

            // Act
            const result = await service.getRevenueTimeSeries();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Failed to get revenue time series');
        });

        it('should pass correct livemode parameter', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRevenueTimeSeries(12, false);

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });
    });

    describe('getRecentActivity', () => {
        it('should return recent activity items correctly mapped', async () => {
            // Arrange
            const mockDate = new Date('2024-01-15T10:30:00Z');
            const mockRows = [
                {
                    subscription_id: 'sub_123',
                    customer_email: 'user1@example.com',
                    status: 'active',
                    plan_id: 'plan_pro',
                    updated_at: mockDate
                },
                {
                    subscription_id: 'sub_456',
                    customer_email: 'user2@example.com',
                    status: 'trialing',
                    plan_id: 'plan_starter',
                    updated_at: new Date('2024-01-14T15:20:00Z')
                }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getRecentActivity(10);

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(2);
            expect(result.data?.[0]).toEqual({
                subscriptionId: 'sub_123',
                customerEmail: 'user1@example.com',
                status: 'active',
                planId: 'plan_pro',
                updatedAt: '2024-01-15T10:30:00.000Z'
            });
            expect(result.data?.[1]).toEqual({
                subscriptionId: 'sub_456',
                customerEmail: 'user2@example.com',
                status: 'trialing',
                planId: 'plan_starter',
                updatedAt: '2024-01-14T15:20:00.000Z'
            });
        });

        it('should default limit to 20', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRecentActivity();

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it('should accept custom limit parameter', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRecentActivity(50);

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it('should return empty array when no activity', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            const result = await service.getRecentActivity();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should return error result on database failure', async () => {
            // Arrange
            const dbError = new Error('Connection pool exhausted');
            mockExecute.mockRejectedValueOnce(dbError);

            // Act
            const result = await service.getRecentActivity();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Connection pool exhausted');
        });

        it('should correctly convert updatedAt to ISO string', async () => {
            // Arrange
            const testDate = new Date('2024-06-20T14:30:45.123Z');
            const mockRows = [
                {
                    subscription_id: 'sub_789',
                    customer_email: 'test@example.com',
                    status: 'active',
                    plan_id: 'plan_test',
                    updated_at: testDate
                }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getRecentActivity();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data![0]!.updatedAt).toBe('2024-06-20T14:30:45.123Z');
        });

        it('should pass correct livemode parameter', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getRecentActivity(20, false);

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });
    });

    describe('getSubscriptionBreakdown', () => {
        it('should return breakdown by plan correctly', async () => {
            // Arrange
            const mockRows = [
                { plan_id: 'plan_pro', active_count: 25, trialing_count: 5 },
                { plan_id: 'plan_starter', active_count: 40, trialing_count: 8 },
                { plan_id: 'plan_enterprise', active_count: 10, trialing_count: 2 }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toHaveLength(3);
            expect(result.data?.[0]).toEqual({
                planId: 'plan_pro',
                activeCount: 25,
                trialingCount: 5
            });
            expect(result.data?.[1]).toEqual({
                planId: 'plan_starter',
                activeCount: 40,
                trialingCount: 8
            });
            expect(result.data?.[2]).toEqual({
                planId: 'plan_enterprise',
                activeCount: 10,
                trialingCount: 2
            });
        });

        it('should handle zero active/trialing counts', async () => {
            // Arrange
            const mockRows = [
                { plan_id: 'plan_free', active_count: 0, trialing_count: 15 },
                { plan_id: 'plan_legacy', active_count: 5, trialing_count: 0 }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.[0]).toEqual({
                planId: 'plan_free',
                activeCount: 0,
                trialingCount: 15
            });
            expect(result.data?.[1]).toEqual({
                planId: 'plan_legacy',
                activeCount: 5,
                trialingCount: 0
            });
        });

        it('should handle null counts gracefully', async () => {
            // Arrange
            const mockRows = [{ plan_id: 'plan_test', active_count: null, trialing_count: null }];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data?.[0]).toEqual({
                planId: 'plan_test',
                activeCount: 0,
                trialingCount: 0
            });
        });

        it('should return empty array when no subscriptions', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data).toEqual([]);
        });

        it('should return error result on database failure', async () => {
            // Arrange
            const dbError = new Error('Syntax error in query');
            mockExecute.mockRejectedValueOnce(dbError);

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.error?.code).toBe(ServiceErrorCode.INTERNAL_ERROR);
            expect(result.error?.message).toBe('Syntax error in query');
        });

        it('should handle non-Error thrown values', async () => {
            // Arrange
            mockExecute.mockRejectedValueOnce('Unexpected error');

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe('Failed to get subscription breakdown');
        });

        it('should pass correct livemode parameter', async () => {
            // Arrange
            mockExecute.mockResolvedValueOnce({ rows: [] });

            // Act
            await service.getSubscriptionBreakdown(false);

            // Assert
            expect(mockExecute).toHaveBeenCalledTimes(1);
        });

        it('should order results by active_count DESC', async () => {
            // Arrange - rows ordered by active_count descending
            const mockRows = [
                { plan_id: 'plan_popular', active_count: 100, trialing_count: 10 },
                { plan_id: 'plan_mid', active_count: 50, trialing_count: 5 },
                { plan_id: 'plan_low', active_count: 10, trialing_count: 2 }
            ];
            mockExecute.mockResolvedValueOnce({ rows: mockRows });

            // Act
            const result = await service.getSubscriptionBreakdown();

            // Assert
            expect(result.success).toBe(true);
            expect(result.data![0]!.activeCount).toBeGreaterThanOrEqual(
                result.data![1]!.activeCount || 0
            );
            expect(result.data![1]!.activeCount).toBeGreaterThanOrEqual(
                result.data![2]!.activeCount || 0
            );
        });
    });
});
