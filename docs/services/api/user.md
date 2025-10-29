# User Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Autenticación y Autorización](#autenticacion-y-autorizacion)
- [Gestión de Roles y Permisos](#gestion-de-roles-y-permisos)
- [Perfil de Usuario](#perfil-de-usuario)
- [Identidades Externas](#identidades-externas)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `UserService` gestiona usuarios, autenticación y autorización en Hospeda. Integra con Clerk como proveedor de autenticación principal y maneja un sistema granular de roles y permisos basado en el patrón Actor. Proporciona operaciones CRUD estrictas con validación de permisos.

### Entidad User

Un usuario incluye:

- **Información Básica**: Nombre, slug, email, teléfono
- **Autenticación**: Proveedor (Clerk), ID externo, roles
- **Perfil**: Bio, avatar, ubicación, redes sociales
- **Configuración**: Preferencias, notificaciones, privacidad
- **Permisos**: Roles asignados y permisos granulares
- **Identidades**: Conexiones OAuth (Google, Facebook, etc.)
- **Actividad**: Fechas de registro, último acceso, estado

### Sistema de Roles

Hospeda utiliza un sistema jerárquico de roles:

```typescript
enum RoleEnum {
    SUPER_ADMIN = "SUPER_ADMIN",     // Acceso total al sistema
    ADMIN = "ADMIN",                 // Administrador general
    CONTENT_MANAGER = "CONTENT_MANAGER", // Gestión de contenido
    HOST = "HOST",                   // Anfitrión de alojamientos
    USER = "USER",                   // Usuario registrado estándar
    GUEST = "GUEST"                  // Usuario no registrado
}
```

### Proveedores de Autenticación

```typescript
enum AuthProvider {
    CLERK = "CLERK",                 // Proveedor principal
    GOOGLE = "GOOGLE",               // OAuth Google
    FACEBOOK = "FACEBOOK",           // OAuth Facebook
    APPLE = "APPLE",                 // OAuth Apple
    EMAIL = "EMAIL"                  // Email/password directo
}
```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: UserCreateInput)

Crea un nuevo usuario (Solo SUPER_ADMIN).

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `input`: Datos del usuario a crear

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Validaciones:**

- Email único en el sistema
- Slug único generado desde displayName
- Proveedor de autenticación válido
- Rol válido para asignación

**Ejemplo de Input:**

```typescript
{
    displayName: "María González",
    slug: "maria-gonzalez", // Opcional, se genera automáticamente
    email: "maria@example.com",
    phone: "+34 600 123 456",
    
    // Autenticación
    authProvider: "CLERK",
    authProviderUserId: "clerk_user_123",
    
    // Rol inicial
    role: "USER",
    
    // Perfil básico
    profile: {
        bio: "Apasionada de los viajes y la fotografía",
        location: {
            country: "España",
            city: "Barcelona"
        },
        socialNetworks: {
            instagram: "@maria_travels",
            twitter: "@mariagonzalez"
        }
    },
    
    // Configuración inicial
    settings: {
        language: "es",
        currency: "EUR",
        timezone: "Europe/Madrid",
        notifications: {
            email: true,
            push: true,
            marketing: false
        },
        privacy: {
            profileVisible: true,
            showEmail: false,
            showPhone: false
        }
    }
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "user_123",
        displayName: "María González",
        slug: "maria-gonzalez",
        email: "maria@example.com",
        role: "USER",
        permissions: [], // Permisos adicionales vacíos inicialmente
        // ... resto de campos
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### getById(actor: Actor, id: string)

Obtiene un usuario por su ID.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `id`: ID del usuario

**Permisos Requeridos:**

- El propio usuario puede ver su perfil completo
- Otros usuarios ven versión pública (según configuración de privacidad)
- ADMIN y SUPER_ADMIN ven toda la información

**Ejemplo:**

```typescript
const result = await userService.getById(actor, "user_123");
if (result.data) {
    console.log(result.data.displayName); // "María González"
    console.log(result.data.role); // "USER"
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene un usuario por su slug.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `slug`: Slug del usuario

**Ejemplo:**

```typescript
const result = await userService.getBySlug(actor, "maria-gonzalez");
```

### update(actor: Actor, id: string, input: UserUpdateInput)

Actualiza un usuario existente (PUT - reemplaza completamente).

**Permisos Requeridos:**

- El propio usuario puede actualizar su información
- Solo SUPER_ADMIN puede actualizar otros usuarios

### patch(actor: Actor, id: string, input: UserPatchInput)

Actualiza parcialmente un usuario (PATCH - actualización incremental).

**Permisos Requeridos:**

- El propio usuario puede actualizar su información
- Solo SUPER_ADMIN puede actualizar otros usuarios

**Ejemplo:**

```typescript
// Usuario actualiza su propio perfil
const result = await userService.patch(actor, actor.user.id, {
    profile: {
        bio: "Viajera y fotógrafa profesional especializada en destinos europeos"
    },
    settings: {
        notifications: {
            marketing: true // Acepta marketing
        }
    }
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente un usuario (soft delete).

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Funcionalidad:**

- Preserva datos para auditoría
- Desactiva acceso del usuario
- Mantiene referencias en contenido creado

### hardDelete(actor: Actor, id: string)

Elimina físicamente un usuario (hard delete - irreversible).

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Advertencia:** Elimina permanentemente todos los datos del usuario.

### restore(actor: Actor, id: string)

Restaura un usuario eliminado lógicamente.

**Permisos Requeridos:** Solo `SUPER_ADMIN`

### list(actor: Actor, params: UserSearchInput)

Lista usuarios con paginación y filtros.

**Permisos Requeridos:** Solo `ADMIN` y `SUPER_ADMIN`

**Parámetros de Búsqueda:**

```typescript
{
    q?: string;                    // Búsqueda por texto (nombre, email)
    role?: RoleEnum;              // Filtro por rol
    authProvider?: AuthProvider;   // Filtro por proveedor
    isActive?: boolean;           // Solo usuarios activos
    hasPermission?: string;       // Usuarios con permiso específico
    registeredAfter?: string;     // Registrados después de fecha
    registeredBefore?: string;    // Registrados antes de fecha
    page?: number;                // Página (default: 1)
    pageSize?: number;            // Elementos por página (default: 20, max: 100)
}
```

## 🔐 Autenticación y Autorización {#autenticacion-y-autorizacion}

### getByAuthProviderId(actor: Actor, params: UserGetByAuthProviderInput)

Obtiene un usuario por su ID de proveedor de autenticación.

**Parámetros:**

```typescript
{
    provider: AuthProvider;        // Proveedor de autenticación
    providerUserId: string;       // ID del usuario en el proveedor
}
```

**Uso Principal:** Integración con Clerk para mapear usuarios externos.

**Ejemplo:**

```typescript
const result = await userService.getByAuthProviderId(actor, {
    provider: "CLERK",
    providerUserId: "clerk_user_123"
});
```

### ensureFromAuthProvider(actor: Actor, params: UserEnsureFromAuthProviderInput)

Asegura que existe un usuario para un proveedor de autenticación. Si no existe, lo crea.

**Parámetros:**

```typescript
{
    provider: AuthProvider;        // Proveedor (ej: CLERK)
    providerUserId: string;       // ID en el proveedor
    profile: {                    // Datos del perfil desde el proveedor
        email: string;
        displayName?: string;
        firstName?: string;
        lastName?: string;
        avatar?: string;
        phone?: string;
    };
    identities?: ExternalIdentity[]; // Identidades OAuth conectadas
}
```

**Funcionalidad:**

- **Si existe:** Actualiza información del perfil desde el proveedor
- **Si no existe:** Crea nuevo usuario con datos del proveedor
- **Upsert identities:** Gestiona conexiones OAuth (Google, Facebook, etc.)

**Ejemplo de Uso con Clerk:**

```typescript
// Llamado desde middleware de autenticación
const result = await userService.ensureFromAuthProvider(systemActor, {
    provider: "CLERK",
    providerUserId: clerkUser.id,
    profile: {
        email: clerkUser.emailAddresses[0]?.emailAddress,
        displayName: clerkUser.firstName + " " + clerkUser.lastName,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        avatar: clerkUser.imageUrl,
        phone: clerkUser.phoneNumbers[0]?.phoneNumber
    },
    identities: clerkUser.externalAccounts.map(account => ({
        provider: account.provider,
        providerUserId: account.providerUserId,
        email: account.emailAddress
    }))
});

// El usuario ya existe o se ha creado
const user = result.data.user;
const wasCreated = result.data.created;
```

## 👥 Gestión de Roles y Permisos {#gestion-de-roles-y-permisos}

### assignRole(actor: Actor, params: UserAssignRoleInput)

Asigna un rol a un usuario.

**Parámetros:**

```typescript
{
    userId: string;               // ID del usuario
    role: RoleEnum;              // Rol a asignar
}
```

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Validaciones:**

- Solo SUPER_ADMIN puede asignar roles
- No se puede asignar SUPER_ADMIN a otros usuarios
- Validación de jerarquía de roles

**Ejemplo:**

```typescript
// Promover usuario a HOST
const result = await userService.assignRole(actor, {
    userId: "user_123",
    role: "HOST"
});

// Asignar rol de administrador de contenido
const contentManager = await userService.assignRole(actor, {
    userId: "user_456", 
    role: "CONTENT_MANAGER"
});
```

### addPermission(actor: Actor, params: UserAddPermissionInput)

Añade un permiso específico a un usuario.

**Parámetros:**

```typescript
{
    userId: string;               // ID del usuario
    permission: PermissionEnum;   // Permiso a añadir
}
```

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Ejemplo:**

```typescript
// Dar permiso para moderar contenido
const result = await userService.addPermission(actor, {
    userId: "user_123",
    permission: "POST_MODERATE"
});

// Dar permiso para gestionar eventos
const eventPermission = await userService.addPermission(actor, {
    userId: "user_456",
    permission: "EVENT_CREATE"
});
```

### removePermission(actor: Actor, params: UserRemovePermissionInput)

Remueve un permiso específico de un usuario.

**Parámetros:**

```typescript
{
    userId: string;               // ID del usuario
    permission: PermissionEnum;   // Permiso a remover
}
```

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Ejemplo:**

```typescript
const result = await userService.removePermission(actor, {
    userId: "user_123",
    permission: "POST_MODERATE"
});
```

### setPermissions(actor: Actor, params: UserSetPermissionsInput)

Establece el conjunto completo de permisos de un usuario.

**Parámetros:**

```typescript
{
    userId: string;               // ID del usuario
    permissions: PermissionEnum[]; // Array completo de permisos
}
```

**Permisos Requeridos:** Solo `SUPER_ADMIN`

**Ejemplo:**

```typescript
// Establecer permisos específicos para un editor de contenido
const result = await userService.setPermissions(actor, {
    userId: "user_123",
    permissions: [
        "POST_CREATE",
        "POST_EDIT", 
        "POST_MODERATE",
        "EVENT_CREATE",
        "EVENT_EDIT"
    ]
});
```

### Matriz de Permisos por Rol

```typescript
const rolePermissions = {
    GUEST: [],
    
    USER: [
        "POST_READ", "POST_LIKE", "POST_COMMENT",
        "ACCOMMODATION_READ", "ACCOMMODATION_REVIEW",
        "EVENT_READ", "DESTINATION_READ"
    ],
    
    HOST: [
        ...USER_PERMISSIONS,
        "ACCOMMODATION_CREATE", "ACCOMMODATION_EDIT",
        "EVENT_CREATE", "EVENT_EDIT"
    ],
    
    CONTENT_MANAGER: [
        ...USER_PERMISSIONS,
        "POST_CREATE", "POST_EDIT", "POST_MODERATE",
        "EVENT_CREATE", "EVENT_EDIT", "EVENT_MODERATE"
    ],
    
    ADMIN: [
        // Todos los permisos excepto SUPER_ADMIN específicos
    ],
    
    SUPER_ADMIN: [
        // Todos los permisos del sistema
        "USER_CREATE", "USER_DELETE", "USER_MANAGE_ROLES"
    ]
};
```

## 👤 Perfil de Usuario {#perfil-de-usuario}

### getMyProfile(actor: Actor)

Obtiene el perfil completo del usuario autenticado.

**Respuesta Completa:**

```typescript
{
    data: {
        id: "user_123",
        displayName: "María González",
        slug: "maria-gonzalez",
        email: "maria@example.com",
        phone: "+34 600 123 456",
        
        profile: {
            bio: "Viajera apasionada por la fotografía",
            avatar: "https://images.clerk.dev/user_avatar.jpg",
            location: {
                country: "España",
                city: "Barcelona",
                timezone: "Europe/Madrid"
            },
            socialNetworks: {
                instagram: "@maria_travels",
                twitter: "@mariagonzalez",
                website: "https://mariatravels.com"
            }
        },
        
        settings: {
            language: "es",
            currency: "EUR",
            notifications: {
                email: true,
                push: true,
                marketing: false,
                newBookings: true,
                reviewReminders: true
            },
            privacy: {
                profileVisible: true,
                showEmail: false,
                showPhone: false,
                showLocation: true
            }
        },
        
        role: "HOST",
        permissions: ["ACCOMMODATION_CREATE", "ACCOMMODATION_EDIT"],
        
        stats: {
            accommodationsOwned: 3,
            postsCreated: 12,
            reviewsReceived: 45,
            averageRating: 4.7
        },
        
        membership: {
            joinedAt: "2023-06-15T10:30:00Z",
            lastActiveAt: "2024-09-22T08:15:00Z",
            isVerified: true,
            verificationLevel: "EMAIL_PHONE"
        }
    }
}
```

### updateMyProfile(actor: Actor, input: UserProfileUpdateInput)

Actualiza el perfil del usuario autenticado.

**Parámetros Editables:**

```typescript
{
    displayName?: string;
    bio?: string;
    avatar?: string;
    location?: {
        country?: string;
        city?: string;
        timezone?: string;
    };
    socialNetworks?: {
        instagram?: string;
        twitter?: string;
        facebook?: string;
        linkedin?: string;
        website?: string;
    };
    settings?: {
        language?: string;
        currency?: string;
        notifications?: NotificationSettings;
        privacy?: PrivacySettings;
    };
}
```

**Ejemplo:**

```typescript
const result = await userService.updateMyProfile(actor, {
    bio: "Fotógrafa de viajes especializada en destinos mediterráneos. Creadora de contenido para @maria_travels.",
    location: {
        city: "Valencia", // Se mudó
        timezone: "Europe/Madrid"
    },
    socialNetworks: {
        instagram: "@maria_travels",
        website: "https://mariamediterranea.com"
    },
    settings: {
        notifications: {
            marketing: true, // Acepta marketing
            reviewReminders: false // No quiere recordatorios
        }
    }
});
```

## 🔗 Identidades Externas {#identidades-externas}

### Gestión de Conexiones OAuth

El sistema gestiona automáticamente las identidades externas conectadas:

```typescript
// Estructura de identidad externa
type ExternalIdentity = {
    provider: "GOOGLE" | "FACEBOOK" | "APPLE";
    providerUserId: string;
    email?: string;
    connectedAt: string;
    isActive: boolean;
};

// Ejemplo de usuario con múltiples identidades
const userWithIdentities = {
    id: "user_123",
    email: "maria@example.com",
    authProvider: "CLERK",
    authProviderUserId: "clerk_user_123",
    
    externalIdentities: [
        {
            provider: "GOOGLE",
            providerUserId: "google_123456",
            email: "maria@gmail.com",
            connectedAt: "2024-01-15T10:00:00Z",
            isActive: true
        },
        {
            provider: "FACEBOOK", 
            providerUserId: "fb_789012",
            email: "maria@example.com",
            connectedAt: "2024-02-01T14:30:00Z",
            isActive: true
        }
    ]
};
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### UserCreateInput

**Campos Requeridos:**

- `displayName`: string (2-100 caracteres)
- `email`: email válido
- `authProvider`: AuthProvider enum
- `authProviderUserId`: string (ID del proveedor)

**Campos Opcionales:**

- `slug`: string (se genera automáticamente)
- `phone`: string (formato internacional)
- `role`: RoleEnum (default: USER)
- `profile`: Información del perfil
- `settings`: Configuración inicial

### Validaciones Específicas

**Email Único:**

```typescript
// ✅ Válido
email: "nuevo@example.com"

// ❌ Inválido - ya existe
email: "existente@example.com" // Error: email already exists
```

**Teléfono Internacional:**

```typescript
// ✅ Válido
phone: "+34 600 123 456"
phone: "+1 555 123 4567"

// ❌ Inválido
phone: "600123456" // Sin código de país
```

**Slug Único:**

```typescript
// Se genera automáticamente desde displayName
displayName: "María González" → slug: "maria-gonzalez"
displayName: "John Doe" → slug: "john-doe"

// Si existe conflicto, se añade número
"maria-gonzalez" → "maria-gonzalez-2"
```

**Configuración de Privacidad:**

```typescript
// Configuración por defecto para nuevos usuarios
settings: {
    privacy: {
        profileVisible: true,     // Perfil público
        showEmail: false,        // Email privado
        showPhone: false,        // Teléfono privado
        showLocation: true       // Ubicación pública
    }
}
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | N/A | Solo SUPER_ADMIN |
| `getById` | N/A | Propio perfil o admin |
| `list`, `search` | N/A | Solo ADMIN y SUPER_ADMIN |
| `update`, `patch` | N/A | Propio perfil o SUPER_ADMIN |
| `softDelete`, `hardDelete` | N/A | Solo SUPER_ADMIN |
| `restore` | N/A | Solo SUPER_ADMIN |
| `getByAuthProviderId` | N/A | Sistema/interno |
| `ensureFromAuthProvider` | N/A | Sistema/interno |
| `assignRole` | N/A | Solo SUPER_ADMIN |
| `addPermission`, `removePermission` | N/A | Solo SUPER_ADMIN |
| `setPermissions` | N/A | Solo SUPER_ADMIN |
| `getMyProfile` | N/A | Usuario autenticado |
| `updateMyProfile` | N/A | Usuario autenticado |

### Jerarquía de Roles

```typescript
// Niveles de autorización (de menor a mayor)
GUEST < USER < HOST < CONTENT_MANAGER < ADMIN < SUPER_ADMIN

// Reglas de asignación:
- Solo SUPER_ADMIN puede crear/eliminar usuarios
- Solo SUPER_ADMIN puede asignar roles
- Solo SUPER_ADMIN puede gestionar permisos
- Usuarios pueden gestionar su propio perfil
- ADMIN puede ver información de usuarios pero no modificar
```

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Registro e Integración con Clerk

```typescript
// 1. Usuario se registra en Clerk
// 2. Webhook de Clerk llama a nuestro endpoint
// 3. Creamos/actualizamos usuario en nuestro sistema

const webhookHandler = async (clerkEvent) => {
    if (clerkEvent.type === 'user.created' || clerkEvent.type === 'user.updated') {
        const clerkUser = clerkEvent.data;
        
        const result = await userService.ensureFromAuthProvider(systemActor, {
            provider: "CLERK",
            providerUserId: clerkUser.id,
            profile: {
                email: clerkUser.email_addresses[0]?.email_address,
                displayName: `${clerkUser.first_name} ${clerkUser.last_name}`,
                firstName: clerkUser.first_name,
                lastName: clerkUser.last_name,
                avatar: clerkUser.image_url,
                phone: clerkUser.phone_numbers[0]?.phone_number
            }
        });
        
        console.log(`Usuario ${result.data.created ? 'creado' : 'actualizado'}: ${result.data.user.displayName}`);
    }
};
```

### Gestión de Roles para Hosts

```typescript
// Usuario solicita convertirse en Host
const promoteToHost = async (userId: string) => {
    // 1. Verificar que cumple requisitos
    const user = await userService.getById(adminActor, userId);
    if (!user.data.isVerified) {
        throw new Error('User must be verified to become a host');
    }
    
    // 2. Asignar rol de HOST
    const roleResult = await userService.assignRole(superAdminActor, {
        userId: userId,
        role: "HOST"
    });
    
    // 3. Añadir permisos específicos de alojamiento
    const permissionResult = await userService.addPermission(superAdminActor, {
        userId: userId,
        permission: "ACCOMMODATION_CREATE"
    });
    
    console.log(`Usuario ${user.data.displayName} promovido a HOST`);
    return roleResult;
};
```

### Dashboard de Administración de Usuarios

```typescript
// Panel de administración para gestionar usuarios
const adminDashboard = async () => {
    // 1. Obtener estadísticas generales
    const allUsers = await userService.list(adminActor, {
        page: 1,
        pageSize: 100
    });
    
    // 2. Usuarios por rol
    const usersByRole = {};
    for (const role of Object.values(RoleEnum)) {
        const users = await userService.list(adminActor, {
            role: role,
            page: 1,
            pageSize: 10
        });
        usersByRole[role] = users.data?.total || 0;
    }
    
    // 3. Nuevos registros esta semana
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const newUsers = await userService.list(adminActor, {
        registeredAfter: weekAgo.toISOString(),
        page: 1,
        pageSize: 50
    });
    
    // 4. Usuarios que necesitan verificación
    const unverifiedUsers = await userService.list(adminActor, {
        isActive: false,
        page: 1,
        pageSize: 20
    });
    
    return {
        totalUsers: allUsers.data?.total,
        usersByRole,
        newThisWeek: newUsers.data?.total,
        pendingVerification: unverifiedUsers.data?.total,
        recentUsers: newUsers.data?.items
    };
};
```

### Perfil de Usuario con Estadísticas

```typescript
// Obtener perfil completo con estadísticas
const getUserProfileWithStats = async (userId: string) => {
    // 1. Perfil básico
    const profile = await userService.getById(actor, userId);
    
    // 2. Estadísticas de contenido (si es creador)
    const userPosts = await postService.list(actor, {
        authorId: userId,
        page: 1,
        pageSize: 5 // Solo los más recientes
    });
    
    // 3. Alojamientos (si es host)
    let accommodations = null;
    if (profile.data?.role === 'HOST') {
        accommodations = await accommodationService.list(actor, {
            hostId: userId,
            page: 1,
            pageSize: 10
        });
    }
    
    // 4. Actividad reciente
    const recentActivity = {
        postsCreated: userPosts.data?.total || 0,
        lastPostDate: userPosts.data?.items[0]?.createdAt,
        accommodationsOwned: accommodations?.data?.total || 0
    };
    
    return {
        profile: profile.data,
        stats: recentActivity,
        recentPosts: userPosts.data?.items,
        accommodations: accommodations?.data?.items
    };
};
```

### Gestión de Permisos Granulares

```typescript
// Asignar permisos específicos a un editor de contenido
const setupContentEditor = async (userId: string) => {
    // 1. Asignar rol base
    await userService.assignRole(superAdminActor, {
        userId: userId,
        role: "CONTENT_MANAGER"
    });
    
    // 2. Permisos específicos de contenido
    const contentPermissions = [
        "POST_CREATE",
        "POST_EDIT", 
        "POST_MODERATE",
        "POST_DELETE",
        "EVENT_CREATE",
        "EVENT_EDIT",
        "DESTINATION_EDIT"
    ];
    
    await userService.setPermissions(superAdminActor, {
        userId: userId,
        permissions: contentPermissions
    });
    
    console.log(`Editor de contenido configurado para usuario ${userId}`);
};

// Verificar permisos antes de acción
const checkUserCanModerateContent = (actor: Actor) => {
    return actor.permissions?.includes('POST_MODERATE') || 
           ['ADMIN', 'SUPER_ADMIN'].includes(actor.role);
};
```

### Actualización de Preferencias de Usuario

```typescript
// Usuario actualiza sus preferencias
const updateUserPreferences = async (actor: Actor) => {
    const preferences = {
        settings: {
            language: "en", // Cambiar a inglés
            currency: "USD", // Cambiar moneda
            notifications: {
                email: true,
                push: false, // Desactivar push
                marketing: false,
                newBookings: true,
                reviewReminders: true,
                priceAlerts: true // Nueva preferencia
            },
            privacy: {
                profileVisible: true,
                showEmail: false,
                showPhone: false,
                showLocation: true,
                allowMessageFromGuests: true // Nueva configuración
            }
        }
    };
    
    const result = await userService.updateMyProfile(actor, preferences);
    console.log('Preferencias actualizadas correctamente');
    return result;
};
```

## 🚨 Manejo de Errores Comunes

### Errores de Autenticación

```typescript
// Error por usuario no encontrado en proveedor
{
    error: {
        code: "NOT_FOUND",
        message: "User not found with provider CLERK and ID clerk_user_123",
        details: {
            provider: "CLERK",
            providerUserId: "clerk_user_123"
        }
    }
}
```

### Errores de Permisos

```typescript
// Error por falta de permisos para asignar rol
{
    error: {
        code: "FORBIDDEN", 
        message: "Only SUPER_ADMIN can assign roles",
        details: {
            requiredRole: "SUPER_ADMIN",
            userRole: "ADMIN"
        }
    }
}
```

### Errores de Validación

```typescript
// Error por email duplicado
{
    error: {
        code: "ALREADY_EXISTS",
        message: "User with email 'maria@example.com' already exists",
        details: {
            field: "email",
            value: "maria@example.com"
        }
    }
}

// Error por rol inválido
{
    error: {
        code: "VALIDATION_ERROR",
        message: "Cannot assign SUPER_ADMIN role",
        details: {
            role: "SUPER_ADMIN",
            reason: "SUPER_ADMIN role cannot be assigned to other users"
        }
    }
}
```

## 🔗 Relaciones con Otros Servicios

### Con PostService

- Los posts tienen un autor (User)
- Estadísticas de contenido por usuario
- Sistema de seguimiento de autores

### Con AccommodationService

- Los alojamientos tienen un host (User con rol HOST)
- Gestión de propiedades por usuario
- Reviews y ratings de hosts

### Con BookingService

- Las reservas tienen un huésped (User)
- Historial de reservas por usuario
- Preferencias de viaje

### Con ReviewService

- Las reseñas tienen un autor (User)
- Historial de reseñas por usuario
- Reputación y credibilidad

### Integración con Clerk

- Sincronización automática de perfiles
- Gestión de sesiones y tokens
- Webhook para actualizaciones en tiempo real

---

**Nota**: El UserService es fundamental para todo el sistema de Hospeda. Gestiona la identidad, autorización y personalización de la experiencia del usuario en toda la plataforma.
