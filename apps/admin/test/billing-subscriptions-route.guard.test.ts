import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sidebars } from '../src/config/ia/sidebars';

const ROUTES_DIR = 'src/routes/_authed/billing/subscriptions';

describe('HOS-2081 subscription finder route guard', () => {
    it('protects the list route with the inspection permission', () => {
        const source = readFileSync(resolve(ROUTES_DIR, 'index.tsx'), 'utf8');
        expect(source).toContain(
            'requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT)'
        );
        expect(source).toContain('<SubscriptionsListScreen');
    });

    it('protects the detail index route with the inspection permission', () => {
        const source = readFileSync(resolve(ROUTES_DIR, '$subscriptionId.index.tsx'), 'utf8');
        expect(source).toContain(
            'requireAdminPermission(context, PermissionEnum.BILLING_SUBSCRIPTION_INSPECT)'
        );
        expect(source).toContain('<SubscriptionDetailScreen');
    });

    it('registers the gated subscriptions sidebar entry before reconciliation', () => {
        const comercialSidebar = sidebars.comercialSidebar;
        const links = comercialSidebar.items.flatMap((entry) =>
            entry.type === 'group' ? entry.items : [entry]
        );
        const item = links.find((entry) => entry.type === 'link' && entry.id === 'subscriptions');
        expect(item).toBeDefined();
        expect(item).toMatchObject({
            route: '/billing/subscriptions',
            permissions: ['BILLING_SUBSCRIPTION_INSPECT'],
            onMissing: 'hide'
        });
    });

    it('does not create a $subscriptionId layout route (D-3)', () => {
        const files = readdirSync(resolve(ROUTES_DIR));
        expect(files.filter((file) => file === '$subscriptionId.tsx')).toHaveLength(0);
        expect(files.filter((file) => file === '$subscriptionId.index.tsx')).toHaveLength(1);
    });

    it('keeps the feature free of domain internals', () => {
        const root = resolve('src/features/billing-subscriptions');
        const files = collectTypeScriptFiles(root);
        expect(files.length).toBeGreaterThan(0);
        for (const file of files) {
            const source = readFileSync(resolve(root, file), 'utf8');
            expect(source).not.toMatch(/@repo\/(verticals|payments|service-core|db)/);
        }
    });
});

function collectTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = resolve(directory, entry.name);
        if (entry.isDirectory()) return collectTypeScriptFiles(path);
        return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
}
