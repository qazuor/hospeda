/**
 * Shared fictional sample data for catalog scenarios. Never real people,
 * addresses or secrets: `@example.com` mail, `hospeda.com.ar` links, fake ids.
 *
 * @module catalog/sample-data
 */

/** Base recipient fields of a notification payload. */
export const SAMPLE_RECIPIENT = {
    recipientEmail: 'ana.ejemplo@example.com',
    recipientName: 'Ana Ejemplo',
    userId: '00000000-0000-4000-8000-000000000001',
    customerId: 'cus-ejemplo-0001'
} as const;

/** Production site base URL used in sample links. */
export const SAMPLE_SITE_URL = 'https://hospeda.com.ar';

/** Admin panel base URL used in sample links. */
export const SAMPLE_ADMIN_URL = 'https://admin.hospeda.com.ar';

/** Fictional accommodation name. */
export const SAMPLE_ACCOMMODATION_NAME = 'Cabañas del Río (ejemplo)';

/** Fictional subscription id. */
export const SAMPLE_SUBSCRIPTION_ID = '00000000-0000-4000-8000-0000000000b1';
