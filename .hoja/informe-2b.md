# HOS-1479 — corrida 2b

## Decisión y cambio

Elegí la opción **(b)**. Los extras 046, 047 y 048 crean sus triggers directamente sobre las tablas de destino, sin una guarda `to_regclass(...)`; el 049 seguía el mismo patrón. El test de catálogo migra sólo las entradas del journal con `idx < 144` (`packages/db/test/integration/plan-catalog-from-empty.test.ts:30-37`), mientras `vertical_deadline_version` aparece en la 0147. La selección de extras debe respetar el esquema que ese test construye, sin alterar el extra de producción.

En `packages/db/test/integration/plan-catalog-from-empty.test.ts:38-54`, el test enumera los extras en el mismo orden léxico que el aplicador, excluye los `_down.sql` y consulta `to_regclass` para el único extra que depende de una tabla posterior (`049`). Omite ese extra cuando la tabla no existe; sigue aplicando todos los demás. Las aserciones del catálogo y el límite de migraciones permanecen iguales.

## Gates

- Prueba focalizada, bajo el lock compartido: **verde**; 1 archivo, 30 tests.
- `CI=true pnpm --filter @repo/db lint`: **verde**; 579 archivos, 5 avisos preexistentes.
- `test:integration` completo de `@repo/db`, bajo el lock compartido, primera corrida: **71 archivos pasaron y 1 falló**; 618 tests pasaron y 2 fallaron. Ambos fallos son `23505` por `context=default` en `content-moderation-threshold.test.ts`, ruido de base compartida indicado en la consigna. El test de catálogo pasó.
- Repetición del gate completo, bajo el lock compartido: **mismo resultado**; 71 archivos pasaron, 1 falló; 618 tests pasaron, 2 fallaron. Los únicos fallos fueron nuevamente los dos `23505` de `content-moderation-threshold.test.ts`. Por lo tanto el gate completo no quedó verde; se registra la excepción de ruido indicada en la consigna, sin modificar un test fuera de `permitidas.txt`.

## Mutación

No corresponde: la prueba de mutación fue pedida únicamente para la opción (a). No se modificó el extra 049.
