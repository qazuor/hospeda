/**
 * Environment configuration with validation
 * Centralized environment variables with Zod validation
 */
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env files
config({ path: ['.env.local', '.env'] });

const EnvSchema = z.object({
    // Server Configuration
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    API_PORT: z.coerce.number().default(3001),
    API_HOST: z.string().default('localhost'),

    // Logging Configuration
    LOG_LEVEL: z
        .string()
        .transform((val) => val.toLowerCase())
        .pipe(z.enum(['debug', 'info', 'warn', 'error']))
        .default('info'),
    ENABLE_REQUEST_LOGGING: z.coerce.boolean().default(true),

    // CORS Configuration
    CORS_ORIGINS: z.string().default('*'),

    // Internationalization Configuration
    SUPPORTED_LOCALES: z.string().default('en,es'),
    DEFAULT_LOCALE: z.string().default('en'),

    // Rate Limiting Configuration
    RATE_LIMIT_REQUESTS: z.coerce.number().default(100),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutes

    // Database Configuration (optional for now)
    DATABASE_URL: z.string().optional(),

    // Auth Configuration (optional for now)
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional()
});

// Parse and validate environment variables
const parseEnv = () => {
    try {
        return EnvSchema.parse(process.env);
    } catch (error) {
        console.error('❌ Invalid environment configuration:', error);
        process.exit(1);
    }
};

export const env = parseEnv();

// Export types for usage in other files
export type Env = z.infer<typeof EnvSchema>;
