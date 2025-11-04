// biome-ignore lint/suspicious/noConsoleLog: This is a test script that requires console output for validation results
/**
 * End-to-End Test for Mockup Generation System
 *
 * This script performs a complete validation of the mockup generation workflow:
 * 1. Validates environment configuration
 * 2. Generates a real mockup via Replicate API
 * 3. Verifies file outputs (image + metadata)
 * 4. Validates cost tracking updates
 * 5. Reports results
 *
 * Usage:
 *   pnpm tsx packages/ai-image-generation/examples/e2e-test.ts
 *
 * Requirements:
 *   - REPLICATE_API_TOKEN must be set in .env.local
 *   - Internet connection for API calls
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Load .env.local from project root
config({ path: join(process.cwd(), '.env.local') });

import { MockupGenerator } from '../src/core/mockup-generator';
import type { UsageData } from '../src/utils/cost-tracker';

// ANSI color codes for terminal output
const colors = {
	reset: '\x1b[0m',
	bright: '\x1b[1m',
	red: '\x1b[31m',
	green: '\x1b[32m',
	yellow: '\x1b[33m',
	blue: '\x1b[34m',
	magenta: '\x1b[35m',
	cyan: '\x1b[36m',
};

/**
 * Print formatted section header
 */
function printHeader(text: string): void {
	console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}`);
	console.log(`${colors.bright}${colors.cyan}${text}${colors.reset}`);
	console.log(`${colors.bright}${colors.cyan}${'='.repeat(70)}${colors.reset}\n`);
}

/**
 * Print success message
 */
function printSuccess(text: string): void {
	console.log(`${colors.green}✓${colors.reset} ${text}`);
}

/**
 * Print error message
 */
function printError(text: string): void {
	console.log(`${colors.red}✗${colors.reset} ${text}`);
}

/**
 * Print warning message
 */
function printWarning(text: string): void {
	console.log(`${colors.yellow}⚠${colors.reset} ${text}`);
}

/**
 * Print info message
 */
function printInfo(text: string): void {
	console.log(`${colors.blue}ℹ${colors.reset} ${text}`);
}

/**
 * Validate environment configuration
 */
function validateEnvironment(): { valid: boolean; token?: string } {
	printHeader('🔍 STEP 1: Validating Environment');

	const token = process.env.REPLICATE_API_TOKEN;

	if (!token) {
		printError('REPLICATE_API_TOKEN not found in environment');
		printInfo('Please set REPLICATE_API_TOKEN in your .env file');
		return { valid: false };
	}

	if (!token.startsWith('r8_')) {
		printWarning('REPLICATE_API_TOKEN does not start with "r8_"');
		printInfo('This might not be a valid Replicate token');
	}

	printSuccess(`REPLICATE_API_TOKEN found: ${token.substring(0, 10)}...`);
	return { valid: true, token };
}

/**
 * Generate mockup via API
 */
async function generateMockup(
	generator: MockupGenerator,
	sessionPath: string,
): Promise<{ success: boolean; imagePath?: string; metadataRegistryPath?: string }> {
	printHeader('🎨 STEP 2: Generating Mockup');

	const prompt = 'Modern hotel landing page with hero section, booking form, and room gallery';
	const filename = 'hotel-landing-page.png';

	printInfo(`Prompt: "${prompt}"`);
	printInfo(`Filename: "${filename}"`);
	printInfo(`Session: ${sessionPath}`);

	try {
		printInfo('Calling Replicate API...');
		const result = await generator.generate({
			prompt,
			filename,
			sessionPath,
		});

		if (!result.success) {
			printError(`Generation failed: ${result.error || 'Unknown error'}`);
			return { success: false };
		}

		printSuccess('Mockup generated successfully!');
		printInfo(`Image path: ${result.imagePath || 'N/A'}`);
		printInfo(`Image URL: ${result.imageUrl || 'N/A'}`);
		printInfo(`Generation time: ${result.metadata.generationTime}ms`);
		printInfo(`Model: ${result.metadata.model}`);
		printInfo(`Cost: $${result.metadata.cost.toFixed(4)}`);

		// Metadata registry path (actual location used by MetadataRegistry)
		const metadataRegistryPath = join(sessionPath, 'mockups', '.registry.json');

		return {
			success: true,
			imagePath: result.imagePath,
			metadataRegistryPath,
		};
	} catch (error) {
		printError(`Failed to generate mockup: ${error instanceof Error ? error.message : String(error)}`);
		return { success: false };
	}
}

/**
 * Verify file outputs
 */
function verifyOutputs(imagePath?: string, metadataRegistryPath?: string): boolean {
	printHeader('📁 STEP 3: Verifying File Outputs');

	let allValid = true;

	// Check image file
	if (!imagePath) {
		printError('Image path not provided');
		allValid = false;
	} else if (!existsSync(imagePath)) {
		printError(`Image file not found: ${imagePath}`);
		allValid = false;
	} else {
		printSuccess(`Image file exists: ${imagePath}`);
		const stats = statSync(imagePath);
		printInfo(`Image size: ${(stats.size / 1024).toFixed(2)} KB`);
	}

	// Check metadata registry file
	if (!metadataRegistryPath) {
		printError('Metadata registry path not provided');
		allValid = false;
	} else if (!existsSync(metadataRegistryPath)) {
		printError(`Metadata registry not found: ${metadataRegistryPath}`);
		allValid = false;
	} else {
		printSuccess(`Metadata registry exists: ${metadataRegistryPath}`);
		try {
			const registry = JSON.parse(readFileSync(metadataRegistryPath, 'utf-8'));
			printInfo(`Total mockups: ${registry.mockups?.length || 0}`);
			if (registry.mockups && registry.mockups.length > 0) {
				const latest = registry.mockups[registry.mockups.length - 1];
				printInfo(`Latest prompt: ${latest.prompt}`);
				printInfo(`Latest model: ${latest.model}`);
				printInfo(`Generated at: ${new Date(latest.generatedAt).toLocaleString()}`);
			}
		} catch (error) {
			printError(`Failed to parse metadata registry: ${error instanceof Error ? error.message : String(error)}`);
			allValid = false;
		}
	}

	return allValid;
}

/**
 * Verify cost tracking
 */
function verifyCostTracking(sessionPath: string): boolean {
	printHeader('💰 STEP 4: Verifying Cost Tracking');

	const usageFile = join(sessionPath, '.usage-tracking.json');

	if (!existsSync(usageFile)) {
		printError(`Usage tracking file not found: ${usageFile}`);
		return false;
	}

	printSuccess(`Usage tracking file exists: ${usageFile}`);

	try {
		const usage: UsageData = JSON.parse(readFileSync(usageFile, 'utf-8'));

		printInfo(`Current month: ${usage.currentMonth}`);
		printInfo(`Mockup count: ${usage.mockupCount}`);
		printInfo(`Total cost: $${usage.totalCost.toFixed(4)}`);
		printInfo(`Last reset: ${new Date(usage.lastReset).toLocaleString()}`);

		// Validate data structure
		if (
			typeof usage.currentMonth !== 'string' ||
			typeof usage.mockupCount !== 'number' ||
			typeof usage.totalCost !== 'number' ||
			typeof usage.lastReset !== 'string'
		) {
			printError('Invalid usage data structure');
			return false;
		}

		// Check if approaching limit
		const remaining = 50 - usage.mockupCount;
		if (remaining <= 10) {
			printWarning(`Only ${remaining} mockups remaining before threshold!`);
		} else {
			printSuccess(`${remaining} mockups remaining (${usage.mockupCount}/50 used)`);
		}

		return true;
	} catch (error) {
		printError(`Failed to parse usage tracking: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Print final results
 */
function printResults(results: {
	environment: boolean;
	generation: boolean;
	outputs: boolean;
	costTracking: boolean;
}): void {
	printHeader('📊 FINAL RESULTS');

	const checks = [
		{ name: 'Environment Configuration', passed: results.environment },
		{ name: 'Mockup Generation', passed: results.generation },
		{ name: 'File Outputs', passed: results.outputs },
		{ name: 'Cost Tracking', passed: results.costTracking },
	];

	for (const check of checks) {
		if (check.passed) {
			printSuccess(check.name);
		} else {
			printError(check.name);
		}
	}

	const allPassed = Object.values(results).every((r) => r);

	console.log('\n');
	if (allPassed) {
		console.log(`${colors.bright}${colors.green}✓ ALL CHECKS PASSED${colors.reset}`);
		console.log(
			`${colors.green}The mockup generation system is working correctly!${colors.reset}\n`,
		);
	} else {
		console.log(`${colors.bright}${colors.red}✗ SOME CHECKS FAILED${colors.reset}`);
		console.log(`${colors.red}Please review the errors above and fix the issues.${colors.reset}\n`);
		process.exit(1);
	}
}

/**
 * Main test execution
 */
async function main(): Promise<void> {
	console.log(`${colors.bright}${colors.magenta}`);
	console.log('╔════════════════════════════════════════════════════════════════════╗');
	console.log('║           MOCKUP GENERATION SYSTEM - E2E TEST                      ║');
	console.log('║                                                                    ║');
	console.log('║  This test validates the complete mockup generation workflow      ║');
	console.log('╚════════════════════════════════════════════════════════════════════╝');
	console.log(colors.reset);

	const results = {
		environment: false,
		generation: false,
		outputs: false,
		costTracking: false,
	};

	// Step 1: Validate environment
	const envCheck = validateEnvironment();
	results.environment = envCheck.valid;

	if (!envCheck.valid) {
		printResults(results);
		return;
	}

	// Step 2: Initialize generator
	// biome-ignore lint/style/noNonNullAssertion: token existence validated in step 1
	const generator = new MockupGenerator({
		replicateApiToken: envCheck.token!,
		model: process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell',
		maxRetries: 3,
	});
	const sessionPath = join(process.cwd(), '.claude', 'sessions', 'planning', 'P-005-test');

	// Step 3: Generate mockup
	const genResult = await generateMockup(generator, sessionPath);
	results.generation = genResult.success;

	if (!genResult.success) {
		printResults(results);
		return;
	}

	// Step 4: Verify outputs
	results.outputs = verifyOutputs(genResult.imagePath, genResult.metadataRegistryPath);

	// Step 5: Verify cost tracking
	results.costTracking = verifyCostTracking(sessionPath);

	// Step 6: Print final results
	printResults(results);
}

// Execute test
main().catch((error) => {
	console.error(`${colors.red}Unhandled error:${colors.reset}`, error);
	process.exit(1);
});
