# Local Artifact App (MVP prototype)

Prototype local y aislado para validar el contrato `artifact/v1` antes de crear el servicio remoto multi-proyecto.

## Ejecutar

Requiere Node 22+ por `node:sqlite`.

```bash
node publish-sample.mjs
node server.mjs
```

Abrir `http://127.0.0.1:4317/artifacts`.

Para publicar otro snapshot validado:

```bash
node publish-bundle.mjs ./bundle.json
```

La base se guarda por defecto en `~/.local/share/opencode-artifacts/artifacts.sqlite`. Se puede cambiar con `ARTIFACT_DATA_DIR`. El servidor escucha solo en `127.0.0.1`.

Este prototipo no está integrado todavía con OpenCode, hops, Engram, Linear ni las apps de Hospeda. Su objetivo es validar galería, versiones, restauración y eventos persistentes del checklist.

Las mutaciones del MVP requieren la cookie de sesión local que entrega una
página del visor. Requests POST sin esa sesión reciben 401; el token es efímero
por proceso y no se persiste en el repositorio.

Antes de publicar un bundle nuevo podés validarlo sin escribir nada:

```bash
node validate-bundle.mjs ./bundle.json
```

El visor inicia en modo oscuro. El selector `Tema` permite `Oscuro`, `Claro` o
`Sistema`; esa preferencia se guarda solo en `localStorage` del navegador y no
forma parte del estado persistente del artifact.
