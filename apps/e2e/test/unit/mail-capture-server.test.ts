import { afterEach, describe, expect, it } from 'vitest';
import {
    E2E_MAIL_CAPTURE_PORT,
    type E2eMailCaptureServer,
    startE2eMailCapture
} from '../../fixtures/mail-capture-server.ts';

describe('TEST:V4:23 support mail capture server', () => {
    let capture: E2eMailCaptureServer | null = null;

    afterEach(async () => {
        await capture?.close();
        capture = null;
    });

    it('uses the port configured for the built API by default', async () => {
        capture = await startE2eMailCapture();
        expect(capture.port).toBe(E2E_MAIL_CAPTURE_PORT);
    });

    it('captures Brevo mail by recipient and subject and releases its port', async () => {
        capture = await startE2eMailCapture({ port: 0 });
        const response = await fetch(`${capture.url}/smtp/email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: 'noreply@example.test', name: 'Hospeda' },
                to: [{ email: 'owner@example.test' }],
                subject: 'Trial reminder',
                htmlContent: '<h1>Trial reminder</h1>',
                tags: ['trial']
            })
        });
        expect(response.status).toBe(201);
        expect(await response.json()).toMatchObject({
            messageId: expect.stringMatching(/@e2e-capture$/)
        });
        const received = await capture.waitForMail({
            to: 'owner@example.test',
            subject: 'Trial reminder',
            timeoutMs: 100
        });
        expect(received.html).toContain('<h1>Trial reminder</h1>');
        expect(capture.mailsTo({ to: 'other@example.test' })).toHaveLength(0);
        expect(capture.mailsTo({ to: 'owner@example.test' })).toHaveLength(1);
        const port = capture.port;
        await capture.close();
        capture = null;
        const { createServer } = await import('node:net');
        const server = createServer();
        await new Promise<void>((resolve, reject) => {
            server.once('error', reject);
            server.listen(port, '127.0.0.1', () => resolve());
        });
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it('rejects other routes and invalid JSON', async () => {
        capture = await startE2eMailCapture({ port: 0 });
        expect((await fetch(capture.url)).status).toBe(404);
        expect(
            (
                await fetch(`${capture.url}/smtp/email`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: '{broken'
                })
            ).status
        ).toBe(400);
    });

    it('lists captured subjects when waiting times out', async () => {
        capture = await startE2eMailCapture({ port: 0 });
        await fetch(`${capture.url}/smtp/email`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                sender: { email: 'sender@example.test' },
                to: [{ email: 'owner@example.test' }],
                subject: 'Already captured',
                htmlContent: '<p>body</p>'
            })
        });
        await expect(
            capture.waitForMail({
                to: 'owner@example.test',
                subject: 'Missing subject',
                timeoutMs: 10
            })
        ).rejects.toThrow(/Already captured/);
    });
});
