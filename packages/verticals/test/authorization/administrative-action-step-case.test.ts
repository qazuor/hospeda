import { describe, expect, it } from 'vitest';
import { resolveAdministrativeActionStep } from '../../src/authorization/administrative-action-step';

describe('TEST:1691:4 step 3 compares accounts ignoring case', () => {
    const actorId = '11111111-1111-4111-8111-111111111111';
    const action = 'ACC_11' as const;
    it('rejects subject uppercase', () =>
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId,
                subjectId: actorId.toUpperCase(),
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' }));
    it('rejects actor uppercase', () =>
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId: actorId.toUpperCase(),
                subjectId: actorId,
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' }));
    it('allows distinct accounts', () =>
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId,
                subjectId: '22222222-2222-4222-8222-222222222222',
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true }));
    it('allows null subject', () =>
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId,
                subjectId: null,
                permitted: true,
                isSystemActor: false
            })
        ).toEqual({ allowed: true }));
    it('rejects a system actor', () =>
        expect(
            resolveAdministrativeActionStep({
                action,
                actorId,
                subjectId: null,
                permitted: true,
                isSystemActor: true
            })
        ).toEqual({ allowed: false, reason: 'FORBIDDEN' }));
});
