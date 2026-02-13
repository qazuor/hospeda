/**
 * Example: Exchange Rate API Configuration
 *
 * This example demonstrates how to configure and use exchange rate API
 * environment variables in your application.
 */

import {
	commonEnvSchemas,
	parseExchangeRateSchema,
	validateEnv
} from '@repo/config';
import { z } from 'zod';

/**
 * Basic Usage: Parse exchange rate configuration from environment variables
 */
export function basicUsage() {
	// Parse exchange rate configuration with defaults
	const config = parseExchangeRateSchema(process.env);

	console.log('Exchange Rate Configuration:');
	console.log(`  API Key: ${config.HOSPEDA_EXCHANGE_RATE_API_KEY || 'Not set (using free tier)'}`);
	console.log(`  Dolar API: ${config.HOSPEDA_DOLAR_API_BASE_URL}`);
	console.log(`  Exchange Rate API: ${config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL}`);

	return config;
}

/**
 * Integration with Application Schema
 */
export function integratedSchema() {
	// Extend your application schema with exchange rate configuration
	const appSchema = z.object({
		NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
		HOSPEDA_API_URL: z.string().url(),
		HOSPEDA_DATABASE_URL: z.string().min(1),

		// Exchange rate configuration
		HOSPEDA_EXCHANGE_RATE_API_KEY: z.string().optional(),
		HOSPEDA_DOLAR_API_BASE_URL: z.string().url().default('https://dolarapi.com/v1'),
		HOSPEDA_EXCHANGE_RATE_API_BASE_URL: z
			.string()
			.url()
			.default('https://v6.exchangerate-api.com/v6')
	});

	const config = validateEnv(appSchema, 'Application');
	return config;
}

/**
 * Service Class Example: Exchange Rate Service
 */
export class ExchangeRateService {
	private readonly apiKey?: string;
	private readonly dolarApiBaseUrl: string;
	private readonly exchangeRateApiBaseUrl: string;

	constructor() {
		const config = parseExchangeRateSchema(process.env);
		this.apiKey = config.HOSPEDA_EXCHANGE_RATE_API_KEY;
		this.dolarApiBaseUrl = config.HOSPEDA_DOLAR_API_BASE_URL;
		this.exchangeRateApiBaseUrl = config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL;
	}

	/**
	 * Get Argentine peso exchange rates from DolarApi
	 */
	async getArgentinePesoRates() {
		const url = `${this.dolarApiBaseUrl}/dolares`;
		console.log(`Fetching ARS rates from: ${url}`);

		// Implement API call here
		// const response = await fetch(url);
		// return response.json();
	}

	/**
	 * Get global exchange rates from ExchangeRate-API
	 */
	async getGlobalRates(baseCurrency = 'USD') {
		// Build URL with optional API key
		const keyPath = this.apiKey ? `/${this.apiKey}` : '';
		const url = `${this.exchangeRateApiBaseUrl}${keyPath}/latest/${baseCurrency}`;

		console.log(`Fetching ${baseCurrency} rates from: ${url}`);

		// Implement API call here
		// const response = await fetch(url);
		// return response.json();
	}

	/**
	 * Check if API key is configured
	 */
	hasApiKey(): boolean {
		return this.apiKey !== undefined && this.apiKey.length > 0;
	}
}

/**
 * Testing Example: Mock environment variables
 */
export function testingExample() {
	// In your test file (Vitest)
	/*
  import { describe, it, expect, beforeEach, vi } from 'vitest';
  import { parseExchangeRateSchema } from '@repo/config';

  describe('Exchange Rate Config', () => {
    beforeEach(() => {
      // Stub environment variables for testing
      vi.stubEnv('HOSPEDA_EXCHANGE_RATE_API_KEY', 'test-api-key');
      vi.stubEnv('HOSPEDA_DOLAR_API_BASE_URL', 'https://test-dolar-api.com');
      vi.stubEnv('HOSPEDA_EXCHANGE_RATE_API_BASE_URL', 'https://test-exchange-api.com');
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('should parse configuration with test values', () => {
      const config = parseExchangeRateSchema(process.env);

      expect(config.HOSPEDA_EXCHANGE_RATE_API_KEY).toBe('test-api-key');
      expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://test-dolar-api.com');
      expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe('https://test-exchange-api.com');
    });

    it('should use default URLs when not provided', () => {
      vi.unstubAllEnvs();

      const config = parseExchangeRateSchema(process.env);

      expect(config.HOSPEDA_DOLAR_API_BASE_URL).toBe('https://dolarapi.com/v1');
      expect(config.HOSPEDA_EXCHANGE_RATE_API_BASE_URL).toBe('https://v6.exchangerate-api.com/v6');
    });
  });
  */
}

/**
 * Environment-Specific Configuration
 */
export function environmentSpecific() {
	const config = parseExchangeRateSchema(process.env);
	const isDevelopment = process.env.NODE_ENV === 'development';

	if (isDevelopment && !config.HOSPEDA_EXCHANGE_RATE_API_KEY) {
		console.log('💡 Running in development without API key (using free tier)');
		console.log(
			'   Get your API key at: https://www.exchangerate-api.com to avoid rate limits'
		);
	}

	// Use API key in production for higher rate limits
	if (!isDevelopment && !config.HOSPEDA_EXCHANGE_RATE_API_KEY) {
		console.warn(
			'⚠️  No ExchangeRate-API key configured in production. May hit rate limits.'
		);
	}

	return config;
}

/**
 * Error Handling Example
 */
export function errorHandlingExample() {
	try {
		// Test with invalid URL
		const invalidEnv = {
			HOSPEDA_DOLAR_API_BASE_URL: 'not-a-valid-url'
		};

		parseExchangeRateSchema(invalidEnv);
	} catch (error) {
		if (error instanceof z.ZodError) {
			console.error('Validation failed:');
			for (const issue of error.issues) {
				console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
			}
		}
	}
}

/**
 * Usage with commonEnvSchemas
 */
export function commonSchemasUsage() {
	// Import the common exchange rate schema
	const { exchangeRate } = commonEnvSchemas;

	// Use it in your application schema
	const appSchema = z.object({
		NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
	});

	// Merge with exchange rate schema
	const fullSchema = appSchema.merge(exchangeRate);

	const config = validateEnv(fullSchema, 'Application');
	return config;
}

// Example usage in a module
if (import.meta.url === `file://${process.argv[1]}`) {
	console.log('=== Basic Usage ===');
	basicUsage();

	console.log('\n=== Environment-Specific ===');
	environmentSpecific();

	console.log('\n=== Service Class ===');
	const service = new ExchangeRateService();
	console.log(`Has API Key: ${service.hasApiKey()}`);
}
