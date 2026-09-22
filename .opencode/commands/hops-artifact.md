---
description: Opera artifacts locales versionados mediante hops
---

Usá el subcomando determinista de `hops` según la operación:

- `hops artifact validate <bundle>` para validar un bundle local.
- `hops artifact publish <bundle>` para publicar un snapshot.
- `hops artifact list` para listar artifacts disponibles.
- `hops artifact state <slug>` para leer el estado persistido de un artifact.

El script hace el trabajo de filesystem, validación, publicación y estado. Sólo
agregá una explicación narrativa cuando el usuario la pida. No edites el JSON
persistido a mano ni uses `localStorage` como fuente de estado.
