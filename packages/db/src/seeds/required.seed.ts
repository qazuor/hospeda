import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { seedRequiredDestinations } from 'src/seeds/required';
import { db } from '../client';
import { emailTemplates } from '../schema/emailTemplates';
import { roles } from '../schema/users';

async function seedRoles() {
    const existing = await db.select().from(roles);
    if (existing.length > 0) {
        console.log('[seed] Roles already exist, skipping...');
        return;
    }

    console.log('[seed] Inserting system roles...');
    await db.insert(roles).values([
        { id: '00000000-0000-0000-0000-000000000001', name: 'ADMIN' },
        { id: '00000000-0000-0000-0000-000000000002', name: 'EDITOR' },
        { id: '00000000-0000-0000-0000-000000000003', name: 'CLIENT' },
        { id: '00000000-0000-0000-0000-000000000004', name: 'USER' }
    ]);
}

async function seedEmailTemplates() {
    const existing = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.type, 'WELCOME'));

    if (existing.length > 0) {
        console.log('[seed] Welcome template already exists, skipping...');
        return;
    }

    console.log('[seed] Inserting default welcome email template...');
    await db.insert(emailTemplates).values({
        name: 'Welcome Email',
        subject: 'Welcome to Hospeda!',
        bodyHtml: '<h1>Welcome!</h1><p>Thanks for joining our platform.</p>',
        type: 'WELCOME',
        isSystem: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    });
}

async function main() {
    console.log('🌱 Running required seed...');
    console.log('🌱 Running roles seed...');
    await seedRoles();
    console.log('🌱 Running email templates seed...');
    await seedEmailTemplates();
    console.log('🌱 Running destinations seed...');
    await seedRequiredDestinations();
    console.log('✅ Required seed complete.');
}

main().catch((err) => {
    console.error('[seed:error]', err);
    process.exit(1);
});
