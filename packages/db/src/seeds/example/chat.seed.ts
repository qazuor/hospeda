import { db } from '../../client';
import { chatMessages, chatThreads } from '../../schema/chat';

const now = new Date().toISOString();

export async function seedExampleChat() {
    await db.delete(chatMessages);
    await db.delete(chatThreads);

    console.log('[seed] Inserting example chat conversation...');

    await db.insert(chatThreads).values({
        id: 'a0000000-0000-0000-0000-000000000001',
        accommodation: '20000000-0000-0000-0000-000000000001', // cabania-rio-colon
        guestId: '10000000-0000-0000-0000-000000000004', // guest1
        hostId: '10000000-0000-0000-0000-000000000003', // host1
        isArchived: false,
        isBlocked: false,
        createdAt: now,
        updatedAt: now
    });

    await db.insert(chatMessages).values([
        {
            id: 'a1000000-0000-0000-0000-000000000001',
            threadId: 'a0000000-0000-0000-0000-000000000001',
            senderId: '10000000-0000-0000-0000-000000000004',
            receiverId: '10000000-0000-0000-0000-000000000003',
            content: 'Hola, ¿está disponible la cabaña para este fin de semana?',
            type: 'TEXT',
            sentAt: now,
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'a1000000-0000-0000-0000-000000000002',
            threadId: 'a0000000-0000-0000-0000-000000000001',
            senderId: '10000000-0000-0000-0000-000000000003',
            receiverId: '10000000-0000-0000-0000-000000000004',
            content: 'Sí, está disponible. ¿Querés reservar?',
            type: 'TEXT',
            sentAt: now,
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'a1000000-0000-0000-0000-000000000003',
            threadId: 'a0000000-0000-0000-0000-000000000001',
            senderId: '10000000-0000-0000-0000-000000000004',
            receiverId: '10000000-0000-0000-0000-000000000003',
            content: 'Sí, me gustaría reservar del 5 al 7 de enero.',
            type: 'BOOKING_REQUEST',
            sentAt: now,
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'a1000000-0000-0000-0000-000000000004',
            threadId: 'a0000000-0000-0000-0000-000000000001',
            senderId: '10000000-0000-0000-0000-000000000003',
            receiverId: '10000000-0000-0000-0000-000000000004',
            content: 'Reserva confirmada 🎉',
            type: 'SYSTEM',
            sentAt: now,
            createdAt: now,
            updatedAt: now
        }
    ]);
}
