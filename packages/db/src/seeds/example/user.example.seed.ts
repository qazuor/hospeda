import { logger } from '@repo/logger';
import { BuiltinRoleTypeEnum, PreferedContactEnum, StateEnum } from '@repo/types';
import * as bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { getDb } from '../../client.js';
import { roles, users } from '../../schema';

/**
 * Seeds example users with different roles and profiles
 */
export async function seedExampleUsers() {
    logger.info('Starting to seed example users', 'seedExampleUsers');

    try {
        const db = getDb();

        // Get available roles
        const availableRoles = await db.select().from(roles);

        if (!availableRoles || availableRoles.length === 0) {
            throw new Error('No roles found. Please seed roles first.');
        }

        // Map roles by name for easier access
        const rolesMap = new Map();
        for (const role of availableRoles) {
            rolesMap.set(role.name, role);
        }

        // Define example users with different roles and profiles
        const exampleUsers = [
            {
                id: crypto.randomUUID(),
                name: 'editor',
                displayName: 'Editor User',
                userName: 'editor',
                passwordHash: await bcrypt.hash('editor123', 10),
                firstName: 'María',
                lastName: 'González',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.EDITOR)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'editor@example.com',
                    mobilePhone: '5491123456789',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    bio: 'Editor de contenido con experiencia en turismo',
                    avatar: 'https://i.pravatar.cc/300?img=5'
                },
                settings: {
                    darkMode: true,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de editor',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'client1',
                displayName: 'Hotel Owner',
                userName: 'client1',
                passwordHash: await bcrypt.hash('client123', 10),
                firstName: 'Carlos',
                lastName: 'Rodríguez',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.CLIENT)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'client1@example.com',
                    workEmail: 'info@hotelexample.com',
                    mobilePhone: '5491187654321',
                    workPhone: '5493442123456',
                    website: 'https://www.hotelexample.com',
                    preferredEmail: PreferedContactEnum.WORK,
                    preferredPhone: PreferedContactEnum.WORK
                },
                profile: {
                    bio: 'Propietario de hotel en Colón con 15 años de experiencia',
                    avatar: 'https://i.pravatar.cc/300?img=12'
                },
                settings: {
                    darkMode: false,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: false
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de cliente (propietario)',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'client2',
                displayName: 'Cabañas del Río',
                userName: 'client2',
                passwordHash: await bcrypt.hash('client456', 10),
                firstName: 'Ana',
                lastName: 'Martínez',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.CLIENT)?.id,
                emailVerified: true,
                phoneVerified: false,
                contactInfo: {
                    personalEmail: 'client2@example.com',
                    workEmail: 'reservas@cabanasdelrio.com',
                    mobilePhone: '5491145678901',
                    preferredEmail: PreferedContactEnum.WORK,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    bio: 'Administradora de complejo de cabañas en Gualeguaychú',
                    avatar: 'https://i.pravatar.cc/300?img=9'
                },
                settings: {
                    darkMode: true,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: false,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de cliente (administrador)',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'user1',
                displayName: 'Regular User',
                userName: 'user1',
                passwordHash: await bcrypt.hash('user123', 10),
                firstName: 'Juan',
                lastName: 'Pérez',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.USER)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'user1@example.com',
                    mobilePhone: '5491156789012',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    bio: 'Viajero frecuente por la costa del río Uruguay',
                    avatar: 'https://i.pravatar.cc/300?img=3'
                },
                settings: {
                    darkMode: false,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol básico',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'user2',
                displayName: 'Inactive User',
                userName: 'user2',
                passwordHash: await bcrypt.hash('user456', 10),
                firstName: 'Laura',
                lastName: 'Gómez',
                state: StateEnum.INACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.USER)?.id,
                emailVerified: false,
                phoneVerified: false,
                contactInfo: {
                    personalEmail: 'user2@example.com',
                    mobilePhone: '5491167890123',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    avatar: 'https://i.pravatar.cc/300?img=8'
                },
                settings: {
                    darkMode: true,
                    language: 'es',
                    notifications: {
                        enabled: false,
                        allowEmails: false,
                        allowSms: false,
                        allowPush: false
                    }
                },
                adminInfo: {
                    notes: 'Usuario inactivo de ejemplo',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'client3',
                displayName: 'Termas Resort',
                userName: 'client3',
                passwordHash: await bcrypt.hash('client789', 10),
                firstName: 'Roberto',
                lastName: 'Fernández',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.CLIENT)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'client3@example.com',
                    workEmail: 'gerencia@termasresort.com',
                    mobilePhone: '5491178901234',
                    workPhone: '5493456789012',
                    website: 'https://www.termasresort.com',
                    preferredEmail: PreferedContactEnum.WORK,
                    preferredPhone: PreferedContactEnum.WORK
                },
                profile: {
                    bio: 'Gerente de complejo termal en Federación',
                    avatar: 'https://i.pravatar.cc/300?img=15'
                },
                settings: {
                    darkMode: false,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de cliente (gerente)',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'user3',
                displayName: 'Foreign Tourist',
                userName: 'user3',
                passwordHash: await bcrypt.hash('user789', 10),
                firstName: 'John',
                lastName: 'Smith',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.USER)?.id,
                emailVerified: true,
                phoneVerified: false,
                contactInfo: {
                    personalEmail: 'user3@example.com',
                    mobilePhone: '5491189012345',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    bio: 'Tourist from the United States exploring Argentina',
                    avatar: 'https://i.pravatar.cc/300?img=7'
                },
                settings: {
                    darkMode: true,
                    language: 'en',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: false,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario extranjero de ejemplo',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'client4',
                displayName: 'Camping El Río',
                userName: 'client4',
                passwordHash: await bcrypt.hash('client101', 10),
                firstName: 'Diego',
                lastName: 'Sánchez',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.CLIENT)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'client4@example.com',
                    workEmail: 'info@campingelrio.com',
                    mobilePhone: '5491190123456',
                    workPhone: '5493442234567',
                    website: 'https://www.campingelrio.com',
                    preferredEmail: PreferedContactEnum.WORK,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                profile: {
                    bio: 'Propietario de camping en Villa Paranacito',
                    avatar: 'https://i.pravatar.cc/300?img=11'
                },
                settings: {
                    darkMode: false,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: false
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de cliente (propietario de camping)',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'user4',
                displayName: 'Pending User',
                userName: 'user4',
                passwordHash: await bcrypt.hash('user101', 10),
                firstName: 'Sofía',
                lastName: 'López',
                state: StateEnum.PENDING,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.USER)?.id,
                emailVerified: false,
                phoneVerified: false,
                contactInfo: {
                    personalEmail: 'user4@example.com',
                    mobilePhone: '5491101234567',
                    preferredEmail: PreferedContactEnum.HOME,
                    preferredPhone: PreferedContactEnum.MOBILE
                },
                settings: {
                    darkMode: true,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: false,
                        allowPush: false
                    }
                },
                adminInfo: {
                    notes: 'Usuario pendiente de activación',
                    favorite: false
                },
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                id: crypto.randomUUID(),
                name: 'client5',
                displayName: 'Posada del Sol',
                userName: 'client5',
                passwordHash: await bcrypt.hash('client202', 10),
                firstName: 'Marcela',
                lastName: 'Ramírez',
                state: StateEnum.ACTIVE,
                roleId: rolesMap.get(BuiltinRoleTypeEnum.CLIENT)?.id,
                emailVerified: true,
                phoneVerified: true,
                contactInfo: {
                    personalEmail: 'client5@example.com',
                    workEmail: 'reservas@posadadelsol.com',
                    mobilePhone: '5491112345678',
                    workPhone: '5493442345678',
                    website: 'https://www.posadadelsol.com',
                    preferredEmail: PreferedContactEnum.WORK,
                    preferredPhone: PreferedContactEnum.WORK
                },
                profile: {
                    bio: 'Propietaria de posada en Concepción del Uruguay',
                    avatar: 'https://i.pravatar.cc/300?img=10'
                },
                settings: {
                    darkMode: false,
                    language: 'es',
                    notifications: {
                        enabled: true,
                        allowEmails: true,
                        allowSms: true,
                        allowPush: true
                    }
                },
                adminInfo: {
                    notes: 'Usuario de ejemplo con rol de cliente (propietaria de posada)',
                    favorite: true
                },
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ];

        // Check which users already exist and insert only new ones
        for (const user of exampleUsers) {
            const existingUser = await db
                .select()
                .from(users)
                .where(eq(users.userName, user.userName));

            if (existingUser.length > 0) {
                logger.info(`User ${user.userName} already exists, skipping`, 'seedExampleUsers');
                continue;
            }

            const createdUser = await db.insert(users).values(user);
            logger.info(`User ${user.userName} created successfully`, 'seedExampleUsers');
            logger.query('insert', 'users', { userName: user.userName }, createdUser);
        }

        logger.info('Example users seeded successfully', 'seedExampleUsers');
    } catch (error) {
        logger.error('Failed to seed example users', 'seedExampleUsers', error);
        throw error;
    }
}
