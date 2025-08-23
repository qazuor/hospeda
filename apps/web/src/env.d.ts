/// <reference types="astro/client" />

interface ImportMetaEnv {
    // Database
    readonly DATABASE_URL: string;

    // API Configuration
    readonly PUBLIC_API_BASE_URL: string;

    // Authentication
    readonly PUBLIC_CLERK_PUBLISHABLE_KEY: string;
    readonly CLERK_SECRET_KEY: string;

    // Site Configuration
    readonly PUBLIC_SITE_URL: string;
    readonly PUBLIC_DEFAULT_LOCALE: string;
    readonly PUBLIC_SUPPORTED_LOCALES: string;

    // Monitoring
    readonly PUBLIC_SENTRY_DSN: string;
    readonly SENTRY_ENVIRONMENT: string;
    readonly SENTRY_RELEASE: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
