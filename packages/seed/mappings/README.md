# ID Mapping System

Este directorio contiene el sistema de mapeo de IDs para el proceso de seed.

## 📁 Archivos

- `id-mappings.json` - Archivo generado automáticamente con los mapeos de IDs
- `id-mappings.example.json` - Ejemplo de la estructura del archivo de mapeos

## 🔄 Funcionamiento

### Persistencia Automática
- Los mapeos se guardan **inmediatamente** después de cada operación de `setMapping()`
- Se cargan automáticamente al inicializar el `IdMapper`
- **No se guardan al final** - cada mapeo se persiste en tiempo real

### Estructura del Archivo
```json
{
  "entityType": {
    "seedId": "realDatabaseId",
    "anotherSeedId": "anotherRealId"
  }
}
```

## 🛠️ Uso

### Getters Específicos
```typescript
// En lugar de:
const realUserId = context.idMapper.getRealId('users', seedUserId);

// Usar:
const realUserId = context.idMapper.getMappedUserId(seedUserId);
const realDestinationId = context.idMapper.getMappedDestinationId(seedDestinationId);
const realAccommodationId = context.idMapper.getMappedAccommodationId(seedAccommodationId);
```

### Métodos Disponibles
- `getMappedUserId(seedUserId)` - Obtiene ID real de usuario
- `getMappedDestinationId(seedDestinationId)` - Obtiene ID real de destino
- `getMappedAccommodationId(seedAccommodationId)` - Obtiene ID real de alojamiento
- `getMappedAttractionId(seedAttractionId)` - Obtiene ID real de atracción
- `getMappedPostId(seedPostId)` - Obtiene ID real de post
- `getMappedEventId(seedEventId)` - Obtiene ID real de evento
- `getMappedTagId(seedTagId)` - Obtiene ID real de tag
- `getMappedAmenityId(seedAmenityId)` - Obtiene ID real de amenity
- `getMappedFeatureId(seedFeatureId)` - Obtiene ID real de feature
- `getMappedSponsorId(seedSponsorId)` - Obtiene ID real de sponsor
- `getMappedOrganizerId(seedOrganizerId)` - Obtiene ID real de organizer
- `getMappedLocationId(seedLocationId)` - Obtiene ID real de location

### Métodos de Persistencia
- `saveMappingsToFile()` - Guarda manualmente todos los mapeos
- `getMappingsFilePath()` - Obtiene la ruta del archivo de mapeos

## 🔄 Flujo de Trabajo

1. **Required Seeds** → Se ejecutan y **cada mapeo se guarda inmediatamente**
2. **Mapeos Persistentes** → Disponibles en `id-mappings.json` en tiempo real
3. **Example Seeds** → Se ejecutan usando los mapeos existentes
4. **Relaciones** → Se establecen correctamente usando IDs reales

## ⚠️ Notas Importantes

- El archivo se crea automáticamente en la primera ejecución
- **Cada mapeo se guarda inmediatamente** - no hay pérdida de datos si el proceso se interrumpe
- Los mapeos se mantienen entre ejecuciones
- Si se resetea la base de datos, los mapeos pueden quedar obsoletos
- Se recomienda limpiar el archivo si se hace reset completo de la DB 