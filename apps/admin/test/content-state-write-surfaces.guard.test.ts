/**
 * Guard: no admin surface may write a content state field through the generic
 * update (HOS-374 §7.6.4).
 *
 * `moderationState`, `visibility` and `lifecycleState` left the
 * `PATCH /api/v1/admin/{posts|events}/:id` payload. The API is non-strict for
 * posts, so a stale caller does not get an error — it gets a 200 and no state
 * change. That failure is invisible in the UI (the toast still says success),
 * which is exactly why it needs a guard rather than a test.
 *
 * Two surfaces are covered:
 *  1. The entity edit form — a field declared in any section that reaches
 *     `editSections` is put back into the PATCH body by `EntityPageBase`.
 *  2. The entity list — the inline dropdowns must call the dedicated
 *     state-transition mutations, not `useUpdate{Post,Event}Mutation`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { createEventConsolidatedConfig } from '../src/features/events/config/event-consolidated.config';
import { createPostConsolidatedConfig } from '../src/features/posts/config/post-consolidated.config';

const mockT = vi.fn((key: string) => key) as ReturnType<
    typeof import('@repo/i18n').useTranslations
>['t'];

const STATE_FIELDS = ['visibility', 'moderationState', 'lifecycleState'] as const;

const CONFIGS = [
    { name: 'post', config: () => createPostConsolidatedConfig(mockT) },
    { name: 'event', config: () => createEventConsolidatedConfig(mockT) }
] as const;

describe('content state fields never reach the edit form payload', () => {
    for (const { name, config } of CONFIGS) {
        it(`${name}: no editable section declares a state field`, () => {
            const editableSections = config().sections.filter((section) =>
                (section.modes as readonly string[]).includes('edit')
            );

            const offenders = editableSections.flatMap((section) =>
                section.fields
                    .filter((field) => (STATE_FIELDS as readonly string[]).includes(field.id))
                    .map((field) => `${section.id}.${field.id}`)
            );

            expect(
                offenders,
                `These fields are declared in an editable section, so EntityPageBase will include them in the generic PATCH body — which the API no longer accepts. Move them to ContentStatePanel: ${offenders.join(', ')}`
            ).toEqual([]);
        });

        it(`${name}: the states are still shown somewhere in view mode`, () => {
            // The flip side of the guard above: dropping them from the edit form
            // must not silently drop them from the view page too.
            const viewFields = config()
                .sections.filter((section) => (section.modes as readonly string[]).includes('view'))
                .flatMap((section) => section.fields.map((field) => field.id));

            for (const field of STATE_FIELDS) {
                expect(viewFields).toContain(field);
            }
        });
    }
});

describe('list widgets call the dedicated state-transition mutations', () => {
    const columnFiles = [
        { name: 'post', path: '../src/features/posts/config/posts.columns.ts', prefix: 'POST' },
        { name: 'event', path: '../src/features/events/config/events.columns.ts', prefix: 'EVENT' }
    ] as const;

    for (const { name, path, prefix } of columnFiles) {
        it(`${name}: each state widget uses ${prefix}_STATE_MUTATIONS`, () => {
            const source = readFileSync(join(__dirname, path), 'utf8');

            // Take each widget block by the field it edits, then assert the
            // mutation wired into that same block.
            for (const [field, hook] of [
                ['visibility', 'useSetPublishStateMutation'],
                ['moderationState', 'useModerateMutation'],
                ['lifecycleState', 'useSetLifecycleStateMutation']
            ] as const) {
                const blockStart = source.indexOf(`field: '${field}'`);
                expect(blockStart, `no inline widget found for ${field}`).toBeGreaterThan(-1);
                const block = source.slice(blockStart, blockStart + 900);

                expect(
                    block,
                    `The ${field} widget must call ${prefix}_STATE_MUTATIONS.${hook}. Through the generic update mutation the API silently drops the field and the UI still reports success.`
                ).toContain(`${prefix}_STATE_MUTATIONS.${hook}`);
            }
        });
    }
});
