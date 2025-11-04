/**
 * Example usage of CostTracker
 *
 * This example demonstrates how to use the CostTracker utility
 * to monitor AI image generation costs and usage.
 */

import { CostTracker } from '../src/utils/cost-tracker';

async function main() {
    const tracker = new CostTracker();
    const sessionPath = '.claude/sessions/planning/P-005';
    const _currentUsage = await tracker.resetIfNewMonth(sessionPath);
    const updatedUsage = await tracker.incrementUsage(sessionPath);

    // 3. Check if threshold is reached
    const thresholdCheck = tracker.checkThreshold(updatedUsage);
    if (thresholdCheck.shouldAlert) {
        console.warn(`\n${thresholdCheck.message}`);
    } else {
    }
    const _loadedUsage = await tracker.load(sessionPath);
    const highUsage = {
        currentMonth: '2025-11',
        mockupCount: 42,
        totalCost: 0.126,
        lastReset: new Date().toISOString()
    };

    const alertCheck = tracker.checkThreshold(highUsage);
    if (alertCheck.shouldAlert) {
        console.warn(alertCheck.message);
    }
}

// Run example
main().catch(console.error);
