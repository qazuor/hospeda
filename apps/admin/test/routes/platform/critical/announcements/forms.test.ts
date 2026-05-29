/**
 * @file forms.test.ts
 * @description Source-based tests for the announcement create + edit pages
 * (SPEC-156 PR-4 T-039 + T-040). The pure form validation is covered by
 * AnnouncementForm.test.ts; here we pin the route + wiring shape so future
 * refactors can not silently drop the append / replace semantics or the
 * MAINTENANCE_MODE_WRITE permission gate.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const createSrc = readFileSync(
    resolve(__dirname, '../../../../../src/routes/_authed/platform/critical/announcements/new.tsx'),
    'utf8'
);

const editSrc = readFileSync(
    resolve(
        __dirname,
        '../../../../../src/routes/_authed/platform/critical/announcements/$id_.edit.tsx'
    ),
    'utf8'
);

describe('new.tsx (T-039)', () => {
    it('registers the new route path', () => {
        expect(createSrc).toContain(
            "createFileRoute('/_authed/platform/critical/announcements/new')"
        );
    });

    it('requires MAINTENANCE_MODE_WRITE in beforeLoad', () => {
        expect(createSrc).toContain('PermissionEnum.MAINTENANCE_MODE_WRITE');
        expect(createSrc).toContain("throw redirect({ to: '/auth/forbidden' })");
    });

    it('generates a client-side UUID for the new item', () => {
        expect(createSrc).toContain('crypto.randomUUID');
    });

    it('APPENDS the new item to the existing announcements.global array', () => {
        expect(createSrc).toMatch(/\[\.\.\.existing,\s*item\]/);
        expect(createSrc).toContain('mutation.mutate(next');
    });

    it('reads + writes the announcements.global key', () => {
        expect(createSrc).toContain("key: 'announcements.global'");
        expect(createSrc).toContain('usePlatformSetting');
        expect(createSrc).toContain('useUpdatePlatformSetting');
    });

    it('navigates back to the list on successful submit', () => {
        expect(createSrc).toContain("navigate({ to: '/platform/critical/announcements' })");
    });

    it('mounts the shared <AnnouncementForm>', () => {
        expect(createSrc).toContain('<AnnouncementForm');
        expect(createSrc).toContain("from '@/features/announcements/AnnouncementForm'");
    });

    it('uses the submitCreate label', () => {
        expect(createSrc).toContain("'admin-pages.announcements.form.submitCreate'");
    });
});

describe('$id_.edit.tsx (T-040)', () => {
    it('registers the edit route path with the $id_ param', () => {
        expect(editSrc).toContain(
            "createFileRoute('/_authed/platform/critical/announcements/$id_/edit')"
        );
    });

    it('requires MAINTENANCE_MODE_WRITE in beforeLoad', () => {
        expect(editSrc).toContain('PermissionEnum.MAINTENANCE_MODE_WRITE');
        expect(editSrc).toContain("throw redirect({ to: '/auth/forbidden' })");
    });

    it('reads the id from Route.useParams', () => {
        expect(editSrc).toContain('Route.useParams()');
    });

    it('finds the target item in announcements.global by id', () => {
        expect(editSrc).toContain('existing.find((item) => item.id === id)');
    });

    it('REPLACES the target row (preserving id) when persisting', () => {
        expect(editSrc).toMatch(
            /existing\.map\(\(entry\) => \(?\s*entry\.id === id \? item : entry\s*\)?\)/
        );
    });

    it('navigates back to the list on successful submit', () => {
        expect(editSrc).toContain("navigate({ to: '/platform/critical/announcements' })");
    });

    it('renders a loading skeleton while the query is in flight', () => {
        expect(editSrc).toContain('data-testid="edit-announcement-loading"');
    });

    it('renders a missing-row fallback when the id does not match any item', () => {
        expect(editSrc).toContain('data-testid="edit-announcement-missing"');
        expect(editSrc).toContain('target === null');
    });

    it('seeds the form with the existing target values', () => {
        expect(editSrc).toContain('textEs: target.text.es');
        expect(editSrc).toContain('textEn: target.text.en');
        expect(editSrc).toContain('textPt: target.text.pt');
        expect(editSrc).toContain('variant: target.variant');
        expect(editSrc).toContain('dismissible: target.dismissible');
    });

    it('uses the submitEdit label', () => {
        expect(editSrc).toContain("'admin-pages.announcements.form.submitEdit'");
    });
});
