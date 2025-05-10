import { db } from '../../client';
import { users } from '../../schema/users';

const now = new Date().toISOString();

/**
 * Seeds at least one user per role: ADMIN, EDITOR, CLIENT, USER.
 */
export async function seedExampleUsers() {
    await db.delete(users);

    console.log('[seed] Inserting example users...');

    await db.insert(users).values([
        {
            id: '10000000-0000-0000-0000-000000000001',
            userName: 'admin1',
            passwordHash: 'hashed_admin_pass',
            displayName: 'Alice Admin',
            firstName: 'Alice',
            lastName: 'Admin',
            brithDate: '1985-01-01',
            role: 'ADMIN',
            state: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            contactInfo: {
                personalEmail: 'alice@hospeda.com',
                mobilePhone: '+541111111111',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            socialNetworks: { instagram: 'https://instagram.com/aliceadmin' },
            location: {
                street: 'Av. Central 123',
                city: 'Concepción del Uruguay',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: '-32.4825', long: '-58.2372' }
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '10000000-0000-0000-0000-000000000002',
            userName: 'editor1',
            passwordHash: 'hashed_editor_pass',
            displayName: 'Edwin Editor',
            firstName: 'Edwin',
            lastName: 'Notas',
            brithDate: '1988-06-12',
            role: 'EDITOR',
            state: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            contactInfo: {
                personalEmail: 'editor@hospeda.com',
                mobilePhone: '+541122223333',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            socialNetworks: { twitter: 'https://twitter.com/edwineditor' },
            location: {
                street: 'Calle Prensa 99',
                city: 'Gualeguaychú',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: '-33.0067', long: '-58.5172' }
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '10000000-0000-0000-0000-000000000003',
            userName: 'host1',
            passwordHash: 'hashed_host_pass',
            displayName: 'Carlos Host',
            firstName: 'Carlos',
            lastName: 'Ríos',
            brithDate: '1980-03-15',
            role: 'CLIENT',
            state: 'ACTIVE',
            emailVerified: true,
            phoneVerified: true,
            contactInfo: {
                personalEmail: 'carlos@hospeda.com',
                mobilePhone: '+541122223334',
                preferredEmail: 'WORK',
                preferredPhone: 'MOBILE'
            },
            socialNetworks: { facebook: 'https://facebook.com/carlosrios' },
            location: {
                street: 'Costanera Sur 456',
                city: 'Colón',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: '-32.2167', long: '-58.1444' }
            },
            createdAt: now,
            updatedAt: now
        },
        {
            id: '10000000-0000-0000-0000-000000000004',
            userName: 'guest1',
            passwordHash: 'hashed_guest_pass',
            displayName: 'Gustavo Guest',
            firstName: 'Gustavo',
            lastName: 'Paz',
            brithDate: '1992-07-22',
            role: 'USER',
            state: 'ACTIVE',
            emailVerified: true,
            phoneVerified: false,
            contactInfo: {
                personalEmail: 'gustavo@correo.com',
                mobilePhone: '+5493512345678',
                preferredEmail: 'HOME',
                preferredPhone: 'MOBILE'
            },
            socialNetworks: { twitter: 'https://twitter.com/gustavopaz' },
            location: {
                street: 'Pasaje Paz 789',
                city: 'Federación',
                state: 'Entre Ríos',
                country: 'Argentina',
                coordinates: { lat: '-30.9749', long: '-57.9232' }
            },
            createdAt: now,
            updatedAt: now
        }
    ]);
}
