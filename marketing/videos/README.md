# @repo/videos — videos tutoriales de Hospeda

Videos tutoriales hechos con **pantallas reales** de Hospeda: Playwright graba la app,
Remotion edita y renderiza. Las reglas de estilo y el historial de correcciones del dueño
están en [`REGLAS.md`](REGLAS.md); el plan general en [`../plan-videos.md`](../plan-videos.md).

## Qué vive dónde

| En el repo (`marketing/videos/`) | Fuera del repo (`$HOSPEDA_MARKETING_ASSETS_DIR`) |
|---|---|
| Código Remotion (`src/`), grabadores Playwright (`record/`), scripts de generación (`tools/`), reglas | Tomas crudas, `events.json`, `screen.mp4`, poses de Hospedín, WAVs, modelos, renders |

`HOSPEDA_MARKETING_ASSETS_DIR` vale por defecto `/home/qazuor/projects/WEBS/marketing`. Adentro:

```text
video-lab/
├── public/       # public dir de Remotion: a1/ (screen.mp4, events.json, first/last.png),
│                 # hospedin/ (poses + hd/layers.json), audio/, brand/logo.png
├── recordings/   # tomas de Playwright: <toma>/frames/ + frames.json + events.json
├── out/          # renders y stills
└── tools/models/ # pesos de Real-ESRGAN
```

`config/asset-paths.ts` (y su espejo `tools/marketing_paths.py`) resuelve esas rutas.
`remotion.config.ts` apunta el public dir ahí y expone el alias `@marketing-assets/` para
importar los JSON generados. Typecheck no depende de esos archivos (`src/marketing-assets.d.ts`).

## Arquitectura en 3 capas (planificada)

1. **Toma**: Playwright graba el flujo real y registra un **log de eventos** (toques, tipeo,
   esperas, cada uno con su caja en pantalla). Se graba en viewport **mobile y desktop**.
   Mobile es siempre el **Galaxy S24 Ultra** de `config/device.ts` (412 × 750 a DPR 3); las
   medidas y el porqué están en [`REGLAS.md`](REGLAS.md#dispositivo-de-referencia-samsung-galaxy-s24-ultra).
2. **Pantalla editada**: una composición que muestra sólo la pantalla, con cortes, zoom y foco
   calculados desde el log de eventos. Regrabar recalcula el montaje solo.
3. **Tutorial completo**: envuelve el componente de la capa 2 en un marco de teléfono o de
   escritorio, con título, número de paso y Hospedín.

Hoy existe A1 (`src/a1/`), que todavía mezcla las capas 2 y 3 en una sola composición.

A1 se graba **en staging** con el dispositivo de referencia (como los VC): la toma llena el área
de página de 412 × 750 y el montaje se recalcula solo desde `events.json`.

## Uso

```bash
CI=true corepack pnpm install                      # desde la raíz del repo
cd marketing/videos
corepack pnpm studio                               # Remotion Studio
corepack pnpm render:test                          # → $ASSETS/video-lab/out/test.mp4
corepack pnpm render:a1                            # → $ASSETS/video-lab/out/a1.mp4
VIDEO_LOGIN_PASSWORD=… corepack pnpm record:a1 <toma>   # → $ASSETS/video-lab/recordings/a1/<toma>/
corepack pnpm typecheck
```

- Grabar A1 y los VC va contra staging (`WEB_URL`, default `https://staging.hospeda.com.ar`),
  logueado con una cuenta del seed; la contraseña sale de `VIDEO_LOGIN_PASSWORD` y nunca se
  escribe en el código. Los grabadores se niegan a correr contra producción.
- Grabar con la máquina libre: con la CPU saturada la captura cae a 8-11 cuadros/s.
- Después del render, normalizar el audio a -14 LUFS con `ffmpeg loudnorm` (ver `REGLAS.md`).
- Los scripts de `tools/` son Python y se corren con `uv` (instrucciones en cada archivo y en
  `tools/audio/README.md`).
