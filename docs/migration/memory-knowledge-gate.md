# Memoria y conocimiento — Gate 7

Fecha: 2026-09-15

## Revisión posterior a la limpieza

La inspección de metadatos muestra memorias de Hospeda, Hospeda2, Hospeda3 y
otros proyectos, además de backups y documentación de plugins. Hospeda2 sigue
siendo el conjunto mayor, pero su tamaño o fecha no justifican importar nada.
Engram conserva `engram.db`, WAL y SHM; no se modificó ninguno.

La reducción reciente de Engram debe considerarse definitiva para la migración:
no se reutilizarán exports anteriores ni se intentarán restaurar las 149
observaciones eliminadas. El export y la copia íntegra verificados en Gate 1 son
el punto de rollback, no una fuente automática de reimportación.

## Política confirmada

- `AGENTS.md`: reglas universales e invariantes breves.
- Skills: arquitectura y procedimientos especializados bajo demanda.
- `hops`/commands: operaciones deterministas y estados operativos.
- Linear y `.specs`: estado de issues y trabajo.
- Engram: sólo decisiones duraderas, verificadas y deduplicadas.
- `CLAUDE.md` y `MEMORY.md`: fuentes de extracción y rollback durante la
  transición, no carga automática ni importación masiva.

Cada memoria que se mueva deberá revisarse individualmente contra el código y
la documentación actual. Las entradas históricas, duplicadas, contradictorias,
ruidosas o sensibles quedan fuera. Este gate no aprueba ninguna entrada.

## Resultado

El conocimiento está listo para una futura fase de revisión por lotes. No se
copió, importó, consolidó ni eliminó memoria en este gate.
