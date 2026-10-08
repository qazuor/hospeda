/** HOS-1642 — TEST:V9a:7 against a disposable PostgreSQL database. */
import { domainEventModel, ExperienceModel, GastronomyModel, tags } from '@repo/db';
import { EntityTypeEnum, PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { issueExperienceCertificate } from '../../../src/services/experience/experience.certificate';
import { replaceGastronomyDailySpecials } from '../../../src/services/gastronomy/gastronomy.daily-specials';
import { replaceGastronomyEvents } from '../../../src/services/gastronomy/gastronomy.events';
import { replaceGastronomyMenu } from '../../../src/services/gastronomy/gastronomy.menu';
import { TagService } from '../../../src/services/tag/tag.service';
import type { Actor } from '../../../src/types';
import { createLoggerMock } from '../../utils/modelMockFactory';
import {
    closeServiceTestPool,
    seedAccommodation,
    seedExperience,
    seedGastronomy,
    withServiceTestTransaction
} from './helpers';

function owner(id: string): Actor {
    return {
        id,
        roles: [RoleEnum.HOST, RoleEnum.GASTRONOMY_OWNER, RoleEnum.EXPERIENCE_OWNER],
        permissions: [
            PermissionEnum.ACCOMMODATION_UPDATE_OWN,
            PermissionEnum.GASTRONOMY_EDIT_OWN,
            PermissionEnum.EXPERIENCE_EDIT_OWN
        ]
    };
}

async function expectActs(input: {
    readonly entityType: 'accommodation' | 'gastronomy' | 'experience';
    readonly entityId: string;
    readonly ownerId: string;
    readonly fields: readonly string[];
    readonly tx: Parameters<typeof domainEventModel.findByEntity>[0]['tx'];
    readonly forbiddenContent: readonly string[];
}): Promise<void> {
    const events = await domainEventModel.findByEntity({
        entityType: input.entityType,
        entityId: input.entityId,
        tx: input.tx
    });
    expect(events).toHaveLength(input.fields.length);
    expect(events.map((event) => event.changes)).toEqual(input.fields.map((field) => [{ field }]));
    for (const event of events) {
        expect(event.eventType).toBe('listing.edited');
        expect(event.actorId).toBe(input.ownerId);
        expect(event.actorType).toBe('owner');
    }
    for (const content of input.forbiddenContent) {
        expect(JSON.stringify(events)).not.toContain(content);
    }
}

describe('HOS-1642 owner acts for other listing subentities', () => {
    afterAll(closeServiceTestPool);

    it('TEST:V9a:7 — carta, special and event edits each write a name-only act', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { gastronomyId, ownerId } = await seedGastronomy(tx);
            const actor = owner(ownerId);
            const model = new GastronomyModel();
            const ctx = { tx };
            const menu = await replaceGastronomyMenu(
                model,
                actor,
                {
                    gastronomyId,
                    menu: {
                        sections: [{ name: 'Carta secreta', items: [{ name: 'Plato secreto' }] }]
                    }
                },
                ctx
            );
            expect(menu.error).toBeUndefined();
            const specials = await replaceGastronomyDailySpecials(
                model,
                actor,
                {
                    gastronomyId,
                    specials: {
                        specials: [
                            {
                                title: 'Especial secreto',
                                validFrom: '2026-10-08',
                                validUntil: '2026-10-09'
                            }
                        ]
                    }
                },
                ctx
            );
            expect(specials.error).toBeUndefined();
            const agenda = await replaceGastronomyEvents(
                model,
                actor,
                {
                    gastronomyId,
                    agenda: {
                        events: [
                            {
                                title: 'Evento secreto',
                                recurrence: 'once',
                                date: '2026-10-09',
                                startTime: '20:00'
                            }
                        ]
                    }
                },
                ctx
            );
            expect(agenda.error).toBeUndefined();
            await expectActs({
                entityType: 'gastronomy',
                entityId: gastronomyId,
                ownerId,
                fields: ['menu', 'dailySpecials', 'events'],
                tx,
                forbiddenContent: [
                    'Carta secreta',
                    'Plato secreto',
                    'Especial secreto',
                    'Evento secreto'
                ]
            });
        });
    });

    it('TEST:V9a:7 — issuing a certificate writes a name-only act', async () => {
        await withServiceTestTransaction(async (tx) => {
            const { experienceId, ownerId } = await seedExperience(tx);
            const result = await issueExperienceCertificate(
                new ExperienceModel(),
                owner(ownerId),
                { experienceId, recipientName: 'Persona secreta', completedAt: '2026-10-08' },
                { tx }
            );
            expect(result.error).toBeUndefined();
            await expectActs({
                entityType: 'experience',
                entityId: experienceId,
                ownerId,
                fields: ['certificates'],
                tx,
                forbiddenContent: ['Persona secreta']
            });
        });
    });

    it.each([
        'accommodation',
        'gastronomy',
        'experience'
    ] as const)('TEST:V9a:7 — assigning and removing a tag on %s write owner acts', async (vertical) => {
        await withServiceTestTransaction(async (tx) => {
            const seeded =
                vertical === 'accommodation'
                    ? await seedAccommodation(tx)
                    : vertical === 'gastronomy'
                      ? await seedGastronomy(tx)
                      : await seedExperience(tx);
            const entityId =
                vertical === 'accommodation'
                    ? (seeded as Awaited<ReturnType<typeof seedAccommodation>>).accommodationId
                    : vertical === 'gastronomy'
                      ? (seeded as Awaited<ReturnType<typeof seedGastronomy>>).gastronomyId
                      : (seeded as Awaited<ReturnType<typeof seedExperience>>).experienceId;
            const ownerId = 'userId' in seeded ? seeded.userId : seeded.ownerId;
            const [tag] = await tx
                .insert(tags)
                .values({
                    name: `Tag secreto ${vertical}`,
                    color: 'BLUE',
                    type: 'SYSTEM'
                })
                .returning();
            if (!tag) throw new Error('Tag seed failed');
            const service = new TagService({ logger: createLoggerMock() });
            const params = {
                tagId: tag.id,
                entityId,
                entityType:
                    vertical === 'accommodation'
                        ? EntityTypeEnum.ACCOMMODATION
                        : vertical === 'gastronomy'
                          ? EntityTypeEnum.GASTRONOMY
                          : EntityTypeEnum.EXPERIENCE
            };
            const assigned = await service.assignTag(owner(ownerId), params, { tx });
            expect(assigned.error).toBeUndefined();
            const removed = await service.removeAssignment(owner(ownerId), params, { tx });
            expect(removed.error).toBeUndefined();
            await expectActs({
                entityType: vertical,
                entityId,
                ownerId,
                fields: ['tags', 'tags'],
                tx,
                forbiddenContent: [`Tag secreto ${vertical}`]
            });
        });
    });
});
