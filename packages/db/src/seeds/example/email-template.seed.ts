import { db } from '../../client';
import { emailTemplates } from '../../schema/emailTemplates';

const now = new Date().toISOString();

export async function seedExampleEmailTemplates() {
    await db.delete(emailTemplates);

    console.log('[seed] Inserting example email templates...');

    await db.insert(emailTemplates).values([
        {
            id: '90000000-0000-0000-0000-000000000001',
            name: 'Welcome Template',
            subject: 'Welcome to Hospeda!',
            bodyHtml: '<h1>Welcome!</h1><p>We are happy to have you.</p>',
            bodyText: 'Welcome! We are happy to have you.',
            tags: ['welcome', 'system'],
            type: 'WELCOME',
            isSystem: true,
            createdAt: now,
            updatedAt: now
        },
        {
            id: '90000000-0000-0000-0000-000000000002',
            name: 'Booking Confirmation',
            subject: 'Your booking is confirmed',
            bodyHtml: '<p>Thank you for booking with us.</p>',
            bodyText: 'Thank you for booking with us.',
            tags: ['booking'],
            type: 'BOOKING_CONFIRMATION',
            isSystem: false,
            createdAt: now,
            updatedAt: now
        },
        {
            id: '90000000-0000-0000-0000-000000000003',
            name: 'Monthly Newsletter',
            subject: 'What’s new in Hospeda?',
            bodyHtml: '<h2>Highlights this month</h2><ul><li>New features</li></ul>',
            type: 'NEWSLETTER',
            isSystem: false,
            tags: ['newsletter'],
            createdAt: now,
            updatedAt: now
        },
        {
            id: '90000000-0000-0000-0000-000000000004',
            name: 'Promotional Offer',
            subject: '15% OFF This Weekend!',
            bodyHtml: '<p>Use the code <strong>WEEKEND15</strong> at checkout.</p>',
            type: 'PROMO',
            isSystem: false,
            createdAt: now,
            updatedAt: now
        }
    ]);
}
