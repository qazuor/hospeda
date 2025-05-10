import { db } from '../../client';
import { notifications } from '../../schema/notifications';

const now = new Date().toISOString();

export async function seedExampleNotifications() {
    await db.delete(notifications);

    console.log('[seed] Inserting example notifications...');

    await db.insert(notifications).values([
        {
            id: '60000000-0000-0000-0000-000000000001',
            type: 'SYSTEM',
            title: 'Bienvenido a Hospeda',
            message: 'Tu cuenta ha sido creada correctamente.',
            htmlMessage: '<p>¡Gracias por unirte a <strong>Hospeda</strong>!</p>',
            channels: ['EMAIL'],
            target: { type: 'user', userId: '10000000-0000-0000-0000-000000000004' }, // guest1
            targetUserId: '10000000-0000-0000-0000-000000000004',
            status: 'SENT',
            state: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
            sentAt: now
        },
        {
            id: '60000000-0000-0000-0000-000000000002',
            type: 'MARKETING',
            title: 'Nueva funcionalidad: Alojamiento destacado',
            message: 'Probá la opción de destacar tu alojamiento y recibir más visitas.',
            channels: ['PUSH', 'IN_APP'],
            target: { type: 'roles', roles: ['CLIENT'] },
            status: 'PENDING',
            state: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
            scheduledAt: now
        },
        {
            id: '60000000-0000-0000-0000-000000000003',
            type: 'PAYMENT',
            title: 'Pago recibido',
            message: 'Tu pago de ARS 25.000 ha sido confirmado.',
            channels: ['EMAIL'],
            target: { type: 'user', userId: '10000000-0000-0000-0000-000000000003' }, // host1
            targetUserId: '10000000-0000-0000-0000-000000000003',
            status: 'SENT',
            metadata: {
                amount: 25000,
                currency: 'ARS',
                ref: 'PAY-2024-XYZ123'
            },
            state: 'ACTIVE',
            createdAt: now,
            updatedAt: now,
            sentAt: now
        }
    ]);
}
