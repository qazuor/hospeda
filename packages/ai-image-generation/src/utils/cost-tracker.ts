/**
 * Cost tracking and usage monitoring for AI image generation
 *
 * Tracks monthly mockup generation usage and costs to prevent overspending.
 *
 * @module utils/cost-tracker
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Usage data structure for tracking mockup generation
 */
export interface UsageData {
    /** Current month in YYYY-MM format */
    currentMonth: string;
    /** Number of mockups generated this month */
    mockupCount: number;
    /** Total cost accumulated this month (USD) */
    totalCost: number;
    /** ISO timestamp of last reset */
    lastReset: string;
}

/**
 * Threshold check result
 */
export interface ThresholdResult {
    /** Whether an alert should be shown */
    shouldAlert: boolean;
    /** Alert message if threshold exceeded */
    message?: string;
}

/**
 * Cost per image for FLUX.1 schnell model (USD)
 */
const COST_PER_IMAGE = 0.003;

/**
 * Monthly mockup limit
 */
const MONTHLY_LIMIT = 50;

/**
 * Alert threshold (80% of limit)
 */
const ALERT_THRESHOLD = 40;

/**
 * Registry filename for usage tracking
 */
const USAGE_FILE = '.usage-tracking.json';

/**
 * CostTracker - Monitors Replicate API usage and costs
 *
 * Provides monthly usage tracking, cost calculation, and threshold alerts
 * to prevent overspending on AI image generation.
 *
 * @example
 * ```ts
 * const tracker = new CostTracker();
 *
 * // Increment usage after generating mockup
 * const usage = await tracker.incrementUsage(sessionPath);
 *
 * // Check if threshold reached
 * const check = tracker.checkThreshold(usage);
 * if (check.shouldAlert) {
 *   console.warn(check.message);
 * }
 * ```
 */
export class CostTracker {
    /**
     * Loads usage data from registry file
     *
     * Creates new file with default data if it doesn't exist.
     * Handles corrupted JSON gracefully by returning default data.
     *
     * @param sessionPath - Path to session directory (where .usage-tracking.json is stored)
     * @returns Usage data for current or new tracking period
     *
     * @example
     * ```ts
     * const tracker = new CostTracker();
     * const data = await tracker.load('.claude/sessions/planning/P-005');
     * console.log(`Used ${data.mockupCount} mockups this month`);
     * ```
     */
    async load(sessionPath: string): Promise<UsageData> {
        try {
            // Ensure directory exists
            await fs.mkdir(sessionPath, { recursive: true });

            const filePath = path.join(sessionPath, USAGE_FILE);

            // Try to read existing file
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content) as UsageData;

            return data;
        } catch (_error) {
            // File doesn't exist or is corrupted - return default data
            return this.createDefaultUsageData();
        }
    }

    /**
     * Saves usage data to registry file
     *
     * Creates directory structure if it doesn't exist.
     * Formats JSON with 2-space indentation for readability.
     *
     * @param usageData - Usage data to save
     * @param sessionPath - Path to session directory
     *
     * @example
     * ```ts
     * const tracker = new CostTracker();
     * const data: UsageData = {
     *   currentMonth: '2025-11',
     *   mockupCount: 10,
     *   totalCost: 0.03,
     *   lastReset: new Date().toISOString()
     * };
     * await tracker.save(data, sessionPath);
     * ```
     */
    async save(usageData: UsageData, sessionPath: string): Promise<void> {
        try {
            // Ensure directory exists
            await fs.mkdir(sessionPath, { recursive: true });

            const filePath = path.join(sessionPath, USAGE_FILE);

            // Write with 2-space indentation
            await fs.writeFile(filePath, JSON.stringify(usageData, null, 2), 'utf-8');
        } catch (error) {
            // Log error but don't throw - cost tracking failures should not block generation
            console.error(`Failed to save usage data: ${(error as Error).message}`);
        }
    }

    /**
     * Increments mockup usage count and updates cost
     *
     * Automatically resets if new month detected.
     * Persists updated data to file.
     *
     * Cost calculation: $0.003 per image (FLUX.1 schnell model)
     *
     * @param sessionPath - Path to session directory
     * @returns Updated usage data
     *
     * @example
     * ```ts
     * const tracker = new CostTracker();
     *
     * // After successful mockup generation
     * const usage = await tracker.incrementUsage(sessionPath);
     * console.log(`Total: ${usage.mockupCount} mockups, $${usage.totalCost.toFixed(3)}`);
     * ```
     */
    async incrementUsage(sessionPath: string): Promise<UsageData> {
        try {
            // Load current data (or create new)
            let usageData = await this.load(sessionPath);

            // Check if we need to reset for new month
            const currentMonth = this.getCurrentMonth();
            if (usageData.currentMonth !== currentMonth) {
                usageData = this.resetUsageData();
            }

            // Increment count and cost
            usageData.mockupCount += 1;
            usageData.totalCost = this.roundCost(usageData.totalCost + COST_PER_IMAGE);
            usageData.lastReset = new Date().toISOString();

            // Persist to file
            await this.save(usageData, sessionPath);

            return usageData;
        } catch (error) {
            // If anything fails, return incremented default data
            console.error(`Failed to increment usage: ${(error as Error).message}`);
            return {
                currentMonth: this.getCurrentMonth(),
                mockupCount: 1,
                totalCost: COST_PER_IMAGE,
                lastReset: new Date().toISOString()
            };
        }
    }

    /**
     * Checks if usage threshold has been reached
     *
     * Alert triggers at 40 mockups (80% of 50 monthly limit).
     * Does not block generation, only provides warning message.
     *
     * @param usageData - Current usage data
     * @returns Threshold check result with alert message if applicable
     *
     * @example
     * ```ts
     * const tracker = new CostTracker();
     * const usage = await tracker.load(sessionPath);
     * const check = tracker.checkThreshold(usage);
     *
     * if (check.shouldAlert) {
     *   console.warn(check.message);
     * }
     * ```
     */
    checkThreshold(usageData: UsageData): ThresholdResult {
        if (usageData.mockupCount >= ALERT_THRESHOLD) {
            return {
                shouldAlert: true,
                message: `⚠️ High usage alert: ${usageData.mockupCount}/${MONTHLY_LIMIT} mockups used this month ($${usageData.totalCost.toFixed(2)} spent). Consider reviewing mockup necessity.`
            };
        }

        return {
            shouldAlert: false
        };
    }

    /**
     * Resets usage data if new month detected
     *
     * Automatically checks current month vs stored month.
     * Resets count and cost if month has changed.
     * Updates currentMonth and lastReset fields.
     *
     * @param sessionPath - Path to session directory
     * @returns Updated (or unchanged) usage data
     *
     * @example
     * ```ts
     * const tracker = new CostTracker();
     *
     * // At start of each operation, check for month change
     * const usage = await tracker.resetIfNewMonth(sessionPath);
     * console.log(`Current period: ${usage.currentMonth}`);
     * ```
     */
    async resetIfNewMonth(sessionPath: string): Promise<UsageData> {
        try {
            // Load current data
            let usageData = await this.load(sessionPath);

            // Check if month changed
            const currentMonth = this.getCurrentMonth();
            if (usageData.currentMonth !== currentMonth) {
                // Reset for new month
                usageData = this.resetUsageData();

                // Persist reset data
                await this.save(usageData, sessionPath);
            }

            return usageData;
        } catch (error) {
            // If anything fails, return default data
            console.error(`Failed to reset for new month: ${(error as Error).message}`);
            return this.createDefaultUsageData();
        }
    }

    /**
     * Gets current month in YYYY-MM format
     */
    private getCurrentMonth(): string {
        return new Date().toISOString().slice(0, 7);
    }

    /**
     * Creates default usage data for new tracking period
     */
    private createDefaultUsageData(): UsageData {
        return {
            currentMonth: this.getCurrentMonth(),
            mockupCount: 0,
            totalCost: 0,
            lastReset: new Date().toISOString()
        };
    }

    /**
     * Resets usage data for new month
     */
    private resetUsageData(): UsageData {
        return {
            currentMonth: this.getCurrentMonth(),
            mockupCount: 0,
            totalCost: 0,
            lastReset: new Date().toISOString()
        };
    }

    /**
     * Rounds cost to avoid floating point precision errors
     *
     * Rounds to 3 decimal places (0.001 precision)
     */
    private roundCost(cost: number): number {
        return Math.round(cost * 1000) / 1000;
    }
}
