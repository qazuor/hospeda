# Event Organizer Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Gestión de Organizadores](#gestion-de-organizadores)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `EventOrganizerService` gestiona los organizadores de eventos turísticos y culturales. Proporciona un sistema completo para registrar y administrar las entidades responsables de planificar, coordinar y ejecutar eventos, desde organizaciones gubernamentales hasta empresas privadas y colectivos culturales.

### Entidad EventOrganizer

Un organizador de eventos incluye:

- **Información Básica**: Nombre, descripción, logo institucional
- **Contacto**: Email, teléfono, dirección física
- **Presencia Digital**: Sitio web, redes sociales (Facebook, Instagram, Twitter, LinkedIn)
- **Identificación**: ID único para referencias y asociaciones
- **Metadatos**: Información de auditoría y ciclo de vida

### Tipos de Organizadores

- **Instituciones Públicas**: Ministerios, secretarías de turismo, municipios
- **Empresas Privadas**: Agencias de eventos, productoras, empresas turísticas  
- **Organizaciones Sin Fines de Lucro**: Fundaciones, asociaciones culturales
- **Colectivos Artísticos**: Grupos musicales, compañías teatrales, centros culturales
- **Plataformas Digitales**: Organizadores de eventos online, comunidades virtuales

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: EventOrganizerCreateInput)

Crea un nuevo organizador de eventos.

**Ejemplo:**
```typescript
{
    name: "Secretaría de Turismo y Deportes",
    description: "Organismo gubernamental responsable de la promoción turística y eventos deportivos de la ciudad",
    logo: "https://example.com/logos/secretaria-turismo.png",
    email: "eventos@turismo.gob.ar",
    phone: "+54 11 4555-1234",
    website: "https://turismo.buenosaires.gob.ar",
    address: "Av. Corrientes 1235, CABA",
    socialNetworks: {
        facebook: "TurismoBA",
        instagram: "turismoBA",
        twitter: "TurismoBA_Oficial",
        linkedin: "secretaria-turismo-ba"
    }
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene organizador por ID
- `list(actor, params)` - Lista organizadores con filtros
- `update/patch(actor, id, input)` - Actualiza organizador
- `softDelete/hardDelete(actor, id)` - Elimina organizador

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### searchForList(actor: Actor, params: EventOrganizerListInput)

Búsqueda de organizadores con filtros avanzados.

**Parámetros:**
```typescript
{
    q?: string;              // Búsqueda de texto libre en nombre
    filters?: {
        name?: string;       // Filtro específico por nombre
    };
    page?: number;
    pageSize?: number;
}
```

**Búsqueda de Texto Libre (q)**
Busca coincidencias parciales en:
- `name` (nombre del organizador)

**Ejemplo:**
```typescript
// Buscar organizadores gubernamentales
const govOrganizers = await eventOrganizerService.searchForList(actor, {
    q: "secretaría",
    pageSize: 20
});

// Filtrar por nombre exacto
const specificOrganizer = await eventOrganizerService.searchForList(actor, {
    filters: { name: "Ministerio de Cultura" }
});

// Buscar productoras privadas
const privateOrganizers = await eventOrganizerService.searchForList(actor, {
    q: "productora"
});
```

### Búsquedas Especializadas

```typescript
// Organizadores culturales
const culturalOrganizers = await eventOrganizerService.searchForList(actor, {
    q: "cultural centro museo teatro"
});

// Organizadores deportivos
const sportsOrganizers = await eventOrganizerService.searchForList(actor, {
    q: "deporte club federación"
});

// Organizadores turísticos
const tourismOrganizers = await eventOrganizerService.searchForList(actor, {
    q: "turismo visit bureau"
});
```

## 🏢 Gestión de Organizadores {#gestion-de-organizadores}

### Perfiles Completos de Organizadores

```typescript
const completeOrganizerProfile = {
    // Identidad institucional
    name: "Festival Internacional de Jazz",
    description: "Organización dedicada a la promoción del jazz contemporáneo y la educación musical",
    logo: "https://cdn.jazzfestival.com/logo-oficial.png",
    
    // Información de contacto
    email: "info@jazzfestival.com",
    phone: "+54 11 4567-8900",
    website: "https://www.jazzfestival.com",
    address: "Av. Santa Fe 1234, Piso 8, Buenos Aires",
    
    // Presencia en redes sociales
    socialNetworks: {
        facebook: "JazzFestivalBA",
        instagram: "jazzfestivalba",
        twitter: "JazzFestBA",
        linkedin: "festival-jazz-buenos-aires",
        youtube: "JazzFestivalBuenosAires"
    }
};
```

### Categorización por Sector

```typescript
const organizerCategories = {
    "público": {
        keywords: ["secretaría", "ministerio", "municipio", "gobierno"],
        examples: [
            "Secretaría de Turismo",
            "Ministerio de Cultura",
            "Instituto Nacional de Cine"
        ]
    },
    "privado": {
        keywords: ["empresa", "productora", "agencia", "s.a.", "s.r.l."],
        examples: [
            "Eventos & Producciones SA",
            "Turismo Aventura SRL",
            "Productora Cultural Premium"
        ]
    },
    "ong": {
        keywords: ["fundación", "asociación", "ong", "civil"],
        examples: [
            "Fundación Arte y Cultura",
            "Asociación Amigos del Museo",
            "ONG Turismo Sostenible"
        ]
    },
    "independiente": {
        keywords: ["colectivo", "grupo", "centro", "taller"],
        examples: [
            "Colectivo Teatral Independiente",
            "Centro Cultural Barrial",
            "Grupo de Danza Contemporánea"
        ]
    }
};
```

### Validación de Datos de Contacto

```typescript
// Validaciones automáticas aplicadas
const contactValidations = {
    email: "formato válido de email",
    phone: "formato internacional recomendado",
    website: "URL válida y accesible",
    socialNetworks: {
        facebook: "nombre de usuario o URL válida",
        instagram: "handle sin @ inicial",
        twitter: "handle sin @ inicial", 
        linkedin: "nombre de empresa o perfil"
    }
};
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### EventOrganizerCreateInput

**Campos Requeridos:**
- `name`: string (3-100 caracteres)

**Campos Opcionales:**
- `description`: string (10-500 caracteres)
- `logo`: string (URL válida)
- `email`: string (formato email válido)
- `phone`: string (formato internacional)
- `website`: string (URL válida)
- `address`: string (dirección física)
- `socialNetworks`: objeto con perfiles sociales

### Validaciones Específicas

```typescript
// Organizador mínimo válido
{
    name: "Productora Cultural XYZ"
}

// Organizador completo
{
    name: "Teatro Municipal San Martín",
    description: "Teatro público dedicado a las artes escénicas contemporáneas y clásicas",
    logo: "https://teatrosanmartin.gob.ar/logo.png",
    email: "info@teatrosanmartin.gob.ar",
    phone: "+54 11 4374-4111",
    website: "https://teatrosanmartin.gob.ar",
    address: "Av. Corrientes 1530, Buenos Aires",
    socialNetworks: {
        facebook: "TeatroSanMartin",
        instagram: "teatrosanmartin",
        twitter: "TeatroSMartin"
    }
}
```

### Campos de Base Heredados

- **BaseContactFields**: email, phone, website, address
- **SocialNetworkFields**: facebook, instagram, twitter, linkedin, youtube
- **BaseAuditFields**: createdAt, updatedAt, createdBy, updatedBy
- **BaseLifecycleFields**: isActive, deletedAt
- **BaseAdminFields**: visibility, adminNotes

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `EVENT_ORGANIZER_CREATE` | Content Manager+ |
| `getById`, `list` | Actor válido | Usuario autenticado |
| `update`, `patch` | `EVENT_ORGANIZER_UPDATE` | Content Manager+ |
| `delete` | `EVENT_ORGANIZER_DELETE` | Content Manager+ |
| `search`, `count` | Actor válido | Usuario autenticado |

### Características de Permisos

- **Lectura Pública**: Cualquier usuario autenticado puede consultar organizadores
- **Gestión Restringida**: Solo Content Manager+ puede crear/editar/eliminar
- **Permisos Granulares**: Separación entre create, update y delete
- **Visibilidad**: Sistema de visibilidad para controlar exposición pública

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Red de Organizadores Culturales

```typescript
const culturalOrganizers = [
    {
        name: "Centro Cultural Recoleta",
        description: "Espacio cultural multipropósito con exposiciones, espectáculos y talleres",
        email: "info@centroculturalrecoleta.org",
        phone: "+54 11 4803-1040",
        website: "https://centroculturalrecoleta.org",
        address: "Junín 1930, Recoleta, Buenos Aires",
        socialNetworks: {
            facebook: "CCRecoleta",
            instagram: "centroculturalrecoleta"
        }
    },
    {
        name: "Usina del Arte",
        description: "Centro cultural dedicado a las artes contemporáneas y experimentales",
        email: "info@usinadelarte.org",
        website: "https://usinadelarte.org",
        address: "Agustín R. Caffarena 1, La Boca, Buenos Aires",
        socialNetworks: {
            facebook: "UsinaDelArte",
            instagram: "usinadelarte",
            twitter: "UsinaDelArte"
        }
    },
    {
        name: "Fundación Proa",
        description: "Institución cultural dedicada al arte contemporáneo argentino e internacional", 
        email: "info@proa.org",
        website: "https://proa.org",
        address: "Av. Pedro de Mendoza 1929, La Boca, Buenos Aires",
        socialNetworks: {
            facebook: "FundacionProa",
            instagram: "fundacionproa"
        }
    }
];

for (const organizer of culturalOrganizers) {
    await eventOrganizerService.create(actor, organizer);
}
```

### Sistema de Búsqueda Inteligente

```typescript
// Buscador por categorías
async function findOrganizersByCategory(category: string, location?: string) {
    const categoryKeywords = {
        "cultural": ["cultural", "arte", "museo", "teatro", "fundación"],
        "deportivo": ["deporte", "club", "federación", "liga", "atletico"],
        "turístico": ["turismo", "visit", "bureau", "destino", "promoción"],
        "gubernamental": ["secretaría", "ministerio", "gobierno", "municipal"],
        "privado": ["empresa", "productora", "agencia", "eventos"]
    };
    
    const keywords = categoryKeywords[category] || [];
    const results = [];
    
    for (const keyword of keywords) {
        const searchResults = await eventOrganizerService.searchForList(actor, {
            q: keyword,
            pageSize: 10
        });
        results.push(...searchResults.items);
    }
    
    // Remover duplicados
    return results.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
    );
}
```

### Dashboard de Organizadores

```typescript
// Análisis de organizadores activos
const organizerAnalytics = {
    // Total de organizadores
    total: await eventOrganizerService.count(actor, {}),
    
    // Por tipo (basado en palabras clave en nombres)
    byType: {
        public: 0,
        private: 0,
        ngo: 0,
        independent: 0
    },
    
    // Con presencia digital completa
    withCompleteProfile: 0,
    withSocialMedia: 0,
    withWebsite: 0
};

// Análisis de cobertura de contacto
const allOrganizers = await eventOrganizerService.searchForList(actor, {
    pageSize: 1000
});

allOrganizers.items.forEach(org => {
    // Categorizar por tipo
    const name = org.name.toLowerCase();
    if (name.includes('secretaría') || name.includes('ministerio')) {
        organizerAnalytics.byType.public++;
    } else if (name.includes('fundación') || name.includes('ong')) {
        organizerAnalytics.byType.ngo++;
    } else if (name.includes('empresa') || name.includes('productora')) {
        organizerAnalytics.byType.private++;
    } else {
        organizerAnalytics.byType.independent++;
    }
    
    // Evaluar completitud de perfil
    const hasComplete = org.email && org.phone && org.website && org.description;
    if (hasComplete) organizerAnalytics.withCompleteProfile++;
    
    if (org.socialNetworks && Object.keys(org.socialNetworks).length > 0) {
        organizerAnalytics.withSocialMedia++;
    }
    
    if (org.website) organizerAnalytics.withWebsite++;
});
```

### Sistema de Recomendaciones

```typescript
// Sugerir organizadores para tipos de eventos
async function suggestOrganizersForEvent(eventType: string, eventScale: string) {
    const organizerSuggestions = {
        "cultural": {
            "local": ["centro cultural", "biblioteca", "museo"],
            "regional": ["secretaría cultura", "instituto", "fundación"],
            "nacional": ["ministerio cultura", "consejo nacional"]
        },
        "deportivo": {
            "local": ["club", "complejo deportivo"],
            "regional": ["federación", "liga regional"],
            "nacional": ["confederación", "comité olímpico"]
        },
        "turístico": {
            "local": ["oficina turismo", "municipio"],
            "regional": ["secretaría turismo", "ente provincial"],
            "nacional": ["ministerio turismo", "instituto promoción"]
        }
    };
    
    const keywords = organizerSuggestions[eventType]?.[eventScale] || [];
    const suggestions = [];
    
    for (const keyword of keywords) {
        const results = await eventOrganizerService.searchForList(actor, {
            q: keyword,
            pageSize: 3
        });
        suggestions.push(...results.items);
    }
    
    return suggestions.slice(0, 10);
}
```

---

**Nota**: El EventOrganizerService centraliza la información de todas las entidades responsables de crear y gestionar eventos, facilitando la coordinación, comunicación y promoción de actividades turísticas y culturales.
