/**
 * Route tests for the admin direct email endpoints (HOS-2685): the REAL admin gate runs
 * (no authorization mock), the services are mocked at the singleton boundary.
 *
 * Covers per route: 403 without its own permission, 400 on bad input, the happy path.
 */
import { PermissionEnum, RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    message: {
        list: vi.fn(),
        getById: vi.fn(),
        preview: vi.fn(),
        testSend: vi.fn(),
        send: vi.fn(),
        checkRecipients: vi.fn()
    },
    template: {
        list: vi.fn(),
        getById: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        softDelete: vi.fn()
    },
    suppression: { list: vi.fn(), add: vi.fn(), remove: vi.fn() }
}));

vi.mock('../../../src/routes/direct-email/_singletons', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/routes/direct-email/_singletons')>()),
    getDirectEmailMessageService: () => mocks.message,
    getDirectEmailTemplateService: () => mocks.template,
    getDirectEmailSuppressionService: () => mocks.suppression
}));

vi.mock('../../../src/middlewares/rate-limit', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../../src/middlewares/rate-limit')>()),
    createPerRouteRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => {
        await next();
    }
}));

import { Hono } from 'hono';
import { createErrorHandler } from '../../../src/middlewares/response';
import {
    directEmailAdminRoutes,
    directEmailSuppressionAdminRoutes,
    directEmailTemplateAdminRoutes
} from '../../../src/routes/direct-email';
import type { AppBindings } from '../../../src/types';
import { createGuestActor } from '../../../src/utils/actor';

const ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const BODY = {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hola' }] }]
};

const NOW = new Date('2026-11-28T12:00:00Z');
const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const KEY = '33333333-3333-4333-8333-333333333333';
const messageFixture = {
    id: ID,
    subject: 'Propuesta',
    bodyJson: BODY,
    templateId: null,
    sentBy: USER_ID,
    fromEmail: 'contacto@comercial.hospeda.com.ar',
    replyToEmail: 'laura@hospeda.com.ar',
    idempotencyKey: KEY,
    createdAt: NOW,
    updatedAt: NOW
};
const recipientFixture = {
    id: ID,
    messageId: ID,
    email: 'a@example.com',
    status: 'sent',
    providerMessageId: '<1>',
    errorMessage: null,
    sentAt: NOW,
    deliveredAt: null,
    openedAt: null,
    bouncedAt: null
};
const templateFixture = {
    id: ID,
    name: 'Alianza',
    subject: 'Hola',
    bodyJson: BODY,
    createdBy: USER_ID,
    updatedBy: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null
};
const suppressionFixture = {
    id: ID,
    email: 'a@b.com',
    reason: 'manual',
    createdAt: NOW,
    createdBy: USER_ID
};

const actorWith = (...permissions: PermissionEnum[]): AppBindings['Variables']['actor'] => ({
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.ACCESS_PANEL_ADMIN, ...permissions],
    emailVerified: true,
    email: 'laura@hospeda.com.ar',
    name: 'Laura Vega'
});

function buildApp(actor: AppBindings['Variables']['actor']) {
    const app = new Hono<AppBindings>();
    app.onError(createErrorHandler());
    app.use('*', async (c, next) => {
        c.set('actor', actor);
        await next();
    });
    app.route('/api/v1/admin/direct-emails', directEmailAdminRoutes);
    app.route('/api/v1/admin/direct-email-templates', directEmailTemplateAdminRoutes);
    app.route('/api/v1/admin/direct-email-suppressions', directEmailSuppressionAdminRoutes);
    return app;
}

const json = (body: unknown) => ({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
});

const ok = <T>(data: T) => ({ data });

const {
    DIRECT_EMAIL_VIEW: VIEW,
    DIRECT_EMAIL_SEND: SEND,
    DIRECT_EMAIL_TEMPLATE_WRITE: WRITE
} = PermissionEnum;

beforeEach(() => {
    for (const group of Object.values(mocks)) {
        for (const fn of Object.values(group)) fn.mockReset();
    }
});

describe('admin direct email gates', () => {
    const MSG = '/api/v1/admin/direct-emails';
    const TPL = '/api/v1/admin/direct-email-templates';
    const SUP = '/api/v1/admin/direct-email-suppressions';

    const cases: ReadonlyArray<{
        label: string;
        url: string;
        init?: RequestInit;
        needs: PermissionEnum;
    }> = [
        { label: 'GET messages', url: MSG, needs: VIEW },
        { label: 'GET message', url: `${MSG}/${ID}`, needs: VIEW },
        {
            label: 'POST preview',
            url: `${MSG}/preview`,
            init: json({ subject: 's', bodyJson: BODY }),
            needs: VIEW
        },
        {
            label: 'POST check-recipients',
            url: `${MSG}/check-recipients`,
            init: json({ emails: ['a@example.com'] }),
            needs: VIEW
        },
        {
            label: 'POST test-send',
            url: `${MSG}/test-send`,
            init: json({ subject: 's', bodyJson: BODY }),
            needs: SEND
        },
        {
            label: 'POST send',
            url: MSG,
            init: json({ subject: 's', bodyJson: BODY, recipients: ['a@example.com'] }),
            needs: SEND
        },
        { label: 'GET templates', url: TPL, needs: VIEW },
        { label: 'GET template', url: `${TPL}/${ID}`, needs: VIEW },
        {
            label: 'POST template',
            url: TPL,
            init: json({ name: 'n', subject: 's', bodyJson: BODY }),
            needs: WRITE
        },
        {
            label: 'PATCH template',
            url: `${TPL}/${ID}`,
            init: { ...json({ name: 'n' }), method: 'PATCH' },
            needs: WRITE
        },
        { label: 'DELETE template', url: `${TPL}/${ID}`, init: { method: 'DELETE' }, needs: WRITE },
        { label: 'GET suppressions', url: SUP, needs: VIEW },
        { label: 'POST suppression', url: SUP, init: json({ email: 'a@b.com' }), needs: SEND },
        {
            label: 'DELETE suppression',
            url: `${SUP}/${ID}`,
            init: { method: 'DELETE' },
            needs: SEND
        }
    ];

    it.each(cases)('$label answers 403 without $needs and never reaches the service', async ({
        url,
        init
    }) => {
        // Arrange: an admin with every OTHER direct email permission but not the needed one
        const all = [VIEW, SEND, WRITE];
        const needed = cases.find(
            (c) => c.url === url && (c.init?.method ?? 'GET') === (init?.method ?? 'GET')
        )?.needs as PermissionEnum;
        const app = buildApp(actorWith(...all.filter((p) => p !== needed)));

        // Act
        const res = await app.request(url, init);

        // Assert
        expect(res.status).toBe(403);
        for (const group of Object.values(mocks)) {
            for (const fn of Object.values(group)) expect(fn).not.toHaveBeenCalled();
        }
    });

    it('answers 401 for a guest', async () => {
        const res = await buildApp(createGuestActor()).request(MSG);
        expect(res.status).toBe(401);
    });

    it('answers 403 to an EDITOR-like actor with none of the permissions', async () => {
        const res = await buildApp(actorWith()).request(MSG);
        expect(res.status).toBe(403);
    });
});

describe('admin direct email messages', () => {
    const MSG = '/api/v1/admin/direct-emails';

    it('lists the history with pagination', async () => {
        // Arrange
        mocks.message.list.mockResolvedValue(
            ok({ items: [{ ...messageFixture, recipientCount: 2 }], total: 1 })
        );

        // Act
        const res = await buildApp(actorWith(VIEW)).request(`${MSG}?page=2&pageSize=5&search=hola`);

        // Assert
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data.items).toHaveLength(1);
        expect(body.data.items[0]).toMatchObject({ id: ID, recipientCount: 2 });
        expect(body.data.pagination).toMatchObject({ page: 2, pageSize: 5, total: 1 });
        expect(mocks.message.list).toHaveBeenCalledWith(expect.anything(), {
            page: 2,
            pageSize: 5,
            search: 'hola'
        });
    });

    it('gets one message', async () => {
        mocks.message.getById.mockResolvedValue(
            ok({ ...messageFixture, recipients: [recipientFixture] })
        );
        const res = await buildApp(actorWith(VIEW)).request(`${MSG}/${ID}`);
        expect(res.status).toBe(200);
        expect((await res.json()).data.id).toBe(ID);
    });

    it('answers 400 for a non-UUID id and 404 for an unknown message', async () => {
        const app = buildApp(actorWith(VIEW));
        expect((await app.request(`${MSG}/abc`)).status).toBe(400);
        mocks.message.getById.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'nope',
                undefined,
                'DIRECT_EMAIL_NOT_FOUND'
            )
        });
        expect((await app.request(`${MSG}/${ID}`)).status).toBe(404);
    });

    it('previews with the real HTML from the service', async () => {
        mocks.message.preview.mockResolvedValue(ok({ subject: 's', html: '<html></html>' }));
        const res = await buildApp(actorWith(VIEW)).request(
            `${MSG}/preview`,
            json({ subject: 's', bodyJson: BODY })
        );
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ subject: 's', html: '<html></html>' });
    });

    it('checks recipients', async () => {
        mocks.message.checkRecipients.mockResolvedValue(ok({ suppressed: ['a@example.com'] }));
        const res = await buildApp(actorWith(VIEW)).request(
            `${MSG}/check-recipients`,
            json({ emails: ['A@example.com'] })
        );
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({ suppressed: ['a@example.com'] });
    });

    it('test-sends and answers 200', async () => {
        mocks.message.testSend.mockResolvedValue(
            ok({ sentTo: 'laura@hospeda.com.ar', delivered: true, providerError: null })
        );
        const res = await buildApp(actorWith(SEND)).request(
            `${MSG}/test-send`,
            json({ subject: 's', bodyJson: BODY })
        );
        expect(res.status).toBe(200);
        expect((await res.json()).data).toEqual({
            sentTo: 'laura@hospeda.com.ar',
            delivered: true,
            providerError: null
        });
    });

    it('test-send answers 200 with the provider text when the provider refuses (a 502 would be masked)', async () => {
        mocks.message.testSend.mockResolvedValue(
            ok({
                sentTo: 'laura@hospeda.com.ar',
                delivered: false,
                providerError: 'sender not verified'
            })
        );
        const res = await buildApp(actorWith(SEND)).request(
            `${MSG}/test-send`,
            json({ subject: 's', bodyJson: BODY })
        );
        expect(res.status).toBe(200);
        expect((await res.json()).data).toMatchObject({
            delivered: false,
            providerError: 'sender not verified'
        });
    });

    it('maps a suppressed test-send target to 409', async () => {
        mocks.message.testSend.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'suppressed',
                undefined,
                'DIRECT_EMAIL_RECIPIENT_SUPPRESSED'
            )
        });
        const res = await buildApp(actorWith(SEND)).request(
            `${MSG}/test-send`,
            json({ subject: 's', bodyJson: BODY, toEmail: 'x@example.com' })
        );
        expect(res.status).toBe(409);
    });

    it('sends and answers 201 with one result per recipient', async () => {
        // Arrange
        const results = [
            { email: 'a@example.com', status: 'sent', providerMessageId: '<1>', error: null },
            { email: 'b@example.com', status: 'failed', providerMessageId: null, error: 'boom' }
        ];
        mocks.message.send.mockResolvedValue(ok({ messageId: ID, results }));

        // Act
        const res = await buildApp(actorWith(SEND)).request(
            MSG,
            json({
                subject: 's',
                bodyJson: BODY,
                recipients: ['a@example.com', 'B@example.com'],
                idempotencyKey: KEY
            })
        );

        // Assert
        expect(res.status).toBe(201);
        expect((await res.json()).data).toEqual({ messageId: ID, results });
        expect(mocks.message.send).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'laura@hospeda.com.ar' }),
            expect.objectContaining({
                recipients: ['a@example.com', 'b@example.com'],
                idempotencyKey: KEY
            })
        );
    });

    it('answers 400 without a valid idempotency key before reaching the service', async () => {
        const app = buildApp(actorWith(SEND));
        const base = { subject: 's', bodyJson: BODY, recipients: ['a@example.com'] };

        const missing = await app.request(MSG, json(base));
        const malformed = await app.request(MSG, json({ ...base, idempotencyKey: 'not-a-uuid' }));

        expect(missing.status).toBe(400);
        expect(malformed.status).toBe(400);
        expect(mocks.message.send).not.toHaveBeenCalled();
    });

    it('answers 201 with the stored results when the service replays a repeated key', async () => {
        const results = [
            { email: 'a@example.com', status: 'sent', providerMessageId: '<1>', error: null }
        ];
        mocks.message.send.mockResolvedValue(ok({ messageId: ID, results }));

        const res = await buildApp(actorWith(SEND)).request(
            MSG,
            json({
                subject: 's',
                bodyJson: BODY,
                recipients: ['a@example.com'],
                idempotencyKey: KEY
            })
        );

        expect(res.status).toBe(201);
        expect((await res.json()).data).toEqual({ messageId: ID, results });
    });

    it.each([
        ['an invalid address', { recipients: ['nope'] }],
        ['a case-insensitive duplicate', { recipients: ['a@example.com', 'A@Example.com'] }],
        [
            'more than 20 recipients',
            { recipients: Array.from({ length: 21 }, (_, i) => `u${i}@example.com`) }
        ],
        ['an empty subject', { subject: '' }],
        ['an empty body', { bodyJson: { type: 'doc', content: [{ type: 'paragraph' }] } }]
    ])('answers 400 for %s before reaching the service (AC-3)', async (_label, override) => {
        const res = await buildApp(actorWith(SEND)).request(
            MSG,
            json({
                subject: 's',
                bodyJson: BODY,
                recipients: ['a@example.com'],
                idempotencyKey: KEY,
                ...override
            })
        );
        expect(res.status).toBe(400);
        expect(mocks.message.send).not.toHaveBeenCalled();
    });
});

describe('admin direct email templates', () => {
    const TPL = '/api/v1/admin/direct-email-templates';

    it('lists, gets, creates, updates and deletes', async () => {
        // Arrange
        const app = buildApp(actorWith(VIEW, WRITE));
        mocks.template.list.mockResolvedValue(ok({ items: [templateFixture], total: 1 }));
        mocks.template.getById.mockResolvedValue(ok(templateFixture));
        mocks.template.create.mockResolvedValue(ok(templateFixture));
        mocks.template.update.mockResolvedValue(ok(templateFixture));
        mocks.template.softDelete.mockResolvedValue(ok({ id: ID }));

        // Act
        const list = await app.request(TPL);
        const get = await app.request(`${TPL}/${ID}`);
        const create = await app.request(TPL, json({ name: 'n', subject: 's', bodyJson: BODY }));
        const update = await app.request(`${TPL}/${ID}`, {
            ...json({ subject: 'nuevo' }),
            method: 'PATCH'
        });
        const del = await app.request(`${TPL}/${ID}`, { method: 'DELETE' });

        // Assert
        expect(list.status).toBe(200);
        expect((await get.json()).data.bodyJson).toEqual(BODY);
        expect(create.status).toBe(201);
        expect(update.status).toBe(200);
        expect(del.status).toBe(204);
        expect(mocks.template.update).toHaveBeenCalledWith(expect.anything(), {
            id: ID,
            data: { subject: 'nuevo' }
        });
    });

    it('answers 400 for an empty name and for an empty patch', async () => {
        const app = buildApp(actorWith(WRITE));
        const empty = await app.request(TPL, json({ name: '', subject: 's', bodyJson: BODY }));
        const patch = await app.request(`${TPL}/${ID}`, { ...json({}), method: 'PATCH' });
        expect(empty.status).toBe(400);
        expect(patch.status).toBe(400);
        expect(mocks.template.create).not.toHaveBeenCalled();
        expect(mocks.template.update).not.toHaveBeenCalled();
    });

    it('answers 404 when the template does not exist', async () => {
        mocks.template.softDelete.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                'nope',
                undefined,
                'DIRECT_EMAIL_TEMPLATE_NOT_FOUND'
            )
        });
        const res = await buildApp(actorWith(WRITE)).request(`${TPL}/${ID}`, { method: 'DELETE' });
        expect(res.status).toBe(404);
    });
});

describe('admin direct email suppressions', () => {
    const SUP = '/api/v1/admin/direct-email-suppressions';

    it('lists with a reason filter, adds and removes', async () => {
        // Arrange
        const app = buildApp(actorWith(VIEW, SEND));
        mocks.suppression.list.mockResolvedValue(ok({ items: [], total: 0 }));
        mocks.suppression.add.mockResolvedValue(ok(suppressionFixture));
        mocks.suppression.remove.mockResolvedValue(ok({ id: ID }));

        // Act
        const list = await app.request(`${SUP}?reason=opt_out`);
        const add = await app.request(SUP, json({ email: 'A@B.com' }));
        const remove = await app.request(`${SUP}/${ID}`, { method: 'DELETE' });

        // Assert
        expect(list.status).toBe(200);
        expect(mocks.suppression.list).toHaveBeenCalledWith(expect.anything(), {
            page: 1,
            pageSize: 20,
            reason: 'opt_out'
        });
        expect(add.status).toBe(201);
        expect(mocks.suppression.add).toHaveBeenCalledWith(expect.anything(), { email: 'a@b.com' });
        expect(remove.status).toBe(204);
    });

    it('answers 409 with the locked reason when removing an opt_out suppression', async () => {
        mocks.suppression.remove.mockResolvedValue({
            error: new ServiceError(
                ServiceErrorCode.ALREADY_EXISTS,
                'locked',
                undefined,
                'DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED'
            )
        });
        const res = await buildApp(actorWith(VIEW, SEND)).request(`${SUP}/${ID}`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(409);
        expect((await res.json()).error.reason).toBe('DIRECT_EMAIL_SUPPRESSION_OPT_OUT_LOCKED');
    });

    it('answers 400 for an invalid address and an unknown reason', async () => {
        const app = buildApp(actorWith(VIEW, SEND));
        expect((await app.request(SUP, json({ email: 'nope' }))).status).toBe(400);
        expect((await app.request(`${SUP}?reason=bogus`)).status).toBe(400);
    });
});
