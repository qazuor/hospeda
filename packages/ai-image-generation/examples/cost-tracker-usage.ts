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

  // 1. Check and reset if new month
  console.log('Checking for new month...');
  const currentUsage = await tracker.resetIfNewMonth(sessionPath);
  console.log(`Current usage: ${currentUsage.mockupCount} mockups, $${currentUsage.totalCost.toFixed(3)}`);

  // 2. Increment usage after generating a mockup
  console.log('\nGenerating mockup...');
  const updatedUsage = await tracker.incrementUsage(sessionPath);
  console.log(`Updated usage: ${updatedUsage.mockupCount} mockups, $${updatedUsage.totalCost.toFixed(3)}`);

  // 3. Check if threshold is reached
  const thresholdCheck = tracker.checkThreshold(updatedUsage);
  if (thresholdCheck.shouldAlert) {
    console.warn(`\n${thresholdCheck.message}`);
  } else {
    console.log(`\n✓ Usage within limits (${updatedUsage.mockupCount}/50 mockups)`);
  }

  // 4. Load current usage data
  console.log('\nLoading usage data...');
  const loadedUsage = await tracker.load(sessionPath);
  console.log('Usage data:', {
    month: loadedUsage.currentMonth,
    count: loadedUsage.mockupCount,
    cost: `$${loadedUsage.totalCost.toFixed(3)}`,
    lastReset: new Date(loadedUsage.lastReset).toLocaleDateString()
  });

  // 5. Example: Simulate reaching threshold
  console.log('\n--- Simulating threshold alert ---');
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
