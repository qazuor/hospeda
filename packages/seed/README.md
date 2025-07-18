# 📦 Sistema de Seed - Portal Turístico Hosped.ar

Este documento especifica cómo debe funcionar el sistema de seed para poblar la base de datos del monorepo de Hosped.ar. El sistema debe ser modular, fácil de extender, y compatible tanto con entornos de desarrollo como producción.

---

## 🧠 Objetivo

Poblar la base de datos con dos tipos de datos:

* **Datos requeridos**: necesarios para que el sistema funcione en todos los entornos (ej: roles, permisos, destinos base).
* **Datos de ejemplo**: útiles solo en desarrollo y testing para probar features (ej: alojamientos, usuarios, eventos, posts ficticios).

Ambos conjuntos deben mantenerse separados y gestionarse de forma independiente.

---

## 📦 Estructura general del package `@repo/seed`

El sistema de seed vivirá en un package propio dentro del monorepo, con la siguiente estructura sugerida:

```
@repo/seed/
├── required/                    # Seeds requeridos para producción y dev
│   ├── users.seed.ts
│   ├── destinations.seed.ts
│   ├── index.ts
├── example/                     # Seeds de ejemplo solo para dev y test
│   ├── users.seed.ts
│   ├── accommodations.seed.ts
│   ├── index.ts
├── manifest/                    # Declaración explícita de qué JSONs cargar
│   ├── required.manifest.json
│   └── example.manifest.json
├── data/                        # Archivos JSON por entidad
│   ├── users/
│   ├── destinations/
│   ├── accommodations/
├── utils/                       # Funciones auxiliares reutilizables
│   ├── logger.ts
│   ├── loadJsonFile.ts
│   ├── summaryTracker.ts
│   ├── dbReset.ts
│   ├── migrateRunner.ts
│   ├── seedRunner.ts
│   └── withTransaction.ts       # Manejo de transacciones para rollback
├── cli.ts                       # Entrypoint CLI
└── index.ts                     # Orquestador general
```

---

## ✅ Reglas generales

* Cada archivo `*.seed.ts` se encarga **solo de una entidad**.
* La data debe provenir de archivos JSON individuales por entidad (uno por ítem).
* Se prioriza el uso de **servicios de `@repo/services`** para insertar datos (validaciones, relaciones, side effects).
* Solo se accede directamente a la DB (`@repo/db`) cuando es absolutamente necesario (roles, migraciones, resets).
* Las entidades a cargar deben estar listadas de forma explícita en los `manifest.json`, no se detectan automáticamente.

---

## ⚙️ CLI Flags disponibles

El comando de seed acepta los siguientes flags:

| Flag                | Descripción                                                          |
| ------------------- | -------------------------------------------------------------------- |
| `--required`        | Ejecuta solo los seeds requeridos                                    |
| `--example`         | Ejecuta solo los seeds de ejemplo                                    |
| `--reset`           | Borra todos los datos antes de insertar (truncate/reset por entidad) |
| `--migrate`         | Ejecuta las migraciones antes de comenzar el seed                    |
| `--rollbackOnError` | Si ocurre un error, revierte todo lo cargado hasta ese momento       |
| `--continueOnError` | Si ocurre un error en una entidad o archivo, continúa con el resto   |

> ⚠️ `rollbackOnError` y `continueOnError` no deben usarse juntos.

Opcionalmente pueden agregarse más flags como:

* `--only users,destinations`: para cargar solo ciertas entidades
* `--logFile path/to/file.json`: para guardar el resumen

---

## 🔁 Modo Rollback con Transacción

Si se usa la flag `--rollbackOnError`, la carga de cada entidad debe envolverse en una transacción de base de datos.

### Mecanismo:

1. Se inicia una transacción manual (`BEGIN`).
2. Se ejecuta el seed de la entidad.
3. Si todo va bien → `COMMIT`.
4. Si hay algún error → `ROLLBACK`.

### Ejemplo (usando Drizzle):

```ts
import { db } from '@repo/db'
import { withTransaction } from '../utils/withTransaction'

await withTransaction(db, async (tx) => {
  for (const user of users) {
    await UserService.createUser(user, { db: tx })
  }
})
```

El helper `withTransaction` se encarga de comenzar la transacción, inyectar el `tx` y hacer commit o rollback.

---

## 🧵 Logging detallado y summary final

Durante la ejecución se debe imprimir en consola:

1. Inicio del seed general (ej: "Inicializando carga de datos requeridos")
2. Inicio y fin de cada entidad (ej: "Cargando usuarios...")
3. Log por cada ítem cargado exitosamente con su nombre o ID
4. Log por cada error con su archivo fuente y detalle del error
5. Finalización general con un resumen consolidado:

```
✅ Seed finalizado

📊 Summary:
- Users: 5 insertados (5 archivos)
- Destinations: 4 insertados (4 archivos)
- Accommodations: 10 insertados, 2 errores

⚠️ Errores:
- accommodations/019.json → Missing destinationId
- accommodations/020.json → Invalid image URL
```

Este resumen también puede exportarse como archivo JSON si se desea para revisión posterior.

---

## 🧹 Agregar un nuevo seed

Pasos para agregar soporte a una nueva entidad:

1. Crear archivo `required/<entidad>.seed.ts` o `example/<entidad>.seed.ts`
2. Agregar sus datos JSON en `data/<entidad>/`
3. Declarar esos archivos en el `manifest` correspondiente
4. Importar el nuevo seed en el `index.ts` correspondiente
5. Usar utilidades comunes (`loadJsonFiles`, `seedRunner`, `logger`) para simplificar el código

Ejemplo:

```ts
import { loadJsonFiles, seedRunner } from '../utils'
import { AccommodationService } from '@repo/services'

export const seedAccommodations = async (ctx: SeedContext) => {
  const files = await loadJsonFiles(ctx.manifest.accommodations)
  await seedRunner('Accommodations', files, async (data) => {
    await AccommodationService.createAccommodation(data)
  })
}
```

---

## 🛡️ Consideraciones técnicas

* El sistema debe ser **idempotente** si `--reset` no está presente.
* Las inserciones deben garantizar consistencia referencial (destinos deben existir antes que alojamientos, etc.).
* El logger debe tener niveles (`info`, `warn`, `error`) y soporte para entornos silenciosos (ej: `--silent`).
* Si se usa `--rollbackOnError`, se deben ejecutar los seeds envueltos en una transacción.
* Los servicios deben permitir inyectar una transacción (`db: tx`) para que puedan ser usados dentro del contexto transaccional.

---

## ✨ Mejoras futuras posibles

* Guardar el `summary` en un archivo log (`.json` o `.md`)
* Permitir importar desde fuentes remotas o APIs
* Validar estructura de los JSONs antes de insertarlos
* Generar automáticamente los manifests si se desea modo "exploración"

---

## 🧪 Ejemplo de ejecución CLI

```bash
pnpm seed --required --migrate --rollbackOnError
pnpm seed --example --reset --continueOnError
pnpm seed --required --only users,destinations
```

---

