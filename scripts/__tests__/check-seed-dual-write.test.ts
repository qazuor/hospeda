/**
 * @fileoverview
 * HOS-25 T-024: tests the DECISION logic of `check-seed-dual-write.sh` in
 * isolation, without a real git diff. The script exposes two test-injection
 * env vars for exactly this purpose:
 *
 *   - `CHANGED_FILES_OVERRIDE` — a synthetic `STATUS<TAB>PATH` per-line list,
 *     in the same format `git diff --name-status` emits, used instead of
 *     running a real diff.
 *   - `MARKER_TEXT_OVERRIDE` — synthetic PR-body/commit-message text, used
 *     instead of the real PR body + commit-message scan, to test the
 *     `[skip-seed-migration]` opt-out.
 *
 * Each test spawns the real script as a subprocess (bash), asserting exit
 * code and stdout content — the same "drive the artifact directly" style as
 * other guard-script coverage in this repo (e.g. env-doctor.test.ts), except
 * here the artifact under test is a shell script rather than a compiled TS
 * module, since check-seed-dual-write.sh (like check-schema-drift.sh, its
 * sibling guard) is bash.
 */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPT_PATH = path.join(REPO_ROOT, 'scripts/check-seed-dual-write.sh');

interface RunResult {
    readonly exitCode: number;
    readonly stdout: string;
}

/** Runs the guard script with the given env overrides and captures the result. */
function runGuard(env: Record<string, string>): RunResult {
    try {
        const stdout = execFileSync('bash', [SCRIPT_PATH], {
            cwd: REPO_ROOT,
            env: { ...process.env, ...env },
            encoding: 'utf8'
        });
        return { exitCode: 0, stdout };
    } catch (error) {
        const err = error as { status: number | null; stdout: string };
        return { exitCode: err.status ?? 1, stdout: err.stdout };
    }
}

describe('check-seed-dual-write.sh (HOS-25 T-024)', () => {
    it('passes when no guarded baseline path changed', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/example/accommodations.seed.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('OK: no guarded baseline seed-data path changed');
    });

    it('fails when required amenity JSON changed with no new migration and no marker', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
        expect(result.stdout).toContain('db:seed:make');
    });

    it('passes when required data changed AND a new NNNN- migration was added', () => {
        // Arrange
        const changed = [
            'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json',
            'A\tpackages/seed/src/data-migrations/0004-fix-wifi-amenity.ts'
        ].join('\n');

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain(
            'OK: baseline data changed AND a new data-migration was added'
        );
    });

    it('does NOT count a MODIFIED (not added) migration file as satisfying the rule', () => {
        // Arrange
        const changed = [
            'M\tpackages/seed/src/data/feature/001-foo.json',
            'M\tpackages/seed/src/data-migrations/0001-billing-plans-ai-consumer-search-limits.ts'
        ].join('\n');

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('passes via the [skip-seed-migration] opt-out marker', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/amenity/001-amenity-connectivity-wifi.json';
        const marker = 'Cosmetic copy tweak only. [skip-seed-migration]: no live-env impact.';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: marker });

        // Assert
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('OK (opt-out)');
    });

    it('guards billing plan/limit config constants (023-025 precedent)', () => {
        // Arrange
        const changed = 'M\tpackages/billing/src/config/plans.config.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('plans.config.ts');
    });

    it('guards pointOfInterest JSON changes (HOS-113 T-027, R-5)', () => {
        // Arrange
        const changed =
            'M\tpackages/seed/src/data/pointOfInterest/001-point-of-interest-autodromo_concepcion_del_uruguay.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
    });

    it('guards internal-/system- prefixed files in the mixed data/tag/ folder', () => {
        // Arrange
        const changed = 'M\tpackages/seed/src/data/tag/internal-001-revisar-contenido.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
    });

    it('does NOT guard non-required files in the mixed data/tag/ folder (example passthrough)', () => {
        // Arrange: a tag file with neither the internal- nor system- prefix
        // (the example seeder's manifest-driven passthrough files live here).
        const changed = 'M\tpackages/seed/src/data/tag/culture-travel.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('does NOT guard demo-only accommodation fixtures (exemption list, HOS-173)', () => {
        // Arrange: accommodation is synthetic demo-only content that must never
        // represent a real environment — exempt, NOT because it is
        // "regenerated non-deterministically" (that premise was false: every
        // fixture here has a deterministic UUIDv5 id). See HOS-173.
        const changed = 'M\tpackages/seed/src/data/accommodation/uruguay/001-some-fixture.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    // -------------------------------------------------------------------------
    // HOS-173: fail-closed default + closed-gap regression tests
    // -------------------------------------------------------------------------

    it('AC-1: FAILS the exact partners-commit shape (new data/partner/ folder, no migration)', () => {
        // Arrange: replay commit 24ce27a5f — a brand-new data/partner/*.json
        // folder registered via runExampleSeeds(), no migration, no marker.
        const changed = [
            'A\tpackages/seed/src/data/partner/001-partner-autoservice-litoral.json',
            'A\tpackages/seed/src/data/partner/002-partner-something.json',
            'A\tpackages/seed/src/example/partners.seed.ts'
        ].join('\n');

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
        expect(result.stdout).toContain('data/partner/001-partner-autoservice-litoral.json');
    });

    it('AC-2: FAILS a brand-new data/ folder not on the exemption list (fail-closed default)', () => {
        // Arrange: a hypothetical new curated source nobody added to any list.
        const changed = 'A\tpackages/seed/src/data/brandNewCatalog/001-thing.json';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(1);
        expect(result.stdout).toContain('FAIL: baseline seed data changed');
    });

    it('AC-3: PASSES every demo-only exemption-list folder with no migration/marker', () => {
        // Arrange: all 11 EXEMPT_DATA_DIR_PATTERNS folders + the two mixed-folder
        // demo cases must stay green post-inversion (proves the inversion did not
        // introduce a wave of new required markers on already-safe PRs).
        for (const path of [
            'packages/seed/src/data/accommodation/001-acc.json',
            'packages/seed/src/data/accommodationExternalListing/001-l.json',
            'packages/seed/src/data/accommodationExternalReputation/001-r.json',
            'packages/seed/src/data/accommodationReview/001-review.json',
            'packages/seed/src/data/bookmark/001-bookmark.json',
            'packages/seed/src/data/destinationReview/001-review.json',
            'packages/seed/src/data/event/001-event.json',
            'packages/seed/src/data/eventLocation/001-loc.json',
            'packages/seed/src/data/eventOrganizer/001-org.json',
            'packages/seed/src/data/post/001-post.json',
            'packages/seed/src/data/userBookmarkCollection/001-col.json',
            'packages/seed/src/data/user/example/001-user.json',
            'packages/seed/src/data/tag/culture-travel.json'
        ]) {
            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: `M\t${path}`,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode, `expected ${path} to be exempt`).toBe(0);
        }
    });

    it('does NOT guard the 3 demo-only inline example seeders (intentional exemption, HOS-173)', () => {
        // Arrange: these bake fixtures into inline TS constants (no data/ folder)
        // and attach ONLY to demo entities (fake accommodations / demo posts),
        // so — like their exempt data-folder siblings — they never need a
        // live-env backfill. Pinning the decision so it stays a visible, reviewed
        // choice rather than an accident of omission.
        for (const path of [
            'packages/seed/src/example/accommodationExternalListings.seed.ts',
            'packages/seed/src/example/accommodationExternalReputation.seed.ts',
            'packages/seed/src/example/postTagAssignments.seed.ts'
        ]) {
            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: `M\t${path}`,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode, `expected ${path} to be demo-only exempt`).toBe(0);
        }
    });

    it('DOES guard entityTagAssignments/userTags (inline, but attach to guarded entities)', () => {
        // Arrange: entityTagAssignments tags real destination catalog rows
        // (Chajarí/Colón); userTags tags the required admin-user. Both attach to
        // GUARDED entities, so a change is prod-relevant and must not escape.
        for (const path of [
            'packages/seed/src/example/entityTagAssignments.seed.ts',
            'packages/seed/src/example/userTags.seed.ts'
        ]) {
            // Act
            const result = runGuard({
                CHANGED_FILES_OVERRIDE: `M\t${path}`,
                MARKER_TEXT_OVERRIDE: ''
            });

            // Assert
            expect(result.exitCode, `expected ${path} to be guarded`).toBe(1);
        }
    });

    it('a rename-shaped diff line (R<score>\\told\\tnew) does NOT match an exact-guarded file', () => {
        // Documents WHY compute_changed_files passes `--no-renames`: the two-field
        // `IFS=$'\t' read -r status path` collapses "old<TAB>new" into `path`, so a
        // rename line can never equal a bare INLINE_CONSTANT_FILES/BILLING_CONFIG_FILES
        // name. With --no-renames git emits clean A/D pairs instead, keeping the
        // exact-match guards reliable. If this test ever starts FAILING (exit 1),
        // the parsing changed and --no-renames may no longer be load-bearing.
        const renameLine =
            'R100\tpackages/billing/src/config/plans.config.ts\tpackages/billing/src/config/plans2.config.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: renameLine, MARKER_TEXT_OVERRIDE: '' });

        // Assert: the collapsed path does not equal 'plans.config.ts' → not guarded.
        expect(result.exitCode).toBe(0);
    });

    it('AC-4: FAILS the four other formerly-escaped curated sources + inline experiences', () => {
        // Arrange
        for (const path of [
            'M\tpackages/seed/src/data/gastronomy/001-gastronomy.json',
            'M\tpackages/seed/src/data/hostTrade/001-host-trade.json',
            'M\tpackages/seed/src/data/postSponsor/001-sponsor.json',
            'M\tpackages/seed/src/data/postSponsorship/001-sponsorship.json',
            'M\tpackages/seed/src/example/experiences.seed.ts'
        ]) {
            // Act
            const result = runGuard({ CHANGED_FILES_OVERRIDE: path, MARKER_TEXT_OVERRIDE: '' });

            // Assert
            expect(result.exitCode, `expected ${path} to be guarded`).toBe(1);
        }
    });

    it('AC-5: FAILS the inline-constant required seeders (previously scoped-out set)', () => {
        // Arrange
        for (const path of [
            'M\tpackages/seed/src/required/rolePermissions.seed.ts',
            'M\tpackages/seed/src/required/aiPrompts.seed.ts',
            'M\tpackages/seed/src/required/aiSettings.seed.ts',
            'M\tpackages/seed/src/required/socialAutomation.seed.ts',
            'M\tpackages/seed/src/required/contentModeration.seed.ts',
            'M\tpackages/seed/src/required/systemUser.seed.ts'
        ]) {
            // Act
            const result = runGuard({ CHANGED_FILES_OVERRIDE: path, MARKER_TEXT_OVERRIDE: '' });

            // Assert
            expect(result.exitCode, `expected ${path} to be guarded`).toBe(1);
        }
    });

    it('does NOT guard demo example orchestrator logic (e.g. accommodations.seed.ts)', () => {
        // Arrange: a demo orchestrator that reads from an exempt data/ folder —
        // not an inline-constant file, so a logic edit must not trip the guard.
        const changed = 'M\tpackages/seed/src/example/accommodations.seed.ts';

        // Act
        const result = runGuard({ CHANGED_FILES_OVERRIDE: changed, MARKER_TEXT_OVERRIDE: '' });

        // Assert
        expect(result.exitCode).toBe(0);
    });

    it('fails open (no diff) when BASE_SHA does not resolve (e.g. first push, all-zero sha)', () => {
        // Arrange: no CHANGED_FILES_OVERRIDE — forces the real compute_changed_files
        // path, with an unresolvable BASE_SHA.
        const result = runGuard({
            BASE_SHA: '0000000000000000000000000000000000000000',
            CHANGED_FILES_OVERRIDE: '',
            MARKER_TEXT_OVERRIDE: ''
        });

        // Assert
        expect(result.exitCode).toBe(0);
    });
});
