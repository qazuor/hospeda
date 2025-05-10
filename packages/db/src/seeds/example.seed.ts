import 'dotenv/config';
import { seedExampleAccommodations } from './example/accommodation.seed';
import { seedExampleAdCampaigns } from './example/ad-campaign.seed';
import { seedExampleChat } from './example/chat.seed';
import { seedExampleEmailTemplates } from './example/email-template.seed';
import { seedExampleEvents } from './example/event.seed';
import { seedExampleNotifications } from './example/notification.seed';
import { seedExamplePosts } from './example/post.seed';
import { seedExampleSponsors } from './example/sponsor.seed';
import { seedExampleUsers } from './example/user.seed';

async function main() {
    console.log('🌱 Seeding example data...');
    await seedExampleUsers();
    await seedExampleAccommodations();
    await seedExamplePosts();
    await seedExampleEvents();
    await seedExampleNotifications();
    await seedExampleSponsors();
    await seedExampleAdCampaigns();
    await seedExampleEmailTemplates();
    await seedExampleChat();
    console.log('✅ Example data seeded successfully.');
}

main().catch((err) => {
    console.error('[seed:error]', err);
    process.exit(1);
});
