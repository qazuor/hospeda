---
title: Decision Log
linear: HOS-1352
statusSource: linear
created: 2026-09-15
updated: 2026-10-01
status: CURRENT
---

# Decision Log

Registro explícito de las decisiones del programa, exigido por el [PDR](./00-PDR.md) §3.4.

**Ninguna decisión vive en otro lado**: ni en un comentario de código, ni en un mensaje de
chat, ni en la memoria de un agente, ni en un sistema de tracking. Si no está acá, no se
decidió.

Si una decisión se aparta del PDR, el PDR **no se edita** (§3.1): se registra acá el
apartamiento y por qué.

## Formato

Cada entrada lleva, según §3.4:

```
### DEC-<AREA>-<NNN> — <título>

- Fecha · Estado · Decide
- Problema
- Alternativas
- Decisión
- Motivo
- Implicaciones
- Reemplaza a
- Origen (ID de FASE 1A)
```

Áreas: `TRIAL` · `SUB` · `BILL` · `MP` · `ENT` · `LIM` · `ADDON` · `PROMO` · `AUTH` ·
`DATA` · `MAIL` · `ADMIN` · `ARCH` · `MIG` · `GRANT` · `LEGAL` · `TEST` · `METH`.

## Reglas

1. Una decisión `ACCEPTED` **no se edita**. Se cambia creando otra que la marque
   `SUPERSEDED`, con el motivo del cambio.
2. Toda decisión que cierre un ítem de [`04-open-decisions.md`](./04-open-decisions.md)
   actualiza ese documento en el mismo commit.
3. **Una decisión sobre Mercado Pago no puede tomarse mientras su fila de
   [`06-mp-validation-matrix.md`](./06-mp-validation-matrix.md) diga `UNKNOWN`** (§61).
4. Toda decisión declara de dónde sale su fundamento, y sólo hay tres fuentes admitidas:
   **el PDR**, **una medición propia fechada**, o **una respuesta explícita del owner**.
   Ninguna otra. En particular no se admite como fundamento: el código existente,
   documentación del repo, un sistema de tracking, la memoria de un agente, ni una decisión
   de un programa anterior.
5. Si una decisión cita un `§`, **el texto se verifica contra el PDR antes de escribirla**.
   Atribuirle al PDR algo que no dice falsifica el origen de la afirmación y la vuelve
   irrastreable.

---

## Metodología

### DEC-METH-001 — Reset total: el PDR es la única herencia del programa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: una primera pasada de este programa produjo análisis, decisiones y mediciones
  que resultaron contaminados por fuentes que el PDR prohíbe explícitamente usar como
  fundamento (§0: recuerdos, comportamiento legacy, documentación obsoleta, comentarios
  viejos, implementaciones actuales, suposiciones sobre Mercado Pago). Entre otras cosas se
  le atribuyó al PDR una afirmación que el PDR no hace. Una decisión tomada sobre un análisis
  contaminado no se puede auditar hacia atrás: no se sabe cuál de sus premisas sigue en pie.
- **Alternativas**: (1) conservar las decisiones y reescribir sólo el análisis; (2) conservar
  además los hechos medidos; (3) reset total — sobrevive únicamente el PDR.
- **Decisión**: **(3)**. El único documento que se conserva es `00-PDR.md`, verbatim y con su
  integridad verificada contra el historial de git. Todo lo demás se rehace desde cero.
- **Motivo**: cero herencia. Ni siquiera un resultado medido por una sesión contaminada, para
  que no quede ninguna afirmación cuyo origen haya que reconstruir de memoria.
- **Implicaciones**:
  1. Las decisiones funcionales **se vuelven a preguntar** desde un FASE 1A nuevo.
  2. La experimentación contra Mercado Pago **se vuelve a ejecutar** en FASE 1C. Ningún
     resultado anterior se da por válido, ni siquiera para orientar.
  3. Cualquier conteo de producción **se vuelve a medir** en el momento de usarlo.
  4. **No se mira código hasta que el diseño esté cerrado.** Eso incluye esquema,
     migraciones, tests, jobs y superficies. El PDR ya lo ordena en §67 para FASE 1A; acá se
     extiende explícitamente: no se lee código para fundamentar ninguna decisión funcional.
  5. Ningún documento de este programa referencia trabajo anterior. Un enlace a algo previo
     es un defecto, no una fuente.
- **Origen**: instrucción del owner, 2026-09-15.

### DEC-METH-002 — Se autorizan conteos read-only de producción durante FASE 1A

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §67 ordena no empezar FASE 1B hasta que el owner responda 1A, pero varias
  decisiones de 1A dependen de cuántos clientes reales hay. En particular, el §56 apoya su
  preferencia por la coordinación manual en un *"hay pocos customers actuales"* que **el PDR
  no cuantifica** (`O-MIG-01`).
- **Alternativas**: (1) conteos read-only con fecha y método; (2) sólo el conteo mínimo para
  la migración; (3) ninguna medición, se decide sobre supuesto declarado.
- **Decisión**: **(1)**. Se permiten conteos read-only. El alcance es estricto: **contar
  filas**.
- **Motivo**: §4 lista explícitamente *"ejecutar queries"* e *"inspeccionar DB"* entre lo
  permitido. Contar filas no es leer cómo está escrito el sistema, que es lo que prohíben el
  §0 y el §67. Son restricciones de realidad, no arquitectura legacy.
- **Implicaciones**:
  1. **No habilita** leer código, esquema, migraciones, tests, jobs ni comportamiento. Eso
     sigue siendo FASE 1B y sigue prohibido por `DEC-METH-001`.
  2. Los resultados viven en [`07-facts-inventory.md`](./07-facts-inventory.md) con fecha,
     método y caducidad explícita.
  3. **Los números caducan.** Toda decisión que los cite debe re-verificarlos si pasó tiempo.
- **Origen**: `O-METH-02`.

### DEC-METH-003 — El criterio de FASE 5 se define al empezar FASE 5, y es su gate de entrada

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §2 dice que *"La carga de prueba debe estar del lado de conservar código
  legacy. No del lado de justificar reescribirlo"*, y la FASE 5 define `KEEP` como *"sólo si
  estamos prácticamente 100% seguros"* de cinco cosas. Esa frase sólo tiene efecto si existe
  algo concreto que rendir: sin criterio operable, la carga se invierte sola, porque conservar
  nunca requiere defensa activa y reescribir siempre sí. Y con el programa atravesando varias
  ventanas de contexto (§3.3), dos piezas equivalentes se clasifican al revés en sesiones
  distintas y nadie lo nota.
- **Alternativas**: (1) se define al empezar FASE 5, como gate de entrada; (2) se define
  ahora, vinculante; (3) sin criterio fijo, caso por caso argumentado.
- **Decisión**: **(1)**. El criterio se define **al empezar FASE 5**, con el inventario real de
  FASE 1B terminado a la vista.
- **Motivo**: con las piezas concretas enfrente se puede juzgar si un criterio ayuda o estorba,
  en vez de diseñarlo a ciegas.
- **Implicaciones — esto es un gate, no un pendiente**:
  1. **No se clasifica ninguna pieza antes de haber tomado esa decisión.** Empezar a clasificar
     "mientras tanto" equivale a elegir la alternativa (3) sin decirlo.
  2. La decisión se toma **con el inventario de 1B terminado**, no con una muestra.
  3. **Si el criterio que se elija excluye o trata distinto al Eje 2, tiene que decirlo
     explícitamente.** Es la trampa conocida: cualquier regla del tipo *"no nombra ninguna
     vertical en su lógica"* manda **todo el Eje 2 a `REWRITE` por definición**, porque §8
     define el Eje 2 como comportamiento específico de vertical.
  4. **Sea cual sea el resultado, toda clasificación lleva su argumento escrito.** Eso no está
     en discusión y vale también si se elige no tener criterio. Es lo que le da efecto al §2
     aunque el criterio final sea flexible.
  5. El gate tiene que sobrevivir a varias ventanas de contexto entre hoy y FASE 5: vive en el
     handoff y en `04-open-decisions.md`, no en la memoria de nadie.
- **Origen**: `O-METH-03`.

---

### DEC-METH-004 — La FASE 9 tiene cuatro salidas, y «resuelto» exige verificar la regla contra todo su dominio

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: son dos, y se descubrieron juntos al cerrar la FASE 8 con **141 hallazgos, 48 de
  ellos `CRITICA`**.
  1. **El §65 manda actualizar cuatro documentos** —decision log, spec, handoff y worklog— y el
     programa ya no vive sólo ahí. El 2026-09-18 el desarme publicó **25 issues de Linear** (el
     paraguas, las dos épicas, las nueve unidades de verticales y las trece de billing) y **unos
     27 artifacts**, todos escritos contra un modelo que estos hallazgos acaban de mover. Nadie
     era dueño de propagarles el cambio (`F-8C2-011`).
  2. **El programa no declara qué significa «resuelto»** para un hallazgo de FASE 8
     (`F-8C2-016`). Sin eso la fase no tiene criterio de cierre — y ahora tampoco de propagación,
     porque no se sabe qué dispara una actualización hacia lo publicado.
- **Alternativas para «resuelto»**: (1) el capítulo dice qué pasa en todos los casos del hallazgo
  —el criterio que el programa ya usa para los huecos—; (2) lo anterior **y** el camino del
  hallazgo, reejecutado sobre el texto corregido, ya no llega; (3) el (2) para los hallazgos
  sueltos, y para cada racimo **además** verificar la regla corregida contra **todo el dominio que
  cuantifica**.
- **Decisión**: **(3)**, y la FASE 9 cierra **cuatro** salidas, no una.
- **Las cuatro salidas**:
  1. **el diseño** — resolver los seis racimos en los capítulos de las dos épicas y del núcleo;
  2. **el registro** — decision log, handoff, worklog, más las seis correcciones de registro de la
     §7 de [`14-fase-8-adversarial/00-hallazgos.md`](./14-fase-8-adversarial/00-hallazgos.md);
  3. **las sub-specs** — `spec.md` y `descomposicion.md` de `HOS-1353` y `HOS-1354`;
  4. **lo publicado** — los 25 issues de Linear y los artifacts.
- **El orden no es libre: 3 y 4 van al final**, con el diseño ya firme. Propagar mientras la fase
  todavía resuelve racimos significa propagar dos veces sobre 52 objetos, y varios racimos cruzan
  las dos épicas — `R2` toca unidades de las dos, `R1` toca cuatro unidades de billing y sus
  fichas. No hay forma de propagar bien antes de saber cómo quedó cada racimo.
- **Motivo de elegir (3) y no (1) ni (2)**: **(1) es el criterio que produjo la causa raíz.** La
  FASE 8 encontró que las cuatro convergencias son contradicciones **entre dos capítulos, nunca
  dentro de uno**, y que el método cierra huecos *por capítulo* — lo que comprueba que un capítulo
  cubre sus casos, nunca que una regla cubra los suyos, porque los suyos viven en otros capítulos.
  Cerrar con (1) deja viva exactamente la máquina que produjo los 141. **(2) arregla el caso que
  el agente encontró y no el resto del dominio de la regla.** (3) cuesta **seis** verificaciones
  de dominio, no 141, porque se aplica al racimo y no al hallazgo.
- **Implicaciones**:
  1. **Cada racimo tiene que declarar cuál es su dominio**, por escrito. Hoy no está en ningún
     lado, y sin eso el criterio (3) no es ejecutable.
  2. **Un hallazgo no se cierra marcándolo**: se cierra reejecutando su camino sobre el texto
     nuevo. El camino está escrito en cada uno de los 141, que es lo que lo vuelve verificable.
  3. **Esto es un apartamiento declarado del §65**, no una corrección del PDR. El PDR no se edita
     (regla 1): la ampliación vive acá.
  4. Las seis correcciones de registro **siguen sin aplicar** hasta que la FASE 9 las tome. Están
     inventariadas y verificadas, no ejecutadas.
- **Origen**: conversación con el owner del 2026-09-19 al cerrar la FASE 8 — *«la fase 9 debería
  también actualizar las issues y las sub spec y los artifacts»*—, más `F-8C2-011` y `F-8C2-016`.

---

## Decisiones funcionales

### DEC-ARCH-001 — Planes híbridos: se versiona lo que tiene efecto

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR nunca define si un plan es mutable o inmutable, y define encima de esa
  respuesta la derivación del Trial Plan (§10.3), el enforcement de excedentes (§28.1), los
  cambios de precio (§29) y el recálculo del límite efectivo (§37).
- **Alternativas**: (1) híbrido — se versiona precio, limits y entitlements, y lo cosmético
  muta; (2) versionado total, incluido el copy; (3) mutable con efecto inmediato.
- **Decisión**: **(1)**. El plan se parte en dos:
  - **Plan** — identidad y cosmética (nombre, descripción, orden en la pricing). **Muta
    libremente**, sin crear versión.
  - **Versión de plan** — precio, limits y entitlements. **Inmutable.**
  - Cada suscripción queda **anclada a una versión**.
- **Motivo**: el pasado no se reescribe donde importa — dinero y capacidad — y no se versiona
  ruido. Bajar un límite no deja clientes excedidos retroactivamente.
- **Implicaciones**:
  1. **Mover una suscripción a una versión nueva es un acto explícito y auditable**, nunca un
     efecto colateral de editar el plan.
  2. **Toda lectura de configuración comercial resuelve versión primero.** Ninguna lectura
     puede tomar valores del Plan.
  3. Hay que **declarar explícitamente qué campos tienen efecto y cuáles son cosméticos**. Esa
     lista es parte del diseño de FASE 2, es cerrada, y equivocarla convierte un cambio con
     efecto en una mutación silenciosa.
  4. §10.3 sigue cumpliéndose: el Trial Plan deriva de la **versión vigente** del plan más
     premium y del más básico. Cómo se comporta esa derivación cuando la versión vigente
     cambia en mitad de un trial lo define `BD-TRIAL-01`.
  5. Habilita §29: mostrar precio anterior y nuevo con fecha efectiva pasa a ser demostrable
     contra un registro, no una afirmación.
  6. `OD-ARCH-01` (retiro de un plan del catálogo) se apoya en esto, pero **no queda
     resuelto**: sigue abierto.
- **Origen**: `BD-ARCH-01` (BLOCKING).

### DEC-ARCH-002 — Rank explícito por plan; sólo participan los vendibles

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 exige derivar del *"plan comercial más premium"* y del *"más básico"*, y
  §27/§28 necesitan el mismo orden para que "upgrade" y "downgrade" signifiquen algo. Ninguno
  de los dos términos está definido, y por precio no se puede: el precio vive en el
  BillingOption (§18), así que un plan tiene cuatro, y dos planes pueden costar lo mismo.
- **Alternativas**: (1) rank explícito, participan sólo los vendibles; (2) rank explícito,
  participan todos los activos; (3) ordenar por el precio de una billing option de referencia.
- **Decisión**: **(1)**. Cada plan declara un **`rank`** dentro de su vertical. La derivación
  del §10.3 y la comparación de tiers miran **únicamente los planes activos y ofrecibles
  hoy**.
- **Motivo**: el orden queda declarado y es independiente del precio, que §29 dice
  explícitamente que va a cambiar. Un plan retirado, interno o de prueba no puede alterar lo
  que recibe un trial sin que nadie se entere — y §10.3 alimenta el trial de cada cliente
  nuevo.
- **Implicaciones**:
  1. **Hacen falta dos flags distintos: "activo" y "vendible".** Un plan retirado sigue activo
     para quien lo tiene y deja de ser vendible para todos.
  2. **Dos planes vendibles con el mismo rank en la misma vertical es un estado inválido**:
     falla en validación, no se resuelve por desempate arbitrario.
  3. Conviene numerar con huecos, porque insertar un plan entre dos existentes obliga a
     renumerar.
  4. El `rank` y el flag de vendible viven **en la versión de plan** (`DEC-ARCH-001`), no en
     la identidad: cambiarlos tiene efecto y por lo tanto se versiona.
  5. Habilita `OD-ARCH-01` (retiro de un plan del catálogo), que **sigue abierto**: el flag de
     vendible es la mitad del mecanismo, falta la política.
- **Origen**: `BD-ARCH-02` (BLOCKING).

### DEC-TRIAL-001 — Los overrides del Trial Plan se declaran en DB, por vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 ordena heredar **exactamente** los limits del plan más básico, derivados
  automáticamente y sin copiarse a mano. §10.5 ordena **máximo una ficha** durante el trial.
  Si el plan más básico permite más de una, las dos reglas se contradicen sobre el mismo
  valor, y §64 las congela a las dos como invariantes (#5 y #6). Encima, el "1" está escrito
  como constante en el PDR, lo que choca con §9.
- **Alternativas**: (1) overrides declarados en DB por vertical; (2) el "1" es una regla dura
  aparte, fuera de la derivación; (3) gana la derivación y se retira el "1".
- **Decisión**: **(1)**. La resolución de limits del Trial Plan es **derivar y después aplicar
  overrides declarados explícitamente en DB, por vertical**. El máximo de fichas es el primero
  de esa lista.
- **Motivo**: el apartamiento del §10.3 queda escrito y auditable en vez de escondido en
  código, cumple §9, y una vertical futura puede permitir otra cantidad sin deploy. Respeta
  §10.5 y §64.6 tal como están escritos.
- **Implicaciones**:
  1. **La derivación deja de ser pura**: pasa a ser "derivar + aplicar overrides". Toda
     resolución de limits de trial ejecuta los dos pasos, siempre en ese orden, y el override
     nunca reemplaza a la derivación.
  2. **El conjunto de overrides es finito, declarado y cerrado.** Agregarle un ítem es una
     decisión registrada, no una configuración más. Si la lista crece sin control, la
     derivación del §10.3 se vuelve decorativa y vuelven a existir dos fuentes para el mismo
     valor — que es lo que esta decisión viene a evitar.
  3. Se cruza con `DEC-ARCH-001`: la derivación lee la **versión vigente** del plan más
     básico, y el override se aplica sobre ese resultado.
  4. **No resuelve `BD-TRIAL-01`**: qué pasa cuando la versión de la que se deriva cambia en
     mitad de un trial sigue abierto.
- **Origen**: `C-TRIAL-01` (BLOCKING).

### DEC-TRIAL-002 — Derivación con trinquete: en vivo, pero nunca empeora

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.3 pide derivación automática y da un ejemplo que **sube** un límite (*"si
  mañana Basic cambia `MAX_PHOTOS: 20 -> 25`, Trial debe pasar automáticamente a 25"*). El
  caso que duele es el que baja: si el plan más básico reduce un límite con un trial en curso
  por encima de ese valor, esa persona queda excedida sin haber hecho nada y dispara el
  enforcement del §28.1 — que además pide *"informar antes"*, y acá no hay a quién informar
  porque el cambio no fue del usuario.
- **Alternativas**: (1) trinquete — en vivo con piso; (2) en vivo literal; (3) snapshot al
  iniciar.
- **Decisión**: **(1)**. Cada resolución compara lo derivado de la **versión vigente** contra
  el **piso derivado al arrancar el trial**, y se queda con lo mejor para el usuario. Las
  mejoras llegan solas; las reducciones no alcanzan a quien ya está adentro.
- **Motivo**: cumple el ejemplo del §10.3 al pie de la letra sin dejar a nadie excedido en
  mitad del trial. Es la única de las tres que cubre las dos direcciones.
- **Implicaciones**:
  1. **Hay que guardar el piso al iniciar el trial**, y compararlo en cada resolución.
  2. El piso se guarda como **referencia a las versiones vigentes al arrancar**
     (`DEC-ARCH-001`), **no como copia de valores**: §10.3 prohíbe expresamente copiar a mano,
     y una copia además quedaría desactualizada.
  3. Un trial en curso puede quedar temporalmente mejor que el plan más básico vigente. Es el
     costo aceptado de no degradar a nadie.
  4. **El trinquete se aplica al final, sobre el resultado completo**, no en el medio. El
     orden es: derivar de la versión vigente → aplicar los overrides vigentes
     (`DEC-TRIAL-001`) → comparar contra el piso y quedarse con lo mejor.

     El **piso es el conjunto efectivo de limits al arrancar el trial**, es decir el resultado
     de esos mismos dos primeros pasos en ese momento. Aplicarlo antes de los overrides
     dejaría un agujero: bajar un override de 2 a 1 degradaría a los trials en curso, que es
     justo lo que esta decisión impide.
- **Origen**: `BD-TRIAL-01` (BLOCKING).

### DEC-SUB-001 — Subir es inmediato, bajar de tier espera, tocar el ciclo se aplica ya

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED por `DEC-SUB-005`** · **Decide**: owner
- **Problema**: §27 (upgrade inmediato) y §28 (downgrade a fin de ciclo) definen el cambio de
  plan sobre **un** eje, y §18 crea dos — Plan (tier) y BillingOption (ciclo). De nueve
  celdas, una es un no-cambio y sólo dos tenían política. Quedaban seis sin definir, y son las
  más frecuentes comercialmente.
- **Alternativas**: (1) subir ya / bajar de tier espera / cambio de ciclo inmediato con
  compensación en días; (2) el ciclo sólo cambia en la renovación; (3) todo inmediato,
  incluido bajar de tier.
- **Decisión**: **(1)**.

  | | ciclo ↑ | ciclo = | ciclo ↓ |
  |---|---|---|---|
  | **tier ↑** | inmediato | inmediato | inmediato |
  | **tier =** | inmediato | — | inmediato |
  | **tier ↓** | inmediato | fin de ciclo | inmediato |

  En una línea: **subir de tier es inmediato; bajar de tier con el mismo ciclo espera al fin
  del período; cualquier cambio de ciclo se aplica ya.**
- **Motivo**: es lo que el cliente ya conoce de cualquier otro servicio, y no le cierra la
  puerta a quien quiere pasarse a anual hoy.
- **Implicaciones**:
  1. **La compensación se hace en días, no en pesos.** El cobro nuevo arranca corrido por lo
     ya pagado. Se evita prorratear dinero a propósito.
  2. **Depende entera de FASE 1C.** Si no se puede correr la primera fecha de cobro sobre una
     suscripción ya autorizada (`EX-8`), el mecanismo se cae. **Plan B declarado: el cambio de
     ciclo espera a la renovación** — la alternativa (2). Esta decisión **no se puede
     implementar** hasta que `EX-7` y `EX-8` dejen de decir `UNKNOWN` (§61).
  3. **Agujero declarado**: bajar de tier **y** de ciclo a la vez (anual caro → mensual
     barato) se aplica ya y se compensa en días, o sea que es una **salida anticipada de un
     compromiso anual, en especie**. Queda registrado como consecuencia conocida; si hay que
     acotarlo, es una decisión aparte y no una corrección de ésta.
  4. La comparación de tiers usa el `rank` de `DEC-ARCH-002`. El precio no participa.
  5. El cambio inmediato dispara el enforcement de excedentes del §28.1 cuando el destino es
     más chico — que sigue siendo un hueco transversal (`M-ENT-02`).
- **Origen**: `BD-SUB-01` (BLOCKING).
- **Reemplazada**: el mismo día, cuando FASE 1C midió que el ciclo de una suscripción
  autorizada **no se puede mutar** (`EX-4`, `NOT_SUPPORTED`). **La política de la matriz no
  cambió**; lo que se cayó fue el mecanismo. Ver `DEC-SUB-005`.

### DEC-TRIAL-003 — El trial es configurable por plan; Partner lo tiene en cero

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, N7, N1; ver su 📌) · **Decide**: owner
- **Problema**: §17 dice que Partner usa el mismo motor *"de trial; plans; billing;
  subscriptions; entitlements; limits; promo; courtesy; addons"*. §17.3 dice que Partner **no
  es self-service** y que sus dos únicos caminos de alta los maneja el admin. §6 le saca el
  listing, así que tampoco tiene el evento del §10.4 — que además exige que toda vertical sin
  ficha declare explícitamente su evento equivalente. Está escrito como que tiene trial y
  descrito como que no puede tenerlo.
- **Alternativas**: (1) la duración del trial es configuración por plan, y Partner la tiene en
  cero; (2) Partner declara estructuralmente que no admite trial; (3) sí tiene, y lo dispara
  la aprobación del admin.
- **Decisión**: **(1)**. *"Tiene trial"* deja de ser una propiedad de la vertical y pasa a ser
  un **número configurable por plan**: días de trial. **Los planes de Partner lo tienen en
  cero hoy.**
- **Motivo**: mantiene el motor genérico sin casos especiales (§7) y respeta el §17 sin
  forzarlo — Partner sí usa el motor de trial, con la duración en cero. Encenderlo mañana es
  cambiar un valor, no escribir código.
- **Implicaciones**:
  1. **La pregunta del evento de activación de Partner queda diferida, no respondida.** Si
     algún día se pone en distinto de cero, hay que declarar su evento equivalente como exige
     el §10.4. El candidato anotado es **la aprobación del admin**, con la salvedad registrada
     en la alternativa (3): el §17.3 hace que el partner valide su email y complete su perfil
     **después** de la aprobación, así que ese evento arrancaría el reloj antes de que la
     persona haya entrado por primera vez, y §10.2 no admite devolverlo.
  2. **Poner ese número en distinto de cero es una decisión registrada**, no una edición de
     configuración cualquiera. Un cero en una tabla es fácil de cambiar sin pensar.
  3. Vale para cualquier vertical futura: una que no deba tener trial se configura en cero, no
     se le agrega una excepción al motor.
  4. No frena FASE 2.
- **Origen**: `C-PARTNER-01` (BLOCKING).
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, N1)**: Encender o apagar la
  prueba de una vertical queda fuera de esta versión: al publicar una versión de plan, el panel no
  deja pasar los días de prueba de 0 a más de 0 ni al revés (`NUCLEO/02` §1.4), y `T7` salió.
  Partner queda en cero.

### DEC-MIG-001 — Coordinación manual de las cinco relaciones vivas, cero código de migración

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED EN PARTE por `DEC-MIG-003`** (2026-09-19) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C2, sobre la implicación 5; ver su 📌) ·
  **Decide**: owner
- **⚠️ Qué sobrevive y qué no**: sobrevive **cero código de migración**, que era su núcleo, y
  sobrevive entera la medición que la apoya. **Lo que se cae es el destino**: ya no se transcribe
  ninguna fila al sistema nuevo. `DEC-MIG-003` lo decidió el 2026-09-19 con un dato que no existía
  acá —de quién son las ocho filas—, y las *«cinco relaciones»* de este título pasaron a ser ocho
  por las altas que `DEC-MIG-002` dejó entrar.
- **Problema**: qué se le promete a quien hoy está en el sistema cuando llegue el motor nuevo.
  §56 prefiere *"coordinación manual y nueva subscription"* si migrar automáticamente agrega
  complejidad o riesgo, pero apoya esa preferencia en un *"hay pocos customers actuales"* que
  no cuantifica.
- **Contexto medido** (2026-09-15, [`07-facts-inventory.md`](./07-facts-inventory.md)): **cero
  pagos cobrados** en la historia del sistema. **Tres** relaciones con compromiso de cobro
  vivo, las tres en trial, alojamiento, mensual. **Dos** cortesías sin vínculo con el
  proveedor. Gastronomía, experiencia y partner: **cero filas**.
- **Alternativas**: (1) coordinación manual de las cinco, cero código; (2) migración
  automática; (3) congelar altas nuevas hasta el corte.
- **Decisión**: **(1)**. Se los contacta, se los da de alta en el motor nuevo y se cancela el
  compromiso viejo. **Cero código de migración.**
- **Motivo**: es lo que el §56 preveía, y la medición confirma su premisa de forma aplastante:
  no "pocos", **tres**. No hay historial de pagos que preservar.
- **Implicaciones**:
  1. **El diseño nuevo no carga con compatibilidad hacia atrás.** Ninguna decisión posterior
     puede justificarse con "para no romper lo que hay".
  2. Los tres en trial **tienen que volver a autorizar el débito**. Alguno puede no volver.
     Atenuante registrado: nunca se les cobró nada, así que no pierden dinero.
  3. **Gastronomía, experiencia y partner se rediseñan sin migración alguna**: no tienen un
     solo dato. Su deuda es de código, no de datos.
  4. **El primer trial vence el 2026-09-26**, mucho antes que FASE 2. Esa fecha la atiende lo
     que exista ese día, con independencia de esta decisión.
  5. `R-MIG-01` (cómo se convive durante el rewrite) **sigue abierto**: esta decisión define el
     destino, no la transición.
- **Origen**: `BD-MIG-01` (BLOCKING).
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C2, sobre la implicación 5)**:
  No se convive.

### DEC-TRIAL-004 — Identidad: el email normalizado bloquea; el resto observa

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R23`, `F-8V2A3-004`: la lista cerrada de proveedores que ignoran puntos y `+alias`; ver su 📌) — **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`, `V2-v`, `V2-w` y `V2-x`: la lista por proveedor; ver su segundo 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N7, `g2`, sobre la implicación 2; ver su último 📌) · **Decide**: owner
- **Problema**: §10.2 dice que el trial no se reinicia por *"volver a registrarse sobre la
  misma identidad si podemos detectarlo"*, sin definir la señal. Cada candidata tiene un falso
  positivo distinto, y la asimetría es fuerte: un falso negativo regala un trial; un falso
  positivo **le niega el trial a un cliente legítimo, que se va sin hablar con nadie**.
- **Contexto medido** (2026-09-15): 22 usuarios en producción. El abuso es teórico a esta
  escala.
- **Contexto derivado del PDR** — no es algo que el PDR diga, es una consecuencia de lo que
  dice: como el trial arranca al publicar (§10.4) y la suscripción viene después (§10.6), **en
  el momento de decidir todavía no hay medio de pago capturado**. El pagador no está
  disponible como señal aunque se lo quisiera usar.
- **Alternativas**: (1) sólo el email normalizado bloquea, el resto observa; (2) email más
  teléfono verificado bloquean; (3) nada bloquea, todo se registra y decide el admin.
- **Decisión**: **(1)**. **Sólo el email normalizado** — puntos y `+alias` — niega el trial
  automáticamente. Teléfono, identificador fiscal y dispositivo **se registran y alertan al
  admin, pero nunca bloquean**.
- **Motivo**: es la única señal sin falso positivo relevante. Registrar sin bloquear permite
  **medir** el abuso antes de endurecer, y decidir con evidencia en vez de con hipótesis.
- **Implicaciones**:
  1. **Se esquiva con una segunda dirección de correo.** El "trial de por vida" del §10.2
     queda como intención, no como garantía. Es una limitación aceptada a conciencia.
  2. Guardar señales de identidad **con fin de bloqueo** tiene implicancias de datos
     personales aunque no se bloquee con ellas: hay que declarar finalidad y plazo de
     conservación. `M-LEGAL-02` **sigue abierto** y es prerequisito para implementar la parte
     de observación.
  3. Las alertas sólo valen si alguien las mira. Conviene que el admin muestre el patrón
     agregado, no un aviso por caso.
  4. **Conviene revisar esta decisión cuando la base crezca.** Hoy se optimiza contra perder
     clientes reales porque hay 22; el cálculo cambia con dos órdenes de magnitud más.
- **Origen**: `BD-TRIAL-02` (BLOCKING).
- 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R23`, `F-8V2A3-004`)**: el
  seudónimo del correo es SHA-256 sin clave sobre el correo normalizado, y la función no cambia
  nunca. Los puntos de la parte local y el `+alias` se sacan sólo en una lista cerrada de
  proveedores que los ignoran —Gmail, Outlook y los que se midan—; en los demás dominios el
  correo se compara tal cual, en minúsculas. Cambiar la lista no recalcula las filas viejas, y
  se declara.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-j1` a `V2-j4`,
  `V2-v`, `V2-w` y `V2-x`)**: la normalización sigue la lista por proveedor de `V/02` §2.2. Gmail
  quita puntos y `+`; Microsoft consumidor sólo el `+`, sin unificar dominios; Proton e iCloud
  unifican y quitan el `+`; Fastmail y Yandex quitan el `+`; todo dominio que la lista no nombra
  cuenta como dominio propio y quita el `+`. Lo marcado *«a medir»* entra sólo si la medición del
  paso 0 lo confirma, y lo que la medición muestre fuera de la lista vuelve al owner. La medición de
  dominios sólo cuenta dominios: no exporta ni guarda casillas.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, `g2`, sobre la implicación
  2)**: Teléfono, identificador fiscal y dispositivo no se guardan; la consulta legal queda sólo por
  el seudónimo (seguimiento HOS-1394).

### DEC-TRIAL-005 — La publicación es inmediata: publicar es quedar visible

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §10.4 fija el disparador del trial en *"PUBLICAR la primera ficha"* y cierra
  con *"La publicación **efectiva** dispara el consumo del trial"*. Si publicar y quedar
  visible son el mismo instante no hay nada que decidir; si media algo entre la acción de la
  persona y la visibilidad pública son dos eventos, y hay que elegir cuál consume el trial —
  que es único de por vida y no se devuelve (§10.2).
- **Alternativas**: (1) hay revisión y el trial arranca al quedar visible; (2) publicación
  inmediata; (3) hay revisión y el trial arranca al enviar.
- **Decisión**: **(2)**. **No hay paso intermedio.** La persona publica, la ficha se ve y el
  trial arranca: un solo evento.
- **Motivo**: cero fricción, cero espera y ningún proceso operativo que sostener. El §10.4 se
  cumple literalmente, porque "publicar" es un acto único.
- **Implicaciones**:
  1. **`E-TRIAL-01` queda disuelto**: no existe el rechazo posterior a la publicación, porque
     no hay revisión previa.
  2. **Nada filtra el contenido antes de que sea público.** Una ficha mal cargada, spam o
     contenido inapropiado sale al sitio y se corrige después.
  3. **Consecuencia nueva, registrada como `E-TRIAL-04`**: toda moderación pasa a ser
     reactiva, y bajar una ficha ya publicada **no devuelve el trial** (§10.2). Alguien puede
     quedarse sin ficha **y** sin trial. Si eso amerita una excepción al §10.2 es una decisión
     aparte y **sigue abierta**.
  4. El evento de dominio del trial para las verticales con ficha es la publicación, sin
     ambigüedad.
- **Origen**: `A-TRIAL-01`.

### DEC-TRIAL-006 — El disparador del trial se declara por vertical; Turista usa "Empezar"

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, N7, N1; ver su 📌) · **Decide**: owner
- **Problema**: §10.4 cierra diciendo que *"Partner y cualquier vertical futura sin Listing
  deberán definir su evento funcional equivalente explícitamente"*. **Turista no es ninguna de
  las dos**: es una vertical actual (§6) y sin ficha (§6: *"Turista NO tiene ficha/listing
  comercial"*). La frase no la cubre, y §64.1 habla de trial *"por user + vertical"* sin
  excluir a ninguna.
- **Alternativas**: (1) Turista sin trial, configurado en cero como Partner; (2) sí tiene, y
  lo dispara el botón `Empezar` del §47; (3) sí tiene, y arranca al usar una capacidad VIP.
- **Decisión**: **(2)**. Y con eso queda establecida la forma general: **cada vertical declara
  su evento de activación en configuración**, de un catálogo cerrado de eventos de dominio.

  | vertical | evento de activación |
  |---|---|
  | alojamiento · gastronomía · experiencia | la ficha queda publicada (`DEC-TRIAL-005`) |
  | turista | el botón `Empezar` del §47 |
  | partner | ninguno declarado — trial en cero hoy (`DEC-TRIAL-003`) |

- **Motivo**: el evento no se inventa, ya está escrito en el §47, y es el único que el PDR le
  da a Turista. Un click consciente evita el reclamo de *"me lo gastaron sin avisar"*, que es
  grave porque el trial es irreversible.
- **Implicaciones**:
  1. **Cero condiciones especiales en el motor** (§7): una vertical sin evento declarado
     simplemente no otorga trial, y falla cerrado en vez de abierto.
  2. **El click de `Empezar` debe decir explícitamente que consume el trial.** Es un botón de
     baja fricción en una página de precios y el trial es de por vida: sin ese aviso, el
     reclamo es legítimo.
  3. Turista entra en la campaña de recuperación del §10.7 como cualquier otra vertical, lo
     que suma una secuencia más al problema de superposición (`M-TRIAL-03`, sigue abierto).
  4. Si algún día Partner enciende su trial, tiene que sumar su evento a esta misma tabla.
- **Origen**: `M-TRIAL-01`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, N1)**: Encender o apagar la
  prueba de una vertical queda fuera de esta versión: al publicar una versión de plan, el panel no
  deja pasar los días de prueba de 0 a más de 0 ni al revés (`NUCLEO/02` §1.4), y `T7` salió.
  Partner queda en cero.

### DEC-TRIAL-007 — Pre-trial: borradores ilimitados, sin capacidades, archivado por inactividad

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C9; ver su 📌) · **Decide**: owner
- **Problema**: §10.4 enumera qué **no** dispara el trial — registrarse, crear draft, entrar
  al onboarding, guardar un formulario parcial — con lo cual reconoce explícitamente un estado
  *"entró a la vertical y todavía no publicó"*, y después no le da ninguna regla. Es donde va
  a estar la mayor parte de la gente.
- **Alternativas**: (1) borradores ilimitados, sin capacidades, archivado por inactividad;
  (2) un solo borrador hasta publicar; (3) ilimitados y sin vencimiento.
- **Decisión**: **(1)**. Borradores **ilimitados**, **sin ninguna capacidad comercial**, **sin
  consumir trial**. Tras **N meses sin actividad se archivan automáticamente**.
- **Motivo**: cero fricción justo donde más conviene evitarla — antes de que la persona haya
  visto valor — y el trial arranca cuando hay valor real, que es lo que el §10.4 busca al
  excluir el registro y el draft.
- **Implicaciones**:
  1. **`N` es configuración**, no una constante (§9).
  2. **Archivar no es borrar.** Qué significa exactamente y cómo se relaciona con la retención
     del §25 lo define `C-DATA-01`, que **sigue abierta**. Esta decisión depende de esa.
  3. Se puede sostener contenido indefinidamente sin consumir nada, pero **sin obtener nada a
     cambio**: no se publica y no hay capacidades. El costo es de almacenamiento, no de
     entitlements regalados.
  4. El estado pre-trial es un estado real del modelo y entra en el glosario que pide
     `M-ARCH-01`.
- **Origen**: `M-TRIAL-02`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C9)**: Los N meses son el plazo
  3 de `NUCLEO/02` §1.5, validado contra el plazo de borrado (`DEC-DATA-008`).

### DEC-ENT-001 — Existen entitlements medidos, y el trial tiene cuota propia en ellos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, `L2-f1`; ver su 📌) · **Decide**: owner
- **Problema**: §10.3 ordena que el Trial Plan otorgue *"exactamente los entitlements del plan
  comercial más premium"*. Si alguno tiene costo marginal real por uso — el chat con IA del
  §36.2 es el candidato obvio — el trial lo regala sin tope, por vertical, y con cinco
  verticales (§6) una misma persona puede consumir cinco veces. El PDR no distingue
  entitlements booleanos de medidos ni le da cuota propia al trial.
- **Alternativas**: (1) todas las funciones, con cuota propia de trial en las medidas;
  (2) todo ilimitado, como dice la letra del §10.3; (3) las funciones caras no entran en el
  trial.
- **Decisión**: **(1)**. El trial muestra **todas** las funciones de Premium. Los entitlements
  **medidos** declaran **dos cuotas**: la del plan y la del trial, menor.
- **Motivo**: demuestra el producto completo, que es el punto del trial, y acota el costo. Se
  cumple el espíritu del §10.3 sin su consecuencia económica literal.
- **Implicaciones**:
  1. **Apartamiento declarado del §10.3**, que dice *"exactamente"*. El PDR no se edita
     (§3.1): queda registrado acá.
  2. **`OD-ENT-01` queda respondido en su mitad**: **sí existen entitlements medidos**, no son
     todos booleanos. Eso obliga a construir un subsistema de consumo que el PDR no menciona
     en ningún lado — contador, ventana, momento de reset y qué pasa con lo no usado.
  3. **Queda abierto cómo se resetea la cuota**, y tiene una trampa concreta: si se reseteara
     "por período de facturación", un plan anual entregaría doce meses de cuota el primer día.
     Se decide aparte.
  4. Cada entitlement medido lleva su cuota **en la versión de plan** (`DEC-ARCH-001`), porque
     cambiarla tiene efecto.
  5. La cuota de trial no participa del trinquete de `DEC-TRIAL-002` como si fuera un limit
     derivado: es un valor propio del trial, no una derivación de Premium.
- **Origen**: `R-TRIAL-01`, `OD-ENT-01`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, `L2-f1`)**: La cuota de trial
  también se renueva cada mes, desde el día en que arrancó la prueba (contra la recomendación).
  `V/11` §4.3.

### DEC-ENT-002 — Las cuotas de consumo son mensuales, independientes del ciclo de pago

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C4, sobre la implicación 2; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 10 y 11; ver su último 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote N-I; ver su último 📌) · **Decide**: owner
- **Problema**: `DEC-ENT-001` estableció que existen entitlements medidos, pero el PDR no
  menciona cuotas en ningún lado y por lo tanto no dice cuándo se resetean. Si el reset
  acompañara al período de facturación, **un plan anual entregaría doce meses de cuota el
  primer día**.
- **Alternativas**: (1) mensual siempre, lo no usado se pierde; (2) mensual con acumulación
  del sobrante; (3) por período de facturación.
- **Decisión**: **(1)**. La cuota se resetea **todos los meses**, sea cual sea el ciclo de
  pago. **Lo no usado se pierde**, no se acumula.
- **Motivo**: desactiva la trampa del plan anual y mantiene el costo por uso parejo en el
  tiempo, que es como se comporta el gasto real. Sin acumulación no hay saldo que administrar,
  mostrar ni discutir al cancelar.
- **Implicaciones**:
  1. **Dos relojes distintos conviven**: el del ciclo de facturación y el de la cuota. No hay
     que confundirlos en ningún cálculo.
  2. **Falta definir si el mes corre por calendario o por aniversario de la suscripción.** Es
     un detalle de FASE 2 y no cambia el fondo de esta decisión.
  3. **Consecuencia aceptada**: quien pagó un año por adelantado y no usó su cuota la pierde
     igual, y el uso concentrado choca contra el tope mensual. Conviene que la UI muestre la
     cuota restante del mes para que no sea una sorpresa.
  4. Se cruza con `M-MAIL-01`: el momento exacto del reset es una ventana temporal y tiene que
     computarse en el huso del mercado, no en UTC.
- **Origen**: `OD-ENT-01` (segunda mitad).
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C4, sobre la implicación 2)**:
  Cerrada (revisión del owner, C4): la cuota corre por la fecha del ciclo de cada persona, el día
  del `desde` del título, también en anual; del 29 al 31, el último día de los meses cortos,
  calculado desde el ancla; al cambiar de plan la ventana en curso sigue con el cupo del plan nuevo
  menos lo gastado y la fecha nueva rige desde la siguiente; un complemento suma a la ventana del
  título. `V/15` §7.
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 10 y
  11)**: Con más de un título vivo ancla el que da la cuota; con dos, el que arrancó primero. El
  `BASE` ancla en el alta de la cuenta, y se confirma el día que la versión de piso otorgue un
  entitlement medido.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-I)**: Cuando muere el
  título que ancla la ventana de la cuota (la prueba que `T2` convierte, una cortesía que termina) y
  otro título vivo pasa a anclar, la ventana en curso sigue hasta su fin, medida contra el cupo del
  título que queda menos lo ya gastado, y la próxima arranca con el ancla nueva: el tratamiento que
  la regla ya le daba al cambio de plan.

### DEC-ENT-003 — La herencia de Turista VIP cubre entitlements y limits, y bloquea la compra

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §16 dice que un plan comercial *"puede configurar desde DB si hereda beneficios
  de Turista VIP"*, sin precisar qué son "beneficios" — el PDR trata entitlements (§36) y
  limits (§37) como cosas distintas en todos lados — ni qué pasa si además paga VIP por su
  cuenta.
- **Alternativas**: (1) hereda entitlements y limits, y no puede comprar VIP; (2) hereda sólo
  entitlements; (3) hereda todo y puede comprar VIP igual.
- **Decisión**: **(1)**. Hereda **entitlements y limits**. Mientras su plan comercial se lo dé,
  **no puede comprar Turista VIP**: la UI no lo ofrece y la API lo rechaza. Al perder el plan
  comercial, recupera la posibilidad de comprarlo.
- **Motivo**: nunca cobrarle dos veces lo mismo. El problema se evita en vez de resolverse
  después.
- **Implicaciones**:
  1. **No resuelve al que ya lo paga** en el momento de contratar el plan comercial. Ese caso
     se decide aparte.
  2. Cuando los limits de turista y los de la vertical se superponen hay que declarar cuál
     gana. Lo resuelve la estrategia de agregación de `M-ENT-01`, que **sigue abierta**.
  3. **Consecuencia nueva, registrada como `E-ENT-01`**: si su plan comercial cae en
     `SUSPENDED` (§21), pierde beneficios que usaba **como turista**, en una parte del producto
     ajena a su impago — y por esta misma decisión tampoco pudo haberlos comprado. **Sigue
     abierta.**
- **Origen**: `A-ENT-01`.

### DEC-ENT-004 — Un VIP previo se cancela de inmediato, sin reembolso

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-ENT-003` impide comprar Turista VIP mientras un plan comercial lo regale,
  pero no dice qué pasa con quien **ya lo está pagando** en el momento de contratar ese plan.
- **Contexto medido** (2026-09-15): hoy **no existe ningún caso**. La única suscripción de
  turista en producción está `abandoned` y nunca se cobró nada. Se decide en frío.
- **Alternativas**: (1) no se renueva, conservando el período pagado; (2) se cancela ya, con
  reembolso proporcional; (3) se cancela ya, sin reembolso.
- **Decisión**: **(3)**. Se corta el VIP en el acto y **no se devuelve lo ya pagado**. El
  beneficio lo sigue teniendo gratis por el plan nuevo.
- **Motivo**: decisión del owner. Es la más simple de implementar, el servicio no se
  interrumpe, y no depende de ninguna fila de la matriz.
- **Implicaciones y riesgo declarado**:
  1. **Retener dinero de un servicio que cancelamos nosotros, unilateralmente, es discutible
     bajo la ley de defensa del consumidor.** Queda asumido explícitamente.
  2. **Hoy el riesgo es bajo porque todas las suscripciones vivas son mensuales** (medido): se
     retendría un mes parcial como máximo. **El día que exista un ciclo anual de Turista VIP,
     el monto retenido puede ser de hasta once meses y esta decisión debe revisarse.** Queda
     anotada con su disparador de revisión.
  3. Si después cancela el plan comercial, **se queda sin VIP y sin la suscripción que tenía**:
     hay que pedirle que autorice una nueva.
  4. **Conviene —no forma parte de la decisión— avisarle por correo antes de cancelar.** Al
     cancelar contra el proveedor, es posible que éste le escriba por su cuenta un *"tu
     suscripción fue cancelada"* sin contexto; eso es `M-MAIL-04`, y su fila `EX-3` está en
     `UNKNOWN`. Llegar antes es lo único que se puede controlar.
- **Origen**: `A-ENT-01` (b).

### DEC-SUB-002 — Grace configurable en DB por plan, default 10 días

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, N1; ver su 📌) · **Decide**: owner
- **Problema**: cuatro afirmaciones del PDR que no pueden ser ciertas a la vez. §20 fija
  *"Duración: **10 días**"*; §30 lo repite para pagos manuales; §42.3 habla de *"Schedule
  configurable durante 10 días"*, o sea schedule variable dentro de ventana fija; y §9 dice
  que toda regla comercial sale de DB.
- **Alternativas**: (1) configurable en DB por plan, default 10; (2) configurable por
  vertical; (3) constante del dominio, con §9 excepcionado.
- **Decisión**: **(1)**. Los días de grace son un campo **de la versión de plan**, con **10 de
  default**.
- **Motivo**: cumple §9 sin perder el número que el PDR eligió, y deja una palanca comercial
  real — un plan caro puede tener más aire.
- **Implicaciones**:
  1. Al vivir en la **versión** de plan (`DEC-ARCH-001`), cambiarlo queda versionado: **nadie
     ve su grace acortado retroactivamente**.
  2. **El schedule de correos del §42.3 tiene que ser relativo al vencimiento, no absoluto.**
     Si la ventana es variable, un schedule con días fijos se cae fuera de la ventana en los
     planes con grace más corto.
  3. Dos planes de la misma vertical pueden tener grace distinto. Tiene que poder explicarse
     en soporte y mostrarse en la UI del cliente, no sólo aplicarse.
  4. Vale igual para pagos manuales (§30): el mecanismo es el mismo, cambia el método de pago.
- **Origen**: `C-SUB-01`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N1)**: La gracia sigue colgando
  de la versión de plan; al publicar una versión el panel rechaza una gracia que no sea menor que el
  ciclo más corto que ofrece (`DEC-ARCH-013`).

### DEC-SUB-003 — Cambiar de plan en grace está permitido, y es el camino de recuperación

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED por `DEC-SUB-021`** (2026-09-25): en grace no se cambia de plan; el camino de recuperación es cambiar la tarjeta · **Decide**: owner
- **Problema**: §26 sólo permite pausar desde `ACTIVE`, pero el PDR no dice nada sobre cambiar
  de plan en `GRACE_PERIOD`. Si se prohíbe, el control impide el propio remedio — bajarse a un
  plan más barato es cómo alguien sale de un impago. Si se permite, hay dos abusos simétricos:
  cambiar de plan para generar un cobro nuevo que "limpie" el fallido, o para esquivar la
  deuda del ciclo anterior.
- **Alternativas**: (1) se permite, con cobro inmediato del plan nuevo; (2) hay que estar al
  día; (3) sólo se permite bajar de tier.
- **Decisión**: **(1)**. Se permite. **Se intenta el cobro del plan nuevo de inmediato**: si
  entra, vuelve a `ACTIVE` con el plan nuevo; si falla, **sigue en grace con el plan anterior
  y no cambia nada**.
- **Motivo**: convierte el cambio de plan en una salida del problema en vez de un muro, y
  cierra los dos abusos a la vez — no se puede limpiar el fallido porque el cobro nuevo tiene
  que entrar de verdad, y no se puede esquivar la deuda porque si falla se queda con el plan
  viejo y su deuda.
- **Implicaciones**:
  1. **La transacción debe ser atómica.** No puede quedar con el plan nuevo y el pago fallido.
     Es el punto exacto donde esto se rompe si se implementa mal, y entra en los cruces de
     concurrencia de `E-CONC-01`.
  2. **Se cruza con `DEC-SUB-001`**: si además cambia el ciclo, habría que compensar días
     sobre una suscripción que está en deuda. **Qué pasa con el período impago al compensar
     queda abierto** y se registra como `E-SUB-05`.
  3. El intento de cobro inmediato depende del comportamiento del proveedor, que está en
     `UNKNOWN` (`GR-1`, recuperación durante el grace).
- **Origen**: `E-SUB-03`.

### DEC-SUB-004 — La ventana de límites de pausa se cuenta por user + vertical

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §26.3 define tres límites con precisión — 3 pausas por ventana móvil de 12
  meses, 120 días por pausa, 240 días acumulados — y **no dice sobre qué entidad se cuentan**.
  Si fuera por suscripción, cancelar y volver a suscribirse resetearía los tres.
- **Alternativas**: (1) por `user + vertical`; (2) por suscripción; (3) por suscripción con
  arrastre del historial al re-suscribirse.
- **Decisión**: **(1)**. El contador vive en la relación **persona + vertical** y **sobrevive
  a cancelar y volver a suscribirse**.
- **Motivo**: es el único que hace que el límite limite. Con tres números tan específicos el
  §26.3 claramente quiso poner un techo; contarlo por suscripción lo volvería decorativo.
- **Implicaciones**:
  1. Es **el mismo eje que ya usa el resto del modelo**: el trial es por `user + vertical`
     (§10.1) y la suscripción principal también (§11). No se introduce un eje nuevo.
  2. El contador vive **fuera** de la fila de suscripción: hay una entidad más que mantener.
  3. **Queda abierto qué pasa con el historial si la persona borra la cuenta y vuelve.** Se
     cruza con `DEC-TRIAL-004`, que ya eligió el email normalizado como señal de identidad
     para un problema de la misma forma. Conviene que usen la misma señal.
  4. Se descartó la variante con arrastre explícito porque es un **fail-open**: si un camino
     de creación de suscripción se olvida de copiar el historial, el contador se resetea en
     silencio.
- **Origen**: `OD-SUB-01`.

### DEC-ADDON-001 — El addon se pierde con la ficha, y su reloj no se congela

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §40 define el scope `LISTING` y §41 ordena cancelar *"solo cuando queda
  efectivamente huérfano"*. Dos casos quedan sin cubrir: la ficha **se borra** (el addon
  apunta a algo que ya no existe) y la ficha queda **despublicada por suspensión** (§21) — ahí
  el addon **no está huérfano**, la ficha existe, y sin embargo no sirve para nada mientras el
  reloj sigue corriendo.
- **Alternativas**: (1) se pierde con la ficha y el reloj no se congela; (2) el reloj se
  congela mientras la ficha no se vea; (3) el addon se libera y se puede reasignar.
- **Decisión**: **(1)**. Borrar la ficha **consume** el addon: no se libera ni se reasigna. Y
  el addon **vence cuando vence**, esté la ficha publicada o no.
- **Motivo**: la regla más simple posible — una fecha de fin y nada más que calcular, sin
  estados intermedios. No abre la puerta a usar el borrado o la despublicación para estirar un
  addon comprado.
- **Implicaciones**:
  1. **Mitigación obligatoria**: la confirmación de borrado de una ficha **debe advertir qué
     addons se pierden y por cuánto**. Sin eso el reclamo entra por soporte y es justo.
  2. Un cliente suspendido dos meses **pierde dos meses de algo que pagó**. Conviene que el
     aviso de suspensión lo diga explícitamente.
  3. Coherente con cómo el §10.2 trata el trial: borrar no devuelve nada.
  4. No resuelve *"quiero mover el destaque a otra ficha"*, que el PDR tampoco cubre y que
     queda fuera de alcance por ahora.
- **Origen**: `E-ADDON-01`, `E-ADDON-02`.

### DEC-PROMO-001 — Cupo total de canjes más ventana de validez

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **implicación 5 precisada el 2026-09-25** (FASE 9 completa: el piso del apilado; ver su 📌), **y su texto de pantalla el mismo día** (9g; ver su segundo 📌) · **Decide**: owner
- **Problema**: §31 define *"Cada user: máximo un uso de cada código"* y nada más. Sin cupo
  total ni ventana de validez, un código filtrado es una pérdida abierta: el límite por persona
  no limita nada cuando hay usuarios ilimitados y crear una cuenta es gratis.
- **Alternativas**: (1) cupo total más ventana de validez; (2) sólo cupo total; (3) sólo el
  límite por persona del §31.
- **Decisión**: **(1)**. Cada código declara **cuántos canjes admite en total** y **entre qué
  fechas es válido**, además del límite por persona.
- **Motivo**: dos defensas independientes. Si el código se filtra lo corta el cupo; si alguien
  se olvida de desactivarlo, lo apaga la fecha. Que fallen las dos a la vez es mucho menos
  probable que fallar una.
- **Implicaciones**:
  1. **El cupo acota la pérdida máxima a un número conocido de antemano**, así que una campaña
     se puede presupuestar.
  2. **Hay que definir qué ve quien llega tarde** cuando el cupo se agota: un error claro que
     diga que el código ya no está disponible, no un silencio que se lea como "el código no
     existe".
  3. Los dos campos necesitan default, porque el modo de falla más común es el olvido. Un
     default generoso deja el agujero abierto igual.
  4. No resuelve el corte por presupuesto consumido (cortar cuando el descuento acumulado
     supera un monto), que es un tercer mecanismo y queda fuera de alcance.
  5. Se cruza con `A-PROMO-01` (orden de aplicación y piso del apilado), que **sigue abierta**.
     **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 4b; `03-…` AL OWNER
     2).** La mitad *«piso del apilado»* se cierra así: **un canje —o un apilado— cuyo monto compuesto
     cae bajo el piso del proveedor (ARS 15, `PC-2`) se rechaza al canjear**, con el motivo en
     pantalla. Lo gratis ya tiene dos instrumentos —el trial y la cortesía—, y la regla que mandaba
     pausar no tenía transición y dejaba una pausa sin fin (`F-8CB1-001`, paso 7).
     **📌 Precisado otra vez el 2026-09-25, con OK del owner (FASE 9 completa, fila 9g de
     `26-fase-9-completa/10`; `15` §2, aplicado en `17`).** **El motivo en pantalla dice que el
     mínimo lo pone Mercado Pago, no nosotros**: *«este código deja el importe por debajo del mínimo
     que Mercado Pago permite cobrar»* (`B/19` fila 7-bis; `B/14` §1.3 regla 2). El texto lo propuso
     el agente de aplicación; el owner lo aceptó agregando de quién es el mínimo.
- **Origen**: `M-PROMO-01`.

### DEC-PROMO-002 — El scope "todas las verticales futuras" se permite sin restricción

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el scope aparece en §31, §34 y §35.1, y significa que una concesión creada hoy
  otorga acceso automático a una vertical **que todavía no existe**, cuyo costo no se conoce y
  cuyo modelo de negocio puede ser completamente distinto. Una vertical nueva **nace regalada**
  a esa lista.
- **Alternativas**: (1) se permite tal cual; (2) se permite con vencimiento obligatorio;
  (3) una vertical nueva entra sólo si se la incluye explícitamente.
- **Decisión**: **(1)**. Se permite tal cual lo escribe el PDR, **sin tope y sin vencimiento
  obligatorio**.
- **Motivo**: decisión del owner. Es una herramienta comercial real para un acuerdo
  fundacional, y esos acuerdos son efectivamente "para siempre y para todo".
- **Implicaciones**:
  1. **Una vertical nueva nace regalada a esa lista**, con un costo que no se conocía cuando se
     otorgó la concesión.
  2. **Mitigación sugerida — no forma parte de la decisión**: que el acto de **crear una
     vertical liste explícitamente qué concesiones la alcanzan automáticamente**, para que sea
     una decisión consciente y no un descubrimiento posterior.
  3. Si la vertical futura tiene entitlements medidos (`DEC-ENT-001`), el regalo es de dinero
     por uso y no sólo de acceso. Conviene que esa lista incluya el costo estimado.
  4. Se descartó el vencimiento obligatorio porque contradice el §35, que modela Free Forever
     como permanente.
- **Origen**: `OD-PROMO-01`.

### DEC-GRANT-001 — Free Forever corta el cobro de inmediato, sin reembolso; revocar no restaura

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: §35.3 ordena *"Cancelar toda obligación de pago cubierta"*, incluidos
  MercadoPago y manual, pero no dice qué pasa con el período **ya cobrado** ni qué pasa si el
  grant se **revoca** después.
- **Contexto medido** (2026-09-15): hay 2 cortesías en producción, ninguna con vínculo al
  proveedor de pagos, y cero pagos cobrados en la historia del sistema.
- **Alternativas**: (1) se corta ya, sin reembolso, y revocar no restaura; (2) no se renueva,
  conservando el período pagado; (3) se corta ya, con reembolso proporcional.
- **Decisión**: **(1)**. Se corta el cobro **en el acto** y **no se devuelve lo pagado**. Si el
  grant se **revoca**, **no se reanuda el débito viejo**: hay que pedirle al cliente que
  autorice uno nuevo.
- **Motivo**: consistente con `DEC-ENT-004`, que resolvió el mismo dilema de la misma forma.
  Cumple el §35.3 literalmente y no depende de poder reembolsar, que sigue en `UNKNOWN`.
- **Implicaciones y riesgo declarado**:
  1. **Mismo riesgo que `DEC-ENT-004`**: retener dinero de un servicio cancelado por nosotros
     es discutible bajo la ley de defensa del consumidor. Acá **además el cliente no pidió
     nada**: le otorgamos un beneficio y en el mismo acto le retuvimos un período.
  2. **Revocar es una acción destructiva.** Deja al cliente **sin grant y sin suscripción**,
     o sea **sin servicio**, hasta que autorice un débito nuevo. **La UI del admin debe
     decirlo explícitamente al revocar**, o alguien lo va a hacer sin entender que está
     cortando el servicio de alguien.
  3. Si el proveedor no permite reanudar una autorización cancelada (`PA-5`, `UNKNOWN`), esto
     es **irreversible por construcción**, no por política.
  4. **Conviene avisar por correo antes**, tanto al otorgar como al revocar: al cancelar contra
     el proveedor es posible que éste le escriba por su cuenta (`M-MAIL-04`, fila `EX-3` en
     `UNKNOWN`). El §35.4 exige auditar el grant, pero **auditar no es avisar**.
  5. Hereda el disparador de revisión de `DEC-ENT-004`: el día que exista un ciclo anual, el
     monto retenido puede ser de once meses.
- **Origen**: `M-GRANT-01`.

### DEC-GRANT-002 — La cortesía temporal también es exclusiva de SUPER_ADMIN

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR es asimétrico y no dice si a propósito. §35, para Free Forever: *"Solo:
  `SUPER_ADMIN`"*. §34, para la cortesía temporal: apenas *"Admin puede otorgar"*. Las dos
  regalan servicio, y es una autorización con dinero atrás.
- **Alternativas**: (1) cualquier admin, con tope de días y auditoría; (2) sólo `SUPER_ADMIN`,
  igual que Free Forever; (3) cualquier admin, sin tope.
- **Decisión**: **(2)**. **Toda concesión gratuita, temporal o permanente, la firma
  `SUPER_ADMIN`.**
- **Motivo**: decisión del owner. Una sola regla para todo lo que regala servicio: imposible
  confundirse y sin configuración que mantener.
- **Implicaciones**:
  1. **Apartamiento declarado del §34**, que dice *"Admin puede otorgar"*. El PDR no se edita
     (§3.1): queda registrado acá.
  2. **Cierra un agujero real**: una cortesía "temporal" sin tope de días es un Free Forever
     con otro nombre. Si la pudiera otorgar un admin común, la exclusividad del §35 existiría
     en un camino y se podría esquivar por el otro.
  3. **Costo operativo declarado**: compensar a alguien unos días por un problema de servicio
     pasa a requerir al `SUPER_ADMIN`. **El riesgo concreto es que se termine compartiendo la
     cuenta**, que es peor que el riesgo que se evita. Conviene vigilarlo y, si aparece,
     resolverlo con un permiso acotado y no con una cuenta compartida.
  4. El catálogo de acciones administrativas de `M-ADMIN-01` tiene que reflejar que estas dos
     acciones comparten el mismo permiso.
  5. §35.4 ya exige auditar el grant; la cortesía temporal debe auditarse igual.
- **Origen**: `A-GRANT-01`.

### DEC-DATA-001 — Retención: oculto del público, visible para el dueño, con dos avisos

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **el punto 4, cerrado el 2026-09-25 por `DEC-DATA-005`** (ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C9, C11; ver su último 📌) · **Decide**: owner
- **Problema**: §21 promete que al suspender los *"datos conservados"* y la *"recuperación
  posible"*. §25 hace **soft delete a los 90 días** y **hard delete a los 180**. Y entre el
  `+60` en que la campaña del §10.7 ordena dejar de contactar y el día 90 hay **silencio
  total**: alguien que vuelve el día 200 encuentra su contenido borrado sin haber recibido
  nunca una advertencia.
- **Alternativas**: (1) oculto del público, visible para el dueño, con dos avisos; (2) oculto
  para todos, con dos avisos; (3) se conserva todo, sin hard delete.
- **Decisión**: **(1)**.
  - **Día 90**: la ficha **sale del sitio público**, pero **el dueño la sigue viendo** y puede
    **exportarla** o **reactivarla** suscribiéndose.
  - **Día 180**: hard delete de lo eliminable.
  - **Dos avisos**: uno antes del día 90 y otro antes del día 180.
- **Motivo**: es lo único que cumple la promesa del §21 sin incumplir el §25. Nadie pierde su
  contenido sin advertencia previa, y poder exportarlo antes es lo que hace defendible el hard
  delete.
- **Implicaciones**:
  1. **Los dos avisos son correos transaccionales no suprimibles.** No pueden caer bajo el
     opt-out comercial, o se deja de avisar justo a quien más lo necesita. Depende de
     `M-MAIL-03` (jerarquía de supresión), que **sigue abierta**.
  2. **"Visible para el dueño" obliga a que la suspensión no apague el acceso de lectura**, lo
     que es coherente con el *"Mi Cuenta read-only"* del §21 y se cruza con `A-AUTH-01` (si el
     rol se revoca al suspender), que **sigue abierta**.
  3. **Cierra el hueco de `DEC-TRIAL-007`**: "archivar" un borrador por inactividad significa
     esto mismo — sale de circulación, el dueño lo sigue viendo, y no es borrar.
  4. **Qué es exactamente "dato operativo eliminable"** a los 180 sigue sin definirse
     (`M-DATA-01`, abierta). **📌 Cerrada el 2026-09-25 por `DEC-DATA-005`**: sólo el contenido de la
     ficha; el usuario y sus datos no se tocan nunca. Si la auditoría del §49 guarda copias del contenido, el hard
     delete puede no eliminar nada.
  5. Los dos avisos tapan el silencio entre el `+60` y el día 90 que señalaba `R-DATA-01`.
- **Origen**: `C-DATA-01`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C9, C11)**: El día 90 y el día
  180 son los valores iniciales de los plazos 1 y 2 de `NUCLEO/02` §1.5, y cuántos días antes salen
  los dos avisos es el plazo 4; los cambia el `SUPER_ADMIN` sin adelantar ninguna fecha ya anunciada
  (`DEC-DATA-008`).

### DEC-LEGAL-001 — Comprobante no fiscal hasta ARCA, sin fecha ni disparador de revisión

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R25`: el cobro asentado sobre una lápida emite comprobante; ver su 📌) · **Decide**: owner
- **Problema**: §54 ordena que hasta integrar ARCA cada cobro genere un comprobante o recibo
  PDF y que **no** se lo llame factura fiscal; §53 difiere ARCA *"salvo decisión separada"*.
  Cobrar a consumidores finales sin comprobante fiscal tiene consecuencias impositivas, y el
  PDR lo dejaba como detalle de implementación que nadie había firmado.
- **Contexto medido** (2026-09-15): **cero pagos cobrados** en la historia del sistema. Hoy no
  hay ni un comprobante que emitir.
- **Alternativas**: (1) confirmado, con disparador al primer cobro real; (2) confirmado, sin
  fecha ni disparador; (3) se integra ARCA antes de cobrar.
- **Decisión**: **(2)**. Se avanza con comprobante no fiscal. La revisión ocurre *"cuando entre
  ARCA"*, **sin disparador agendado**.
- **Motivo**: decisión del owner. Es exactamente lo que dicen el §53 y el §54, sin agregar
  maquinaria.
- **Implicaciones y riesgo declarado**:
  1. **Lo que la objeción pedía queda cumplido**: esto es ahora una decisión firmada con su
     riesgo impositivo asumido, y no un detalle de implementación.
  2. **`"cuando entre ARCA"` no es una fecha ni un evento observable.** Queda explícito que no
     hay nada agendado ni ninguna condición que alguien vaya a verificar: la revisión depende
     de que alguien la recuerde.
  3. **El riesgo impositivo crece con cada cobro** y no hay ningún momento definido en que
     alguien se pregunte si sigue siendo tolerable. Hoy es cero porque no se cobró nunca nada.
  4. Se descartó adelantar ARCA porque metería una integración externa entera en el camino
     crítico de un programa de diez fases, y hoy no hay a quién cobrarle.
- **Origen**: `O-LEGAL-01`.
- 📌 **2026-09-27 (FASE 9 vuelta 2, `R25`, con OK del owner)**: el cobro que se asienta sobre
  una lápida —la del corte o la de recepción— también emite su comprobante, que queda en su
  fila sin enviarse, porque la lápida no tiene destinatario.

### DEC-SUB-005 — El cambio de ciclo se hace cancelando y recreando, no mutando

- **Fecha**: 2026-09-15 · **Estado**: **SUPERSEDED por `DEC-SUB-006`** (2026-09-16) · **Decide**:
  owner (delegado al criterio técnico, con el hecho medido a la vista)
- **Reemplaza a**: `DEC-SUB-001`.
- **Qué se cayó y qué no**: la **política no cambió** —el cambio de ciclo se sigue haciendo
  cancelando y recreando— pero el **mecanismo de re-autorización sí**: esta decisión daba por
  hecho tokenizar la tarjeta guardada del lado del servidor y pedirle el código de seguridad al
  cliente. `DEC-SUB-006` lo reemplaza por el checkout del proveedor, y además fija la
  compensación y el momento exacto de la cancelación, que acá quedaban sin definir.
- **Problema**: `DEC-SUB-001` fijó que cualquier cambio de ciclo se aplica de inmediato
  compensando en días, y eso presuponía poder **mutar** el ciclo de la suscripción vigente.
  FASE 1C midió que **no se puede**: `EX-4` salió `NOT_SUPPORTED`, y además **falla en
  silencio** — dos intentos aislados devolvieron `200` con `frequency` intacta.
- **Contexto medido** (2026-09-15, sandbox,
  [sondas 01/02/03](./mp-probes/RESULTS-2026-09-15.md)):
  - `EX-4` **el ciclo no se puede cambiar** sobre una suscripción autorizada.
  - `EX-8` **`VERIFIED`**: crear una suscripción autorizada con `start_date` futura respeta esa
    fecha **y no cobra al crearse**.
  - **Recrear no exige recargar la tarjeta**: se puede tokenizar la tarjeta ya guardada
    server-side con `card_id` **más el código de seguridad**. Verificado de punta a punta y por
    relectura independiente: quedó `authorized`, con el ciclo nuevo, el primer cobro corrido y
    cero cobro al crear.
  - Con `card_id` **sin** código de seguridad el token se genera (`201`) pero **no sirve**:
    `400 "Card token was generated without cvv validation"`.
- **Alternativas**: (1) cancelar y recrear con la fecha corrida; (2) el plan B declarado en
  `DEC-SUB-001` — el cambio de ciclo espera a la renovación; (3) prohibir el cambio de ciclo.
- **Decisión**: **(1)**. **La política de `DEC-SUB-001` se mantiene sin cambios** — subir de
  tier es inmediato, bajar de tier con el mismo ciclo espera al fin del período, y cualquier
  cambio de ciclo se aplica ya. **Lo único que cambia es cómo se ejecuta**: cancelando la
  suscripción vigente y creando una nueva con la primera fecha de cobro corrida por los días
  ya pagados.
- **Motivo**: entrega exactamente el efecto que la decisión original buscaba, medido, y evita
  el plan B — que degradaba la experiencia sin necesidad.
- **Implicaciones**:
  1. **El cliente tiene que ingresar su código de seguridad** para cambiar de ciclo. Es
     fricción real, pero de un campo, no de un checkout entero. **Es el costo de esta decisión
     y conviene que la UI lo anticipe** en vez de sorprender con un formulario.
  2. **La operación no es atómica del lado del proveedor**: son dos llamadas, cancelar y
     crear, y cancelar es **irreversible** (`PA-5`). Si la creación falla después de haber
     cancelado, **el cliente queda sin suscripción**. El orden correcto es **crear primero y
     cancelar después**, y hace falta una reconciliación para el caso en que se caiga en el
     medio y queden dos vivas — que conviven sin conflicto (`EX-6`), así que el estado
     intermedio no es destructivo.
  3. **Toda mutación exige relectura y comparación**, no alcanza con el código de estado. Es
     la regla general que dejó FASE 1C y acá es lo que habría evitado dar por bueno el cambio
     de ciclo.
  4. `DEC-SUB-003` (cambiar de plan en grace) se cruza con esto: si el cambio además mueve el
     ciclo, se recrea. Qué pasa con el período impago al compensar sigue abierto (`E-SUB-05`).
  5. El agujero declarado en `DEC-SUB-001` — bajar de tier y de ciclo a la vez como salida
     anticipada de un compromiso anual — **sigue vigente sin cambios**.
- **Origen**: `BD-SUB-01` (BLOCKING) + FASE 1C.

### DEC-MP-001 — Los cambios de precio sobre suscripciones vigentes se aplican mutando el monto

- **Fecha**: 2026-09-15 · **Estado**: ACCEPTED · **Decide**: el experimento (`BD-MP-03`)
- **Problema**: el §29 contempla explícitamente que un cambio de precio afecte *"subscriptions
  existentes"*, pero no dice cómo se ejecuta sobre una suscripción que el cliente ya autorizó.
  `BD-MP-03` era una de las cuatro bloqueantes de FASE 2 que no se podían cerrar por
  conversación.
- **Contexto medido** (2026-09-15, sandbox,
  [sondas 01/02](./mp-probes/RESULTS-2026-09-15.md)):
  - `PC-1` **`VERIFIED`**: el monto de una suscripción **autorizada** se muta. 1500 → 2200 → 15
    → 1500, los cuatro pasos verificados **por relectura**, no por el código de estado.
  - `PC-3` **`VERIFIED`**: **no requiere nuevo consentimiento** del usuario. La suscripción
    sigue `authorized` y conserva su medio de pago.
  - `PC-2` **`VERIFIED`**: el piso es **ARS 15**. Cero y negativo se rechazan.
  - `EX-4` **`NOT_SUPPORTED`**: el **ciclo** no se puede mutar. Un cambio de precio que además
    mueva el ciclo no entra por acá.
- **Alternativas**: (1) mutar `transaction_amount` sobre la suscripción vigente; (2) cancelar y
  recrear con el precio nuevo, que es el mecanismo de `DEC-SUB-005`; (3) no aplicar cambios de
  precio a las vigentes y dejarlos sólo para clientes nuevos.
- **Decisión**: **(1)**.
- **Motivo**: es la única que **no le pide nada al cliente**. La (2) exige el código de
  seguridad (`EX-9`) a **toda la base instalada** por un cambio que el cliente no pidió:
  convierte un aumento en una renegociación, y quien no complete el formulario se queda sin
  suscripción. La (3) contradice el §29, que nombra a las suscripciones existentes entre las
  que un cambio de precio *puede afectar*.
- **Implicaciones**:
  1. **Que el proveedor no pida re-consentimiento no significa que no haya que avisar.** El §29
     exige aviso, precio anterior y nuevo, fecha efectiva y derecho a cancelar, y **el proveedor
     no hace nada de eso**: es responsabilidad entera de Hospeda. Acá sólo se cerró la pregunta
     técnica.
  2. **La mutación se verifica por relectura y comparación campo por campo** (§0 de los
     resultados). Es precisamente el terreno donde este proveedor ya demostró aceptar cambios
     que no aplica, y un aumento "aplicado" que no se aplicó no lo nota nadie hasta la
     conciliación.
  3. **El cambio se ejecuta en la fecha efectiva, no cuando se decide.** Eso implica una cola de
     cambios programados, que es el hueco `M-SUB-02`, y no un `PUT` en el momento de la
     decisión comercial.
  4. **Un precio nuevo por debajo de ARS 15 no es aplicable por este camino** (`PC-2`).
  5. Si el cambio de precio **viene con un cambio de ciclo**, no es este camino: es
     `DEC-SUB-005` (cancelar y recrear), con su fricción de código de seguridad.
  6. El §29 cierra con *"Investigar normativa actual antes de implementar"*. **Eso sigue
     pendiente** y no lo resuelve esta decisión: queda en `M-LEGAL-03`.
- **Origen**: `BD-MP-03` (BLOCKING) + FASE 1C.

### DEC-SUB-006 — El cambio de ciclo se re-autoriza en el checkout, y se compensa por valor

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa, `F-8CB1-002`: la excepción de `D8`; ver su 📌) · **Decide**: owner
- **Reemplaza a**: `DEC-SUB-005` (sólo su mecanismo; la política es la misma).
- **Problema**: `DEC-SUB-005` fijó que el cambio de ciclo se hace cancelando y recreando, pero
  dejó tres cosas sin definir que resultaron ser las que deciden el diseño: **cómo vuelve a
  autorizar el cliente**, **qué pasa con los días que ya pagó**, y **en qué momento exacto se
  cancela la suscripción vieja**.
- **Contexto medido**:
  - `EX-4` **`NOT_SUPPORTED`**: el ciclo de una suscripción viva no se muta — `200` y nada cambia.
  - `EX-21` **`NOT_SUPPORTED`**: tampoco se la puede mover de un plan a otro — `200` y sigue en el
    plan viejo. **La documentación oficial del proveedor lo confirma**: una suscripción creada sin
    plan no se puede migrar a un plan después.
  - `EX-9` **`PARTIALLY_SUPPORTED`**: tokenizar la tarjeta guardada **exige el código de
    seguridad**. Sin él el token se genera igual (`201`) y falla recién al usarse.
  - `EX-12` **`NOT_SUPPORTED`**: un token de tarjeta es **de un solo uso**, y el error del segundo
    intento no se parece a «reintentaste».
  - `EX-6` **`VERIFIED`**: varias suscripciones autorizadas del mismo pagador **conviven sin
    conflicto** (seis a la vez, en producción). El estado intermedio no es destructivo.
  - `PA-5`: cancelar es **irreversible**.
  - `EX-3`: cancelar dispara un correo del proveedor que dice *«por cuenta de pagos no realizados
    o por opción del vendedor»* — una baja voluntaria y una por mora le llegan idénticas.
- **Alternativas** para re-autorizar: (1) tokenizar la tarjeta guardada del lado del servidor y
  pedirle el código de seguridad en nuestra página; (2) **crear el `preapproval` en estado
  pendiente y mandarlo al `init_point`**, igual que en el alta.
- **Alternativas** para los días pagados: (a) no compensar; (b) correr la fecha del primer cobro
  tantos días como le quedaban; (c) **correr la fecha por VALOR**: el crédito es lo pagado sin
  usar, y los días que cubre salen de dividirlo por el precio diario del plan nuevo; (d) mover
  plata — cobrar la diferencia o reembolsar.
- **Decisión**: **(2) + (c)**. Se re-autoriza en el **checkout del proveedor**, y los días pagados
  se compensan **por valor**, corriendo la fecha del primer cobro de la suscripción nueva.
- **Motivo**:
  - El checkout **ya hay que tenerlo construido igual**, porque es el flujo del alta —y es el
    modelo que el §5.6 fija como actual—, así que reusarlo no agrega superficie nueva. La
    tokenización sería un flujo entero que existe sólo para este caso.
  - La tokenización **sólo sirve si el cliente paga con tarjeta**. Quien paga con saldo en cuenta
    queda afuera. El checkout acepta todos los medios.
  - Compensar por valor **cuesta lo mismo que no compensar**: en los dos casos hay que mandar una
    fecha de primer cobro futura —es la precondición que evita el doble cobro—, así que la única
    diferencia es qué fecha se calcula. No compensar sólo compra un cliente molesto.
  - Compensar **por días** y no por valor es correcto de mensual a anual y regala plata al revés:
    trasladaría el descuento por compromiso anual a un plan mensual que no lo tiene.
  - Mover plata suma un reembolso con comisión perdida, sobre una API que el proveedor anuncia en
    discontinuación (`R-MP-01`) y con un rechazo que todavía no sabemos explicar (`RF-8`).
- **Implicaciones**:
  1. **La suscripción vieja se cancela al recibir el webhook de autorizada, NUNCA antes.** Si se
     cancela al iniciar el cambio y el cliente abandona el checkout, **se queda sin nada**. Con
     este orden, si nunca autoriza, la vieja sigue viva y no pasó nada.
  2. **La fecha de primer cobro futura no es un detalle: es la precondición de seguridad.** Sin
     ella la nueva cobra en el acto mientras la vieja sigue viva, y el cliente paga dos veces.
  3. **Hace falta una reconciliación** para el caso en que la nueva quede autorizada y la
     cancelación de la vieja falle: quedan dos vivas y el cliente paga dos veces en el ciclo
     siguiente. `EX-6` garantiza que el estado intermedio no rompe nada, no que se limpie solo.
  4. **El correo del proveedor no se puede evitar, pero sí anticipar.** Hay que escribirle antes
     de cancelar, avisándole que va a recibir un aviso de Mercado Pago que habla de cancelación y
     que es parte del cambio que pidió.
  5. **El cliente ve la fecha antes de confirmar**: el checkout le muestra monto y desde cuándo se
     cobra, así que la compensación deja de ser un gesto invisible y pasa a ser parte de lo que
     acepta.
  6. El crédito **se consume entero en la fecha y no deja saldo**, así que no hace falta modelar
     un saldo a favor.
- **CONDICIONADA a `EX-33`**, que está **`UNKNOWN`** (§61): está medido que una fecha futura se
  respeta sobre una suscripción autorizada **por API con token** (`EX-8`), y **nadie midió qué
  pasa cuando la autoriza el cliente en el checkout**. Es la misma distinción que el documento ya
  marca entre `EX-7` y `EX-8`: que el proveedor acepte una fecha al crear no prueba que la respete
  después. Si el checkout la resetea, la compensación no se puede ejecutar por esta vía **y el
  cliente paga dos veces**. Se mide en sandbox, sin costo, completando un checkout a mano una vez.
- **Origen**: punto 1 del contraste PDR ↔ proveedor · §19 · `BD-SUB-01`.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 8 completa, `F-8CB1-002`)**: la precondición
  de seguridad que esta decisión hizo nacer —`D8`, *«toda sucesora nace con fecha de primer cobro
  posterior al vencimiento de su ventana»*— **tiene una excepción**: la sucesora de una `SUSPENDED`
  de pagador con tarjeta cuyo preapproval se releyó `cancelled` **cobra al autorizar**, como un
  alta. Ahí no hay preapproval viejo que pueda cobrar en paralelo ni crédito que cubra la espera.
  Las dos posiciones están en `B/12` §5.2: la uniformidad de la precondición, contra no regalarle
  días a un moroso que vuelve.

### DEC-SUB-007 — El upgrade se ejecuta con el mismo mecanismo que el cambio de ciclo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C15; ver su 📌) · **Decide**: owner
- **Extiende** `DEC-SUB-006` al cambio de **plan**. No la reemplaza.
- **Problema**: el §27 pide que el upgrade sea inmediato y dejó el **impacto económico** marcado
  `PENDING MP VALIDATION`. La medición le dio una respuesta incómoda: **subir de plan es gratis
  hasta el próximo cobro**.
- **Contexto medido**:
  - `UP-1`/`UP-2` **`VERIFIED`** (producción): mutar el monto aplica en el acto y el cobro
    siguiente sale por el monto nuevo — una suscripción que nació en $15 y se subió a $30 cobró
    $30. Pero **el proveedor no prorratea ni cobra la diferencia del ciclo en curso**.
  - `PC-3` **`VERIFIED`**: mutar el monto **no pide un consentimiento nuevo** al cliente.
  - `EX-30` **`VERIFIED`**: una orden de única vez cobra sin habilitación especial — pero
    **necesita un medio de pago**, y no tenemos la tarjeta del cliente de forma reusable
    (`EX-12`: el token es de un solo uso; `EX-9`: tokenizar la guardada pide el código de
    seguridad).
  - `EX-3`: cancelar dispara el correo del proveedor que insinúa mora.
- **Contexto externo** (no es fundamento, es contraste): la industria cobra la diferencia
  prorrateada **al instante** en el upgrade y **difiere** el downgrade al próximo ciclo. La
  asimetría es deliberada y es lo que evita que alguien juegue con los tiempos.
- **Alternativas**: (A) aceptar el upgrade gratis hasta el próximo cobro, que es lo que el
  proveedor hace solo; (B) cobrar la diferencia prorrateada con una orden suelta; (C) **cancelar y
  recrear**, igual que el cambio de ciclo, compensando por valor.
- **Decisión**: **(C)**.
- **Motivo**:
  - **No agrega ni una línea de mecanismo**: es el mismo camino de `DEC-SUB-006` con otro plan en
    vez de otro ciclo. Un solo flujo cubre los dos cambios.
  - **(B) no es viable como parecía**: cobrar una orden suelta **exige un medio de pago**, y ahí
    vuelve exactamente la fricción de tokenización que `DEC-SUB-006` descartó — más un movimiento
    de plata que no hacía falta.
  - **(A) deja un agujero que el downgrade diferido no cierra**: subir de plan y **cancelar antes
    del cobro** entrega un ciclo de plan caro casi gratis.
  - Para un upgrade, un checkout es fricción esperable: el cliente ya decidió gastar más, y de
    paso **ve y acepta el monto nuevo antes de confirmar**, que es lo que el §29 pide comunicar.
- **Implicaciones**:
  1. **Queda una asimetría deliberada entre subir y bajar**, y coincide con la práctica de la
     industria: el **upgrade** se ejecuta cancelando y recreando (pasa por el checkout, cobra
     desde ya), y el **downgrade** se ejecuta como una **mutación programada para el fin del
     ciclo** —sin checkout, porque mutar no pide consentimiento (`PC-3`)—. Esa segunda mitad se
     decide en su propio punto; acá queda anotada la mitad que esta decisión condiciona.
  2. ~~**El downgrade tiene que ser diferido de verdad.** Si se muta el monto en el momento en que
     el cliente lo pide, el proveedor cobrará el monto bajo al fin del ciclo y el cliente habrá
     usado el plan alto pagando el bajo. Cumplir el §28 significa no tocar el monto hasta el fin
     del ciclo, lo que exige la cola de cambios programados de `M-SUB-02`.~~

     ⚠️ **CORREGIDO el 2026-09-16**, el mismo día y antes de decidir el punto 3. Se deja tachado
     en vez de borrado. **La implicación era falsa.** El cobro es **por adelantado**: el del día 1
     ya pagó el período en curso, y el del día 30 paga el mes siguiente, que ya es el plan bajo.
     Así que **mutar el monto cuando el cliente lo pide da el resultado correcto**, y diferirlo
     sería **peor** — una carrera contra el cobro donde perder significa cobrarle el plan caro un
     mes que no va a usar. El agujero que motivó el párrafo era el del **upgrade gratis**, y lo
     cierra la decisión (C) de arriba, no el downgrade. **El downgrade no necesita la cola de
     `M-SUB-02`.** Lo que sí se difiere al fin del ciclo son los **entitlements**, que son
     nuestros y no del proveedor — ver `DEC-SUB-008`.
  3. **Cada upgrade dispara el correo de cancelación del proveedor**, que dice *«por cuenta de
     pagos no realizados o por opción del vendedor»*. Alguien que acaba de **pagar más** recibe un
     aviso que insinúa que lo dieron de baja por no pagar. Se mitiga igual que en `DEC-SUB-006`:
     escribirle **antes** de cancelar. Es el costo declarado de esta decisión.
  4. **Los addons no se cancelan solos.** Como un addon recurrente es una suscripción aparte
     (`EX-6`), cancelar la del plan no los toca. Al recrear hay que decidir si siguen colgando del
     cliente o si hay que re-vincularlos — es el hueco `E-ADDON-04`.
  5. Hereda de `DEC-SUB-006` sus tres precondiciones: fecha de primer cobro futura, cancelación de
     la vieja **sólo al recibir el webhook de autorizada**, y reconciliación para el caso en que
     la nueva quede viva y la cancelación falle.
- **CONDICIONADA a `EX-33`**, igual que `DEC-SUB-006`: si el checkout no respeta la fecha de
  primer cobro futura, el cliente paga dos veces.
- **Para revisar**: si alguna vez la fricción del checkout mide caída de conversión en upgrades,
  la alternativa (A) es defendible como decisión comercial — regala medio ciclo a cambio de cero
  fricción y de no disparar el correo de cancelación.
- **Origen**: punto 2 del contraste PDR ↔ proveedor · §27.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C15)**: La migración de un plan
  retirado (`DEC-SUB-023`) es un tercer camino: muta el monto como un aumento y baja o sube
  capacidades en la renovación.

### DEC-SUB-008 — El downgrade muta el monto ya, baja los entitlements al fin del ciclo, y el excedente se avisa antes de tocarlo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C15; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 37, G-A, I-A e I-B; ver su último 📌) · **Decide**: owner
- **Problema**: el §28 pide que el downgrade se aplique al fin del ciclo conservando el plan
  anterior hasta entonces, y **no dice qué pasa con lo que ya no entra** en el plan nuevo — un
  anfitrión con 5 fichas publicadas que baja a un plan de 3. Ese hueco es `M-ENT-02`.
- **Contexto medido**:
  - `DW-1`/`DW-2` **`VERIFIED`** (producción): el proveedor **cobra siempre el monto vigente al
    momento del cobro**. Una suscripción que nació en $30 y se bajó a $15 cobró $15.
  - `PC-3` **`VERIFIED`**: mutar el monto **no pide consentimiento** al cliente.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite ningún webhook**. Nuestro estado sólo se
    entera releyendo.
  - `EX-3`: el cliente recibe *«El vendedor Hospeda cambió el monto»*. En un descenso es benigno,
    pero llega sin contexto y antes que nosotros.
- **Decisión**, en tres partes:
  1. **El monto se muta cuando el cliente lo pide.** No se difiere. El cobro es por adelantado, así
     que el próximo cobro ya corresponde al plan nuevo y sale correcto solo. Diferirlo sería una
     carrera contra el cobro (ver la corrección de `DEC-SUB-007`).
  2. **Los entitlements bajan al fin del ciclo**, no al pedirlo. Son dos relojes distintos: entre
     el pedido y el fin del ciclo el cliente ve el precio nuevo y conserva los beneficios viejos,
     que es exactamente lo que el §28 pide.
  3. **El excedente se avisa, no se ejecuta por sorpresa.** Al pedir el downgrade se le muestra
     qué no va a entrar y se le pide que elija qué conserva. **No es obligatorio**: puede
     confirmar igual, y tiene hasta el fin del ciclo para ordenarlo él. Si llegado ese momento
     sigue excedido, **el sistema despublica automáticamente** hasta dejarlo dentro del límite.
- **Motivo**:
  - Del lado del proveedor **no había nada que elegir**: mutar funciona, no pide consentimiento y
    no dispara el correo de cancelación. Es el único de los tres cambios de plan que sale limpio.
  - **Bloquear el downgrade hasta que ordene empuja a cancelar del todo.** Alguien que baja porque
    no puede pagar y se encuentra bloqueado no vuelve al plan caro: se va. Es mejor que baje.
  - **Automático puro sin aviso puede despublicarle la ficha principal**, que para un anfitrión es
    el negocio. Avisar primero y dejar que elija cuesta una pantalla y evita ese daño.
- **Implicaciones**:
  1. **Despublicar no es borrar.** El automático saca del público; los datos siguen y el dueño los
     ve, según `DEC-DATA-001`. Eso es lo que hace tolerable el fallback.
  2. **Hace falta guardar la elección** del cliente entre el pedido y el fin del ciclo, y un
     proceso que la ejecute. No es la cola de cambios programados del proveedor (`M-SUB-02`): es
     una cola nuestra, de entitlements.
  3. **Arrepentirse es barato**: volver al plan alto antes del fin del ciclo es otra mutación del
     monto más cancelar el descenso programado.
  4. **Toda mutación se verifica releyendo.** Como no emite webhook, un cambio de monto que el
     proveedor acepta y no aplica no lo nota nadie hasta la conciliación.
  5. **Nuestro aviso tiene que salir antes** que el del proveedor, o al menos explicar el que ya
     le llegó.
- **El criterio del automático: se despublican primero las publicadas MÁS RECIENTEMENTE**, hasta
  quedar dentro del límite. Cerrado el 2026-09-16 por el owner. Se descartaron «las de menos
  visitas» y «pedirle un orden de prioridad» por el mismo motivo: **es el único criterio que el
  cliente puede predecir sin mirar métricas**. Si el aviso dice «vamos a despublicar las últimas
  que publicaste», sabe qué va a pasar y puede actuar; con un criterio por rendimiento no puede
  anticiparlo, y una sorpresa ahí le pega al negocio. **Por eso el criterio va escrito en el
  aviso**, no sólo en el código: si el cliente no puede leerlo, deja de ser predecible y el
  motivo por el que se eligió se pierde.
- **Origen**: punto 3 del contraste PDR ↔ proveedor · §28 · `M-ENT-02`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C15)**: La migración de un plan
  retirado (`DEC-SUB-023`) es un tercer camino: muta el monto como un aumento y baja o sube
  capacidades en la renovación.
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 37, G-A,
  I-A e I-B)**: El descenso programado lo aplica `S38`, la transición de la cola de `B/12` §2 que
  también aplica el cambio de versión de una migración: pasa la fila a la versión destino, aplica la
  elección de qué conservar y emite el aviso de cobertura. Si la fecha llega con la fila en
  `GRACE_PERIOD`, se aplica igual, porque el servicio sigue y el monto ya se mutó; en `SUSPENDED`
  espera y se aplica al volver por `S7`, también cuando `S7` la devuelve a `CANCEL_SCHEDULED` porque
  el cobro entró sobre un preapproval ya cancelado; en `PAUSED` espera a la reanudación, como ya
  estaba. Un pagador con tarjeta suspendido no vuelve por `S7` sino como sucesora, y el cambio muere
  con la fila vieja, como cuando llega un upgrade: la sucesora eligió su plan en el checkout y nace
  sin cola.

### DEC-SUB-009 — La baja a fin de período cancela YA y sostiene el servicio de nuestro lado

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R17`: el crédito de `DEC-SUB-006` cuenta como período pagado; ver su 📌) — **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-b`: la baja desde `PAUSED` de una sucesora que vive del crédito; ver su segundo 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N8; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, punto 1 y lote L-A; ver su último 📌) · **Decide**: owner
- **Problema**: el §24 pide que la baja se haga efectiva al final del período ya pagado,
  manteniendo el servicio hasta entonces. El proveedor **no lo ofrece** para una suscripción viva,
  así que hay que emularlo — y la forma obvia de emularlo es la peligrosa.
- **Contexto medido**:
  - `CN-1` **`PARTIALLY_SUPPORTED`**: la baja programada existe, pero **sólo se puede fijar al
    CREAR** la suscripción. El mismo campo sobre una autorizada devuelve `200` y **no aparece en
    la relectura**. Justo el caso que importa —una baja se pide *después* de contratar— es el que
    no entra.
  - `GT-1` **`VERIFIED`** (producción): cancelar **frena el cobro**. El sujeto cancelado tenía su
    cobro agendado para el mismo instante que los otros y no cobró.
  - `PA-5`: cancelar es **irreversible**.
  - `EX-3`: cancelar dispara el correo del proveedor que insinúa mora.
- **Contexto externo** (contraste, no fundamento): los proveedores maduros lo resuelven adentro
  —Stripe tiene un `cancel_at_period_end` nativo, y reactivar es ponerlo en falso—. Y el **fallo
  parcial de ese agendamiento está documentado como vulnerabilidad real de implementación**: el
  trabajo programado falla a medias, el procesador no se entera de nada y al vencimiento
  **renueva y sigue cobrando**.
- **Alternativas**: (A) un trabajo programado que cancele el día del vencimiento, dejando la
  suscripción viva en el proveedor hasta entonces; (B) **cancelar en el proveedor de inmediato y
  sostener el servicio de nuestro lado** hasta el fin del período pagado.
- **Decisión**: **(B)**.
- **Motivo, y es uno solo: la dirección en la que falla cada una.** Las dos tienen procesos que se
  pueden caer; lo que se elige es qué pasa cuando se caen.
  - Con **(A)** el fallo **cobra plata que no corresponde**, y repararlo exige un reembolso — con
    la comisión perdida, sobre la API que el proveedor anuncia en discontinuación (`R-MP-01`) y
    con el rechazo de `RF-8` que todavía no sabemos explicar.
  - Con **(B)** el fallo **regala unos días de servicio**, y se corrige sin mover un peso.
  - Segundo argumento: con (A) la suscripción **sigue viva en el proveedor** entre el pedido y el
    vencimiento, así que cualquier otra operación de esa ventana se cruza con una baja pendiente
    que el proveedor no conoce. Con (B) el estado es simple: cancelada allá, con una fecha de fin
    de servicio en nuestra base.
- **Implicaciones**:
  1. **El costo de esta decisión es el arrepentimiento, y es más frecuente que un proceso caído.**
     Como cancelar es irreversible, volver atrás exige **recrear**. No es código nuevo —es el
     mismo camino de `DEC-SUB-006`— pero es fricción, sobre alguien que acaba de decidir quedarse.
  2. **El correo del proveedor le llega el día que pide la baja, no el día que termina.** Va a
     leer *«tu suscripción fue cancelada»* con días de servicio por delante. **Nuestro aviso tiene
     que salir antes y decir la fecha real hasta la que tiene acceso**, o va a creer que perdió lo
     que pagó.
  3. **La fecha de fin de servicio pasa a ser un dato nuestro**, no del proveedor. El
     `next_payment_date` de una suscripción cancelada **no sirve**: sigue mostrando una fecha
     futura que ya no significa nada.
  4. El proceso que corta el servicio al vencimiento **tiene que ser idempotente**: si corre dos
     veces, la segunda no hace nada.
- **Origen**: punto 4 del contraste PDR ↔ proveedor · §24.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: el crédito de
  `DEC-SUB-006` cuenta como período pagado: `fin_de_servicio = max(fórmula, fin del crédito)`.
  El fin en el acto queda sólo para la fila sin `covered_period` y sin crédito.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-b`)**: la baja
  desde `PAUSED` de una sucesora que vive del crédito sin consumir (`S22`) va a `CANCEL_SCHEDULED`
  con fin en el fin del crédito, con la regla de `S11` entera, complementos incluidos.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N8)**: Pendiente de medición
  (revisión del owner, N8): una pausa o una cancelación hecha por el pagador desde su cuenta de
  Mercado Pago no se distingue hoy de una del proveedor; hasta medir, esta decisión la trata como
  mora o como baja del proveedor. `B/12`, lo que no cierra.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, punto 1 y lote L-A)**:
  Medido el 2026-09-29 (`EX-52`, `EX-56`): el pagador puede darse de baja desde su cuenta de Mercado
  Pago cuando el alta fue por checkout, llega un aviso sólo por Webhooks, y ningún campo lo
  distingue de una baja nuestra: la autoría sólo la da nuestro propio registro. Esta decisión no la
  alcanza: por decisión del owner, contra la recomendación, esa baja se espeja como una baja del
  proveedor y corta en el acto (`B/12` §1.4, `B/03` §10.1; lote L, letra A). Consecuencia aceptada:
  quien se da de baja desde Mercado Pago pierde los días que ya pagó, y la misma baja da dos
  resultados según dónde se dio.

### DEC-MP-002 — El aumento rige ya para los nuevos, y alcanza a los existentes tras 60 días de aviso

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C15, C9; ver su ~~📌~~ primer 📌) — **y precisada otra vez el 2026-10-02, con OK del owner** (corte del MVP, BM: ningún precio cambia hasta el momento 5 del corte, y la parte 2 llega con `B12`; ver su segundo 📌) · **Decide**: owner
- **Complementa** `DEC-MP-001`, que decidió el **mecanismo** (mutar el monto). Esta decide la
  **política**: cuándo se avisa, con cuánta antelación, y cómo alcanza a quien ya está.
- **Problema**: el §29 exige avisar, mostrar el precio anterior y el nuevo, la fecha efectiva y
  permitir cancelar — y cierra con *«investigar normativa actual antes de implementar»*.
  `DEC-MP-001` cerró la pregunta técnica y dejó ésta abierta.
- **Contexto medido**:
  - `PC-1`/`PC-3` **`VERIFIED`**: el monto de una suscripción viva se muta **sin pedirle un
    consentimiento nuevo** al cliente.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite ningún webhook**. Nuestro sistema sólo se
    entera releyendo.
  - `EX-3` **`VERIFIED`**: **el proveedor le escribe al cliente por su cuenta** —*«El vendedor
    Hospeda cambió el monto»*— y lo hace **en el acto**.
  - `DW-1`/`DW-2` **`VERIFIED`**: el proveedor cobra siempre el **monto vigente al momento del
    cobro**, así que mutar hoy alcanza a la próxima renovación sea cuando sea.
- **Decisión**, en tres partes:
  1. **Cambiar el precio del plan rige de inmediato para los que se suscriban desde ese momento.**
  2. **A los que ya estaban se les aplica también, pero recién después de una ventana de aviso de
     al menos 60 DÍAS**, con **tres contactos**: al anunciar, a 30 días y a 7 días. Cada uno lleva
     el precio actual, el nuevo, **la fecha en que le toca a ese cliente** y que si no acepta
     puede cancelar.

     **La ventana se cuenta desde el PRIMER AVISO, no desde el cambio del catálogo.** Lo que la
     regla protege es el tiempo de reacción del cliente: si el precio cambia un lunes y se avisa
     el jueves, el cliente tuvo tres días menos.

     **Cómo cae la fecha efectiva, por ciclo:**
     - **Mensual** — 60 días desde el primer aviso, **aunque en el medio haya cobros**. El aumento
       se aplica en el **primer cobro estrictamente posterior** a cumplirse los 60 días. En la
       práctica: **dos cobros al precio viejo y el tercero al nuevo**.
     - **Anual** — el aviso sale **60 días antes de su renovación**, y el aumento se aplica en esa
       renovación. **Si al decidirse el aumento le faltan menos de 60 días para renovar, no se
       llega a avisar y su aumento se posterga a la renovación SIGUIENTE** — hasta catorce meses
       después. Es el costo de la regla, y es deliberado.
     - **El empate lo gana el cliente**: un cobro que cae justo el día 60 va al precio viejo.
  3. **Llegada esa fecha, el monto se muta automáticamente.** No hace falta que el cliente acepte
     nada; sí puede cancelar antes.
- **Motivo**:
  - **El owner quiere que el aumento alcance a todos**, no sólo a los nuevos. Una versión anterior
    de esta decisión fijaba migración explícita por cliente —es decir, que si nadie la ejecutaba
    los viejos conservaban el precio para siempre— y **eso no era lo que se quería**. Corregido el
    mismo día, antes de implementar nada.
  - **La ventana larga es lo que hace real el derecho a cancelar del §29.** Con 30 días y ciclo
    mensual el cliente tiene un solo ciclo para reaccionar; con dos meses tiene dos o tres. La
    antelación no es cortesía: es la condición para que «cancelá si no aceptás» signifique algo.
  - **Tres contactos y no uno** porque un único mail se pierde, y el costo de que se pierda lo
    paga el cliente con un cobro que no esperaba.
  - **Nuestro aviso sale antes de mutar, siempre.** Como el proveedor le escribe al cliente en el
    instante de mutar y a nosotros no nos avisa, si no hablamos primero el cliente se entera por
    un tercero. Con tres avisos previos, el correo del proveedor llega como **confirmación**.
- **Implicaciones**:
  1. **La fecha efectiva es por cliente, no global**, y sale de la regla por ciclo de arriba. Un
     anual que ya pagó hasta dentro de nueve meses no puede recibir un aviso que diga «desde el 1
     de diciembre»: el aumento lo alcanza en **su** renovación. El anuncio es global, **cada mail
     dice la fecha de ese cliente**, o el «cancelá antes» no le sirve para calcular nada.
  1b. **Un aumento tarda en rendir, y hay que preverlo.** En mensual, dos ciclos completos al
     precio viejo; en anual, hasta catorce meses. Quien decida un aumento tiene que saber cuándo
     empieza a cobrarse de verdad.
  2. **El precio vive en la suscripción, no sólo en el plan.** Durante la ventana conviven dos
     precios para el mismo plan, y lo que se cobra es el de la suscripción.
  3. **El proceso que aplica el aumento falla para el lado bueno**: si no corre, el cliente sigue
     pagando el precio viejo y nadie cobra de más. Pero **hay que registrar a quién se le
     aplicó**, para que un fallo parcial no deje media cartera migrada sin que se sepa cuál.
  4. **La mutación se verifica releyendo**, siempre: no hay webhook que confirme, y es el terreno
     donde el proveedor ya demostró aceptar sin aplicar.
  5. Quien cancela para no aceptar el aumento entra por `DEC-SUB-009`: se cancela en el proveedor
     de inmediato y conserva el servicio hasta el fin del período que pagó.
  6. **Falta resolver un cruce**: qué pasa si la fecha del aumento cae sobre una suscripción en
     mora o en grace. Queda como hueco, no se completa en silencio.
- **RIESGO LEGAL DECLARADO Y ACEPTADO POR EL OWNER.** La parte 3 se apoya en que **el silencio
  del cliente vale como aceptación** de una modificación del contrato. Es el modelo estándar de la
  industria, **pero no está verificado para Argentina** y es precisamente el terreno donde la
  normativa de consumo suele ser restrictiva. El owner decidió explícitamente **avanzar así y
  corregir si la consulta legal dice otra cosa** (2026-09-16).
  **Si resultara que el silencio no alcanza, esta decisión cambia de forma**: haría falta una
  aceptación activa, y quien no responda no podría ser aumentado. Eso no sería un ajuste de
  redacción sino otro diseño, así que **conviene resolverlo antes de implementar el punto 5**.
  Va a `M-LEGAL-03` junto con las otras dos pendientes —el plazo de notificación y el botón de
  baja—, y **las tres piden revisión profesional, no una búsqueda web**.
- **Origen**: punto 5 del contraste PDR ↔ proveedor · §29 · `M-LEGAL-03`.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C15, C9)**: La migración de un
  plan retirado usa la regla de esta decisión para su fecha (primer cobro estrictamente posterior,
  empate a favor del cliente) y su mínimo como piso del plazo (`DEC-SUB-023`). Y los 60 días y los
  contactos a 30 y a 7 son el valor inicial del plazo 11 de `NUCLEO/02` §1.5, que el `SUPER_ADMIN`
  cambia sin bajar de ese mínimo; el aumento anunciado guarda la versión de plazos con que se
  anunció (`DEC-DATA-008`).
- 📌 **Precisada otra vez el 2026-10-02, con OK del owner (corte del MVP, BM, la 1, con la
  aclaración del owner: *«en el momento del corte no se puede cambiar precio, quedan los que tenemos
  actualmente.. una vez la epica esta terminada, mergeada, deployada y smokeada y queda en produccion
  andando estable, ahi si, si algun dia queremos cambiar un precio, lo podemos cambiar»*)**: **los
  precios del corte son los vigentes hoy**: los carga el paso 3a y no se cambian durante el corte, y
  **ningún precio cambia hasta que el momento 5 del corte esté cumplido**. Desde ahí, la acción 19
  aplica esta decisión así: sobre una versión de plan sin clientes fija el precio; sobre una con
  clientes se rechaza y se publica una versión nueva, que rige para las altas nuevas (la parte 1); el
  aviso y la mutación a los clientes ya anclados (la parte 2) llegan con `B12`, que se lleva la
  cláusula de anunciar un aumento del criterio de `B2`; y un monto menor que ARS 15 se rechaza
  (`DEC-MP-001`, implicación 4). El código de la acción 19 es de `B2`; su uso, vedado hasta el
  momento 5, es una regla de operación y no un control del código. Respeta `DEC-ARCH-001`: una
  versión con clientes no cambia de precio. Dónde: `B/descomposicion.md` §2 (filas de `B2` y `B12`)
  y §4; `16-fase-7-del-paraguas.md` §4.7, momento 5; `41-corte-del-mvp/10-decisiones-del-owner.md`,
  BM.

### DEC-CONC-001 — El candado contra el doble cobro es nuestro, durable, y el duplicado se cancela solo pero se reembolsa con confirmación

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, lote L-C; ver su 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote N-B; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes E e Y: `A3` sólo confirma y la identidad de la compra; ver su último 📌) · **Decide**: owner
- **Problema**: el §51 y el §52 piden diseñar explícitamente para el doble clic, los reintentos,
  los webhooks duplicados, el desorden, los jobs duplicados y los fallos de red. La medición dejó
  ese pedido sin red de contención del lado del proveedor.
- **Contexto medido**:
  - `EX-17` **`NOT_SUPPORTED`**: la creación de una suscripción **no deduplica por ningún
    mecanismo**. Diez intentos, diez ids. Ni `external_reference` ni `X-Idempotency-Key` — el
    header **se acepta y no hace nada**. Re-verificado en producción.
  - `RF-4`/`RF-6` **`VERIFIED`**: en `/refunds` el mismo header es **obligatorio** y **se
    respeta**. **La idempotencia de este proveedor es POR ENDPOINT** y no se puede razonar de uno
    al otro. La documentación oficial lo confirma y advierte que no se le atribuyan a la API de
    suscripciones garantías que no tiene.
  - `RC-1` **`PARTIALLY_SUPPORTED`**: el buscador de suscripciones **ignora `external_reference`
    en silencio**; sí filtra por `payer_email` y `status`, y los compone.
  - `PA-3`: una creación **autorizada cobra** — al instante en sandbox, ~26 min en producción.
  - `RF-8`: hay un rechazo de reembolso que **no sabemos explicar** ($5 se rechaza y $14 entra
    sobre el mismo pago). `R-MP-01`: la API donde viven los reembolsos está anunciada en
    discontinuación.
  - `payer.id` **no identifica a una persona** — el mismo mail apareció con dos ids. El mail sí.
- **Decisión**, en tres partes:
  1. **El candado es nuestro, va ANTES de llamar al proveedor, y es DURABLE.** Nada en memoria del
     proceso: en un despliegue conviven dos contenedores sirviendo tráfico, y un registro en
     memoria deja de deduplicar justo cuando más falta hace.
  2. **La recuperación tras un timeout no pregunta por nuestra referencia, pregunta por el
     pagador.** Como el buscador ignora `external_reference`, la pregunta *«¿ya creé ésta?»* no
     tiene respuesta; la que sí la tiene es **«¿este pagador tiene alguna suscripción autorizada
     que yo no tenga registrada?»**, por `payer_email` + `status`.
  3. **Ante un duplicado que ya cobró: se cancela automáticamente, y el reembolso lo confirma una
     persona.**
- **Motivo**:
  - El caso peligroso **no lo cubre un candado**: mandamos crear, el proveedor crea y cobra, y la
    respuesta se pierde. Desde nuestro lado sólo hay un timeout. Reintentar son dos cobros; no
    reintentar deja a alguien que pagó sin servicio. **Sólo lo resuelve preguntarle al proveedor**,
    y por eso la parte 2 es tan importante como la 1.
  - **Cancelar y reembolsar no son igual de riesgosos.** Cancelar detiene el daño futuro, no mueve
    plata, y lo peor que puede salir mal es cancelar algo que igual había que cancelar. El
    reembolso es **la operación que más veces nos sorprendió midiendo**, sobre una API en
    discontinuación. Automatizar lo primero y confirmar lo segundo separa lo reversible de lo que
    no lo es.
  - Con tres clientes, la confirmación humana llega en minutos; el costo de esperar es bajo y el
    de un reembolso automático mal disparado no.
- **Implicaciones**:
  1. **El daño no es simétrico, y el diseño tiene que reflejarlo.** Dos suscripciones sin
     autorizar son inofensivas; **una creación autorizada cobra**, así que ahí un reintento son
     dos cobros reales. El candado tiene que ser más estricto en el camino que autoriza.
  2. **La clave de idempotencia se genera y se persiste ANTES de la primera llamada**, no al
     reintentar. Si se genera en el reintento, no hay nada que comparar.
  3. **Hace falta un reconciliador que barra los estados intermedios**: creaciones que quedaron sin
     respuesta, y suscripciones del proveedor que no tienen contraparte nuestra.
  4. **El `external_reference` sirve para RECONOCER, no para ENCONTRAR.** Una vez que tenés la
     suscripción en la mano, la referencia te dice de quién es; pero no podés llegar a ella por la
     referencia. Y `EX-19` mide que se puede **reescribir** sobre una autorizada, así que es una
     vía de reparación de vínculos.
  5. **Los webhooks también se deduplican de nuestro lado**, y no alcanza con mirar el tipo: el
     proveedor emite **tres notificaciones por reembolso, en dos formatos distintos para el mismo
     hecho** (`RF-7`).
- **Origen**: punto 6 del contraste PDR ↔ proveedor · §51 · §52 · `M-CONC-01`.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, lote L-C)**: Un rechazo
  en la compra de un complemento de pago único cierra la compra en el acto: la orden vuelve `402`,
  creada y `failed`, con su id (`EX-30`), y `A7` lleva la instancia a `ABANDONED` (`B/03` §8). El
  segundo intento es un pedido nuevo, con otro identificador y otra clave de idempotencia: reusar la
  del pedido rechazado devuelve la orden `failed`, y otra tarjeta con la misma clave es otro cuerpo,
  que el proveedor contesta `409` (`EX-41`). La clave sigue persistida antes de la primera llamada
  (implicación 2); lo que cambia es que un rechazo cierra su pedido.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-B)**: Si la respuesta de
  la orden se pierde, la instancia queda con su clave y sin id de orden, y el segundo pedido que la
  encuentra así reenvía la orden con la misma clave y el mismo cuerpo, que es seguro por `EX-41`:
  vuelve la misma orden, y con su `402` corre `A7`. Si en ese segundo pedido la persona eligió otra
  tarjeta, el proveedor contesta `409` y la pantalla dice "tu pago anterior se está procesando,
  probá en unos minutos", sin abrir un pedido nuevo: la primera orden pudo haberse aprobado.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes E e Y)**: `A3` sólo confirma
  y nunca crea: sin id de orden abandona sin reenviar, y la comprobación de órdenes pagadas busca
  también por el identificador del pedido si el proveedor lo permite (`EX-57`). La identidad de la
  compra (dueño, producto, objetivo), única entre las pendientes, frena la segunda compra en una
  pantalla nueva y es el candado del addon recurrente, que frena también si ya hay un addon
  recurrente vivo igual sobre el mismo objetivo.

### DEC-CONC-002 — La conciliación se apoya en NUESTRO inventario, detecta huérfanas por webhook, y sólo repara el vínculo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **el punto 4, precisado el 2026-09-25** (FASE 8 completa, racimo `R5`; ver su 📌), **y otra vez el mismo día** (FASE 9 completa: la precondición de la re-vinculación y la cota de *«todavía no se sabe»*; ver su segundo 📌), **y el 2026-09-26** (FASE 9 vuelta 1, `X-1`: la lápida de recepción cancela su preapproval; ver su tercer 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lote C, con el OK del lote E: la salvedad 4 cuenta una sola lápida, la de recepción; ver su cuarto 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra I: sale la columna `origen_de_lápida`; ver su quinto 📌) · **Decide**: owner
- **Problema**: el §23 pide un proceso periódico contra el proveedor que detecte webhooks
  faltantes, duplicados, pagos y suscripciones huérfanas, estados que no coinciden y preapprovals
  desconocidos. La forma canónica de hacerlo —dos extracciones paralelas, la nuestra y la del
  proveedor, enfrentadas en una capa de comparación— **no es aplicable acá**, porque una de las
  dos no se puede obtener.
- **Contexto medido**:
  - `RC-2` **`VERIFIED`**: leer una suscripción **por su id** es confiable.
  - `RC-1` **`PARTIALLY_SUPPORTED`**: **buscarlas no lo es**, y falla en tres direcciones sin
    avisar en ninguna — ignora `external_reference` y devuelve **todo**; con un `status` inválido
    devuelve **nada** (`200` con cero resultados, no un error); y con uno válido devuelve **un
    subconjunto plausible** (en producción, `cancelled` trajo **15 de 69**). El tercero es el peor:
    un barrido procesa parte de la cartera y **termina sin error**.
  - `RC-4` **`NOT_SUPPORTED`**: el buscador devuelve **menos campos** que el `GET`.
  - `EX-15` **`VERIFIED`**: mutar el monto **no emite webhook**. Una divergencia de monto no se
    anuncia por ningún canal: sólo aparece releyendo.
  - `EX-19` **`VERIFIED`** (producción): el `external_reference` **se puede reescribir** sobre una
    suscripción viva. Es la vía de reparación de un vínculo roto.
  - `EX-16`: `/authorized_payments` **llega tarde**, y eso ya casi produjo una conclusión falsa.
  - Documentación oficial: el buscador de pagos cubre **sólo los últimos doce meses**.
- **Decisión**, en cuatro partes:
  1. **El inventario a conciliar sale de NUESTRA base**, no de la del proveedor: se guarda el id de
     cada suscripción y se leen de a una. El buscador **no puede ser fuente de verdad de nada**.
  2. **Las huérfanas se detectan por WEBHOOK, no por barrido.** Toda suscripción que cobra emite
     uno; si llega uno de un preapproval que no conocemos, eso *es* la detección.
  3. **Barrido diario** de la cartera propia, para lo que el webhook no cubre — sobre todo los
     estados que divergen **en silencio**, como un cambio de monto que el proveedor aceptó y no
     aplicó.
  4. **Sólo se repara el vínculo automáticamente.** Re-vincular una huérfana reescribiendo su
     `external_reference` no cambia plata ni estado: sólo dice de quién es. Toda divergencia de
     **monto, estado o cobro** emite `RECONCILIATION_REQUIRED` y la mira una persona.
     **📌 Precisado el 2026-09-25, con OK del owner (FASE 8 completa, `F-8CB1-013`, racimo `R5`).
     Terminar una cancelación NUESTRA ya decidida no es reparar una divergencia.** Once filas de
     `B/03` llegan a su estado terminal *«pase lo que pase con la llamada»* (`B/09` §3), así que un
     timeout o un correo que no salió (`DEC-MAIL-001`) dejaba la fila `CANCELLED` con el preapproval
     vivo, y hasta que una persona mirara la marca **podía cobrar**. **El barrido reintenta esa
     llamada** —con el correo antes y la relectura después— **hasta 3 días después de la transición** (tiempo y no corridas, precisado por el owner el mismo día); recién
     entonces abre la marca y avisa (`DEC-OBS-001`). **No toca plata**: cancelar no cobra ni
     devuelve nada, sólo impide cobros futuros. **Las dos posiciones, escritas**: la recomendación
     fue reintentar; la objeción, que el punto 4 reserva a una persona toda divergencia de estado.
     Se resolvió leyendo que el acto ya estaba decidido por una transición declarada y sólo faltaba
     que la llamada llegara. **Todo lo demás del punto 4 queda igual**: un preapproval vivo sobre
     una fila que **nunca** mandamos cancelar sigue siendo divergencia, y la mira una persona.
     *(Nota del 2026-09-25, FASE 9 completa `04-…` `C-R5-6`: «once» era la cifra el día de la
     decisión; hoy son **trece** de las catorce filas «no», con `S31` y `S16` —`B/09` §3, salvedad 4—.
     El texto de arriba no se edita.)*
     **📌 Precisado otra vez el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 2b y 3d de
     `26-fase-9-completa/10`).**
     - **La re-vinculación automática tiene precondición** (2b; `02-…` `AO-2`, `F-8CB3-008`): se
       reescribe el `external_reference` de un preapproval desconocido **sólo si ese
       `external_reference` ya nombra una fila nuestra que no tiene otro vínculo vivo con el
       proveedor**. Todo otro desconocido **abre marca** y lo mira una persona. Cada preapproval del
       sistema nuevo nace con nuestro `external_reference` (`PA-2`), así que una huérfana legítima
       siempre nombra su fila; lo que no la nombra —del sistema viejo, una sonda, un id que sólo
       existía en el proveedor— no tiene candidato seguro, y *«el candidato más plausible»* imputaba
       el cobro al ciclo nuevo de la misma persona: pagaba dos veces y se registraba una. **La
       implicación 2 cambia en el mismo sentido**: el `SubscriptionNotResolvedError` dispara la
       re-vinculación sólo si se cumple la precondición; si no, la marca.
     - **«Todavía no se sabe» tiene cota: a los 3 días, marca** (3d; `01-…` §2.5 pendiente 4,
       `F-8CB3-004`). Si la lectura del `B/09` §4 sigue en *«todavía no se sabe»* —el contador del
       proveedor va delante de su listado— tres días después de la primera vez, se abre marca con un
       motivo nuevo, que entra al listado accionable. Es la forma del 📌 de arriba —reintentar y, a
       los 3 días, marcar— para un caso trabado que no es divergencia. Mientras tanto `S6` sigue sin
       actuar.
     **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `X-1` y `G3-2` de
     `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** El desconocido que no nombra ninguna fila
     tiene dónde asentarse: una **lápida de recepción**, que el handler escribe en `CANCELLED` con
     el `payment` y la marca colgados. **El mismo acto manda cancelar su preapproval**; si la
     llamada no se aplicó, la reintenta el barrido por la salvedad 4 del punto 4 —que desde
     entonces cuenta las dos lápidas, la del corte y la de recepción— y a los 3 días marca
     (`B/09` §2.4 y §3).
     **📌 Precisado el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lote C y
     lote E; `38-fase-5/20-simplificacion-del-corte.md` §11, S-40 y S-46).** La salvedad 4 cuenta
     **una sola lápida, la de recepción**: la lápida del corte sale del diseño. Un cobro tardío de
     un débito viejo entra por la lápida de recepción como cualquier desconocido: se anota, se
     cancela su preapproval y abre `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolver, que decide
     el owner. La regla de re-vinculación por `external_reference` del segundo 📌 no cambia (S-49).
     **📌 Precisado otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra I;
     `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 I).** La lápida de recepción se reconoce por `clase = LÁPIDA`, y alcanza:
     **sale la columna `origen_de_lápida` y su restricción**, que con la lápida del corte afuera
     sólo podía valer `RECEPCIÓN` y no distinguía nada. Si algún día vuelve otra lápida, una
     migración la agrega (FASE 5, lote de la aplicación, owner 2026-09-30, I).
- **Motivo**:
  - La parte 1 **no es una elección**: está medida. Cualquier diseño que liste desde el proveedor
    va a procesar una fracción de la cartera y a terminar en verde.
  - La parte 2 resuelve el punto ciego que deja la 1: si sólo miramos los ids que ya tenemos, una
    suscripción que nunca registramos no aparecería jamás. **Y el detector ya existe y funciona
    hoy en producción**: el `SubscriptionNotResolvedError` que encontramos de paso es exactamente
    eso — el sistema detecta la huérfana bien, y lo que está mal es lo que hace después (responde
    `500` y la encola cinco veces). Lo que falta no es el detector, es el tratamiento.
  - La parte 4 aplica la misma frontera que `DEC-CONC-001`, y el owner la eligió por segunda vez:
    **la línea no es «automático contra manual», es «toca plata o no toca plata»**.
- **Implicaciones**:
  1. **Guardar el id de cada suscripción deja de ser una comodidad y pasa a ser la condición de
     que la conciliación exista.** Si se pierde un id, esa suscripción se vuelve invisible para el
     barrido — y sólo reaparece si cobra y emite webhook.
  2. **El `SubscriptionNotResolvedError` vivo en producción pasa de bug a caso de uso.** Cuando se
     arregle, no debe silenciarse: debe convertirse en el disparador de la re-vinculación.
  3. **La conciliación no puede apoyarse en `/authorized_payments` para concluir que algo no
     cobró**: llega tarde, y la ausencia de cobros tiene tres causas distintas — no cobró nunca,
     lag, o el id es de otra cuenta.
  4. **Más allá de doce meses, la única fuente somos nosotros.** El buscador de pagos no llega, así
     que el histórico tiene que ser nuestro o no existe.
  5. `RECONCILIATION_REQUIRED` ya notifica a `SUPER_ADMIN` por regla del PDR; esta decisión define
     **cuándo se emite**: en toda divergencia que toque plata o estado.
- **Origen**: punto 7 del contraste PDR ↔ proveedor · §23 · §22.1.

### DEC-MAIL-001 — Nuestro correo bloquea la acción sólo donde el del proveedor hace daño, y los correos falsos se anticipan

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — la premisa de su implicación 4 (*«no usamos los
  planes del proveedor»*) tiene decisión propia desde el 2026-09-24, **`DEC-MP-007`**; la atribución
  a `DEC-MP-002` de esa implicación es incorrecta · **el punto 1, precisado el 2026-09-25** (FASE 8
  completa, racimo `R5`; ver su 📌), **y otra vez el mismo día** (FASE 9 completa: el correo que agotó sus reintentos tampoco bloquea; ver su segundo 📌), **y una tercera vez** (FASE 9 completa, 9c: `A3` también cancela, con el correo antes; ver su tercer 📌) · **Decide**: owner
- **Problema**: el §42 se escribió como si fuéramos los únicos que le hablan al cliente, y la
  medición mostró que no. Además, **cinco decisiones anteriores** (`DEC-SUB-006`, `007`, `008`,
  `009` y `DEC-MP-002`) se apoyan en que «nuestro aviso sale antes», y ninguna definía qué pasa si
  no sale.
- **Contexto medido** (`EX-3`, sobre la casilla real del owner: 43 correos del proveedor en un día):
  - El proveedor le escribe al cliente **por su cuenta** en el **alta**, el **cambio de monto**, la
    **pausa** y la **cancelación** — y **siempre primero**.
  - **Tres de esos correos afirman cosas que sus propios datos desmienten**: *«Pagaste la
    suscripción»* 18 s después de autorizar, cuando no se cobró nada —y en los sujetos pausados y
    cancelados ese cobro **no llegó nunca**—; *«Cobramos $15 para validar tu tarjeta»* cuando el
    cargo registrado es de **$0**; y el rechazo `2084` que dice que un pago no se puede reembolsar
    cuando sí se puede.
  - **`paused` y `cancelled` llegan idénticos**: *«por un pago no realizado o por opción del
    vendedor»*. Una cortesía y una mora son indistinguibles para el cliente.
  - Los cuatro lo mandan a **nuestra** puerta (*«contactá con el vendedor»*): **no hay
    autogestión**, todo cae en nuestro soporte.
  - `EX-19` **`VERIFIED`**: el **`reason` es el texto que ve el cliente** en asunto y encabezado,
    y **se puede reescribir**.
  - `EX-22`: si la suscripción se crea **con plan**, el `reason` propio se descarta y queda el del
    plan.
  - `EX-15`: mutar el monto **no nos avisa a nosotros**, pero **sí le avisa a él**.
- **Decisión**, en tres partes:
  1. **Nuestro correo bloquea la acción SÓLO donde el del proveedor hace daño**: antes de
     **cancelar**, sí; antes de mutar un monto, no. Si el correo no sale, la cancelación no se
     ejecuta y se reintenta.
     **📌 Precisado el 2026-09-25, con OK del owner (FASE 8 completa, `F-8CB2-001`,
     `F-8CD1-006`).** El reintento supone una falla que pasa. **Si no hay a quién mandarlo** —rebote
     duro o cuenta borrada, que `NUCLEO/07` §4.2 suprime para siempre, incluso lo transaccional—
     **el correo no bloquea**: se cancela igual, y el no-entregable se registra y se escala a una
     persona, como ya manda ese §. Sin esto, la predecesora de un cambio de plan de alguien con un
     rebote duro no se cancelaba nunca y **cobraban las dos**. **Y el bloqueo vale para toda
     cancelación que ejecutamos en el proveedor**, escrito como condición en cada fila de `B/03` que
     cancela: antes vivía sólo acá y ninguna transición lo nombraba.
     **📌 Precisado otra vez el 2026-09-25, con OK del owner (FASE 9 completa, decisión 1 de
     `26-fase-9-completa/10`; `04-…` §R5.5.1).** **Tampoco bloquea el correo que agotó sus
     reintentos** (`failed` en el outbox, `NUCLEO/07` §1.3): es, por definición, una falla que no
     pasó, y le cabe la razón del 📌 anterior. Se cancela igual y se escala como no-entregable, igual
     que sin destinatario. Sin esto, un `failed` trababa `S17` —cobraban las dos— y `S6` —el moroso
     seguía en grace con servicio entero y sin plazo—. **Lo que se acepta**: en una caída larga del
     proveedor de correo, algunas cancelaciones salen sólo con el correo del proveedor, que insinúa
     mora (`EX-3`). **La rama transitoria —el correo todavía puede salir— sigue bloqueando.**
     **📌 Precisado una tercera vez el 2026-09-25, con OK del owner (FASE 9 completa, fila 9c de
     `26-fase-9-completa/10`; `04-…` contradicción `C-R5-2`, aplicada en `13`).** **`A3` —el addon
     que vence su ventana en `PENDING_AUTHORIZATION`— también cancela**, y entra a la población de
     este punto: si es recurrente relee su preapproval por id (si lo ve `authorized`, corre `A2` y no
     `A3`) y **lo cancela en el proveedor con nuestro correo antes** y la regla de relectura de
     `S17`; si la cancelación falla, la reintenta el barrido por la salvedad 1 de `B/09` §3, como a las
     de `A5` y `A6`, hasta 3 días (la forma del primer 📌 de `DEC-CONC-002`). Antes `B/09` §3 lo contaba entre los que cancelan y ninguna fila de `B/03`
     lo escribía: un preapproval `pending` no vence (`EX-1`) y el enlace viejo se podía autorizar
     más tarde. El agente de aplicación eligió esta corrección, no la inversa (sacar `A3` de la
     lista); el owner la ratificó como estaba.
  2. **Los correos falsos del proveedor se ANTICIPAN, no se desmienten.** Nuestro correo de alta
     avisa que va a llegar uno diciendo que ya pagó, y da la fecha del primer cobro real.
  3. **El `reason` es copy, no un identificador.** Nunca lleva un id interno ni un slug.
- **Motivo**:
  - Bloquear **siempre** acopla el cobro al proveedor de mail: una caída de algo accesorio frenaría
    algo crítico. No bloquear **nunca** deja el peor resultado posible —que el cliente reciba
    **sólo** el correo ambiguo o falso— y además **ocurre sin que nadie lo note**.
  - **Bloquear donde importa resulta gratis** por cómo quedaron las decisiones anteriores: en el
    cambio de ciclo y el upgrade, la cancelación de la vieja ocurre **cuando llega el webhook de
    que la nueva quedó autorizada**, que es un momento que controlamos. La secuencia natural es
    webhook → correo → cancelar, y si el correo falla **no se cancela y se reintenta**. El estado
    intermedio no es destructivo: las dos suscripciones conviven (`EX-6`) y la nueva no cobra
    porque tiene fecha futura. **Bloquear ahí no frena nada ni arriesga nada.**
  - Desmentir al proveedor es una pelea que se pierde: su correo llega primero y con su marca.
    **Anticiparlo convierte la contradicción en algo previsto.**
- **Implicaciones**:
  1. **Regla para soporte, que sale directo de la medición: ante un reclamo, mirar el PAGO, nunca
     el correo.** Ninguna decisión de atención puede apoyarse en la copy del proveedor.
  2. **Nuestra comunicación tiene que desambiguar lo que el proveedor dejó ambiguo**: si pausamos
     por cortesía, decirlo; si es por mora, decirlo. El cliente recibe el mismo texto del
     proveedor en los dos casos.
  3. **No hay autogestión del lado del proveedor**: toda baja, cambio o duda cae en nuestro
     soporte. Dimensionarlo así, no como excepción.
  4. **El `reason` se controla por suscripción sólo porque no usamos los planes del proveedor**
     (`DEC-MP-002`). Si alguna vez se usaran, el texto lo fijaría el plan y sería **un texto por
     combinación** de vertical, tier y ciclo.
  5. El aviso del punto 3 —el excedente al bajar de plan— **lleva escrito el criterio** con que se
     despublicaría automáticamente, o el criterio deja de ser predecible.
- **Origen**: punto 8 del contraste PDR ↔ proveedor · §42 · §43 · `M-MAIL-04`.

### DEC-RF-001 — La revocación reembolsa y cancela en un solo acto; el botón de arrepentimiento queda fuera de alcance hasta la consulta legal

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **parte 3 precisada el 2026-09-26** (el reintento de un parcial nunca supera lo confirmado; ver su 📌) y la parte 4 el mismo día (la revocación sin botón la ejecuta `S36`), **con `S36` extendida a `PAUSED` también ese día** (owner, `X-2`; tercera tanda, L4) — **y la parte 1 precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R17` y `R1-b`: el pago de la predecesora y los complementos; ver su 📌) — **y la parte 1 precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-o`: el pago retenido por `S19`; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote L: el addon de única vez comprado dentro de la ventana; ver su último 📌) · **Decide**: owner
- **Problema**: el §54 y `M-LEGAL-01` dan por supuesto poder reembolsar, pero no dicen **cuándo se
  reembolsa, qué pasa con la suscripción, ni qué hace el sistema cuando el proveedor rechaza sin
  motivo entendible**.
- **Contexto medido** (todo en **producción**, con los cuatro pagos del propio owner):
  - `RF-1`/`RF-2` **`VERIFIED`**: reembolso **total y parcial**, en los dos tipos de cobro. Los
    parciales **se acumulan** hasta completar el total y validan contra el **saldo**, no contra el
    monto original. **No hay monto mínimo** — ARS 5 entró sobre pagos de 5.000 y 7.500.
  - `RF-6` **`VERIFIED`**: **es idempotente**. Misma clave → `200` con cuerpo vacío y ningún
    reembolso nuevo. **Devuelve `200`, no `201`** —un cliente que sólo acepte `201` trata una
    reentrega correcta como fallo— y **no devuelve el reembolso original** en el cuerpo.
  - `RF-4` **`VERIFIED`**: `X-Idempotency-Key` es **obligatoria**, y falla **antes** de cualquier
    validación de negocio.
  - `RF-5`: `cause[0].code` distingue el motivo (`2063` estado del pago, `2017` monto). **El
    `message` no alcanza.**
  - `RF-8`: **hay un rechazo sin explicar.** Sobre el mismo pago, $5 se rechaza con `2084` y $14
    entra. Cuatro hipótesis murieron. Lo único probado es negativo y alcanza: **no es una
    propiedad del pago**, aunque el mensaje diga exactamente eso.
  - **Reembolsar el cobro de una suscripción viva NO la da de baja** (sonda 32).
  - `R-MP-01`: la API donde viven los reembolsos está anunciada en **discontinuación**, y su guía
    de migración **excluye explícitamente a las suscripciones**.
- **Contexto normativo** (búsqueda propia con fuente oficial, **no es una opinión legal**):
  la **Resolución 424/2020** sobre la Ley 24.240 art. 34 fija **10 días corridos** para revocar,
  un **botón de arrepentimiento** visible en el primer acceso de la página de inicio, **sin exigir
  registro ni trámite**, y **24 horas** para informar el código de identificación.
- **Decisión**, en cuatro partes:
  1. **La revocación es UNA sola operación: reembolso total + cancelación.** No dos cosas que
     alguien tenga que acordarse de hacer juntas. Un reembolso por otra causa —un duplicado, un
     error nuestro— **no cancela nada**.
     📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17` y `R1-b`)**: sobre una
     sucesora sin pagos, el pago que se devuelve es el de su predecesora, que se encuentra por
     `sucedida_por`; y la orfandad que causa la revocación devuelve por `RF1` el último cobro de
     cada complemento recurrente sólo si cae dentro de sus propios 10 días corridos; si no, va al
     motivo 14.
  2. **El pedido se registra y se responde al instante; el reembolso se ejecuta con confirmación
     humana.** El acceso al servicio se corta enseguida si el cliente lo pide; la plata sale
     dentro de la ventana. Concilia el plazo de 24 h con la regla que ya rige en `DEC-CONC-001` y
     `DEC-CONC-002`: **lo que toca plata lo mira una persona**.
  3. **Ante el `2084`, el sistema NUNCA concluye que el pago no se puede reembolsar.** Reintenta
     con otro monto o cae al reembolso total. Está medido que ese mensaje miente.
     **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `F-8V1B1-005`).** *«Cae al
     reembolso total»* vale cuando lo confirmado es el total —la revocación de esta entrada—.
     Sobre un reembolso parcial, el reintento ante un `2084` parte el monto confirmado y **nunca
     lo supera** (`D11`; `B/03` §6.1, `RF2`).
  4. **El botón de arrepentimiento queda FUERA DE ALCANCE por ahora**, por decisión explícita del
     owner (2026-09-16), hasta que lo consulte con un abogado.
     **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-4`;
     `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** La parte 4 saca de alcance **el botón**,
     no el derecho. Hasta que el botón entre, la revocación que llega por correo o por soporte la
     registra una persona con *«cancelar una suscripción»* y motivo revocación, y la ejecuta
     **`S36`** (`B/03` §3.2): desde `ACTIVE`, `GRACE_PERIOD` ~~o `CANCEL_SCHEDULED`~~, `CANCEL_SCHEDULED`
     **o `PAUSED`**, dentro de los
     10 días, cancela el preapproval, corta el servicio en el acto y crea `RF1` por el total. Es la
     operación única de la parte 1, y es lo que el botón va a llamar.
     **📌 Y sale también de `PAUSED`** (owner 2026-09-26, `X-2`; FASE 9 vuelta 1, `N-3` de
     `25-verificado-G5`; `28-fase-9-vuelta-1/10-decisiones-del-owner.md`): la condición legal es el plazo, no el
     estado, y quien pausó dentro de los 10 días del cobro volvía a la baja de `S22` más un
     reembolso aparte —las *«dos cosas»* que la parte 1 prohíbe—. Desde `PAUSED` cancela el
     preapproval pausado (`EX-11`: sobre una pausada se deja cancelar), corta el servicio como
     `S22`, escribe `fin_real` en la pausa, crea `RF1` por el total y, si la fila es predecesora,
     dispara `S18`.
- **Motivo de la parte 1**: está medido que reembolsar **no** da de baja. Si alguien se arrepiente
  y sólo le devolvemos la plata, **le vuelven a cobrar el mes siguiente** — el peor final posible
  para un cliente que ya se estaba yendo.
- **RIESGO DECLARADO Y ACEPTADO (parte 4).** No implementar el botón **no es una funcionalidad
  faltante: si la norma aplica, es un incumplimiento.** El owner decidió no construirlo sobre una
  búsqueda web y consultarlo profesionalmente primero, lo cual es razonable — pero el riesgo corre
  mientras tanto. **Las preguntas ya están formuladas** para esa consulta:
  1. ¿Una suscripción mensual recurrente queda alcanzada igual que una compra única?
  2. **¿Cada renovación abre una ventana nueva de 10 días, o corre una sola vez desde el alta?**
     Esto cambia el diseño, no sólo la redacción.
  3. ¿El botón es exigible para nuestro rubro y tamaño?
  4. Las otras tres de `M-LEGAL-03`: plazo de notificación de aumentos, botón de baja, y **si el
     silencio del cliente vale como aceptación** de un aumento.
- **Implicaciones**:
  1. **El histórico de reembolsos es nuestro o no existe**: el buscador de pagos del proveedor
     cubre **sólo doce meses**.
  2. **Un reembolso emite TRES notificaciones, en DOS formatos distintos para el mismo hecho**
     (`RF-7`). Deduplicar por tipo no alcanza.
  3. **`RF-3` sigue `UNKNOWN`**: no sabemos qué pasa con un pago de más de 180 días, porque
     todavía no existe uno.
  4. El riesgo de plataforma de `R-MP-01` **cae entero sobre este punto**: es la única capacidad
     del diseño que vive en una API anunciada como discontinuada, sin camino de migración
     publicado para suscripciones.
- **Origen**: punto 9 del contraste PDR ↔ proveedor · §54 · `M-LEGAL-01`.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`)**: cuando
  `S36` corre desde `GRACE_PERIOD` sobre una predecesora que retiene un pago por `S19`, ese pago es
  el último pago acreditado de la revocación: lo devuelve su `RF1`, los 10 días se cuentan desde él,
  y la rama 6 no abre marca sobre ese pago.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote L)**: El addon de única vez
  comprado dentro de la ventana de revocación se devuelve por `RF1`, que crea `S36`, por el camino
  de devolución de órdenes; fuera de ella se consume.

### DEC-SUB-010 — La pausa es la del proveedor, empieza ya, dura meses enteros, y el que vuelve antes paga el ciclo siguiente completo

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-26, contra la recomendación** (la vuelta anticipada sigue libre; ver su 📌) — **y su 📌 precisado el mismo día, con OK del owner** (tercera tanda, L3: el regalo es toda pausa que termina fuera del aniversario, y el detector lista las de regalo neto positivo) · **Decide**: owner
- **Problema**: el §26.4 pide que el usuario **no pierda período ya pagado por estar pausado**. El
  proveedor no lo hace solo, y —esto es lo nuevo— **tampoco nos deja arreglarlo**.
- **Contexto medido** (sandbox 2026-09-16, con producción coincidiendo en el tercer punto):
  - `PS-4` **`NOT_SUPPORTED`**: **no existe la auto-reanudación**. El sujeto estuvo `paused` 24,5 h
    y siguió `paused`, con `last_modified` sin tocar. **MP no tiene `pauseUntil`**: el reloj que
    termina una pausa es NUESTRO, sí o sí.
  - `PS-5` **`VERIFIED`**: reanudar cambia **sólo el `status`**. `next_payment_date` queda clavado
    donde estaba; no se adelanta, no se corre, no dispara cobro de recuperación ni deja deuda.
  - `PS-6` **`NOT_SUPPORTED`**: el ciclo que vence **estando pausada** avanza la fecha +1 ciclo
    **sin cobrar**. El período pagado que no se usó se pierde, y no hay nada para recuperarlo. Ya
    se había visto en producción (`PS-2`).
  - `EX-34` **`NOT_SUPPORTED`**: **la fecha de cobro de una suscripción viva es inmutable.** Cuatro
    formas de pedirlo, cuatro `200`, cero cambios, `last_modified` congelado en las cuatro — con el
    control que lo separa de "esta suscripción está rara": el **monto** sí muta en el mismo
    instante. Es lo que cierra la puerta: `start_date` a futuro sólo funciona **al crear**
    (`EX-7`).
  - `EX-11` **`VERIFIED`**: estando pausada **no se puede modificar nada** (`400` explícito), pero
    **sí cancelar**.
- **Alternativas**: (A) diferir la pausa al fin del ciclo, para que el cliente use todo lo que
  pagó; (B) pausar ya y devolverle los días perdidos como **servicio nuestro**, con un crédito en
  nuestra base desfasado a propósito del calendario del proveedor; (C) **pausar ya, en múltiplos
  de un ciclo entero, sin compensación de ninguna clase**.
- **Decisión**: **(C)**. La pausa empieza **en el momento en que el cliente la pide**, se elige en
  **cantidad de meses**, y los días no usados del ciclo en curso **se pierden**. El cliente puede
  **volver cuando quiera** (§26.2 se cumple entero), y al volver **se le cobra normal en el ciclo
  siguiente**: el `next_payment_date` que el proveedor ya tiene corrido. No se prorratea, no se
  recalcula, no se acredita nada.
- **Motivo: la aritmética se compensa sola, así que no hace falta mecanismo.** Lo que el cliente
  pierde del ciclo pagado y lo que gana del ciclo de vuelta **son el mismo número de días** cuando
  la pausa dura ciclos enteros, porque vuelve **el mismo día del mes** en que pausó. Pausa el 5/ene
  por dos meses: pierde 25 días de enero, vuelve el 5/mar, y el proveedor recién cobra el 1/abr —
  27 días sin pagar. Neto ≈ 0.
  - Contra **(A)**: resuelve con un mecanismo lo que (C) resuelve con una restricción, y le niega
    al cliente parar cuando quiere parar. Además su cron **tiene que ganarle al cobro del
    proveedor**, cuyo instante exacto no es predecible —en producción el cobro llegó ~26 min tarde
    (`PA-3`), y el reloj de sandbox seguía sin cobrar 31 min después de su fecha—, así que exigía
    un margen de 24 h que ya le costaba un día al cliente.
  - Contra **(B)**: obliga a mantener a propósito una fecha nuestra distinta de la del proveedor,
    que es exactamente la clase de desfasaje que alguien viene a "arreglar" después.
  - **El caso que (C) tenía que resolver, y resuelve**: la pausa que empieza y termina **dentro del
    mismo ciclo** era indefendible —pagó el 1, pausó el 5, volvió el 25: recibió 11 días de los 30
    que pagó y el 1/feb le cobran el mes completo igual, o sea **pausar le salió estrictamente peor
    que no pausar**—. Con el mínimo de un mes, esa pausa no existe.

  **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-3`, contra la
  recomendación; `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** La vuelta anticipada **sigue
  libre** (§26.2 a la letra), así que la premisa *«vuelve el mismo día del mes en que pausó»* vale
  sólo para quien vuelve en el fin previsto. ~~Una pausa de menos de un ciclo que cruza una fecha de
  cobro salteada regala ese ciclo~~ **Toda pausa que cruza una fecha de cobro salteada y termina
  fuera del aniversario regala días, dure lo que dure** (hasta casi un ciclo), y el sobrecobro
  inverso existe. **Se acepta y se declara**
  (`B/03` y `B/12`, *«lo que … NO cierra»*) y **se mide**: el barrido lista ~~esas pausas~~ **las pausas con regalo neto positivo** —(próxima
  fecha después de la vuelta − vuelta) − (primera fecha salteada − inicio)— en el
  resumen de `DEC-OBS-001` (`NUCLEO/08` §4.1). *(FASE 9 vuelta 1, `N-2`, con OK del owner el
  2026-09-26, L3: el predicado por duración era el ejemplo que motivó el detector, no la
  aritmética del daño; pausar tres meses y volver el segundo día de un ciclo regala 29 días.)*

- **Implicaciones**:
  1. **El early resume no perjudica nunca al cliente, porque el cobro es POR ADELANTADO.** Lo que
     se cobra el 1/mar es marzo entero, que va a usar: volver antes de tiempo no le hace pagar
     servicio que no recibe, sólo le da los días que van de la reanudación al próximo cobro
     **gratis**. Lo único que pierde es lo que ya estaba decidido: los días del ciclo en curso en
     que estuvo pausado. **Al reanudar se le muestra UNA cosa: qué día se le va a cobrar.** No se
     le habla de días perdidos ni se le explica la compensación — no hay nada que compensar desde
     su lado, y contarlo sólo inventa un problema. Decisión explícita del owner.
  2. **El reloj de fin de pausa es nuestro** (`PS-4`), y reanudar es un `PUT {status:"authorized"}`
     que no cobra nada (`PS-5`). El mismo scheduler sirve para el auto-resume y para el early
     resume.
  3. **Todo cambio pedido durante la pausa se aplica DESPUÉS de reanudar**: estando pausada el
     proveedor rechaza cualquier modificación (`EX-11`), incluso un cambio de precio. Un aumento
     que caiga sobre un pausado (`DEC-MP-002`) no se puede aplicar hasta que vuelva.
  4. Los límites del §26.3 **se reexpresan en meses**: 120 días son 4 pausas-mes y 240 son 8.
  5. Los meses no miden lo mismo: pausar un 31/ene y volver un 28/feb deja 3 días de ruido en la
     compensación. Se acepta.
- **Condicionada a una medición en curso**: que la fecha corra **+1 ciclo por vencimiento
  indefinidamente** está medido **una sola vez**, con ciclo diario y **un** vencimiento. Toda la
  aritmética de arriba lo necesita en el vencimiento 2 y 3 — si el proveedor dejara de correrla, o
  la recalculara al reanudar, el cliente vuelve el 5/mar y le cobran enseguida. El sujeto
  `pausa-real` quedó **pausado el 2026-09-16 12:16 `-03` con `next` en el 17** para responderlo
  leyéndolo el 17, 18 y 19. **Si esa lectura desmiente el corrimiento, esta decisión se reabre.**
- **Origen**: punto 10 del contraste PDR ↔ proveedor · §26.2 · §26.4 · `BD-MP-01`.

### DEC-GRANT-003 — La cortesía temporal se implementa PAUSANDO la suscripción en el proveedor, y el servicio lo sostenemos nosotros

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa, racimo `R4`): la cortesía temporal sólo sobre planes **mensuales** y en **meses enteros**; la implicación 6 estaba equivocada (ver su 📌) · **Decide**: owner
- **Problema**: el §34.2 pide **mantener el servicio sin cobrar** durante N días o meses, y es el
  único punto del PDR que ordena investigar antes de elegir: *«NO asumir implementación contra MP.
  Debe investigarse.»* El proveedor no tiene nada parecido a «no le cobres a este durante N ciclos».
- **Contexto medido**:
  - `PC-2` **`VERIFIED`**: el piso es **ARS 15**. Cobrar cero devuelve `400`. **«Gratis» no existe
    bajando el monto**, y no es teórico: `CT-1` lo confirmó el 2026-09-16 sobre una suscripción que
    ya había cobrado — `cortesia-piso` cobró 2000 en su primer ciclo, se lo bajó al piso, y en la
    renovación **cobró ARS 15**.
  - `EX-35` **`NOT_SUPPORTED`** (2026-09-16): **no se le puede poner un `free_trial` a una
    suscripción viva**. Dos formas, dos `200`, `free_trial` siguió `null`, `last_modified`
    congelado. Con control: el monto sobre el mismo objeto entró y movió `last_modified`.
  - `EX-34` **`NOT_SUPPORTED`** (2026-09-16): **tampoco se le puede correr la fecha de cobro.**
    Cuatro formas, cuatro `200`, nada escrito.
  - `PS-2` **`VERIFIED`** en **producción**: **pausada NO cobra.**
  - `PS-5` **`VERIFIED`** (2026-09-16): reanudar es un `PUT {status:"authorized"}` que cambia sólo
    el estado — no dispara cobro de recuperación ni deja deuda.
  - `EX-11` **`VERIFIED`**: estando pausada **no se puede modificar nada** (`400` explícito), pero
    **sí cancelar**.
  - `CT-3` **`VERIFIED`**: todo cambio de monto le dispara al pagador un correo del proveedor que
    dice **«El vendedor Hospeda cambió el monto»**, y `EX-15` midió que esa mutación **no emite
    webhook**: le avisa al cliente y no a nosotros.
  - `PA-5` + `EX-3`: cancelar es **irreversible**, y su correo **insinúa mora**.
- **Contexto externo** (contraste, no fundamento): los proveedores maduros lo tienen resuelto
  adentro. Stripe expone `pause_collection` con tres comportamientos (`void`, `keep_as_draft`,
  `mark_uncollectible`) y su documentación dice explícitamente que se usa **«para ofrecer
  temporalmente tu servicio gratis»**. Mercado Pago ofrece **tres operaciones y ninguna más**:
  pausar, cancelar, modificar monto. No existe saltear un cobro ni cobrar cero.
- **Alternativas**: (A) **pausar en el proveedor durante la cortesía y sostener el servicio de
  nuestro lado**; (B) cancelar y que el beneficiario se re-suscriba al terminar; (C) bajar el monto
  al piso durante la cortesía.
- **Decisión**: **(A)**.
- **Motivo, por los dos criterios del owner.**
  - **Toca plata o no toca plata**: (A) es la única que **no mueve un peso en ninguna dirección**.
    (C) le **cobra ARS 15 por ciclo a alguien a quien le dijimos que no pagaba**. (B) no cobra, pero
    pone una barrera de checkout al final de un regalo.
  - **Hacia dónde falla cada una**: (A) falla **regalando más días de los debidos**, y se corrige
    reanudando. (B) falla **perdiendo al cliente** —cancelar es irreversible y al final hay que
    reconquistarlo en el checkout, justo a quien quisimos premiar—. (C) falla **cobrándole** al
    beneficiario.
  - Y (A) **no cuesta código nuevo**: el reloj que pausa y reanuda hay que construirlo igual por
    `DEC-SUB-010`. La cortesía es otro motivo para el mismo mecanismo, no un mecanismo más.
- **Implicaciones**:
  1. **Durante la cortesía la suscripción queda congelada en el proveedor** (`EX-11`): no se le
     puede aplicar un upgrade, ni un cambio de precio de `DEC-MP-002`, ni un cambio de tarjeta. Lo
     que se pida en ese período **se encola y se aplica al reanudar**, o se reanuda primero y se
     rehace la cortesía. No hay una tercera opción: el proveedor devuelve `400`.
  2. **En el proveedor una cortesía se ve IDÉNTICA a una pausa pedida por el cliente.** La
     distinción existe sólo en nuestra base, y el reloj que reanuda **tiene que saber por qué está
     pausada**: si lee sólo el estado de MP, reanuda la cortesía de alguien que había pedido pausa,
     o al revés.
  3. **La precedencia** entre una cortesía vigente y una pausa pedida por el cliente —y entre una
     cortesía y otra— quedó como residuo, y **la cerró `DEC-GRANT-004`** el mismo día.
  4. **El §34.1 no toca al proveedor**: durante el trial, la cortesía extiende el trial, que es
     nuestro. Son dos implementaciones según el estado del beneficiario.
  5. **La cortesía PERMANENTE sigue cancelando** (§35.3 y `DEC-GRANT-001`), y la asimetría es
     deliberada: cancelar es irreversible, así que sirve para lo que no termina y no para lo que sí.
  6. Lo que `PS-6` mide —que el ciclo vencido en pausa se pierde— **acá no aplica**: durante la
     cortesía el servicio lo damos igual, que es el punto.
     **📌 Precisado el 2026-09-25, con OK del owner (FASE 8 completa, `F-8CB1-001`): esta
     implicación estaba equivocada.** El servicio lo damos igual, pero `PS-6` sí aplica **al
     cobro**: en pausa el proveedor se saltea las fechas de cobro enteras que caen adentro, y al
     reanudar no corre la fecha (`PS-5`). Entonces **una cortesía vale los cobros que cruza, no
     los días que promete**: diez días que no cruzan una fecha valen cero, y treinta días sobre un
     plan anual que cruzan la renovación regalan un año. **La regla**: la cortesía temporal se
     otorga **sólo sobre planes mensuales y en meses enteros** —la misma validación de la pausa,
     `DEC-SUB-010`, **pero sólo su término del ciclo**: no gasta la cuota de pausas del cliente, no
     depende de que el plan permita pausar y alcanza al pagador manual, porque es un regalo nuestro y
     no un pedido suyo (owner, 2026-09-25)—, así que N meses saltean exactamente N cobros. **Sobre un plan anual no se
     ofrece**: el admin ve que no está disponible, y le quedan la cortesía permanente o una promo
     sobre la renovación. **No aplica al §34.1**: durante el trial la cortesía extiende el trial,
     que es nuestro, y sigue en días.
- **Pendiente de medir, y no bloquea**: **si el proveedor le manda algún correo al cliente cuando
  pausamos su suscripción.** Si le llega un «tu suscripción fue pausada» en medio de un regalo, hay
  que anticiparlo (`DEC-MAIL-001`: los correos del proveedor se anticipan, no se desmienten).
- **Origen**: punto 11 del contraste PDR ↔ proveedor · §34.2 · `BD-MP-02`.

### DEC-GRANT-004 — Cortesía y pausa se resuelven con validaciones nuestras: pausar cancela la cortesía avisando, y sobre una pausa no se otorga

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa, racimo `R4`): el punto 3 suma **meses**, no días · **Decide**: owner
- **Problema**: residuo que dejó abierto `DEC-GRANT-003`. La cortesía y la pausa del cliente
  **usan el mismo mecanismo** —pausar en el proveedor—, así que se pisan. Hay tres cruces:
  un cliente en cortesía que pide pausar, un cliente pausado que recibe una cortesía, y una
  cortesía que cae sobre otra.
- **Contexto medido**: `DEC-GRANT-003` + `EX-11`. En el proveedor **una cortesía se ve idéntica a
  una pausa pedida por el cliente**: es el mismo `status: "paused"`, y `EX-11` midió que estando
  pausada no se puede modificar nada. **No hay ningún campo del proveedor que distinga una de la
  otra**, así que preguntarle a él por qué está pausada no es una opción — la intención es nuestra
  o no existe.
- **Decisión**: los tres cruces se resuelven **de nuestro lado, con validaciones, prohibiciones y
  avisos**, sin pedirle nada al proveedor.
  1. **En cortesía, pide pausar** → **se le permite**, avisándole explícitamente que **pierde la
     cortesía que le quedaba**, y elige. Si acepta, el grant se cancela y queda una pausa normal.
  2. **En pausa, el super admin intenta otorgar cortesía** → **se bloquea**, avisando que la
     suscripción está pausada.
  3. **Cortesía sobre cortesía** → **se SUMAN los días, no se reemplazan** (**📌 desde el 2026-09-25 se suman MESES**: la cortesía temporal es en meses enteros, ver `DEC-GRANT-003` impl. 6), y el aviso dice la
     **fecha de fin nueva**, no «un mes más».
- **Motivo**:
  - **(1) es la opción menos compleja, y esa es la razón.** La alternativa evaluada —prohibir
    pausar durante la cortesía y ofrecer una **pausa programada** para cuando termine— protege
    mejor al cliente, pero **introduce un mecanismo que `DEC-SUB-010` ya había descartado**: ahí se
    decidió que la pausa empieza cuando el cliente la pide, sin diferir nada. Traerla de vuelta por
    la puerta de atrás, para un caso de borde, no se paga.
    - Queda **declarado el costo**: durante la cortesía el cliente **no está pagando**, así que
      pausar no le ahorra un peso — sólo le quita servicio. Es la misma operación sin sentido
      económico que `DEC-SUB-010` eliminó para la pausa intra-ciclo. **Por eso el aviso importa
      más que la validación**: es lo único que lo protege de tomar una decisión que sólo lo
      perjudica.
  - **(2)**: regalarle meses a alguien que no está pagando **no le regala nada** — la cortesía se
    consumiría contra un período sin cobro. Bloquear y avisar deja el error del lado visible.
  - **(3) se suman** porque reemplazar es **destructivo y silencioso**: un super admin que otorga un
    mes a alguien que tenía seis se los saca sin que nada en la operación lo insinúe. Sumar es
    además lo que menos sorprende —«le doy un mes» es un mes más— y encaja con el §35.4, que ya
    pide auditoría **por grant**: cada uno sobrevive entero en el registro y la fecha de fin es la
    consecuencia, no un dato que haya que reconstruir.
- **Implicaciones**:
  1. **El estado «pausada» de nuestra base necesita un motivo**, no sólo un booleano: pausa del
     cliente, cortesía, o —cuando lo midamos— el destino al que el proveedor manda una suscripción
     al agotar los reintentos. El reloj que reanuda lee ese motivo, nunca el estado del proveedor.
  2. **El aviso del caso (1) es parte de la decisión, no un adorno.** Sin él, el cliente pausa y
     descubre después que perdió el regalo.
  3. **Programar una cortesía para cuando el cliente reanude** se evaluó y **queda fuera** por la
     misma razón de simplicidad. Si más adelante aparece la necesidad, es un agregado, no un
     rediseño.
- **Origen**: residuo de `DEC-GRANT-003` · §34.2 · §35.4 · §26.

### DEC-ADDON-002 — Cada addon recurrente es un preapproval aparte, no una línea del monto del plan

- **Fecha**: 2026-09-16 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R1-a`, `R1-c` y `R18-b`: la baja y el espejo cancelan los complementos recurrentes, y `S21` los cierra antes que su `S12`; ver su 📌) — **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d` y `V2-e`: la selección confirmada, `S26` sobre los `USER`/`GLOBAL` y el disparador nuevo de `S32`; ver su segundo 📌) · **Decide**: owner
- **Problema**: el §38 define dos tipos de addon, *«one-time; **recurrent**»*, y `EX-5` midió que
  **una autorización del proveedor cubre un solo monto**. Quedaban dos mecanismos posibles, y
  **los dos funcionan** — por eso `BD-MP-04` estaba mal clasificada como «la decide el
  experimento»: la medición cerró la pregunta técnica y dejó viva una elección de diseño.
- **Contexto medido**:
  - `EX-5` **`NOT_SUPPORTED`**: `auto_recurring` como array da `400`, y el campo `items` devuelve
    `201` y **se descarta en silencio**. Un addon **no puede ser una línea aparte dentro de la
    suscripción del plan**.
  - `EX-6` **`VERIFIED`**: **dos suscripciones autorizadas del mismo pagador conviven** sin
    conflicto. Verificado con seis a la vez, en producción.
  - `PC-1` / `PC-3` **`VERIFIED`**: el monto de una autorizada se muta sin re-consentimiento.
  - **`EX-36`** (2026-09-16): el medio de pago se cambia **por preapproval**, y ese cambio **cobra
    una validación de ARS 0 que puede fallar**.
  - **`EX-37`** (2026-09-16): el `init_point` que entrega la API **viene roto**.
  - **`EX-34`** (2026-09-16): la fecha de una suscripción viva **es inmutable**.
- **Contexto externo** (contraste, no fundamento): existe un PR previo en el repo —
  [#3236, «provision MercadoPago preapproval plans for recurring add-ons»](https://github.com/qazuor/hospeda/pull/3236),
  detrás de un flag—. **No se leyó y no se usa como fundamento** (§4, `DEC-METH-001`); se anota
  para FASE 5, que es donde se contrasta contra lo existente.
- **Alternativas**: (1) **subir el monto de la suscripción del plan** por cada addon contratado;
  (2) **un preapproval aparte por cada addon recurrente**.
- **Decisión**: **(2)**.
- **Motivo, por los dos criterios del owner.**
  - **Toca plata o no toca plata**: **(1) toca plata cada vez que alguien contrata o da de baja un
    addon**, porque cada alta y cada baja es una mutación del monto del plan — **el punto exacto
    donde este proveedor ya demostró nueve veces que acepta sin aplicar**. Ahí el fallo silencioso
    **cobra de menos o de más y nadie se entera**, porque `EX-15` midió que mutar el monto **no
    emite webhook**. **(2) no toca plata nunca**: contratar es crear, dar de baja es cancelar.
  - **Hacia dónde falla**: (2) falla hacia **un addon que no se cobra** — visible y recuperable.
    (1) falla hacia **cobrar mal el plan entero**.
  - Y hay un argumento estructural que no depende de los fallos: con (1) **un addon con ciclo
    propio no existe** —queda obligado al del plan, así que un addon mensual sobre un plan anual
    es imposible— y el §40 define scopes (`LISTING`, `VERTICAL_SUBSCRIPTION`, `USER`, `GLOBAL`)
    que el §41 exige **poder cancelar por separado**. Con (1) el importe cobrado tampoco dice qué
    lo compone: hay que derivarlo del estado local.
- **Implicaciones**:
  1. **Contratar un addon pasa por el checkout.** El costo que el análisis previo había anotado
     —«le pide el código de seguridad al cliente»— **ya no aplica**: `DEC-SUB-006` movió la
     re-autorización al checkout, así que no se tokeniza del lado del servidor. Es más visible
     para el cliente, pero no manejamos datos de tarjeta.
  2. **Y por lo tanto `EX-37` alcanza a cada addon**: cada contratación necesita un `init_point`,
     que **viene roto**. Es un call site más para el guard que sanea el link — no uno nuevo, pero
     sí más superficie.
  3. **Un cambio de tarjeta son N actualizaciones, no una** (`EX-36`), cada una con su validación
     de ARS 0 que **puede fallar por separado**. Si falla en algunas y en otras no, el cliente
     queda con **parte de sus addons cobrando y parte no**: es un estado parcial que hay que
     reconciliar, y es un caso real porque a la gente se le vence la tarjeta. Lo que lo hace
     manejable es que **cada preapproval se lee solo**, así que el estado parcial es detectable.
     > ❌ **Corregida el 2026-09-24: esta implicación describe un flujo que el diseño NO tiene, y
     > se contradice con la implicación 1 de esta misma decisión.** Cambiar la tarjeta en el
     > proveedor es `PUT {card_token_id}` (`EX-36`), o sea que exige **tener un token**, o sea
     > **haber tokenizado**. Y la implicación 1 dice lo contrario con todas las letras:
     > *«`DEC-SUB-006` movió la re-autorización al checkout, así que **no se tokeniza del lado del
     > servidor** … **no manejamos datos de tarjeta**»*. **Las dos no pueden ser ciertas a la vez.**
     > **`EX-36` mide que el PROVEEDOR permite cambiar la tarjeta; no que nosotros lo hagamos.**
     > Confirmado por el owner el 2026-09-24: *«todo lo que es tarjeta lo maneja MP 100%, nosotros
     > no tenemos idea de tarjeta vencida… ahí el user debe cambiar la tarjeta en su suscripción»*.
     > **Lo que esta implicación decía queda sin efecto**, y con ella el deber que le pasaba al
     > capítulo 13 (*«cómo se resuelve una tarjeta que se cambia sobre N preapprovals»*), que **era
     > un deber mal atribuido**: no hay operación nuestra que pueda quedar a medias.
     > **Lo que SÍ vale, y es el escenario real**: si el cliente no cambia la tarjeta, **cada
     > suscripción falla por separado** y cada una corre su propio dunning (`GR-3`, `DEC-MP-003`) —
     > el plan puede seguir andando y el addon caer, o al revés. Eso ya está diseñado.
     > 🚧 **Y destapa un hueco que no está medido en ninguna fila**: una vez que el proveedor
     > **pausa** por mora, `EX-11` midió que **rechaza toda modificación**. Nosotros no podemos
     > cambiarle la tarjeta —ni queremos—, así que la pregunta es **si el cliente puede recuperar su
     > medio de pago por su cuenta desde Mercado Pago sobre una suscripción pausada**. Si puede, el
     > flujo existe y es del proveedor. **Si no puede, la suscripción está muerta** y la única salida
     > es un alta nueva por el checkout. `RN-3` empieza a contestarlo.
  4. **El ciclo del addon se alinea al del plan sólo AL CREARLO** (`EX-34`). Después no se corrige.
  5. **El resumen de la tarjeta muestra un cargo por el plan y otro por cada addon.** Es lo que
     hace que cada cobro se explique solo en la conciliación, y a la vez lo que el cliente ve.
  6. **Cancelar el plan NO cancela los addons**: esa orquestación es nuestra, y es exactamente lo
     que el §41 pide poder hacer al revés (cancelar un addon huérfano sin tocar lo demás).
     📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-a`, `R1-c` y `R18-b`)**:
     la baja desde `ACTIVE` (`S11`) cancela en el proveedor, en el mismo acto y con la misma regla
     que la principal, los complementos recurrentes que dependen de ella —la selección de `S32`—;
     siguen dando servicio hasta el fin de servicio y en esa fecha los cierra `S21`, antes que su
     propio `S12`. La misma regla corre cuando la principal llega a `CANCEL_SCHEDULED` sin pedir la
     baja: por el espejo que lee nuestra cancelación después de que el pago le ganó la escritura a
     `S6` o `S3`, y por `S7`. Lo que sigue valiendo es que la instancia no se apaga con el plan: la
     apaga la orfandad.
     📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-c`, `V2-d` y
     `V2-e`)**: la selección de `S32` en la baja suma `CANCEL_SCHEDULED` a la exclusión. `S26` la
     aplica a los `USER`/`GLOBAL` compatibles con la vertical que discontinúa. Y cuando una de las
     catorce transiciones saca a una principal de las filas vivas y la orfandad de un
     `USER`/`GLOBAL` no se cumple sólo porque las otras compatibles están pausadas o suspendidas,
     `S32` lo pausa en el mismo acto.
- **Origen**: `BD-MP-04` · §38 · §40 · §41. **Era el último bloqueante de FASE 2.**

### DEC-ARCH-003 — Los dos `SUSPENDED` del PDR se separan: el del trial se llama `TRIAL_EXPIRED`

- **Fecha**: 2026-09-17 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el PDR usa la palabra `SUSPENDED` para dos situaciones que no se comportan igual.
  El §10.6 la usa para el trial que venció sin que la persona se suscribiera
  (`TRIAL_ACTIVE -> SUSPENDED`), y el §20/§21 para el pago que falló y agotó su grace
  (`GRACE_PERIOD -> SUSPENDED`). El §63 pide modelar explícitamente los estados y las
  transiciones de ocho máquinas, y dos situaciones distintas bajo un mismo nombre no se pueden
  modelar: cualquier transición que se escriba sobre `SUSPENDED` es ambigua.
- **Las tres diferencias, que es lo que impide compartir nombre**:

  | | trial vencido | impago tras el grace |
  |---|---|---|
  | ¿hubo dinero de por medio? | no, nunca pagó | sí, y quedó un cobro sin entrar |
  | campaña de recuperación del §10.7 (+1, +5, +15, +30, +60) | **sí** — el §10.7 la define para este caso | **no** — el §10.7 habla de *«Recovery post-trial»* |
  | qué le falta para volver | suscribirse por primera vez | regularizar un pago |

- **Alternativas**: (1) separarlos en dos estados con nombres distintos; (2) un solo
  `SUSPENDED` con un campo `motivo`; (3) dejarlo como está y que cada consumidor deduzca cuál
  es por el contexto.
- **Decisión**: **(1)**. El del §10.6 se llama **`TRIAL_EXPIRED`** y el del §20/§21 conserva
  **`SUSPENDED`**.
- **Motivo**: es la única que hace que las transiciones del §63 sean escribibles sin ambigüedad.
  La (2) mueve el problema a un campo que hay que acordarse de mirar —y `DEC-GRANT-004` ya
  obligó a un motivo para `PAUSED`, donde sí hace falta porque el proveedor no distingue; acá
  la distinción es nuestra desde el origen y no hay razón para diferirla a un campo—. La (3) es
  el estado de cosas que el §1 nombra entre las causas de este programa.
- **Implicaciones**:
  1. **Apartamiento declarado del §10.6**, que escribe `SUSPENDED`. El PDR no se edita (§3.1):
     queda registrado acá. Es el **tercero** del programa, y ya estaba anticipado como tal en el
     resumen de este log antes de tener ID propio.
  2. **Las consecuencias del §21 valen para los dos por igual** —sin listado público, sin
     edición, sin creación, sin entitlements comerciales, datos conservados, Mi Cuenta en sólo
     lectura, billing accesible, recuperación posible—. Lo que cambia es la comunicación, no el
     acceso.
  3. **El reloj de retención del §25 arranca igual en los dos**: el §25 dice *«desde que queda
     efectivamente inactiva»* y las dos situaciones lo son. Rige `DEC-DATA-001` sin cambios.
  4. La campaña del §10.7 se dispara **sólo** desde `TRIAL_EXPIRED`. Qué pasa si la campaña ya
     se disparó y después el trial se extiende sigue abierto (`E-TRIAL-03`, capítulo 11).
- **Origen**: `M-ARCH-01` · §10.6 · §20 · §21 · §63. Cerrado por el capítulo 01 de la Master
  Spec; el nombre lo aprobó el owner el 2026-09-17.

### DEC-OBS-001 — `RECONCILIATION_REQUIRED` avisa por un listado accionable y un correo AGREGADO, no uno por evento

- **Fecha**: 2026-09-17 · **Estado**: ACCEPTED — **precisada con OK del owner** (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27, `V2-s` el 2026-09-28: el cobro por debajo del esperado y el sujeto de la acción 16; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8; ver su último 📌) · **Decide**: owner
- **Problema**: el §22.1 ordena, **siempre** que el sistema llegue a ese estado, cinco cosas — y
  la tercera es *«enviar email a `SUPER_ADMIN`»*, sin condición ni agrupamiento. Un incidente de
  webhooks genera cientos de eventos idénticos: con un correo por evento, **el canal deja de
  leerse justo cuando importa**. El requisito real lo enuncia el propio §22.1 al cerrar: *«El
  objetivo es que SUPER_ADMIN esté al tanto y pueda intervenir»*.
- **Alternativas**: (1) listado accionable en Admin como canal primario más un correo **agregado**
  con ventana de frecuencia; (2) un correo por evento, tal como lo escribe el §22.1; (3) sólo el
  listado, sin correo.
- **Decisión**: **(1)**.
  - **Canal primario**: el listado accionable en Admin — que el §22.1 **ya contempla** en su
    cuarto punto.
  - **El correo es agregado**: un resumen cada N minutos con el conteo por tipo y los sujetos
    afectados. `N` es configuración (§9).
  - **Excepción**: un evento **único y grave** —un doble cobro real detectado, un reembolso que
    falló sobre una revocación— manda **su propio correo**, sin esperar la ventana.
  - **La agrupación es por tipo + sujeto**, así que cientos de eventos de un mismo incidente
    colapsan en una línea con su conteo.
  - **Lo que NUNCA se agrupa es el registro**: el evento crítico se escribe uno por uno, siempre.
    Lo que se agrupa es el aviso.
- **Motivo**: cumple el objetivo que el §22.1 enuncia sin el modo de falla que su letra produce.
  La (2) es la que apaga el canal. La (3) incumple el §22.1 sin compensarlo con nada: si nadie
  mira el Admin ese día, nadie se entera.
- **Implicaciones**:
  1. **Apartamiento declarado del §22.1**, que dice *«enviar email a `SUPER_ADMIN`»* sin
     condición. El PDR no se edita (§3.1): queda registrado acá. Es el **cuarto** apartamiento del
     programa.
  2. **Los otros cuatro puntos del §22.1 se cumplen literalmente**: evento crítico registrado,
     información suficiente para investigar, alerta en Admin, y cero decisiones destructivas
     automáticas.
  3. **La ventana de agregación es un riesgo declarado**: entre que ocurre el primer evento y sale
     el resumen pasan hasta `N` minutos. Para el caso que no puede esperar está la excepción, y
     **qué eventos entran en esa excepción es una lista cerrada** que el capítulo 08 declara.
  4. Se cruza con la jerarquía de supresión del capítulo 07: este correo es **transaccional no
     suprimible**, y un rebote duro sobre él se escala como no entregable.
- **Origen**: `R-OBS-01`, `S-OBS-01` · §22.1 · §50. Cerrado por el capítulo 08 de la Master Spec.
- 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-f` el 2026-09-27; `V2-s` el
  2026-09-28)**: el resumen lista el cobro por debajo del monto esperado de su período, con el
  sujeto y la diferencia; no abre marca ni mueve el conteo de motivos. Y lista la acción 16 con la
  vertical como sujeto y cuántos dueños alcanza, así que el `SUPER_ADMIN` que además es dueño en esa
  vertical queda visible ahí, sin regla nueva.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8)**: Su resumen ya no lleva
  la acción 16 (`V2-s`).

---

### DEC-ARCH-004 — El billing se implementa de nuestro lado, en un package propio de Hospeda, con la pasarela detrás de un adaptador

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, N2, sobre la definición 2 y la implicación 5; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, caso 30, contra la recomendación; ver su último 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes M-D y N-A; ver su último 📌) · **Decide**: owner
- **Problema**: tres días de medición contra Mercado Pago dejaron dos cosas a la vista. La
  primera, que **de las ocho capacidades del capítulo 06 ya traíamos cinco de nuestro lado** —el
  reloj de la pausa, el candado contra el doble cobro, el inventario a conciliar, la
  compensación de días y la baja a fin de período—, no por desconfianza sino porque el proveedor
  no las tiene o las tiene de una forma que no sirve. La segunda, que el reparto actual entre
  `qzpay` y Hospeda **no tiene una frontera**: son **seis repartos distintos sobre las mismas 27
  tablas y ninguno coincide** (`F-1B-132`), con el DDL escrito por Hospeda y los modelos Drizzle
  definidos por `qzpay`. Encima, la evaluación de reemplazo abierta el 2026-09-17 puso sobre la
  mesa una pregunta que el diseño actual no sabe contestar: **qué cuesta cambiar de pasarela**.
- **Las cifras que sostienen la decisión**, todas medidas:

  | | |
  |---|---|
  | capacidades que ya resolvíamos nosotros | **5 de 8** |
  | decisiones acopladas a una fila medida del proveedor | **20 de 46** (43 %) |
  | capítulos de la Master Spec que citan una medición | **13 de 21**, y **41 de las citas viven en el capítulo 06** |
  | tamaño de `qzpay` | **~62.500 líneas** en 9 paquetes |
  | cuánto de su motor usa Hospeda | **6 de 261 símbolos**; 12 de 16 servicios en cero; 4 namespaces en cero |
  | otros consumidores de `qzpay` | **ninguno** — sólo worktrees de Hospeda |
  | dirección de la dependencia | **19 FK** hospeda→qzpay, **0** al revés |
  | crons que ya se saltean la abstracción | **7 de 17**, con el motivo escrito en el código |

- **Alternativas**: (1) seguir con `qzpay` como paquete externo y mejorar su frontera;
  (2) traer el billing adentro de Hospeda, en un package propio, con la pasarela detrás de un
  adaptador; (3) acoplarse a la pasarela elegida y aceptar que cambiarla sea una reescritura.
- **Decisión**: **(2)**, con cinco definiciones del owner y dos condiciones que las hacen
  exigibles:
  1. **Se implementa de nuestro lado todo lo que se pueda**, para depender de la pasarela lo
     mínimo posible. Al proveedor se le pide cobrar, reembolsar, leer y avisar — el ciclo de
     vida es nuestro.
  2. **`qzpay` se absorbe.** Deja de ser un paquete externo.
  3. **Un package del monorepo concentra el dominio de billing**, y **ninguna otra parte de
     Hospeda habla con la pasarela directamente**.
  4. **Ese package expone una API definida por lo que Hospeda necesita**, no por lo que una
     pasarela ofrece — que es lo que el capítulo 06 ya hizo con las ocho capacidades.
  5. **Adentro es un adaptador intercambiable**: cambiar de pasarela cambia el adaptador, no la
     API ni el código que la consume.
  6. **Condición A — un guard estático** que prohíba importar el SDK de la pasarela fuera del
     adaptador. Es lo único que convierte «no lo hagas» en «no se puede».
  7. **Condición B — un adaptador falso, en memoria, desde el día uno**, que implemente la misma
     interfaz. Sirve para testear sin red y, sobre todo, **es lo que prueba que la abstracción no
     miente**: si no se puede escribir sin filtrar conceptos de Mercado Pago, la interfaz está
     mal definida.
- **Motivo**: un paquete externo se justifica por reuso, y **no hay reuso**: `qzpay` existe sólo
  para Hospeda, que además usa el 2 % de su motor. Estamos pagando el precio de una frontera sin
  cobrar ningún beneficio, y la frontera está rota de una forma medida y no accidental. La (1)
  conserva ese precio. La (3) es la que nos trajo hasta acá: es la razón por la que tres días de
  medición sobre un proveedor pusieron en duda meses de diseño.
- **Lo que esta decisión NO afirma**: que las pasarelas sean intercambiables. **No lo son.** El
  modelo de datos difiere de verdad —en Mobbex una suscripción es una plantilla con muchos
  suscriptores; en Mercado Pago un `preapproval` **es** un cliente—, y lo que el proveedor le
  escribe al cliente por su cuenta (`EX-3`), sus tiempos de acreditación y sus comisiones no se
  abstraen. Por eso la API **no expone el mínimo común denominador**: para cada capacidad, el
  diseño declara qué pasa cuando el proveedor no la tiene —se emula de nuestro lado, se degrada,
  o se bloquea la función del producto—. Un adaptador que finge paridad es peor que ninguno,
  porque el código de arriba le cree.
- **El riesgo, declarado**: esta decisión **traslada el riesgo hacia nosotros**. Hoy, si un cobro
  sale mal, es problema del proveedor. Con el ciclo de vida de nuestro lado, **un doble cobro es
  nuestro bug y es plata de un cliente real** — y está medido que ni Mercado Pago (`EX-17`) ni
  Mobbex ofrecen idempotencia en la creación, así que el candado es nuestro y va **antes** de
  llamar al proveedor (`DEC-CONC-001`). Se acepta el trade por dos razones: un bug nuestro se
  arregla y uno del proveedor no, y **nadie puede testear lo que no controla** — hoy el e2e de
  billing corre contra un stub de Mercado Pago que, por construcción, no puede detectar
  divergencias con el proveedor real.
- **Implicaciones**:
  1. **El package no es un wrapper de pasarela: es el dominio de billing entero.** Adentro viven
     el reloj de la pausa, el dunning, los reintentos, las cortesías y el candado contra el doble
     cobro. La pasarela queda como un detalle al fondo.
  2. **La FASE 5 cambia de contenido.** `qzpay` deja de ser material a clasificar en
     `KEEP`/`ADAPT`/`REWRITE` y pasa a absorberse. El gate de `DEC-METH-003` sigue rigiendo para
     el resto del código de billing de Hospeda.
  3. **Las 20 decisiones acopladas se revisan, no se reescriben.** En cada una la política
     sobrevive y lo que se revisa es la forma. Varias mejoran si el proveedor nuevo puede lo que
     Mercado Pago no: si se puede mutar el ciclo de una suscripción viva, `DEC-SUB-006` deja de
     necesitar el cancelar-y-recrear.
  4. **El capítulo 13 (Pagos), el único que falta, se escribe con esta decisión puesta.** Era la
     razón por la que se había diferido.
  5. **Lo que se absorbe es mucho menos que 62.500 líneas**: el 2 % del motor que se usa, más los
     modelos de las 27 tablas cuyo DDL ya es de Hospeda. Lo que se descarta es lo que nunca se
     usó.
  6. **Los 7 crons que hoy construyen su propio adaptador se reescriben** — ya estaban condenados
     por decisión previa del owner, así que no es costo que agregue esta decisión.
- **Origen**: conversación con el owner del 2026-09-18, a partir del §57 del PDR (abstracción de
  proveedor), del capítulo 06 de la Master Spec (las ocho capacidades por dominio) y de la
  evaluación de proveedor abierta el 2026-09-17
  ([`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md)). **Es la primera decisión
  de arquitectura del programa que no sale de una medición sino de un criterio del owner**; las
  mediciones que la sostienen están citadas arriba, pero la elección es suya.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N2, sobre la definición 2 y la
  implicación 5)**: `qzpay` no se absorbe: se saca. Todo el cobro nuevo se escribe bien encapsulado
  en un package compartido del monorepo, de modo que se pueda publicar como package npm propio sin
  reescribirlo: no depende de ninguna app ni de la mitad de verticales, salvo del package del
  contrato. `qzpay` queda sólo como referencia de lectura: su adaptador de Mercado Pago sirve para
  ver cómo se arma un pedido o se verifica una firma, y su motor y su esquema no. La implicación 5
  (se absorben el 2 % del motor y los modelos de las 27 tablas) queda superada: con `DEC-MIG-003` y
  el modelo nuevo no se absorbe ninguna tabla. `qzpay` se congela hasta el corte y se archiva
  después (`D/16` §4.5), y `G16` falla si vuelve `@qazuor/qzpay` (revisión del owner, 2026-09-28,
  N2).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, caso 30, contra
  la recomendación)**: El package del cobro es un package compartido del repo; publicarlo en npm
  pediría reescribir sus dependencias internas. Puede depender de packages internos de Hospeda con
  la regla del owner: "siempre que sea simple evitar la dependencia de otro package de Hospeda,
  evitalo; si es complejo, la dejamos y en el futuro se reverá", porque "no quiero demorar la salida
  de esta épica por eso". `G16` no mira esas dependencias; la prohibición de `@qazuor/qzpay` sigue.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-D y N-A)**: `qzpay` y todo
  el cobro viejo salen de la rama del paraguas al principio de la épica, en la limpieza del principio
  (`16-fase-7…` §4.6, `DEC-ARCH-014`), antes de que se construya el cobro nuevo; el sistema viejo
  sigue cobrando en producción desde `main` hasta el paso 3 del corte. Por eso el predicado (a) de
  `G16` mira todo el repo desde que nace, sin lista de pendientes. El lote M-D lo había acotado el
  mismo día al package del cobro, porque el 2026-09-29 cinco `package.json` del repo declaraban
  `qzpay`, y el lote N-A lo devolvió al repo al sacar el cobro viejo al principio.

---

### DEC-ARCH-005 — El programa se parte en dos épicas autónomas: Verticales y Billing

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED — **el «Problema» precisado el 2026-09-26** (la pasarela ya está decidida; ver su 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote 2, letras A y B: el outbox común lo construye `U2`; ver su último 📌) · **Decide**: owner
- **Problema**: el programa entero quedó detenido por **una sola cosa**: no está decidida la
  pasarela. Mercado Pago niega el cobro a demanda con un `403` comercial y el candidato que sí lo
  documenta tiene el alta en revisión manual de KYC. **Ese bloqueo alcanza al dinero y no alcanza
  a las capacidades**: qué puede hacer una cuenta, qué publica cada vertical, cómo se agregan los
  limits y quién está autorizado a qué no necesitan saber con qué se cobra. Se estaba esperando
  por una razón que no aplicaba a la mitad del programa.

  **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, contradicción (b) de
  `28-fase-9-vuelta-1/05-…`).** El *«Problema»* de esta entrada —la pasarela sin decidir— **dejó
  de ser cierto el 2026-09-24** (`DEC-MP-005`: Mercado Pago). **La partición sigue en pie por la
  otra razón que ya daba**: el bloqueo alcanzaba al dinero y no a las capacidades, y el corte
  *«toca plata o no toca plata»* no dependía de la pasarela. *«Autónomas»* se lee hoy así: las
  épicas se citan entre sí, y lo que cruza por contrato es la cobertura (`DEC-ARCH-006`).
- **Las cifras que sostienen la decisión**:

  | | |
  |---|---|
  | capítulos escritos que **no citan ninguna medición** del proveedor | **8 de 21**, contados con `rg` el 2026-09-18 — y son casi exactamente la épica que arranca |
  | capítulos que son billing **sin una sola fisura** | **5** — `05`, `06`, `09`, `12`, `14` |
  | capítulos que son verticales enteros | **3** — `11`, `17`, `18` |
  | entidades del catálogo comercial **sin un solo campo de dinero** | **5 de 6** (cap. 02 §2.1) |
  | lugares distintos donde verticales necesita un hecho de billing | **4**, y los cuatro son **el mismo hecho** |
  | filas a migrar en Gastronomía, Experiencia y Partner | **cero**, y **cero pagos históricos** (cap. 21) |

- **Alternativas**: (1) esperar a que se decida la pasarela con el programa entero detenido;
  (2) partir en dos épicas autónomas; (3) arrancar la implementación completa en una sola épica
  con billing simulado adentro.
- **Decisión**: **(2)**, y con una precisión del owner que es la que le da forma: **las dos
  épicas son AUTÓNOMAS**. Cada una se lee y se desarrolla **sin que la otra esté terminada de
  definir**. No son dos vistas de un mismo documento: son dos specs que se sostienen solas.
  - **`HOS-1353` · Verticales** — capacidades, entitlements, limits y autorización. Arranca ya.
  - **`HOS-1354` · Billing** — cobro, suscripción y proveedor detrás de un adaptador. Espera.
  - **`HOS-1352`** queda como **paraguas** y deja de implementarse.
- **Por dónde pasa el corte**: **es el criterio del owner —*«toca plata o no toca plata»*—**, y no
  hubo que inventarlo: el capítulo 15 ya lo había escrito al cerrar, separando su materia de la
  del 14 con las palabras exactas — *«acá se agregan **capacidades**, allá se compone **dinero**»*.
- **Y pasa POR DENTRO del catálogo de planes, no por afuera.** Es el punto donde el reparto se
  equivoca si se hace por nombre: «plan» suena a billing y no lo es. De las seis entidades del
  catálogo comercial, **cinco no tienen un solo campo de dinero** — `vertical`, `plan`,
  `plan_version` (que guarda `rank`, vendible, días de grace, días de trial, permite pausa,
  hereda Turista VIP), `plan_version_entitlement` y `plan_version_limit`. **El precio vive en una
  sola tabla hoja, `billing_option`**, y el propio capítulo 02 lo dice: *«El precio cuelga de la
  versión, no del plan»*. **Eso es lo que vuelve independiente al trial**: deriva su plan del
  vendible de `rank` más alto y del más bajo, y las dos columnas están en `plan_version`, así que
  se resuelve entero sin que exista un precio en la base.
- **Motivo**: un bloqueo se respeta donde aplica, no donde alcanza por contagio. La (1) paga el
  costo de un bloqueo que sólo rige para la mitad del trabajo, y esa mitad no tiene siquiera deuda
  de datos que la justifique. La (3) mete el simulacro adentro de una épica sola, que es donde un
  simulacro se vuelve permanente sin que nadie lo note.
- **Lo que esta decisión NO afirma**: que las dos mitades no se toquen. Se tocan en **un** lugar,
  y ese lugar es compartido por definición — lo fija `DEC-ARCH-006`. **Autónomo no quiere decir
  incomunicado**: quiere decir que ninguna espera a la otra para avanzar.
- **El riesgo, declarado**: **dos specs autónomas duplican contenido y pueden divergir.** Es el
  modo de falla que este programa ya tiene medido —seis repartos sobre las mismas 27 tablas y
  ninguno coincide (`F-1B-132`)— y se acota de dos formas: la frontera tiene **una sola fuente**
  (`DEC-ARCH-006`) que ninguna de las dos puede mutar sola, y lo transversal —glosario, el
  criterio Eje 1 / Eje 2, outbox, auditoría— queda en un núcleo común que las dos citan sin
  copiar.
- **Implicaciones**:
  1. **Los interiores se escriben autónomos; la frontera no.** Cada spec absorbe el diseño de sus
     capítulos; el contrato de la frontera se cita, nunca se copia.
  2. **Queda pendiente qué pasa con la Master Spec.** El documento de partición escrito el
     2026-09-18 dice *«los capítulos no se reescriben ni se mueven»*, y eso era correcto cuando
     las specs sólo declaraban alcance. Con specs autónomas hay dos fuentes para lo mismo si los
     capítulos se quedan donde están **y** las specs los absorben. **Sin decidir, y es del owner.**
  3. **El reparto capítulo por capítulo** vive en
     [`11-particion-del-programa.md`](./11-particion-del-programa.md) §4.
- **Origen**: conversación con el owner del 2026-09-18, a partir del bloqueo de la evaluación de
  proveedor ([`10-evaluacion-de-proveedor.md`](./10-evaluacion-de-proveedor.md)) y de
  `DEC-ARCH-004`. La autonomía de las dos épicas es una segunda precisión suya, del mismo día.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 2, letras A y B;
  `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-10` y `R5-11`)**: el outbox del núcleo
  común (`NUCLEO/07`), que ninguna unidad construía, lo construye **`U2`, el outbox común**, una
  unidad del paraguas como `U1`, que depende de ésta y va antes de toda unidad que encole (`V6`,
  `V9`, `B4`, `B12`), sobre el precedente del outbox del newsletter. Incluye la supresión y absorbe
  la bitácora de correos que `U1` renombra desde `billing_notification_log` (lote 1 B). La misma
  unidad agrega la correlación de punta a punta, el id de corrida y el huso del mercado en los
  jobs; el reloj sigue en `B1`. Lo transversal sigue en el núcleo, citado y no copiado: lo que
  cambia es que ahora tiene quién lo construye.

---

### DEC-ARCH-006 — La frontera entre las dos épicas es un contrato único con dos implementaciones desde el día uno

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED — **precisada el 2026-09-25, con OK del owner** (FASE 9 completa, 9h: la firma gana el campo `piso` y pasa a siete campos; ver su 📌) — **precisada otra vez el 2026-09-26** (FASE 9 vuelta 1, G2-1: el primer evento de verticales a billing; y G4-2: tres entradas nuevas en la dirección inversa, `extenderTrial` la única escritura, y la capa de composición; ver sus implicaciones 4 y 5) — **y precisadas las dos implicaciones el mismo 2026-09-26, con OK del owner** (tercera tanda, L1 y L2: el empuje sale después del commit; `ficha` gana `admiteDestaque`) — **y precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R5` y `Q-FECHA`: `finDeServicio` en la dirección de ida y `vertical_discontinuation`; ver su último 📌) — **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `N-B-03` confirmado por `V2-x`: `PB9` no borra con el hecho 4 pendiente; ver su último 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N6, `L1-d`, C4, C14; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos G-B, I-E, J-A y K-C; ver su último 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes M-F, N-A y N-C; ver su último 📌); **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote P-C: quién crea el package del contrato; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes D y Q: `puedeCobrarle` sobre la cancelación confirmada y la última pérdida de cobertura de una ficha; ver su último 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote AE: la cancelación del proveedor tras un rechazo cuenta hasta que pasa el plazo 16; ver su último 📌) · **Decide**: owner
- **Problema**: `DEC-ARCH-005` parte el programa, y eso sólo sirve si la épica de verticales
  **puede correr sin que exista la de billing**. El punto de contacto no es teórico: el paso 5 de
  la resolución de autorización (cap. 17 §1.2) pregunta *«¿tiene trial, suscripción, cortesía o
  grant que lo cubra?»*, y tres de esas cuatro fuentes son de billing.
- **Lo medido que lo hace posible**: verticales necesita de billing **un solo hecho**, que aparece
  en cuatro lugares y es siempre el mismo — el paso 5 de la autorización, la transición `PB2` de
  publicación (cap. 03 §9), la pérdida de beneficios de turista al suspender (cap. 15 §6) y el
  disparador del recálculo del conjunto efectivo (cap. 02 §3.2 · cap. 15 §4.2). **Nada más cruza
  la frontera**: ni montos, ni estados de pago, ni ids del proveedor, ni fechas de cobro.
- **Y el contrato no depende de la pregunta que billing tiene abierta.** Esté el reloj de cobro de
  nuestro lado o del proveedor —lo que decidirá el capítulo 13—, en los dos mundos hay un título
  con un estado y una fecha hasta la cual cubre. **Se puede definir hoy sin prejuzgar el 13.**
- **Decisión**: **un contrato único, con dos implementaciones desde el día uno.**
  1. **El contrato es de la frontera, no de una épica.** Vive en el programa, las dos specs lo
     citan, y **ninguna de las dos puede mutarlo sola**. Una copia que billing pudiera tocar sin
     que verticales se entere es `F-1B-132` otra vez.
  2. **Lo que verticales declara es lo que necesita, no el package ajeno.** Verticales no depende
     de un `@repo/billing`: depende de un contrato que billing satisface. Es el punto 4 de
     `DEC-ARCH-004` —*«expone una API definida por lo que Hospeda necesita»*— aplicado un nivel
     más arriba.
  3. **La implementación de arranque NO devuelve datos fijos: resuelve el trial de verdad**, y
     niega las otras tres fuentes. Es la precisión que cambia el valor del ejercicio, y el motivo
     está abajo.
  4. **Tres defensas, y ninguna es opcional**: el default de una fuente no implementada es
     **negar**; **un solo juego de casos corre contra las dos implementaciones**; y un guard
     impide que la implementación de arranque llegue a producción.
- **Motivo**: es la **condición B de `DEC-ARCH-004`** aplicada a esta frontera en vez de a la de
  la pasarela — *«es lo que prueba que la abstracción no miente: si no se puede escribir sin
  filtrar conceptos de Mercado Pago, la interfaz está mal definida»*. El contrato no es un
  andamio: es el instrumento que verifica que el corte de `DEC-ARCH-005` es real.
- **Por qué el trial y no un dato fijo**: un simulacro que contesta **siempre que sí** es un
  fail-open, y deja sin ejercer **la mitad interesante** —perder la cobertura: `PB2`, el
  reconciliador de excedentes, el aviso de qué se hizo—. Uno que contesta siempre que no deja todo
  apagado. Las dos versiones desarrollan verticales contra un mundo que no existe. **El trial evita
  las dos porque es un título vivo de verdad**, con una máquina de estados que vive del lado de
  verticales (cap. 03 §2) y que vence: los dos caminos se ejercen completos sin una sola línea de
  mentira. Lo único que se siembra es un plan con sus entitlements para que el trial tenga de dónde
  derivar, y eso es un dato, no una rama en el código.
- **El riesgo, declarado**: **que la implementación de arranque sobreviva a producción.** El
  proyecto ya tiene el caso: un fallback comentado como seguro que era el permisivo. Por eso las
  tres defensas del punto 4 son parte de la decisión y no una recomendación — y por eso el default
  es negar: **un olvido apaga funciones en vez de regalarlas.**
- **Implicaciones**:
  1. **El swap de implementación deja de ser un día de sorpresas** y pasa a ser un evento
     verificable: para entonces el juego de casos ya corrió meses contra la otra.
  2. **El contrato se escribe antes que las dos specs autónomas**, porque las dos lo citan.
  3. **No agrega sobrearquitectura** (§57): es un contrato con dos implementaciones, que es el
     mínimo con el que la condición B se puede cumplir.
  4. **📌 Implicación (FASE 9 vuelta 1, owner 2026-09-26, `G2-1`;
     `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** El contrato gana un segundo evento, el
     primero de verticales a billing: *«la ficha F llegó a `PURGED`»*, emitido ~~en el mismo acto de
     `PB9` y de `PB12`~~ **por el mismo acto** de `PB9` y de `PB12`, **después de su commit** —como
     el aviso de cobertura: su consumidor relee `fichaPurgada`, y un empuje anterior al commit se
     descartaba siempre (FASE 9 vuelta 1, `N-G2V-01`/`N-G4V-05`; owner 2026-09-26, L1)—, cuyo único
     consumidor es `A6`. No tiene transporte durable; su red es la
     consulta `fichaPurgada(ficha) → sí | no` del §4.1, leída por el barrido diario de billing. Se
     eligió contra la recomendación (sólo la consulta, con hasta un día de atraso) porque el owner
     no acepta ni un cobro de más; el día de atraso vuelve sólo si el empuje se pierde, y queda
     declarado en `B/16` NO cierra.
  5. **📌 Implicación (FASE 9 vuelta 1, owner 2026-09-26, `G4-2`;
     `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** La dirección inversa del contrato gana
     tres entradas: ~~`ficha(idDeFicha) → { vertical, dueño }`~~ `ficha(idDeFicha) → { vertical, dueño,
     admiteDestaque }` —el tercer campo es un sí o no, no el estado: lo exige `A1` (FASE 9 vuelta 1,
     `N-G4V-06`; owner 2026-09-26, L2)— y
     `políticaDeAddon(versiónDeAddon) → { addon, vigencia, díasDeVigencia, tipoDeScope }`, que
     consume `A1`, y `extenderTrial(user, vertical, días, claveDeCanje) → ACEPTADA | RECHAZADA`, la
     **única escritura** de billing en verticales, que corre `T4` dentro del lock del trial. Sale
     `díasDeTrial` de `políticaDePlan`, que no tenía lector en billing. Las superficies (pricing,
     Mi Suscripción, el botón) son una **capa de composición**: leen de las dos épicas porque no
     deciden, y si deciden algo su lectura entra al §4.1. La regla de vigilancia del §4.2 cita las
     preguntas del §4.1, sin cifra.
- **Origen**: propuesta del owner del 2026-09-18 —*«definir una interface para el package billing,
  que la épica de verticales genere como stub… y luego la sub épica de billing real, convierta ese
  package stub en código real»*—, con tres precisiones aceptadas en la misma conversación: que lo
  declarado sea el contrato y no el package ajeno, que la implementación de arranque resuelva el
  trial en vez de devolver datos fijos, y las tres defensas del punto 4.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, fila 9h de
  `26-fase-9-completa/10`; `09-…` `C-2`, aplicado en `17`).** **La firma de `cobertura()` gana
  `piso: versiónDePlan, si tipo = GRANT`** —nada en los otros cinco tipos— **y pasa de seis a siete
  campos** (`12-contrato…` §2, §2.1, §2.8). El piso del trinquete de `DEC-GRANT-005` lo aplica
  verticales (`V/15` §2) y el dato vive en billing (`permanent_grant`, `B/02`): leerlo de la tabla de
  billing era cruzar la frontera por fuera del contrato, que es lo que el punto 1 prohíbe.
  `permanent_grant` sigue siendo **el origen del dato**; lo que cambia es que llega por la firma.
  El agente de aplicación lo había dejado como está; **el owner eligió agregarlo**. Implica un caso
  de `GRANT` con piso en el juego único de casos del punto 4.

  La entrada no se edita en su contenido.

- 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R5` y `Q-FECHA`)**: la
  fecha de fin de servicio de una vertical la calcula billing y verticales la pregunta por
  `finDeServicio` (`12-contrato…` §4.1), que en la implementación de arranque contesta
  `NINGUNA`; la real contesta de `vertical_discontinuation`, una fila de billing por vertical
  discontinuada, y verticales no guarda copia. El día del fin de servicio billing sólo avisa.
  `PB2`, el hecho 4 y la invalidación de la vertical los ejecuta el reconciliador diario de
  cobertura (`V/03` §9). `extenderTrial` sigue siendo la única escritura de billing en
  verticales.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-x` sobre
  `N-B-03`)**: `PB9` no borra una ficha de una vertical cuya `finDeServicio` ya pasó mientras la
  corrida del reconciliador no escribió el hecho 4, así que `finDeServicio` tiene tres lectores en
  verticales y no dos.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N6, `L1-d`, C4, C14)**: El
  contrato vive en un package compartido del monorepo, único punto de comunicación entre las épicas,
  con las dos interfaces, sus validaciones, los simuladores de cada lado y los dos juegos de casos;
  `G14` prohíbe que una mitad importe a la otra; el nombre es FASE 5. La fuente gana `desde` (C4) y
  la dirección de ida tiene una pregunta, `retenciónDetenida` (C14).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos G-B, I-E,
  J-A y K-C)**: El package del contrato tiene una quinta cosa: la interfaz del reloj con que el
  código de producción de las dos mitades lee la hora, inyectada. La construye `B1`, junto con el
  reloj adelantable que la implementa, que vive en el package de pruebas compartido. La
  implementación real, la hora del sistema, no vive en el package: la inyecta la raíz de composición
  de `apps/api`, el único lugar que junta las dos mitades, en una línea que también escribe `B1`, y
  en las pruebas se inyecta el adelantable. `G14` no cambia: importar el contrato nunca fue cruzar.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-F, N-A y N-C)**: La
  dirección de ida gana una segunda pregunta, `puedeCobrarle(user) → sí | no`, que billing contesta
  sobre la cuenta entera y sin estado: `sí` si le queda una suscripción, principal o de complemento,
  en `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`, las filas vivas sin
  `CANCEL_SCHEDULED`, o una marca `CANCELACIÓN_SIN_CONFIRMAR` abierta. Su único lector es la acción
  24; la real la construye `B4` y la de arranque, que contesta `no`, `V4`. El contrato pasa a ocho
  entradas, siete preguntas y una operación, con los mismos trece campos, y la pregunta entra al
  inventario de consumidores de "fila viva" que vigila `G-R1-E`. No suma dependencia entre épicas:
  la cubre la de la dirección de ida, y siguen siendo once. Y mientras la app de la rama está rota,
  desde la limpieza del principio hasta que `B4` integra la implementación real, las dos mitades se
  construyen y se prueban contra los simuladores del contrato (`12-contrato…` §7.1).
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote P-C)**: El package del
  contrato lo crea `U1`, la unidad del paraguas, vacío, al terminar la limpieza del principio: la
  estructura, sin interfaces, validaciones, simuladores ni casos. `V1` y `B1` arrancan en paralelo
  y cada una llena su parte: `V1` las cuatro primeras cosas, y construye `G14`, y `B1` la quinta,
  la interfaz del reloj. Así `B1` no espera a `V1`, y las dependencias entre épicas siguen en once.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes D, Q y AD)**: `puedeCobrarle`
  contesta sobre la cancelación confirmada por Mercado Pago: mientras una relectura no vea
  `cancelled` contesta `sí` y la baja de cuenta espera. `G13` vigila las seis respuestas de
  arranque. Y el contrato devuelve ~~cuándo perdió cobertura por última vez una ficha~~ cuándo
  perdió la cobertura por última vez la persona en esa vertical (`coberturaPerdidaEn`, un campo de
  `retenciónDetenida`; lote AD): el borrado de una ficha inactiva (`PB9`) cuenta su plazo también
  desde ahí. Que una relectura confirmó la cancelación lo guarda `provider_link.cancelado_visto_en`. Mientras el contrato no devuelva ese dato,
  `PB9` no corre en la misma pasada en que ve la ficha sin cobertura por primera vez.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote AE)**: sobre una
  suscripción cuyo preapproval canceló el proveedor tras un cobro rechazado, `puedeCobrarle`
  contesta `sí` mientras no pase el plazo 16 de `NUCLEO/02` §1.5, la ventana de relectura de la
  cancelación por rechazo (7 días), desde la primera relectura que lo vio `cancelled`: es la misma
  ventana con que el barrido la sigue releyendo, porque el proveedor puede deshacer esa cancelación
  (`EX-45`). La baja de cuenta espera hasta entonces.

---

### DEC-ARCH-007 — Las dos épicas se desarrollan en paralelo y se liberan juntas; ninguna llega a producción sola

- **Fecha**: 2026-09-18 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C2, `L3-b`; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 3 y 4; ver su 📌 de esa fecha) — **y precisada el 2026-10-01, con OK del owner** (corte del MVP, Y; ver su último 📌) · **Decide**: owner
- **Problema**: `DEC-ARCH-005` partió el programa en dos épicas autónomas, y «autónomas» se puede
  leer de dos formas muy distintas. Una es *«cada una se desarrolla sin esperar a la otra»*; la
  otra es *«cada una puede salir a producción por su cuenta»*. **La decisión era la primera y no la
  segunda**, y no estaba escrito en ningún lado — al punto de que una sesión propuso construir un
  adaptador sobre el billing actual para que verticales pudiera llegar sola, que es trabajo real
  sobre código condenado, apoyado en una premisa que el owner nunca pidió.
- **Alternativas**: (1) cada épica llega a producción cuando está lista; (2) se desarrollan en
  paralelo y se liberan juntas; (3) se libera primero billing y después verticales.
- **Decisión**: **(2)**. La separación existe **para poder trabajar**, no para poder desplegar.
  **Las dos llegan a producción juntas y terminadas.**
- **Y el flujo de ramas lo hace cumplir, en vez de confiar en que alguien se acuerde**:
  1. **Existe una rama de integración del paraguas** — `epic/HOS-1352-verticales-billing` — que
     **nace cuando exista el primer código**, no antes. Los documentos siguen yendo por su rama de
     spec, que sí va a `staging` normalmente: son documentación y no despliegan nada.
  2. **Las sub-épicas cortan de esa rama y mergean a esa rama.** Nunca a `staging` directamente.
  3. **`staging` se mergea HACIA la rama del paraguas, periódicamente y como obligación.** Nunca al
     revés hasta el final. Es lo único que evita que meses de divergencia terminen en un merge
     imposible, y este repo tiene mucho movimiento.
  4. **La revisión ocurre en los PRs de sub-épica → paraguas.** El PR final a `staging` va a ser
     enorme y nadie lo puede revisar de verdad: tiene que ser el merge de algo ya revisado pieza
     por pieza, no el momento de mirar.
  5. **Es una excepción declarada** al flujo de 6 pasos del `CLAUDE.md` del repo, que exige que
     toda rama salga de `staging` y vuelva a `staging`. Declarada acá para que el próximo agente
     que entre no la «corrija».
- **Motivo**: es la misma forma de la **condición A de `DEC-ARCH-004`** — convertir *«no lo hagas»*
  en *«no se puede»*. Con la rama de integración, liberar una épica sola deja de ser una decisión
  que alguien puede tomar mal: **la unidad que llega a `staging` es el paraguas**.
- **Lo que esta decisión NO cambia**: la autonomía de desarrollo. Las dos épicas siguen sin
  esperarse: verticales se construye y se prueba entera con la implementación de arranque del
  contrato (`DEC-ARCH-006`), y billing avanza en todo lo que no dependa de la pasarela.
- **Lo que sí cancela**: **el contrato se queda con DOS implementaciones.** La tercera que se había
  propuesto —un adaptador que leyera el billing actual, para que verticales pudiera ir a producción
  sin la otra épica— **deja de tener objeto**. Era código sobre el sistema viejo, escrito para
  tirarlo, y sólo se justificaba bajo la lectura equivocada de `DEC-ARCH-005`.
- **El riesgo, declarado, y es otro que el que parecía**: no es la coexistencia en producción —no
  la hay— sino **la espera**. Si una épica termina meses antes que la otra, su código espera, y una
  rama que vive meses acumula conflictos con todo lo que entre a `staging` mientras tanto. Lo
  acotan el punto 3 de arriba y la integración continua hacia la rama del paraguas; **cómo se
  integra sin activar** es materia de la FASE 7 de cada épica y no se resuelve acá.
- **Implicaciones**:
  1. **«Terminada» para una épica no significa «en producción»**: significa **lista y verificada
     contra el contrato**, esperando a la otra.
  2. **Las fases 8 y 9 se parten pero no del todo**: cada épica hace la suya, y **hace falta una
     revisión final sobre el conjunto** antes del despliegue.
  3. **La FASE 10 se desarrolla en paralelo y despliega una sola vez.**
  4. Las fases **5, 6 y 7** sí se parten limpio: cada épica hace su gap analysis, su decisión de
     rewrite/reuse y su estrategia.
  5. **La FASE 1C no se parte**: es billing entera, y se va con `HOS-1354`.
- **Origen**: conversación con el owner del 2026-09-18, aclarando el alcance de `DEC-ARCH-005`
  —*«van a llegar sí o sí juntas y terminadas ambas a producción»*— y proponiendo él mismo la rama
  de integración del paraguas.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C2, `L3-b`)**: Cómo se integra
  sin activar: no se activa nada; la épica vive en la rama del paraguas y entra a `staging` al
  final, con `staging` congelado para `main` hasta el corte (`D/16` §4.4).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 3 y 4)**:
  `rollout` queda cerrado: las ramas son el §4.4 de la FASE 7 del paraguas y el orden de despliegue
  el §4.2. El script del corte vive versionado en `scripts/cutover/` y se borra en un commit
  posterior al corte.
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, Y)**: *«juntas y terminadas»*
  quiere decir **el alcance del corte**: las dos épicas llegan juntas a producción con las 22 piezas
  del corte que fija `DEC-ARCH-017`. **Las fases posteriores son del sistema nuevo, aditivas —no
  reescriben filas ni código del corte—, y cada una tiene su propio gate.** La implicación 1
  (*«terminada»* es *«lista y verificada contra el contrato»*) vale pieza por pieza; la
  implicación 3 (*«despliega una sola vez»*) vale para el corte, y cada fase posterior llega por su
  propia rama épica (`DEC-ARCH-017`, AE). Lo demás sigue igual: ninguna épica llega sola, el
  contrato tiene dos implementaciones y no hay convivencia con el sistema viejo
  (`41-corte-del-mvp/00-propuesta.md` §5; `41-corte-del-mvp/10-decisiones-del-owner.md`, Y).

---

### DEC-MIG-002 — Las altas nuevas siguen tomándose en el sistema actual durante el rediseño

- **Fecha**: 2026-09-19 · **Estado**: **SUPERSEDED EN PARTE por `DEC-MIG-003`** (2026-09-19): sobrevive *«se siguen tomando altas en el sistema actual»*; se cae *«se transcriben a mano cuando el rediseño esté listo»* —no se migra nada, y las altas nuevas se llaman como la cartera (`DEC-MIG-004` #16; y desde el 2026-09-25 se tratan como clientes nuevos, `DEC-MIG-005`)—. El puntero se registró el 2026-09-25 (FASE 9 completa, `F-8CB3-013`, `F-8CA3-013`) — **precisada el 2026-09-26, con OK del owner** (FASE 9 vuelta 1, `G4-1`: no hay altas durante la ventana del corte; ver su 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lotes A y B, con el OK del lote E: lo que entre hasta el corte no se conserva salvo que el owner lo sume a la lista, y una sola regla bloquea toda escritura; ver su último 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra A, **contra la recomendación**: si el corte aborta, la regla que bloquea toda escritura sigue puesta hasta el reintento; ver su último 📌) · **Decide**: owner
- **Problema**: el capítulo 21 §3.3 dejó abierto qué pasa con quien se suscriba **mientras dura el
  rediseño**. Es una decisión comercial, no técnica: congelar altas tiene costo de negocio —tres
  verticales todavía no vendieron nada— y no congelarlas agranda la cohorte que después hay que
  transcribir a mano, que es precisamente lo que hoy hace barata a la coordinación manual de
  `DEC-MIG-001`.
- **Las cifras que la sostienen**, medidas el 2026-09-15 y re-verificadas el 2026-09-17 sin un solo
  cambio ([`07-facts-inventory.md`](./07-facts-inventory.md)):

  | | |
  |---|---|
  | pagos registrados en toda la historia del sistema | **0** |
  | suscripciones vivas | **8**, todas mensuales |
  | con compromiso de cobro vivo | **3** |
  | gastronomías · experiencias · partners | **0 · 0 · 0** |

- **Alternativas**: (1) **seguir tomando altas** en el sistema actual; (2) **congelar altas nuevas**
  hasta FASE 10; (3) **coexistencia de dos motores**.
- **Decisión**: **(1)**. Se siguen tomando altas en el sistema actual, y **se transcriben a mano
  cuando el rediseño esté listo**, con el mismo procedimiento del §2.3 que `DEC-MIG-001` fijó para
  las cinco relaciones vivas.

  **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G4-1`;
  `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** Durante la ventana del corte —del paso 0b
  al paso 5 de `16-fase-7-del-paraguas.md` §4.2— **no hay altas**, ni en el sistema viejo ni en
  el nuevo: una regla de Cloudflare cierra las rutas que crean o re-autorizan algo en el
  proveedor. No contradice esta decisión: su alcance es el rediseño, y el corte es su final.
- **Motivo**: el owner declara que **van a ser muy pocas**. Con ese volumen la opción (1) no cuesta
  nada comercialmente, y el trabajo extra que genera es el mismo que ya está aceptado para las cinco
  existentes. La (2) cobra un costo de negocio cierto —cerrar la venta de tres verticales que recién
  arrancan— para ahorrar un trabajo manual que hoy es chico. La (3) es la más cara de construir y
  **contamina la arquitectura nueva**, que es exactamente lo que el §56 pide no hacer.
- **Lo que esta decisión NO afirma**: que la transcripción manual escale. Es barata **porque son
  pocas**, y esa premisa es la que hay que vigilar, no la decisión.
- **El riesgo, declarado**: **la cohorte a transcribir crece mientras dure el rediseño.** Hoy son 5;
  cada alta nueva suma una. **Si el ritmo de altas se acelera hay que volver a mirar esto** — no
  porque la decisión haya sido mala, sino porque habría cambiado la condición que la hacía barata.
  Queda anotado en [`04-open-decisions.md`](./04-open-decisions.md) § *«Para revisar más adelante»*.
- **Implicaciones**:
  1. **El capítulo 21 §3.3 queda cerrado.** Era la única decisión que ese capítulo abría en vez de
     cerrar, y la que remitía a `04-open-decisions.md` sin estar registrada ahí.
  2. **No agrega trabajo de código.** La transcripción usa el procedimiento que `DEC-MIG-001` ya
     definió; lo único que cambia es cuántas filas pasan por él.
  3. **El 2026-09-26 sigue siendo su propia cosa.** El primer cobro de la historia del sistema
     ocurre **bajo el sistema actual** (cap. 21 §3.2 b) y no es materia de esta decisión: es una
     operación que necesita a alguien mirándola el día que pase.
- **Origen**: conversación con el owner del 2026-09-19 —*«van a ser muy pocas, lo manejamos
  manualmente cuando el rediseño esté listo»*—, a partir de la auditoría que encontró que el
  capítulo 21 declaraba esta decisión como registrada y **no lo estaba**.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lotes A y B,
  con el OK del lote E; `38-fase-5/20-simplificacion-del-corte.md` §11, S-03, S-25, S-26 y
  S-72)**: Sigue *«se siguen tomando altas en el sistema actual»* (opción A1), pero lo que entre
  hasta el corte **no se conserva**: la ficha de quien se suscriba en el viejo se borra en el corte
  (J del lote 1 de la FASE 5), salvo que el owner lo sume a la lista cerrada de cuentas que se
  conservan, cada una con su única ficha, que fija él cuando esté listo para el corte; si trae más
  de una ficha, vuelve al owner (`DEC-MIG-007`). Y el 📌 `G4-1` queda precisado por el lote B: no
  es una regla del borde que cierra las rutas que crean o re-autorizan algo en el proveedor, sino
  **una sola regla que bloquea toda escritura** en el sitio viejo y en el nuevo, desde antes de
  cancelar nada (el 0b) hasta abrir el sistema nuevo (el paso 5); sólo queda abierta la entrada de
  avisos de Mercado Pago. Salen la lista de rutas, la espera de 30 minutos y los recuentos
  repetidos.
- 📌 **Precisada otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra A,
  **elegida contra la recomendación**; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 A)**: *«Hasta abrir el sistema nuevo (el
  paso 5)»* vale para un corte que termina. **Si el corte se aborta, la regla que bloquea toda
  escritura queda puesta hasta el reintento**: la plataforma entera, las cinco cuentas incluidas,
  queda en sólo lectura mientras tanto. La recomendada era la 3: levantar la regla general y, hasta
  el reintento, bloquear sólo las rutas de venta del viejo (checkout, reintento, cambio de plan,
  cambio de medio de pago, compra de complemento). El owner eligió la 1, sin lista de rutas, y se
  acepta que, si el reintento tarda días, la plataforma quede en sólo lectura ese tiempo (FASE 5,
  lote de la aplicación, owner 2026-09-30, A; ver los 📌 de `DEC-MIG-003` y `DEC-MIG-005`).

---

### DEC-CI-001 — `epic/**` es un tipo de rama del proyecto, y no todos los workflows corren ahí

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED — **precisada el 2026-09-30, con OK del owner** (FASES 6 y 7, lote de la aplicación, M: su implicación 1 la contesta `DEC-ARCH-016`; ver su 📌) — **y precisada otra vez el 2026-10-01, con OK del owner** (congelamiento y CI del paraguas, letra P: la condición de C-4 queda corregida; ver su último 📌) · **Decide**: owner
- **Problema**: `DEC-ARCH-007` manda que las sub-épicas corten de `epic/HOS-1352-verticales-billing`
  y mergeen **a esa rama**, y que la revisión ocurra en esos PRs. Medido el 2026-09-19 sobre el
  worktree: de los **15** workflows del repo, **ninguno nombra `epic` ni un patrón `**`**, y
  `ci.yml` corre en `pull_request` sólo hacia `main` y `staging`. Un PR de sub-épica al paraguas
  entraría **sin lint, sin typecheck, sin tests y sin los guards**, y **el único camino con CI
  completa es el que la decisión prohíbe** (`F-8C2-003`). La regla estaba escrita cuatro veces en
  las specs y **cero veces en el repo**.
- **Alternativas**: (1) una excepción temporal mientras dure el programa; (2) un patrón acotado a
  `epic/HOS-1352-*`; (3) **`epic/**` como tipo de rama de primera clase del proyecto**, con reparto
  explícito de qué workflow corre ahí y qué no.
- **Decisión**: **(3)**.
- **Motivo de descartar (1) y (2)**: una excepción temporal en diez archivos que nadie va a
  recordar retirar **es deuda garantizada**; y un patrón atado a esta épica obliga a volver a tocar
  los mismos archivos en la próxima, que es **la misma forma del defecto que la FASE 8 encontró**
  —una regla escrita para el caso que la motivó.
- **El criterio del reparto**: el riesgo no es que corran ramas `epic/` ajenas —que una épica
  futura reciba lint y tests es deseable— sino que corra **lo caro** y, sobre todo, **lo que tiene
  efectos afuera del repo**.
- **El reparto, workflow por workflow**: corren en `epic/**` **`ci.yml`, `validate-pr-title.yml`,
  `validate-docs.yml` y `codeql.yml`**; `docs.yml` ya corre porque no filtra por rama. **No
  corren**: `e2e-pr.yml` (caro por PR — va por `workflow_dispatch` y **obligatorio antes del PR
  final a `staging`**), `lighthouse.yml` y `a11y-sweep.yml` (miden páginas desplegadas y el
  paraguas no despliega), `whats-new-gate.yml` (es de `main` por diseño) y **`smoke-gate-sync.yml`**.
- **`smoke-gate-sync.yml` es el punto de riesgo y por eso queda afuera con nombre propio**: mueve
  issues de Linear al mergear. Corriendo en los PRs de sub-épica —que llevan `[HOS-NNNN]` en el
  título porque `validate-pr-title` lo exige— **cerraría las 22 unidades del programa como hechas
  sin nada desplegado**. Es el footgun que el `CLAUDE.md` documenta con **dos incidentes reales**
  (PR #1982 → `HOS-36`, PR #1983 → `HOS-54`, ambos revertidos a mano).
- **El barrido profundo también** (agregado el 2026-09-19, `D-29`): `codeql-staging.yml` pina
  `ref: staging`, así que una rama de paraguas acumularía **meses de código nuevo sin barrido
  profundo**, cubierta sólo por semgrep **por diff** — que mira el cambio y no el conjunto, y por lo
  tanto **no ve lo que emerge de la combinación** de cambios que individualmente pasaron. Vale para
  **toda** rama de integración de épica, no sólo la primera.
- **Las dos mitades de `ci.yml` hacen falta**: `pull_request` cubre `F-8C2-003`; **`push` cubre
  `F-8C2-004`**, porque el merge periódico de `staging` hacia el paraguas **no es un PR** y ningún
  disparador de `pull_request` lo alcanza.
- **Implicaciones**:
  1. **No está aplicado.** Son archivos del repo y el §65 reserva el código productivo para la
     FASE 10; la aplicación la decide el owner. El detalle por archivo está en
     [`15-fase-9/01-R6-resuelto.md`](./15-fase-9/01-R6-resuelto.md) §7.3.
  2. **La ventana está abierta**: `git ls-remote --heads origin 'epic/*'` devuelve **cero** al
     2026-09-19. Mientras el paraguas no exista, aplicarlo no obliga a migrar nada.
  3. **Aplicar esto hace que `G8` falle en el primer PR del programa** en vez de no correr nunca.
     Es lo deseable, y es lo que vuelve **no independientes** esta decisión y la de abrir el gate
     de `DEC-METH-003`.
  4. La regla vive en el `CLAUDE.md` del repo, junto a las de `main` y `staging`, **no sólo acá**.
- **Origen**: conversación con el owner del 2026-09-19 —*«tampoco quiero que más adelante corran
  ramas epic que no tienen nada que ver, o lo hacemos temporal o lo definimos bien como regla del
  proyecto»*—, sobre el recorrido de R6.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, lote de la aplicación, M;
  `39-fases-6-y-7/10-decisiones-del-owner.md`)**: la implicación 1 (*«No está aplicado… la
  aplicación la decide el owner»*) está contestada por `DEC-ARCH-016`, letra A: los cambios `C-1` a
  `C-8` y el guard de destino `check-umbrella-branch-target.sh` entran **en un PR propio a
  `staging`, titulado `[NOSPEC:epic-ci]` y sin `HOS-1352`, antes de crear
  `epic/HOS-1352-verticales-billing`**, así que la rama nace con el CI encendido y el PR de `U1` es
  el primero que corre CI completo. El reparto de workflows no cambia. Dónde:
  `16-fase-7-del-paraguas.md` §4.6 y §4.7. Origen: (FASES 6 y 7, lote de la aplicación, owner 2026-09-30, M).
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (congelamiento y CI del paraguas, letras P
  y Q; `40-congelamiento-y-ci/10-decisiones-del-owner.md`)**: el snippet original del guard de
  destino `check-umbrella-branch-target.sh` (`15-fase-9/01-R6-resuelto.md` §1, «la punta del
  paraguas es ancestro de HEAD») tenía tres fallas —ponía en rojo todos los PRs a `staging` el día
  que nace la rama épica, bloqueaba el PR final del propio paraguas y dejaba pasar una rama de
  unidad cortada de un commit viejo de la épica—, y **se acepta la condición corregida** (P): **falla
  si HEAD trae algún commit de la rama épica que el destino todavía no tiene**; el PR cuya head es
  la rama épica queda exento; si la rama épica no existe en el remoto, sale 0; si no puede consultar
  el remoto, falla. Implementada en el PR #3436 (`scripts/check-umbrella-branch-target.sh`, con 12
  tests), CI verde y sin mergear al 2026-10-01. Y **la rama `epic/HOS-1352-verticales-billing` se
  borra apenas se mergea a `staging`** (Q): si no se borra, el guard bloquea la promoción
  `staging → main`, porque esa promoción trae los commits de la épica que `main` todavía no tiene.
  Dónde: `16-fase-7-del-paraguas.md` §4.4 y §4.7. **Y el mismo día, con OK del owner (T)**: la
  condición de P también bloqueaba **toda** promoción `staging → main` mientras la rama épica
  existe, no sólo la del final, porque la épica comparte con `staging` los commits que recibe de él
  (medido al promover el PR #3447: hubo que borrar la rama épica recién creada). **El guard cuenta
  sólo los commits propios de la épica**: falla si HEAD trae algún commit de la rama épica que no
  está ni en el destino ni en `staging`. Q sigue valiendo para el PR final del paraguas. PR
  `[NOSPEC:epic-guard-promotion]`.

---

### DEC-CI-002 — `develop` no se toca: es una condición adelantada, no un filtro muerto

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: midiendo R6 se encontró que `validate-docs.yml` filtra por `[main, develop]` y que
  **`develop` no existe en el remoto** (`git ls-remote --heads origin develop` → cero, 2026-09-19).
  Se propuso limpiarlo como filtro muerto.
- **Decisión**: **no se toca**, y **la razón vuelve falso el diagnóstico**: no es descuido, es una
  condición **adelantada** a una rama que el owner sí quiere tener. Le hizo falta hace semanas,
  para trabajo que todavía no debía llegar a `staging`.
- **Por qué no ahora y no acá**: crearla de verdad obliga a tocar **workflows, reglas de rama e
  instrucciones de los agentes** — es trabajo propio, no un renglón. Lo toma otra persona, en otro
  momento.
- **Implicación**: queda **anotado como pendiente de diseño**, no como limpieza. Quien agregue
  `epic/**` a `validate-docs.yml` (`C-7`) **no debe aprovechar para sacar `develop`**.
- **Origen**: conversación con el owner del 2026-09-19.

---

### DEC-METH-005 — Los guards nuevos salen de lo que la épica pide, y corren desde el día 1

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el repo tiene **45 guards** —scripts que fallan el build a propósito cuando
  encuentran algo prohibido— y son la defensa real contra el modo de falla que este programa viene
  a corregir. El caso que lo prueba es `HOS-1079`: **once sitios en `apps/api` decidían una
  vertical con un ternario binario** (`x === 'gastronomy' ? A : B`) y respondían mal para
  `accommodation` y `partner`; **ninguno se detectó en runtime**, los cazó un guard estático. Pero
  el rediseño **borra el sujeto de varios de esos guards**, así que la defensa que más hace falta
  está programada para morir en medio de la épica (`F-8C2-008`).
- **Alternativas**: (1) exigir que los `G1`…`G13` del diseño nuevo **cubran lo que cubren los
  guards condenados**, con mapeo uno a uno; (2) **los viejos quedan como están y se eliminan a
  medida que se pueda; los nuevos salen de lo que la épica pide, más lo que valga la pena rescatar
  de los viejos, y corren desde el día 1 de implementación**.
- **Decisión**: **(2)**.
- **Motivo de descartar (1)**, y son dos, el segundo medido: **ata el diseño nuevo al vocabulario
  viejo** —obliga a preguntar cómo se expresa `product_domain` en el modelo nuevo cuando esa
  pregunta puede no tener sentido—, que es exactamente lo que el **§0 del PDR prohíbe**. Y el
  inventario de [`15-fase-9/04-inventario-de-guards.md`](./15-fase-9/04-inventario-de-guards.md)
  mostró que **ni siquiera es cierto que mueran todos**: de los 45, **7 `MUERE`, 6 `REVISAR`, 32
  `SOBREVIVE`**, y de los diez que vigilan la separación por vertical **mueren cinco**. Un mapeo
  uno a uno habría obligado a traducir cosas que no desaparecen.
- **Por qué «desde el día 1» es la parte que importa**: la función de estos guards **no es
  documentar el diseño, es impedir que una implementación se salga de él**. Un guard que llega
  después certifica lo que ya se hizo; no protege. Es la misma forma que `DEC-ARCH-004` ya le dio a
  sus dos condiciones —el guard contra importar el SDK fuera del adaptador, y el adaptador falso
  «desde el día uno»—, generalizada a todo el programa.
- **Cómo se vuelve verificable** (el agregado aprobado en la misma conversación): **cada unidad de
  trabajo declara qué guard entrega, y ese guard es parte de su definición de terminado.** No son
  una unidad aparte al final. Así «desde el día 1» se comprueba solo: si la unidad está terminada,
  su guard existe y corre.
- **Tres datos medidos que hoy lo impiden, y hay que resolver antes**:
  1. **Los `G1`…`G13` tienen CERO implementados.**
  2. **`G12` y `G13` no están en ningún capítulo `20`**: nacieron sueltos en las descomposiciones.
  3. **Estar en `pnpm check:guards` NO hace que un guard corra en CI** — necesita su **paso propio**
     en el job `guards`. Sin esto se escriben trece guards que no se ejecutan y nadie se entera.
- **Qué pasa con los viejos**: **no se tocan ahora.** Se eliminan a medida que su sujeto
  desaparezca, y eso lo deciden las FASES 5 y 6, no esta decisión.
- **Y el inventario cambia de uso**: deja de ser una lista de borrado y pasa a ser dos cosas — el
  aviso de **qué se va a poner rojo y por qué no es un bug**, y una **cantera de ideas** para los
  guards nuevos.
- **Implicación sobre el alcance**: enumerar los guards que cada unidad entrega es **editar las dos
  `descomposicion.md`**, o sea la **salida 3 de `DEC-METH-004`**, que va al final de la FASE 9.
  Queda anotado ahí, no se ejecuta acá.
- **Origen**: conversación con el owner del 2026-09-19 —*«esos que queden como están, y los vamos
  eliminando a medida que podamos, y que desde el inicio tengamos los guards nuevos … corran desde
  el día 1 de implementación de esta épica. eso nos protege que ningún agente le erre en
  implementación y haga algo por fuera de lo que estamos buscando»*.

---

### DEC-GRANT-005 — Un grant permanente se ancla al PLAN, lee su versión vigente, y lleva trinquete

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: un grant permanente cruza la frontera, la persona queda «cubierta», y cuando el
  paso 6 pregunta **qué capacidades le da, no hay respuesta**. El contrato transportaba un solo
  campo de contenido (`versiónDePlan`) y un grant **no apuntaba a ningún plan**: *Free Forever* era
  un nombre comercial **sin contenido definido**. Lo encontraron **tres agentes de las dos épicas
  por separado**, que es lo que lo volvió la causa de su racimo.
- **Alternativas**: (1) anclar a una **versión fija**; (2) **anclar al plan y leer su versión
  vigente**; (3) que el grant **declare su propio juego de claves**.
- **Decisión**: **(2)**, con dos precisiones que la completan: se lee la vigente **sea vendible o
  no**, y con un **trinquete** — *un grant nunca otorga menos de lo que otorgaba el día que se
  concedió.*
- **Por qué no la (1)**: era la recomendación original y el owner la mejoró. Anclado a una versión
  fija, el beneficiario **no recibe ninguna mejora del plan**, para siempre. Y el modo híbrido no
  inventa nada: `V/02` §2.1 ya tiene **los dos modos escritos** —*«la pricing lee la versión
  vigente y sólo si es vendible; una suscripción lee su versión anclada, vigente o no, vendible o
  no»*—, así que seguir la vigente no agrega un tercer modo.
- **Por qué «vendible o no» y no como la pricing**: porque **retirar un plan se hace publicando una
  versión no vendible** (`D13`, cap. 10 §3.2). Leyendo *«sólo si es vendible»*, el día que se
  retira el plan Premium **todos los `Free Forever` anclados a él se quedan sin nada**.
- **Por qué el trinquete**: seguir la vigente expone al beneficiario a que el plan **empeore** —una
  versión que reparte distinto le saca algo a quien tiene un «para siempre», **sin que nadie lo
  haya decidido para esa persona**—. El instrumento no es nuevo: es el piso de `V/15` §2.5.
- **Por qué no la (3)**: sería **una segunda forma de declarar entitlements**, que ~~`V/02` §1.2~~ `NUCLEO/02` §1.2
  *(referencia corregida el 2026-09-25: `V/02` no tiene §1.2)* prohíbe, y obligaría a mantener dos catálogos en sincronía para siempre. Es el defecto que este
  programa entero viene a corregir.
- **La objeción que había que contestar, y se contesta con reglas que ya existen**: que un grant
  apunte a una versión de plan choca con `NUCLEO/01` §1.5 —*«se modela como entidad independiente,
  no como un plan»*—. **Anclar no es ser**: una suscripción ancla una versión y no es un plan. Y el
  retiro ya estaba resuelto por `D13`.
- **Implicaciones**: `permanent_grant` gana **`plan_id`** (no anulable) y el **piso del trinquete**,
  guardado como **referencia a la versión**, nunca como copia de valores. `UNIQUE(plan_id) WHERE
  vigente` es lo que garantiza que *«la vigente»* sea unívoca y siempre exista.
- **Beneficio operativo**: regalar algo pasa a ser **elegir un plan concreto**, y queda auditado.
- **Riesgo declarado**: que alguien lea el anclaje como *«el grant es un plan»*.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-05`, sobre el racimo `R2`.

---

### DEC-CONC-003 — `RECONCILIATION_REQUIRED` deja de ser un estado y pasa a ser una MARCA

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el estado quedaba **fuera de los «vivos»** del candado del §11, y esa exclusión
  estaba escrita **con su razón**, en `B/02` §2.2: *«si una suscripción necesita intervención
  humana, la persona tiene que poder contratar de nuevo sin esperar a que alguien resuelva un
  caso»*. **La intención era buena; lo que produjo, no.** Al no verlo el candado se abrieron **dos
  críticos a la vez**: el preapproval sigue vivo y habilita una segunda suscripción —**dos
  cobros**, y está medido que el proveedor no frena la segunda— y **un estado del que no se sale**,
  sin destino legal una vez que el cliente recontrató.
- **La causa de fondo**: escribir `RECONCILIATION_REQUIRED` **en la columna de estado borra el
  estado real**. Eso obliga a `S15` a **adivinar a dónde volver** y **convierte una alerta en una
  decisión destructiva automática** —convertir una `ACTIVE` en `RECONCILIATION_REQUIRED` lo es,
  textualmente—, que es lo que el §22.1 prohíbe.
- **Alternativas**: (1) **marca booleana** sobre la fila, que conserva su estado; (2) dejarlo como
  estado y **meterlo** en los vivos.
- **Decisión**: **(1)**.
- **Por qué la marca cumple mejor la intención original que la exclusión que la escribió**: la
  razón era *«que la persona no espere a que alguien resuelva un caso»*. Con la marca **no espera
  nada: su suscripción sigue en su estado real y funcionando**. La marca es para el operador, no
  para el cliente. La (2) cierra el doble cobro pero **le cobra al cliente la espera**, que es
  exactamente lo que la razón quería evitar.
- **Implicaciones**: `S14` deja de ser una transición —pone la marca y emite el §22.1— y `S15`
  también —la levanta, y si además corresponde un cambio de estado se ejecuta **la transición de la
  tabla que lo permita**—. Una fila marcada **ocupa** el candado en vez de liberarlo, que es la
  única dirección en que esto **endurece** la restricción. Y una fila marcada **no puede declarar
  una sucesión**, salvo desde `CANCEL_SCHEDULED` (ver `DEC-SUB-011`).
- **⚠️ Revisa una razón registrada del owner**, y por eso lleva `DEC-` propia en vez de aplicarse
  como corrección: la frase de `B/02` §2.2 era deliberada.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-11` y `D-12`, sobre el racimo `R1`.

---

### DEC-SUB-011 — El invariante 8 del §64 cuenta COMPROMISOS, no FILAS

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **⚠️ Apartamiento declarado del PDR** (§11 y §64.8).
- **Problema**: el §11 dice *«máximo una suscripción principal por `user + vertical`»* y el candado
  lo hacía cumplir con **una sola clave** sobre un conjunto de estados. Pero esa clave estaba
  haciendo cumplir **dos invariantes distintos a la vez** —*«un compromiso comercial por
  vertical»* y *«una autorización de cobro por vertical»*—, con el conjunto de estados como proxy
  de los dos. Por eso fallaba **en las dos direcciones**: lo que incluía de más bloqueaba un
  compromiso que todavía no existe, y lo que excluía de más liberaba una autorización que sigue
  viva. Y `DEC-SUB-006` implicación 1 **exige** la convivencia: *«la suscripción vieja se cancela al
  recibir el webhook de autorizada, NUNCA antes»*.
- **Decisión**, y la redacción es la decisión:
  > **El invariante 8 del §64 cuenta COMPROMISOS, no FILAS.**
- **Por qué esa formulación y no *«ahora puede haber dos suscripciones»***: porque **conserva la
  política del PDR intacta** y explica por qué dos filas no la violan. Con la sucesión, el máximo
  de filas vivas pasa a dos durante la ventana del cambio de plan, pero **sigue habiendo un solo
  compromiso de pago**. Lo que deja de ser literal es el enunciado **sobre las filas**.
- **Implicaciones**: `subscription` gana **`sucede_a`** y el `UNIQUE` se parte en **dos índices
  parciales** sobre las mismas columnas y el mismo conjunto de estados, uno para el origen y otro
  para la sucesora. **Dos, exactamente**: un origen y su única sucesora. Al indexar el segundo sobre
  `(user_id, vertical)` —y no sobre `sucede_a`— **una sucesora no puede ser sucedida** sin ninguna
  regla extra. Nuevo invariante `D15` en `NUCLEO/04` §3, y dos guards, `G-R1-A` y `G-R1-B`.
- **Por qué hay que declararlo** en vez de simplemente aplicarlo: el PDR **no se edita** (regla 1),
  y el riesgo de no declararlo es concreto — **alguien lee el §64, ve *«máximo una»* y «arregla» el
  candado de vuelta**, deshaciendo todo esto sin saber que lo está haciendo, y con toda la razón
  desde su punto de vista. Hay cuatro precedentes exactos: `DEC-ARCH-003`, `DEC-OBS-001`,
  `DEC-METH-004` y `DEC-METH-005`.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-13`, sobre el racimo `R1`.

---

### DEC-MIG-003 — No se migra: las ocho filas se cancelan y quien tenga algo vivo se suscribe de nuevo

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED — **el orden del corte, precisado el 2026-09-24**
  (FASE 8 completa, racimo `R2`; ver el punto *«El orden del corte»* abajo), **y el corte entero,
  precisado el 2026-09-25** (FASE 9 completa: el gate de completitud, el backup, sólo hacia
  adelante, la re-vinculación y el corte sin siembra; ver el segundo 📌 de ese punto y
  `DEC-MIG-005`), **y la rama de aborto y el corte, precisados otra vez el 2026-09-27, con OK del
  owner** (FASE 9 vuelta 2, `R3-G4-1` y `R9-b`: la URL de notificación, el paso 4b, el 4c y el
  recuento de fichas; ver el tercer 📌 de ese punto), **y el paso 4c, precisado el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-t`: la página de cada destino; ver su cuarto 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote O-B: la ruta de avisos cerrada en el borde y el 4b que sólo verifica; ver su último 📌); **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote P-A: el Worker del borde que contesta `500`; ver su antepenúltimo 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote 3, letras E y F: el paso 3 en tres actos y los crons apagados hasta el paso 5; ver su penúltimo 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lotes B, C y D, con el OK del lote E: salen las lápidas del corte, el Worker, el recuento de Gastronomía y Experiencia y la condición de caducidad, y abortar es restaurar sin reabrir la venta; ver su último 📌); **y precisada una vez más el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letras A, C y D; A **contra la recomendación**: el aborto deja la regla puesta hasta el reintento, el aviso sin servidor se acepta y la migración copia a una tabla de paso lo que el 5b borra; ver su penúltimo 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, segunda tanda, P: la tabla de paso vive sólo en el SQL de la migración del paso 3; ver su último 📌) · **Decide**: owner
- **⚠️ Supersede en parte a `DEC-MIG-001`**, que definía qué hacer con la cartera existente.
- **Problema**: se estaba diseñando la migración de la cartera actual —orden forzado, punto de no
  retorno por fila, y la aceptación de que el rollback no existe pasado cierto paso—, y **nadie
  sabía de quién eran las ocho filas**.
- **El dato que lo decide lo aportó el owner y no estaba en ningún documento**: **las 2 `comp` son
  suyas** —sin ningún cliente real detrás— y **las 3 `trialing` son clientes, pero amigos a los que
  puede llamar para que se resuscriban**. Las otras 3 son `abandoned`: **no tienen nada vivo**.
- **Decisión**: **se arranca de cero. El sistema nuevo no hereda una sola fila.** Las dos cortesías
  se escriben como `permanent_grant` —exactamente como el *Free Forever* del diseño nuevo, sin nada
  especial— y **se pueden regenerar**.
- **Qué se pierde, medido**: **nada de plata** —no hay **un solo pago histórico**, ningún
  comprobante, ninguna serie que reconstruir— y el *«trial ya consumido»* de **seis personas
  conocidas**, de las cuales tres ya habían abandonado el checkout igual.
- **El argumento, y no es de pereza**: se estaba construyendo una migración para **ocho filas sin un
  solo pago, todas de gente a la que se puede llamar**. Diseñarla, revisarla, ejecutarla y
  garantizar su rollback es **desproporcionado frente a un mensaje**. Y el beneficio extra es real:
  el sistema nuevo arranca **sin una sola fila heredada** — sin transcripciones, sin estados viejos,
  sin dudas sobre si algo quedó mal migrado. Es el escenario más limpio posible, y **sólo está
  disponible ahora**, mientras son ocho.
- **Qué deja sin objeto**: cuatro de los cinco problemas críticos de la migración **no se resuelven,
  se eliminan** —dejaba afuera las relaciones con trial, transcribía el trial dejando los
  compromisos sin vínculo, tenía un punto de no retorno sin lado elegido, y describía dos
  operaciones distintas en dos lugares—, más el hecho de que **nadie la ejecutaba**. La unidad de
  trabajo que iba a escribirla **no se crea**.
- **Lo único que sobrevive**: el **rollback del PROGRAMA**, que es otra cosa y vive en la FASE 7 del
  paraguas (ver `16-fase-7-del-paraguas.md`).
- **⚠️ Precisado el 2026-09-20, tras la FASE 8-bis.** La frase *«el sistema nuevo no hereda una sola
  fila»* quedó **literalmente falsa en un punto**, y conviene la precisión exacta:
  > **Ninguna fila VIVA del sistema viejo pasa al nuevo.** La única que se escribe es una lápida:
  > el compromiso cancelado, en `CANCELLED` y con su vínculo al proveedor (`B/21` §2.5).
  **Sin ella, un cobro viejo que llega después del corte entra como un preapproval desconocido**, y
  el único camino automático para un desconocido es re-vincularlo — con la suscripción nueva de esa
  misma persona como candidato más plausible. **Pagaba dos veces y el sistema registraba una.** La
  regla estaba escrita desde `R5` y **se la llevó puesta esta misma decisión**, aunque no migra
  nada: sólo conserva el rastro de lo que se cancela.
- **Y cómo amanece la población existente, que esta decisión no había contestado.** Sin filas, todo
  el mundo queda en `PRE_TRIAL`; como un reloj que no arrancó no da cobertura, **las fichas
  publicadas de Alojamiento se despublican la mañana del corte**. **Se acepta**: se avisa antes, se
  los llama, contratan, y la ficha vuelve sola. **No se les siembra nada** — hay que llamarlos
  igual, así que una siembra no ahorra ninguna conversación y sí agrega filas.
- **El orden del corte queda declarado** en `16-fase-7-del-paraguas.md` §4: cancelar en el
  proveedor, **verificar releyendo por id**, desplegar, y recién entonces escribir las lápidas. El
  segundo paso es el gate: si alguno no se pudo cancelar, el corte no avanza.
  - **📌 Precisado el 2026-09-24, con OK del owner** (FASE 8 completa, racimo `R2`: `F-8CB3-001`,
    `F-8CC2-001`, `F-8CC2-002`, `F-8CC2-004`). **El orden de base no cambia.** Gana tres cosas:
    (1) un **paso 0**, el despliegue ensayado en staging y verde antes de cancelar nada; (2) un
    **paso 1a**, cancelar los `preapproval_plan` viejos, que es reversible (`EX-40`); (3) **el
    censo del paso 1 sale del recorrido sin filtro del proveedor**, no de nuestra base. Ese
    recorrido encontró ese mismo día una autorización viva que la base no conocía. Y queda
    declarada una **rama de aborto** si el despliegue falla: el costo, aceptado, es que los
    clientes cancelados se re-suscriben sin trial, y **qué se hace con esa diferencia no está
    decidido**. Detalle en `16-fase-7-del-paraguas.md` §4.2.
  - **📌 Precisado el 2026-09-25, con OK del owner** (FASE 9 completa, decisiones 2b, 2c, 2e, 2f y
    2g de `26-fase-9-completa/10`; `02-…` `AO-2`, `AO-3`, `AO-5`, `AO-6`, `CT-4`; `09-…` `C-7`).
    **El orden de base sigue sin cambiar.** Cambian cinco cosas:
    1. **El gate del paso 2 exige completitud** (2f): el conteo del recorrido sin filtro tiene que
       igualar el `total` de su paginado, y **todo id conocido** —los de nuestra base y los de los
       manifiestos de sonda— tiene que aparecer en él; si no, el corte no avanza. La premisa *«el
       recorrido sin filtro es completo»* **no está medida** (`RC-1` mide que los filtros mienten, no
       el recorrido), y este control hace que el corte no dependa de ella.
    2. **La rama de aborto restaura un backup** (2e): se toma antes de la migración del paso 3 y, si
       el corte aborta con la migración ya aplicada, se restaura. Lo que el sistema viejo anote en esa
       ventana se pierde, y por `DEC-MIG-005` no cuesta nada.
    3. **Pasado el paso 3 no hay vuelta atrás al sistema viejo** (2c): sólo arreglo hacia adelante
       —*«no va a pasar»*—. *«Lo único que sobrevive: el rollback del PROGRAMA»* (arriba) queda
       acotado a lo que ocurra **antes** del paso 3.
    4. **Un desconocido ya no se re-vincula con «el candidato más plausible»** (2b): sólo si su
       `external_reference` nombra una fila nuestra sin otro vínculo vivo; todo otro desconocido abre
       marca (`DEC-CONC-002`, su segundo 📌). La precisión del 2026-09-20 de arriba —*«el único camino
       automático para un desconocido es re-vincularlo — con la suscripción nueva de esa misma
       persona como candidato más plausible»*— **deja de describir el diseño**. La lápida sigue
       haciendo falta, para reconocer el cobro viejo como tal.
    5. **El corte no siembra trials consumidos ni lee el sistema viejo** (2g, `DEC-MIG-005`). Lo que
       escribe sigue siendo: las lápidas (paso 4), los dos `permanent_grant` y `inactiva_desde` =
       instante del corte en toda ficha preexistente. De la cartera vieja se conservan el usuario,
       sus preferencias y sus fichas; su billing arranca de cero (`DEC-MIG-005`).

    **Y tres frases de arriba, releídas el 2026-09-25**: *«**nada de plata** —no hay un solo pago
    histórico»* **caduca el 2026-09-26**, cuando cobra `ed00a8fd` bajo el sistema viejo, y esos pagos
    **no se conservan** (`DEC-MIG-005`). El *«trial ya consumido de seis personas»* **deja de ser una
    pérdida y pasa a ser lo decidido**: a toda la cartera vieja se le regala el trial; la cuenta de
    seis, que `F-8CA3-012` mostró tomada sobre un subconjunto, ya no decide nada. Y *«las fichas
    publicadas de Alojamiento se despublican la mañana del corte»* **tiene el mecanismo
    equivocado**: el corte no es un cambio de `cubierto`, así que `PB2` no dispara por evento; las
    baja **la primera corrida del reconciliador diario** (`DEC-ARCH-009`), dentro del primer día. El
    desenlace que se aceptó es el mismo. La entrada no se edita en su contenido.
  - 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R3-G4-1` y `R9-b`;
    `F-8V2A3-002`, `F-8V2C1-001`, `F-8V2B3-003`, `F-8V2A3-003`, `F-8V2C2-006`)**:

    - La rama de aborto devuelve la URL de notificación a la ruta del viejo y la verifica con
      una entrega real.
    - El borrado del contenido de las `L1` pasa al paso 5b, después de abrir altas, porque el
      backup no restaura fotos ni tokens.
    - El apuntado de la URL es el paso 4b, después de las lápidas. El paso 3, que es hasta donde
      cubre la rama de aborto, termina con el paso 4 y el 4b verificados y su sonda cancelada
      (el owner confirmó que la frontera de `G4-1` los incluye). El punto de no retorno no se
      mueve.
    - El recuento de fichas de Gastronomía y de Experiencia se hace antes del 1a, y el corte no
      arranca si da una fila; el gate del paso 2 lo repite como segundo control, y si ahí da una
      fila el corte entra en la rama de aborto (`V/21` §2.4).
    - El paso 4c, después del 4b y fuera de la rama, revalida las páginas públicas de las fichas
      que nacieron despublicadas.
  - 📌 **Precisado el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-t`)**: el paso
    4c revalida también la página de cada destino, que lista sus alojamientos y el código invalida
    por su destino: una purga por destino, 22, que cuentan para el tope del borde.
  - 📌 **Precisado el 2026-09-29, con OK del owner (verificación corta, lote O-B)**: el paso 4b ya
    no apunta ninguna URL. El receptor nuevo sirve la misma ruta que el viejo,
    `/api/v1/webhooks/mercadopago`, para los dos canales; el borde la cierra antes de apagar el
    contenedor viejo en el paso 3 y la abre al final del paso 4, con las lápidas verificadas;
    mientras está cerrada, el proveedor recibe error y reintenta a la misma URL. El 4b verifica con
    la sonda de Webhooks y el pago chico de IPN. La rama de aborto ya no devuelve ninguna URL: vuelve
    a cerrar la ruta si hace falta, redespliega la imagen vieja y la abre verificada con una entrega
    real; y devuelve el pago chico si quedó sin devolver. El punto de no retorno no se mueve.
  - 📌 **Precisado el 2026-09-29, con OK del owner (verificación corta, lote P-A)**: la ruta de
    avisos la cierra un Worker del borde que contesta `500` a todo pedido, con una cabecera propia,
    y no una regla de bloqueo, que contesta un `4xx` cuyo reintento no está medido. Se le asigna la
    ruta antes de apagar el contenedor viejo y se le quita al final del paso 4, las dos veces
    verificado desde afuera; en la rama de aborto, cerrar y abrir la ruta son lo mismo. Vive
    versionado con el script del corte y se archiva con él; lo deja listo el ensayo del paso 0 en
    `staging`, que mide también cuánto dura el cierre.
  - 📌 **Precisado el 2026-09-30, con OK del owner (FASE 5, lote 3, letras E y F;
    `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-20` y `R5-21`)**: el paso 3 se escribe como
    tres actos: apagar el sistema viejo, `hops db-migrate --pull` sobre el mismo commit que la
    imagen, y levantar la imagen nueva; se exige la igualdad de commit (F). La imagen nueva se
    despliega con `HOSPEDA_CRON_ADAPTER` apagado y los crons se prenden al confirmar el corte, en
    el paso 5; se acepta que los del resto de la plataforma paren esas horas (E).
  - 📌 **Precisado el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lotes B, C y
    D, con el OK del lote E; `38-fase-5/20-simplificacion-del-corte.md` §11)**: siguen *no se
    migra*, el orden, el backup, *sólo hacia adelante* y la completitud del paso 2 (S-31, S-32).
    Salen: la precisión del 2026-09-20 (*«la única que se escribe es una lápida»*) y las lápidas
    del paso 4 que nombran el 📌 del 2026-09-25 (punto 5) y el de O-B: el corte ya no escribe
    lápidas, y un cobro tardío de un débito viejo entra por la lápida de recepción como cualquier
    desconocido (lote C; S-40, `DEC-CONC-002`); el 📌 del 2026-09-29, lote P-A (el Worker), y con
    él el cierre y la apertura de la ruta de avisos del de O-B: la ruta queda abierta durante todo
    el corte, como única excepción de la regla del 0b (lotes B y C; S-24, S-45); el recuento de
    fichas de Gastronomía y de Experiencia del 📌 del 2026-09-27 (S-07); y la ⚠️ condición de
    caducidad de abajo, con su umbral de unas veinte personas (S-56). La rama de aborto del 📌 del
    2026-09-24 pasa a ser restaurar el backup y volver a la imagen vieja, sin reactivar los planes
    ni reabrir la venta: las cinco cuentas esperan el reintento y el owner les avisa (lote D;
    S-15, S-16). Y el borrado del 5b del 📌 del 2026-09-27 ya no es el contenido de las `L1`: son
    las fotos y los tokens de calendario de toda ficha que no es de las cinco de la lista, cuyas
    filas borra la migración del paso 3 (J del lote 1 de la FASE 5; S-02, S-04).
  - 📌 **Precisado una vez más el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación,
    letras A, C y D; A **elegida contra la recomendación**; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5)**: la rama de
    aborto restaura el backup y vuelve a la imagen vieja **con la regla que bloquea toda escritura
    puesta hasta el reintento**: la plataforma entera, las cinco cuentas incluidas, queda en sólo
    lectura mientras tanto (A; la recomendada era bloquear hasta el reintento sólo las rutas de
    venta del viejo; ver el 📌 de `DEC-MIG-002`). Un aviso de Mercado Pago que llegue entre apagar lo
    viejo y levantar lo nuevo, sin servidor que lo atienda, **se declara y se acepta**: son minutos
    y tres cuentas con débito que el owner conoce (C; `DEC-MIG-007`, puntos 3 y 4). Y el 5b ya no
    depende de filas que la migración borró: **antes de borrar las fichas que no son de las cinco,
    la migración del paso 3 copia a una tabla de paso el id de cada una, las rutas de sus fotos y
    su token de calendario**; el 5b la recorre y la borra al terminar. El backup la incluye, así
    que un aborto la restaura con las fichas, y el token no sale de la base (D). Origen: (FASE 5,
    lote de la aplicación, owner 2026-09-30, A, C y D).
  - 📌 **Precisado el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, segunda tanda,
    P; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación, segunda tanda», y los registros `38-fase-5/23-` y `24-` §5)**: la tabla de paso del 📌 anterior **vive sólo en el
    SQL de la migración del paso 3, fuera del esquema de Drizzle**; el 5b la borra. Ni `G-R9` ni el
    control de drift la ven. Origen: (FASE 5, lote de la aplicación, segunda tanda, owner
    2026-09-30, P).
- **⚠️ Condición de caducidad**: `DEC-MIG-002` decidió **seguir tomando altas durante el rediseño**,
  así que la cartera crece. Con ocho filas *«no migrar»* son tres llamadas; **el umbral medido está
  en unas veinte**, y arriba de eso deja de ser viable. El aviso que el owner ya se comprometió a
  dar —*«si veo que empiezan a entrar registros nuevos, te aviso»*— **ahora tiene una consecuencia
  concreta: hay que volver a discutir esta decisión.**
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-24`, `D-25` y `D-26`, sobre el racimo `R5`.

---

### DEC-METH-006 — La FASE 8 vuelve a correr sobre lo que la FASE 9 produjo, hasta que no aparezca ningún CRÍTICO nuevo

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED, con su **condición de corte del ciclo (punto 2)
  ENMENDADA por `DEC-METH-008`** el mismo 2026-09-19 y **PRECISADA por `DEC-METH-013`** el
  2026-09-24 · **Decide**: owner
- 🚨 **Leer el punto 2 de esta entrada sin `DEC-METH-008` da el criterio equivocado, y ya hizo
  tropezar a alguien.** El texto de abajo dice que el ciclo corta *«hasta que una pasada de FASE 8
  no produzca ningún `CRITICA` nuevo»*, y **eso duró horas**: `DEC-METH-008` lo reemplazó **el
  mismo día** por *«hasta que ningún `CRITICA` quede abierto sin causa declarada»*, porque el
  criterio original **mide un stock cuando el generador es el acto de arreglar**. `DEC-METH-013`
  (2026-09-24) es lo que le agrega la condición de atribución y la cota. **El punto 1 —cuándo
  termina la FASE 9— no lo tocó ninguna de las dos.**
- **⚠️ Apartamiento declarado del método**, que el PDR §65 define como **fases en secuencia**.
- **Problema**: `DEC-METH-004` definió cuándo un **hallazgo** está resuelto, no cuándo la **fase**
  termina, y no preveía que la propia FASE 9 pudiera introducir defectos nuevos.
- **Decisión**, y son dos cosas:
  1. **Cuándo termina la FASE 9**: cuando las cuatro salidas de `DEC-METH-004` están cerradas y
     ningún `CRITICA` queda abierto **sin causa declarada**.
  2. **El ciclo**: *«una vez que 9 decimos ok, listo, volvemos a ejecutar la 8, para asegurarnos que
     con los cambios de la 9 no aparece ningún problema nuevo, y si aparece, otra vez la 9»*, y
     **se repite hasta que una pasada de FASE 8 no produzca ningún `CRITICA` nuevo.**
- **Por qué *«sin causa declarada»* es lo que hace usable la definición de salida**: permite
  terminar con cosas abiertas —el capítulo 13 no se va a escribir antes— **siempre que cada una diga
  por qué y de qué depende**. La alternativa *«ningún `CRITICA` abierto, punto»* **nunca se cumple**:
  ata el fin de la fase a algo que la fase no controla.
- **Por qué *«ningún `CRITICA` nuevo»* y no *«ningún hallazgo»***: siempre va a aparecer algo menor,
  y atarlo a cero es la misma trampa. Los `ALTA` y `MEDIA` de la última pasada **se registran y se
  va a FASE 10 con ellos declarados**.
- **La evidencia está en la propia tanda que lo motivó**: la FASE 9 **ya demostró que puede
  introducir defectos nuevos**. `D-01` existe porque el arreglo de `R2` abría un fail-open que el
  diseño original no tenía, y `D-20` porque la resolución de `R3` le daba un segundo significado a
  un campo del contrato. **Los dos se cazaron de casualidad**, mientras se resolvía otra cosa.
- **Dónde cae la 8-bis dentro del ciclo**, precisado el mismo día: las salidas 3 y 4 son
  **PROPAGACIÓN** —52 objetos entre issues, fichas y descomposiciones—, así que la 8-bis corre
  **antes** de ellas. Si corriera después y trajera críticos, la 9-bis los resolvería **y habría que
  propagar todo de nuevo**. El orden queda: (1) aplicar decisiones · (2) las `DEC-`, log, handoff y
  worklog · (3) **8-bis entera** · (4) ¿críticos? → 9-bis → volver a (1) · (5) ¿sin críticos? →
  salidas 3 y 4, **una sola vez** · (6) FASE 10.
- **Cómo corre la 8-bis: ENTERA, no sólo sobre lo que cambió.** La causa raíz del programa es que
  **las contradicciones viven ENTRE capítulos**, así que atacar sólo los textos corregidos la
  volvería ciega a justamente lo que el ciclo busca. Lo que la abarata no es recortar el alcance
  sino que **arranca con los 327 casos ya enumerados**: recorre dominios en vez de descubrirlos.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-30`, sobre el racimo `R6`.

---

### DEC-METH-007 — El gate de FASE 5 se abre, con un criterio de dos filtros en orden

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: `DEC-METH-003` dejó la clasificación del código legacy —`KEEP` o `REWRITE`— detrás
  de un gate cuya única condición era **tener el inventario de FASE 1B terminado**, y esa condición
  **está cumplida desde el 2026-09-17**. Sin abrirlo, **`V1` —la única unidad sin dependencias— no
  puede terminar**, porque lleva `G8` (falla si queda `commerce` en fuentes activas) y hacerlo pasar
  **es ejecutar el §55 sobre el código real**, o sea FASE 5. Las otras 21 unidades esperan detrás.
- **Decisión**: se abre, con **dos filtros en este orden**, propuestos por el owner.
- **Filtro 1 — POR SUJETO**: sobrevive el código **cuyo sujeto sobrevive**. No se juzga la calidad:
  se pregunta si **la cosa que ese código maneja existe en el modelo nuevo**. Si el diseño elimina
  `product_domain`, todo lo que opera sobre `product_domain` se va, **sea bueno o malo**.
- **Por qué primero**: elimina la mayor parte **sin auditar nada**. `DEC-ARCH-004` ya condenó todo
  lo que cuelga de qzpay, y el modelo nuevo es **otro modelo**. Juzgar la calidad de ese código
  sería gastar tiempo en una pregunta que no decide nada. Y **esquiva la trampa que `DEC-METH-003`
  anticipó**: no condena al Eje 2 por definición, porque pregunta si *esa capacidad de esa vertical*
  existe en el modelo nuevo, y muchas existen. Precedente en la misma sesión: el inventario de
  guards aplicó exactamente esta forma sobre 45 scripts y dio **7 `MUERE` / 6 `REVISAR` / 32
  `SOBREVIVE`**, con evidencia por fila y sin discusiones.
- **Filtro 2 — POR CONFIANZA DEMOSTRABLE**, sobre lo que sobrevivió al 1: las cinco condiciones del
  PDR para `KEEP`. **El orden es lo que lo vuelve viable**: el filtro 2 es caro y aplicándolo después
  del 1 **se paga sólo sobre una fracción**. Cierra además el agujero que el filtro 1 solo tenía —
  por sujeto, **un código malo cuyo tema sobrevive pasaría a `KEEP` sin que nadie lo mire**.
- **El umbral, en palabras del owner**:
  > **No hace falta probar que algo está mal. Basta con no poder probar que está bien.**
  >
  > *«Prefiero pagar un costo alto, pero que las cosas queden realmente bien. Venimos de 3 o 4
  > refactors grandes de esto en los últimos 2 meses y nunca nos termina de quedar bien, así que el
  > mantener tiene que ser extremadamente seguro; si no, prefiero reescritura.»*
- **Es más fuerte que el §2 del PDR** —*«la carga de prueba debe estar del lado de conservar»*— **y
  abarata el trabajo en vez de encarecerlo**: no exige investigar cada pieza a fondo, exige **poder
  afirmarlo con evidencia a mano**. Si no se puede demostrar rápido, va a `REWRITE` y se sigue. **Lo
  caro sería el criterio blando**, que obliga a discutir cada caso.
- **Una precisión sobre «bien testeado», que es la condición que más miente**: de las cinco del PDR
  es la más fácil de falsear. Esta misma sesión encontró guards en verde que no vigilan nada. **Si
  el filtro 2 pregunta «¿tiene tests?», conserva código respaldado por tests vacíos** y el trabajo
  del filtro 1 se desperdicia. **Se demuestra, no se declara**: hay que ver que el test **detecta el
  fallo** — romper la cosa y verlo ponerse rojo. Es caro, y **sólo es viable gracias al orden**.
- **Origen**: `15-fase-9/07-decisiones-del-owner.md` `D-31`, sobre el racimo `R6`.

---

### DEC-ARCH-008 — La dirección de un cambio de plan la decide VERTICALES, y billing recibe un veredicto

- **Fecha**: 2026-09-20 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa, `F-8CD1-003`): el veredicto rige **todo** cambio de plan, no sólo el del plan retirado; *«el único caso donde la regla hace falta»* (motivo de descartar (2)) quedó corto, ver `12-contrato…` §4.1 · **Decide**: owner
- **Problema**: la única regla que decide **cuándo se cobra** un cambio de plan —si el monto se muta
  hoy o al fin del ciclo— está escrita como *«la dirección se deriva del delta entre las dos
  versiones, **no del `rank`**; si algo baja, es bajada; **cualquier baja manda**»* (`B/10` §3.5).
  Comparar eso es **leer las dos tablas de capacidades**, que son de verticales. O sea: la regla que
  decide **qué se le cobra a alguien y qué día** exigía que billing leyera exactamente lo que el
  contrato prohíbe cruzar, **dos veces y por escrito**. Y la dirección inversa, declarada en la
  FASE 9, **no incluía ese consumidor** — así que el contrato afirmaba haber enumerado un
  acoplamiento que no enumeró.
- **Alternativas**: (1) **la comparación la hace verticales y billing recibe un veredicto**; (2)
  derivar la dirección del **`rank`**; (3) **billing lee las dos tablas**, con la excepción
  declarada.
- **Decisión**: **(1)**. La dirección inversa del contrato gana una tercera pregunta —
  `direcciónDeCambio(versiónOrigen, versiónDestino) → SUBE | BAJA` — y **billing nunca ve valores**.
- **Por qué no debilita la regla de la dirección inversa**, que es la objeción obvia: esa regla dice
  que la inversa transporta *«política y estado de catálogo, nunca capacidades»*, y **un veredicto no
  es una capacidad**. `SUBE`/`BAJA` es una propiedad de **la relación entre dos versiones**, no un
  valor de ninguna: la misma clase de dato que `permitePausa`.
- **Motivo de descartar (2)**: es la más barata y **el diseño ya la había rechazado por escrito**.
  Un plan más caro puede **bajar un límite** al rediseñarse, y con el `rank` mandando **al cliente
  se le recorta algo en silencio mientras se le cobra como mejora**. Y un plan retirado **no tiene
  `rank` comparable**, que es justamente el único caso donde la regla hace falta.
- **Motivo de descartar (3)**: es **el acoplamiento exacto que partir el programa en dos épicas
  venía a impedir**, sería la primera excepción declarada al corte, y **la regla de vigilancia que
  el propio contrato monta se dispara con ella**.
- **Origen**: `F-8bA3-005`, y la conversación con el owner del 2026-09-20.

---

### DEC-METH-008 — «Resuelto» incluye el dominio que el ARREGLO crea, y el ciclo corta con causa declarada

- **Fecha**: 2026-09-19 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-004`** (la definición de «resuelto») y **enmienda `DEC-METH-006`** (la
  condición de corte del ciclo 8 ↔ 9).
- **Problema, y está medido**: la primera vuelta del ciclo —la FASE 8-bis— produjo **112 hallazgos
  y 28 críticos**, y de los 25 críticos de las pasadas A y B, **25 los atribuyen sus propios
  informes a un cambio de la FASE 9**. **Ninguno es un defecto preexistente** que la primera pasada
  hubiera dejado pasar. Con la condición de corte tal como estaba —*«hasta que una pasada no
  produzca ningún `CRITICA` nuevo»*— el ciclo **no termina**: mide un **stock** de defectos cuando
  el generador es **el acto de arreglar**. El conteo baja (48 → 28) porque baja el tamaño de la
  tanda de arreglos, no porque baje la deuda.
- **La causa, precisa**: `DEC-METH-004` define «resuelto» como *«el camino del hallazgo,
  reejecutado, ya no llega — y para un racimo, la regla corregida se verifica contra todo el
  dominio que cuantifica»*. **Ese dominio es el del PROBLEMA, nunca el del ARREGLO.** Caso testigo,
  medido: al partir el `UNIQUE` del §11 por `sucede_a`, el dominio pasó de **90 a 180 pares** y la
  resolución de `R1` verificó **los 90 de antes**. La mitad nueva contenía el doble cobro que el
  arreglo venía a cerrar (`F-8bB1-001`).
- **Decisión, y son cuatro partes:**
  1. **Un arreglo se verifica contra el dominio que el arreglo CREA**, enumerado con la misma regla
     que el del problema: lista finita, con fuente por elemento. Si el arreglo agrega un eje a una
     clave, a un estado o a una clasificación, **el dominio se multiplica y se re-enumera**.
  2. **Y contra las premisas de los demás racimos.** La pregunta es explícita y se contesta por
     escrito: **«¿qué premisa de OTRO racimo estoy volviendo falsa?»**. Tiene su caso testigo: `R2`
     construyó el título `BASE` sobre *«`Turista Free`, `Guest` y `TRIAL_EXPIRED` no tienen ninguna
     fuente `TÍTULO`»* y `R3` la volvió falsa para dos de los tres, **sin que ninguno lo notara**.
  3. **La condición de corte del ciclo pasa a ser la misma que la de salida de la FASE 9**: se
     repite hasta que **ningún `CRITICA` quede abierto sin causa declarada**, en vez de hasta que
     una pasada no produzca ninguno. Es el criterio que `DEC-METH-006` ya eligió para la fase,
     aplicado al ciclo.
  4. **Quién decide, caso por caso: el owner.** Para cada `CRITICA`, la elección entre **arreglarlo**
     y **declararlo con su causa** la toma el owner, y **el agente no elige por su cuenta**. Se le
     presenta qué se rompe, de dónde salió y una recomendación; la decisión es suya.
- **Por qué las cuatro juntas y no algunas**: la 1 y la 2 **atacan al generador** y solas no acotan
  el número de vueltas; la 3 **pone la cota** y sola no mejora nada —sólo deja de esperar—, y entre
  los 28 críticos de esta pasada hay dobles cobros literales. La 4 es la condición que el owner puso
  al aprobar las otras tres, y no es cosmética: **cuál de los dos caminos toma un crítico es una
  decisión de producto y de riesgo**, no una de método.
- **Lo que NO se decidió**: bajar la vara de `CRITICA`. Se revisaron los 28 buscando severidad
  inflada y no se encontró ninguno.
- **Resultado de su primera aplicación**, el mismo día: las **23** decisiones se tomaron familia por
  familia — **22 `ARREGLAR`**, **1 `APLICAR`** (no era un defecto de diseño sino una regla ya escrita
  y no pegada) y ninguna declarada con causa.
- **Origen**: la FASE 8-bis, `17-fase-8-bis/00-hallazgos.md` §2, y la conversación con el owner del
  2026-09-19 —*«vamos con la 3, pero con la condición de que no tomes vos la decisión de si se
  arregla o se escribe la causa y se patea: cada caso de esos me lo decís y me das a elegir»*.

---

### DEC-METH-009 — Un arreglo no está aplicado hasta que se buscó el término que redefine en los capítulos que el commit NO toca

- **Fecha**: 2026-09-20 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-008`**: le agrega una **tercera obligación**. No la reemplaza ni la corrige
  —la obligación 1 funcionó—, y no toca la condición de corte.
- **Problema, y está medido**: la segunda vuelta del ciclo —la FASE 8-bis-2— dio **120 hallazgos**
  y **17 defectos críticos distintos**, y **17 de 17** los atribuyen sus informes a un arreglo de
  la 9-bis. La proporción **no bajó** respecto de la primera vuelta (25 de 25). Lo que sí cambió es
  el **modo**, y `18-fase-8-bis-2/C1-la-costura.md` §2.3 lo cuenta:

  | generador | críticos |
  |---|---|
  | el arreglo se escribió **en un solo lado de una frontera de dos** | 6 |
  | el arreglo **volvió falsa la premisa de otro arreglo** | 6 |
  | el arreglo **declaró su dominio recorrido y lo recorrió a medias** | 3 |
  | el arreglo **abrió una pregunta y contestó una mitad** | 2 |
  | el arreglo **se apoyó en una medición que caduca sola** | 1 |

- **La causa, precisa**: la obligación 1 de `DEC-METH-008` —recorrer el dominio que el arreglo
  crea— **se ejecutó**, y los tres arreglos que traen su dominio escrito (la tabla de 6 × 4, los
  nueve estados, los dos valores de `sucede_a`) dejaron su propio dominio en orden. La obligación 2
  —*«¿qué premisa de OTRO arreglo estoy volviendo falsa?»*— **no se ejecutó en ninguno**. Pero el
  generador más grande, los 6 de la primera fila, **no lo detecta ninguna de las dos**: no es un
  dominio mal recorrido ni una premisa ajena rota, es **un arreglo escrito en un lugar y no en el
  otro lugar donde la misma regla se ejecuta**. Caso testigo: el gate que descarta las fuentes
  `COMPLEMENTO` se escribió en `12-contrato-de-cobertura.md` §2.4 y `V/15` siguió diciendo *«suma
  todas las fuentes vivas»* (`F-8cA1-007` y `F-8cA3-004` son el mismo defecto visto por dos agentes
  ciegos).
- **Decisión**: un arreglo **no se declara aplicado** hasta que se cumple este paso, que es
  mecánico y no depende de que el que arregla se acuerde de hacerse una pregunta:
  1. **Nombrar el término que el arreglo redefine** — el campo, el estado, la clase, la regla o la
     frase cuyo significado cambia. Se escribe, no se piensa.
  2. **Buscarlo con `rg` sobre los capítulos que el commit NO toca**, las dos épicas y el núcleo.
  3. **Cada aparición se resuelve**: o se corrige, o se declara por escrito por qué esa aparición
     sigue siendo correcta con el significado nuevo.
- **Por qué esta y no más recorrido interno**: está contado. *«Ninguno de los 17 se habría evitado
  con más recorrido interno; **doce de los 17** se detectan con una búsqueda de texto por el término
  que el arreglo redefine, sobre los capítulos que el commit no toca»* —
  `18-fase-8-bis-2/C1-la-costura.md` §2.3, con los términos enumerados: `sucede_a`, «sucesora»,
  «viva», «barrido», «cubierto», `plan_id`, `version_id`, «pago tardío» y «los tres».
- **Lo que NO cubre**, y se declara para que no se lea como que sí: el quinto modo —**un arreglo
  apoyado en una premisa propia y verdadera que envejece sola** (`F-8cC2-002`)—. Ninguna búsqueda
  de texto lo encuentra, porque el texto es correcto el día que se escribe. La regla que lo cubre
  **ya existe** y es `S-METH-01`; lo que falta es instrumentarla en los checklists irreversibles.
  Queda abierto.
- **Origen**: la FASE 8-bis-2, `18-fase-8-bis-2/C1-la-costura.md` §2.3, la mecánica que `B1`
  propone al cerrar su informe, y la conversación con el owner del 2026-09-20.

---

### DEC-MIG-004 — La población de producción se resuelve por teléfono, no por diseño: es del owner y está cerrada

- **Fecha**: 2026-09-20 · **Estado**: **SUPERSEDED por `DEC-MIG-007`** (2026-09-30, FASE 5, simplificación del corte, con OK del owner, lote E; `38-fase-5/20-simplificacion-del-corte.md` §11, S-56 y S-77): su mecanismo humano —el owner les habla a los suyos, por privado, y les pide que se vuelvan a suscribir— es la premisa 4 de `DEC-MIG-007`; los defectos #15 y #16, el umbral de unas veinte personas y el punto 4 de su 📌 (el límite del día 180 de la agenda de llamados) quedan sin sujeto — **precisada el 2026-09-25** (FASE 9 completa: la rama de aborto, los defectos #1, #15 y #16, la agenda del día 180 y la cita del umbral; ver su 📌) — **y su punto 2 precisado el 2026-09-27** (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`: entre el paso 3 y el 4 no llega nada al handler nuevo; ver el 📌 de ese punto) · **Decide**: owner
- **Complementa `DEC-MIG-003`** («no se migra»): le da el **mecanismo humano** que la hace
  ejecutable, y que hasta hoy vivía sólo en la conversación.
- **Decisión del owner, en sus términos**: la población de producción —usuarios, fichas y pagos—
  **son pocos y son conocidos suyos**. Les habla, les explica qué pasa y **les pide que se
  resuscriban cuando el sistema nuevo esté andando**. No se construye ningún mecanismo de diseño
  para ellos: ni transcripción, ni coexistencia, ni asiento retroactivo, ni crédito automático.
- **Por qué se registra, y no es burocracia**: está medido que **no estaba registrada**, y por eso
  **cada pasada adversarial la vuelve a descubrir como hallazgo**. En la FASE 8-bis-2, **cinco de
  los diecisiete críticos distintos** son la misma preocupación vista desde cinco capítulos. Sin
  esta entrada, la 8-bis-3 los produce de nuevo, y la de después también: el trabajo no se ahorra
  arreglándolos, se ahorra **declarando la decisión que los responde**.
- **Qué retira, nominalmente** (numeración de `18-fase-8-bis-2/C1-la-costura.md` §2.1). Los cinco
  quedan **declarados con causa**, que es lo que `DEC-METH-006` permite, y **no** se arreglan:

  | # | defecto | por qué lo responde esta decisión |
  |---|---|---|
  | **1** | `PB2` no dispara la mañana del corte y la cartera queda publicada sin cobertura | la cartera es la población conocida; se la llama y se resuscribe |
  | **7** | la entidad `listing` no tiene camino declarado al modelo nuevo | no lo necesita: no se transcribe ninguna |
  | **15** | la lápida no existe entre el paso 3 y el paso 4 del corte | el cobro en vuelo es de uno de los tres conocidos |
  | **16** | el paso 1 cancela «los tres» y el conjunto crece con las altas nuevas | mismo remedio, y **⚠️ es el único cuyo sujeto NO es la población medida el 2026-09-15** — ver abajo |
  | **17** | el corte no tiene paso para un período ya pagado, y *«cero pagos»* caduca el 2026-09-26 | si alguien pagó un período, se le resuelve hablando |

- **La salvedad del #16, declarada para que no se lea cubierta de más**: su sujeto son las altas que
  entren **durante** el rediseño, que por construcción **no son las ocho medidas** y pueden no ser
  conocidas del owner. El remedio es el mismo —se las llama— pero la premisa *«son conocidos míos»*
  es de otra población. Si la cohorte nueva crece, quien decide si sigue siendo manejable es el
  owner, y el umbral ya está medido: **unas 20** (`B/21` §2.4, hoy 8).
- **Lo que NO cubre**: los **doce críticos restantes**, que son defectos del sistema nuevo y le
  pasan a gente que todavía no existe. Ésos se arreglan.
- **El dato operativo con fecha, que sobrevive a la decisión**: el **2026-09-26** cae el primer
  cobro de la historia del sistema, bajo el sistema **actual**. No es una pregunta de diseño y no
  vuelve a este log: está en [`04-open-decisions.md`](./04-open-decisions.md) con su 📅.
- **Origen**: decisión sostenida del owner, reafirmada el 2026-09-20 —*«son pocos, son conocidos
  míos a los cuales les puedo hablar, explicarles lo que pasa y pedirles que se resuscriban cuando
  el sistema nuevo esté andando»*—.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 2d y 5c de
  `26-fase-9-completa/10`; `02-…` `CT-5`; `09-…` `C-7` y `C-10`).**
  1. ***«Se resuelve hablando»* NO alcanza a la diferencia que cobra la rama de aborto del corte**
     (2d): no se devuelve (`DEC-MIG-005`). El #17 sigue valiendo para lo que decía: un período pagado
     bajo el sistema viejo.
  2. **La causa del #15 y el sujeto del #16 caducaron el 2026-09-24**: el censo del paso 1b sale del
     recorrido del proveedor e incluye ids que la base no conoce, así que *«el cobro en vuelo es de
     uno de los tres conocidos»* y *«cancela "los tres"»* ya no son ciertos. **La conclusión del #15
     sigue**: un cobro en vuelo entre el paso 3 y el 4 de alguien que la base no conoce no se
     re-vincula —su `external_reference` no nombra una fila nuestra (`DEC-CONC-002`, segundo 📌)— y
     abre marca.
     📌 **Precisado el 2026-09-27 (FASE 9 vuelta 2, `F-8V2B3-003`, `F-8V2C2-002`)**: entre el
     paso 3 y el 4 no llega nada al handler nuevo. Las lápidas se siembran antes de apuntar la URL
     (el nuevo paso 4b de `16-fase-7…` §4.2), así que el cobro en vuelo de un id que la base no
     conoce encuentra su lápida del corte y se asienta por la regla de `G3-1`, sin marca si es del
     día del corte.
  3. **El desenlace del #1 ya no ocurre**: la cartera no queda publicada sin cobertura; la baja la
     primera corrida del reconciliador diario (`DEC-ARCH-009`), dentro del primer día. La causa del
     #1 sigue —el corte no es un cambio de `cubierto`— y la respuesta de esta decisión también.
  4. **La agenda de llamados tiene un límite de hecho en el día 180** (5c; `05-…` `OW-2`): la ficha
     preexistente de un dueño que no contrató llega a `PURGED` ese día. **No se hace nada especial**:
     *«tenemos 180 días para que lo hagan, es un montón de tiempo»*. Se declara para que no se vuelva
     a reportar (`V/21`, «NO cierra»).
  5. **La cita del umbral apunta a un § que no lo tiene**: *«unas 20 (`B/21` §2.4, hoy 8)»* está en
     **`V/21` §2.5**.

  La entrada no se edita en su contenido.

---

### DEC-RF-002 — El reembolso del pago pendiente lo confirma una persona: no hay operaciones automáticas sobre dinero

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Alcance**: la primera de las cuatro ramas con que puede terminar una sucesión en curso
  (`B/12` §5.3) — la sucesora autoriza, `S17` mata a la predecesora, y el pago que había quedado
  pendiente por `S19` **se devuelve**. La decisión es **quién lo ejecuta**, no si corresponde.
- **El caso, para que se entienda sin reconstruirlo**: a alguien le rebota la cuota y entra en
  `GRACE_PERIOD`. Cambia de plan para salir del problema, lo que abre una sucesión con una ventana
  de 72 h. Mientras tanto el proveedor **sigue reintentando la cuota vieja por su cuenta** —
  perdonar la deuda no apaga su reciclado— y el cobro entra. En ese instante **todavía no se sabe**
  si la persona va a terminar el checkout, y las dos ramas piden lo contrario: si lo termina el
  pago no le compró nada y se devuelve; si lo abandona, ese pago es **lo único que la salva**. Por
  eso el pago queda pendiente (`S19`) y su destino lo decide **el cierre de la sucesión**.
- **Decisión**: el reembolso **lo confirma una persona**. Al cerrar la sucesión el sistema **pone
  la marca** y el caso entra al canal de conciliación; **no ejecuta el reembolso solo**.
- **Por qué, y son tres reglas ya escritas, no una preferencia**:
  1. `NUCLEO/08` §3 lista *«reembolsar»* entre las acciones que **mueven dinero**, con permiso
     propio y confirmación explícita.
  2. `B/09` §2.4 fija el criterio del owner: *«la línea es "toca plata o no toca plata"»* — y es la
     **cuarta** vez que se aplica.
  3. `S14`: **cero decisiones destructivas automáticas**.
  Automatizarlo habría sido **la primera operación automática sobre dinero de todo el diseño**, en
  un dominio que está vacío a propósito.
- **Y un motivo técnico que empuja igual**: `B/02` §2.3 **no guarda el id del refund**, que `RF-6`
  mide necesario para que un reintento no devuelva dos veces. La rama automática exigía además esa
  columna; la manual no.
- **El costo, aceptado con los ojos abiertos**: la persona **espera a que alguien mire**, y este es
  un camino **normal**, no excepcional, así que va a pasar seguido sobre el camino de recuperación
  que `DEC-SUB-003` diseñó para que no fuera un muro. Se acota **avisándolo en el mismo correo** que
  `B/12` §5.3 ya obliga a reescribir para que nombre las dos ramas (`NUCLEO/07` §6 y `B/19` §4
  fila 15).
- **Lo que NO decide**: las otras tres ramas, que ya estaban resueltas y no devuelven plata —vencer
  la ventana **reactiva**, la sucesión trabada ya tiene un humano mirándola, y el grant *Free
  Forever* no devuelve por `DEC-GRANT-001`.
- **Origen**: la FASE 9-bis-2, familia del pago tardío; el hallazgo `F-8cB3-011`, que midió que el
  reembolso automático contradecía al resto del diseño; y la elección del owner del 2026-09-21
  entre las dos opciones que se le presentaron.

---

### DEC-GRANT-006 — La cortesía es POR SUSCRIPCIÓN: se retira su `scope`, y el §34 del PDR queda desviado a propósito

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el `⚠️` que `B/02` §2.4 había dejado declarado abierto en la FASE 9-bis-2.
- **Decisión**: **`courtesy_grant.scope` se retira de la tabla.** Una cortesía cubre **la
  suscripción que pausa**, y nada más. Para dar cortesía en dos verticales se otorgan **dos
  cortesías**, una por suscripción.
- **Qué NO se pierde, y conviene decirlo porque suena a recorte**: la capacidad de tener a alguien
  con cortesía en varias verticales a la vez **sigue existiendo**. Lo único que se pierde es el
  **gesto único** en el panel. Nadie queda sin poder hacer nada que antes pudiera.
- **El nudo, medido, que es por lo que la columna no hacía nada**: una suscripción es de **una**
  vertical (`B/02` §2.2) y la cortesía transporta la **versión anclada de la suscripción que
  pausa** (`DEC-GRANT-003`), así que emite **una** fuente, en esa vertical
  (`12-contrato…` §2.7, fila `cortesía`). Un `scope` de dos verticales era **una columna que se
  puede escribir y no hace nada** — el mismo modo de falla que `B/16` §2.4 nombra para rechazarlo.
- **Por qué acá se elige lo CONTRARIO que en el grant, que es la pregunta que va a volver**: el
  mismo día, `permanent_grant` se resolvió como **un instrumento con N anclas** y se rechazó «N
  grants» explícitamente. La razón de aquello fue que **revocar es la acción administrativa más
  grave del sistema** (`NUCLEO/08` §3) y con N instrumentos pasa a ser N actos, de los que se puede
  olvidar uno y dejar capacidades regaladas para siempre. **Ese argumento no existe en la
  cortesía: una cortesía se vence sola a los N días.** No hay revocación que se pueda escapar. La
  asimetría no es una inconsistencia — es la misma regla aplicada a dos instrumentos con distinta
  forma de terminar.
- **Desviación declarada del PDR §34**, que pide *«scope configurable, de forma equivalente al
  sistema de Free Forever»* y enumera una vertical / varias / todas las actuales / todas las
  actuales y futuras. **Se desvía a propósito, y la razón es que los dos instrumentos no son
  equivalentes**: el Free Forever **ancla un plan por vertical y no necesita que exista nada
  previo**; la cortesía **pausa algo que ya existe**. Pedirle el mismo scope es pedirle a un
  mecanismo que haga de otro. El §34 describe el resultado deseado por analogía con un instrumento
  cuya mecánica no comparte.
- **Y el hueco concreto que la analogía deja sin respuesta**, que es la prueba de lo anterior: con
  scope plural, **qué hace la cortesía en una vertical donde el beneficiario NO tiene
  suscripción**. El PDR trae media respuesta y en dos mecanismos distintos —**§34.1** *«durante
  trial: extiende el trial»*, **§34.2** *«durante subscription: mantiene servicio sin cobrar»*— y
  **ninguna** para el tercer caso, el de quien no tiene nada en esa vertical, ni siquiera un trial.
  Un instrumento con tres comportamientos según lo que encuentre no es un scope: son tres
  instrumentos con un nombre.
- **Lo que queda fijado y no se revisa**: nadie puede emitir la cortesía en una segunda vertical
  transportando la versión anclada de la suscripción de la primera. Sería el defecto del grant
  (`F-8cA1-002` / `F-8cA3-005`) con otro `tipo`.
- **Si alguna vez se quiere el gesto único**, el camino es **de superficie, no de modelo**: una
  acción del panel que otorgue N cortesías en una transacción, mostrando las N. No vuelve una
  columna al modelo de datos.
- **Origen**: la FASE 9-bis-2, familia del contrato, que lo dejó declarado abierto en `B/02` §2.4
  en vez de resolverlo en silencio; y la elección del owner del 2026-09-21 entre las tres opciones
  que se le presentaron.

---

### DEC-TRIAL-008 — Quien tiene una suscripción que NO cubre recibe su trial: la frontera no transporta un segundo hecho

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C14; ver su 📌) · **Decide**: owner
- **Cierra** lo que la FASE 9-bis-2 dejó declarado abierto en `V/03` §2 y en `12-contrato…` §4.
- **Decisión**: se deja como está. **`T1` y `T6` se deciden únicamente por `cubierto`**, y quien
  tiene una suscripción en un estado que **no emite fuente** recibe su trial. **El contrato NO gana
  un segundo hecho.**
- **El caso, para no reconstruirlo**: de los diez estados de la suscripción, los que no emiten
  fuente (`12-contrato…` §2.6) dan `cubierto` falso y disparan `T1`, que arranca el trial. Para
  cuatro —`ABANDONED`, `CANCELLED`, `CHARGE_DECLINED` y no tener fila— es trivialmente correcto.
  De los otros tres, **dos son correctos sin matices**: `PENDING_AUTHORIZATION` (el contrato ya
  declara que esa fila *«no vale nada»* porque el checkout se puede abandonar) y `PAUSED` por
  `CUSTOMER_REQUEST` (*«el servicio está detenido»*, `B/16` §2.2). **El tercero es la concesión**:
  alguien `SUSPENDED` por impago que **nunca publicó en esa vertical** recibe los días de trial
  que habría recibido igual si no hubiera contratado nunca.
- **Por qué la concesión es aceptable, y está acotada por el propio diseño**: es **su único trial
  de por vida**, no uno extra; si regulariza, `T2` lo convierte; si no regulariza, `T3` lo vence,
  `PB2` lo despublica y **no le queda nada**.
- **Por qué se rechaza la alternativa**, que era darle a verticales un bit tipo *«hay un vínculo de
  suscripción no terminal»*:
  1. **Es la frontera creciendo.** `DEC-ARCH-006` fija que el contrato es uno solo, y el §4.2 del
     contrato tiene una regla de vigilancia precisamente para esto. Un bit que diga *«este tiene
     algo no terminal»* **es un estado de cobranza con otro nombre**, y el día que exista alguien
     escribe la segunda regla de producto encima. Es una puerta, no una excepción.
  2. **Empeora dos casos para arreglar uno.** La alternativa alcanza a los tres, incluidos los dos
     que hoy están bien resueltos.
  3. **Y comercialmente va al revés de la intuición.** Quien está `SUSPENDED` **ya no está
     pagando**: darle un trial en una vertical nueva no cuesta ingreso —no hay ingreso que
     perder— y es la única vía por la que esa persona podría volver. Bloquearla protege un ingreso
     inexistente y cierra la puerta de vuelta.
- **Lo que esto NO autoriza**: distinguir sólo a `SUSPENDED` sería la peor versión de la
  alternativa, porque es literalmente una señal de deuda cruzando a verticales. Queda rechazada con
  el resto.
- **Origen**: la FASE 9-bis-2, familia del trial, que lo dejó declarado abierto en vez de
  resolverlo en silencio; los hallazgos `F-8cA3-001` (rama 1) y `F-8cA1-012`; y la elección del
  owner del 2026-09-21 entre las dos opciones que se le presentaron.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C14)**: La frontera se abrió lo
  mínimo por otro caso (`DEC-DATA-006`): la pausa del dueño cruza como `retenciónDetenida`, con
  lectores cerrados de retención. La máquina de trial no la lee, y lo que esta decisión protegía
  queda intacto.

---

### DEC-METH-010 — El grep no falla al buscar sino al resolver: la resolución se escribe POR APARICIÓN, y el alcance es todo el corpus

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Enmienda `DEC-METH-009`**, que no cortó el generador. No la deroga: **su caso de diseño
  funciona y está fechado** — el mensaje de `f5731fd65` registra que la regla encontró que `B/12`
  seguía con la condición histórica de `S16` que `B/03` ya había reemplazado, y esa contradicción
  **no llegó** a la pasada siguiente.
- **Problema, medido en la FASE 8-bis-3**: **85 hallazgos, 18 IDs `CRITICA`, 14 defectos críticos
  distintos**, y **13 de los 14** los introdujo la tanda de arreglos anterior. La serie completa:

  | | 8-bis | 8-bis-2 | 8-bis-3 |
  |---|---|---|---|
  | críticos distintos | — | 17 | **14** |
  | atribuidos a la tanda anterior | 25/25 (A y B) | 17/17 | **13 de 14** |

- **El diagnóstico, y es distinto del que motivó `DEC-METH-009`**: **el paso que falla es el 3, la
  resolución, no el 2, la búsqueda.** El grep alcanzaba **5 de los 14**, y **al menos 2 de esos 5
  pasaron con la regla declarada corrida y con cifras**. Medido en `19-fase-8-bis-3/C1-la-costura.md`
  §4.3: `1ca12d709` declaró haber grepeado el `scope` del grant y dejó viva `NUCLEO/01` §5
  (*«con su scope de verticales»*) en un archivo que no tocó; `3692d5deb` declaró *«23 de sucesora
  y predecesora declaradas correctas»* y dejó viva `B/14` §2.2 (*«la sucesora lo hereda»*), que es
  un `CRITICA` — con **14 apariciones fuera del commit** contra 23 declaradas. **Una resolución en
  bloque no es falsable; una por aparición sí.**
- **Decisión, y son tres enmiendas más una condicional. Van juntas y el orden importa:**
  1. **El alcance es TODO EL CORPUS, y la unidad es el PÁRRAFO, no el archivo.** Donde
     `DEC-METH-009` dice *«los capítulos que el commit NO toca»*, va *«todo el corpus —las dos
     épicas, el núcleo, el contrato, el corte, la partición, los `spec.md`, las `descomposicion.md`
     y este log—, **incluidos los archivos que el commit toca**, porque un archivo abierto no es un
     párrafo leído»*.
  2. **La obligación 3 se cumple por escrito y POR APARICIÓN.** Para cada aparición **que no se
     corrige**, se deja el archivo, el § y **por qué sigue siendo correcta**. **Versión acotada, que
     es la que se adopta**: se escriben las que no se corrigen **y están en un párrafo que el commit
     no tocó** — que es donde vive el riesgo. En `3692d5deb` habrían sido pocas, y una de ellas la
     de `B/14`.
  3. **Se grepea también el término VIEJO, el que se retira**, no sólo el nuevo. El consumidor que
     no se actualizó **no aparece buscando el nombre nuevo**, y ése es justamente el conjunto donde
     viven los defectos que el arreglo vino a corregir.
  4. **Condicional, y sólo con la 2 encima**: cada término que el núcleo define lleva **su lista de
     consumidores**, y un arreglo que crea un consumidor nuevo **agrega la fila antes de declararse
     aplicado**. Se adopta **junto con la 2 y no antes**, por la razón del punto siguiente.
- **Por qué la 1 sin la 2 EMPEORA el problema, y por eso no se adopta suelta**: `49eb99f34` reportó
  110 apariciones con el alcance chico. Con el corpus entero el número crece, y **un arreglo que
  tenga que resolver 300 apariciones va a declarar correctas las 290 que no miró** — que es
  exactamente el modo que produjo el crítico. Ampliar el alcance sin cambiar cómo se resuelve
  multiplica el agregado no falsable.
- **Por qué la 4 es condicional y no incondicional**: mantener listas en el núcleo es **la misma
  clase de conteo que esta pasada encontró roto cinco veces** (`F-8dA2-009`, `F-8dA2-010`,
  `F-8dA3-009`, `F-8dB2-012`, `F-8dC1-005`), y **el precedente es malo**: la única lista que existe
  —`NUCLEO/01` §2.4, los predicados que usan *«fila viva»*— **quedó corta en el mismo commit que
  creó su sexto miembro**. Una lista que se olvida es peor que no tenerla, porque afirma
  completitud. Con la 2 encima se actualiza en el mismo acto en que se escribe la resolución.
- **Lo que las cuatro juntas NO cierran, declarado en voz alta**: **«el capítulo que nunca nombró
  el término»**. `V/11` es el dueño del §10.2 (*«el trial no vuelve»*) y **no contiene `T6` ni una
  vez**; ninguna búsqueda por término, viejo o nuevo, en ningún alcance, lo devuelve. Lo único que
  lo encuentra es recorrer el dominio **por el eje del tiempo** —*«¿qué pasa el día que la
  configuración cambie?»*—, que es la obligación 1 de `DEC-METH-008` con un eje más. **No es una
  regla de búsqueda y no se finge que estas cuatro lo cubren.**
- **Y un dato que la regla necesita y el programa no publica**: **qué archivos toca cada commit**.
  Dos de los siete informes de la 8-bis-3 contestaron mal *«¿lo habría encontrado el grep?»* porque
  midieron contra el conjunto equivocado. Hasta que se publique, la respuesta se verifica con
  `git show --name-only`.
- **Origen**: la FASE 8-bis-3, `19-fase-8-bis-3/C1-la-costura.md` §4.5, y la elección del owner del
  2026-09-21 entre las tres opciones que se le presentaron — eligió **correr la tanda completa con
  la regla corregida y volver a medir**, por encima de la pasada acotada que se le recomendó.

---

### DEC-TRIAL-009 — Revocar un grant NO devuelve el trial: se declara en la confirmación y no se repara

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el defecto crítico #1 de la FASE 8-bis-3 (`F-8dA1-001`), que la 9-bis-3 dejó sin
  arreglar a propósito por ser una decisión de producto.
- **El caso**: recibir un *Free Forever* **consume el trial** de esa vertical —`T2` si estaba
  corriendo, `T6` si todavía no—, porque las dos transiciones se disparan ante cualquier fuente
  viva de clase `TÍTULO` y un `GRANT` lo es. **Revocar el grant no lo devuelve**: no hay
  transición de vuelta y el §10.2 no admite excepciones. El beneficiario queda **sin grant, sin
  suscripción y sin trial**, así que si quiere seguir paga desde el primer día — y el acto que lo
  dejó así **lo firmamos nosotros**.
- **Decisión**: **no se repara. Se declara.** La confirmación de revocar dice, además de que corta
  el servicio, que **el trial ya está consumido y no vuelve** (`NUCLEO/08` §3.1).
- **Las dos alternativas, y por qué se descartan:**
  - **Que el grant no queme el trial** (`T2`/`T6` excluyen las fuentes `GRANT`): reabre por otra
    puerta el defecto que la 9-bis-2 acababa de cerrar — conviven dos fuentes `TÍTULO` y el trial
    deriva del plan vendible de `rank` más alto, que puede otorgar **más** que el plan anclado. Y
    en `T2` el reloj sigue corriendo igual, así que el trial se pierde solo salvo que además se
    pause, cosa que el §26 prohíbe.
  - **Reparar con una cortesía** por los días no usados sobre la primera suscripción que tome: es
    lo que el agente recomendó, aplicando el patrón del `V/11` §2.3. El owner eligió no hacerlo.
- **La razón por la que esto NO contradice al `V/11` §2.3, y va escrita porque es el caso que más
  se le parece.** Ahí el diseño repara *«porque el daño lo hicimos nosotros»*, y acá también lo
  hicimos nosotros. La diferencia son **dos cosas que hay que leer juntas**:

  | | la moderación equivocada (§2.3) | la revocación de un grant |
  |---|---|---|
  | qué fue el acto | **un error** | **una decisión legítima y deliberada**: se termina una concesión que nunca se debió |
  | qué recibió la persona | **nada** | **la cobertura completa del plan anclado**, todo lo que duró el grant — estrictamente más de lo que un trial da |

  **El trial no se perdió: se gastó, y se gastó recibiendo algo mejor.** Es la lectura literal de
  por qué `T6` existe —quien está cubierto no necesita una prueba— y acá la persona **estuvo
  cubierta de verdad**. Reparar sería devolverle una prueba a alguien que ya tuvo el producto
  entero.
- **Lo que esto NO autoriza**: leerlo al revés sobre la moderación equivocada. Ahí la persona **no
  recibió nada** y el acto **fue un error**, así que la reparación del §2.3 —extensión por `T4` si
  el trial vive, cortesía si venció— **sigue intacta**.
- **El costo aceptado, dicho en voz alta**: la confirmación le avisa **al que revoca**, no al que
  pierde. Quien recibe la revocación se entera cuando intenta seguir usando la plataforma.
- **Origen**: la FASE 8-bis-3, hallazgo `F-8dA1-001`; la familia del trial y el grant de la
  9-bis-3, que lo declaró abierto en vez de elegir; y la elección del owner del 2026-09-21 entre
  las tres opciones que se le presentaron — eligió la 3 por encima de la 2, que era la recomendada.

---

### DEC-DATA-002 — La pausa no borra la ficha: `ARCHIVED` tiene vuelta, el reloj se reinicia, y la garantía es un invariante y no una desigualdad suelta

- **Fecha**: 2026-09-21 · **Estado**: **SUPERSEDED EN PARTE por `DEC-DATA-006`** (2026-09-28, revisión del owner, C14): se cae que el reloj corre durante la pausa y la desigualdad que la protegía; sobrevive el resto — **el punto 2, precisado el 2026-09-25** (FASE 8 y FASE 9 completas: la lista cerrada tiene **seis** hechos; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8, C9, N7; ver su último 📌) · **Decide**: owner
- **Cierra** `F-8cC1-001`, `CRITICA` abierto desde la FASE 8-bis-2. **Extiende `DEC-DATA-001`**,
  que queda con dos precisiones: sus *«dos avisos»* ahora son **tres**, y su promesa de que el
  cliente *«puede reactivarla»* **por fin tiene las dos filas que la ejecutan**.
- **El defecto**: un cliente pausa —hasta **4 pausas-mes**, función del catálogo—, su ficha se
  baja, al **día 90** `PB4` la archiva, **`ARCHIVED` no tenía ninguna transición que lo tuviera en
  `desde`**, y al **día 180** el hard delete le borraba el contenido. A alguien que **no canceló
  nada y usó algo que le vendimos**. Dos agravantes medidos: *«inactividad»* aparecía **una sola
  vez en todo el corpus**, sin definición; y dos documentos prometían en una nota que se *«puede
  reactivar»*, promesa que ninguna tabla ejecutaba y sobre la que `V/02` §4.2 apoyaba su defensa
  del borrado.
- **El criterio del owner, textual**: *«si el cliente pausó, el reloj de inactividad no corre; la
  pausa fue deliberada, así que no le podemos borrar la ficha por algo que le dijimos que podía
  hacer»*.
- **Decisión, y son cuatro piezas:**
  1. **`PB7`** (`ARCHIVED` → `PUBLISHED`, al volver `cubierto` y haber cupo) y **`PB8`**
     (`ARCHIVED` → `DRAFT`, el dueño la reactiva). Son **dos** porque a `ARCHIVED` se entra por dos
     puertas y una vuelta automática ciega publicaría el borrador de `PB5`. El origen sale del
     evento de dominio, **sin columna nueva**.
  2. **«Inactividad» queda definida**, con **cuatro hechos de reinicio** y lista cerrada: un acto
     del dueño, **`cubierto` pasando a verdadero**, volver a `PUBLISHED`, y el fin de servicio de
     una vertical discontinuada. Lo que se retira no es una palabra: es **que el reloj fuera
     monótono**.
     **📌 Precisado el 2026-09-25, con OK del owner.** La lista cerrada **tiene seis hechos**
     (`NUCLEO/01` §1.2). El **quinto**, *«el dueño pierde la cobertura en la vertical de la ficha»*, lo
     agregó la FASE 8 completa (racimo `R9`) y no se había registrado acá. El **sexto**, *«se levanta
     la moderación»* (`PB11`), lo agrega la FASE 9 completa (decisión 5b; `05-…` `OW-1`), con la razón
     del hecho 4: mientras la ficha estaba moderada el dueño **no podía** actuar, y contar ese tiempo
     lo castigaba por una decisión nuestra —sin reinicio, levantar una moderación larga llevaba a
     `PB5` y a `PB9` en días—. La escritura única del corte (fila `C`) sigue sin ser un hecho, y
     `G-R6-B` admite el escritor nuevo.
  3. **El reinicio cuelga del HECHO, no de la transición**: si el cliente vuelve con un plan más
     chico y el cupo no alcanza, el reloj se reinicia igual. Atarlo a `PB7` dejaba el borrado vivo
     justo para el que vuelve peor.
  4. **Tercer aviso, «al archivar»**, en el catálogo de correos, más la superficie que dice al
     pausar qué le pasa a la ficha.
- **Cómo se satisface el criterio del owner SIN mover la frontera, que es lo que esta decisión
  tiene de no obvio.** Tomado al pie de la letra, *«el reloj no corre durante la pausa»* exige que
  verticales **vea** la pausa — y una `PAUSED` por `CUSTOMER_REQUEST` **no emite ninguna fuente**,
  así que sería el segundo hecho cruzando la frontera que **`DEC-TRIAL-008` rechazó dos días
  antes**. Se buscó la vía del `T7` (leer el registro de eventos de la propia vertical) y **no
  existe**: cuando arranca una pausa la única fuente que desaparece es `tipo: SUSCRIPCIÓN`,
  exactamente igual que en una baja o una suspensión, y el §3 del contrato empuja *«qué fuente
  cambió y en qué dirección»*, que no separa las tres.

  **Lo que se implementó es equivalente en el resultado, y conviene decir que no es idéntico: el
  reloj SÍ corre durante la pausa, y se reinicia al reanudar.** El daño residual es **cero**, y por
  una razón aritmética: el tope de una pausa son **4 pausas-mes ≈ 120 días** contra los **180** del
  hard delete, y cada reanudación reinicia — así que las pausas encadenadas tampoco acumulan. La
  ficha se archiva, sí, pero **vuelve sola por `PB7`** y **nunca se borra**.
- **`D16`, y es la pieza que evita que todo esto sea una premisa que envejece sola**: *«el tope de
  una pausa, en días, es menor que el día del hard delete»*, con guard `G-R5` que compara las dos
  cifras y falla si la primera alcanza a la segunda. **Las dos son configuración**, así que el
  invariante es **la relación** y nunca los números. Sin `D16`, todo el arreglo descansa en una
  desigualdad entre dos valores que nadie vuelve a mirar — que es exactamente el quinto modo de
  falla que `DEC-METH-010` declara **no cubierto** por ninguna búsqueda.
- **Lo que NO se hizo, y por qué**: enmendar `DEC-TRIAL-008`. La mitad (a) tomada literalmente
  cuesta la frontera y **no compra nada que la vuelta de `ARCHIVED` no dé**. `DEC-TRIAL-008` sale
  **reforzada**.
- **Tres descartes escritos**: definir inactividad sobre la actividad del dueño a secas (archivaría
  la ficha publicada de un cliente que paga y no la edita); usar `UNPUBLISHED_BY_BILLING` como
  causa (no distingue pausa de baja, y sacarlo del `desde` de `PB4` mata la retención para el que
  sí se fue); y que la pausa emita una fuente no-cubriente (es literalmente el bit de
  `DEC-TRIAL-008`, y además le rompe el trial).
- **Origen**: `F-8cC1-001` (FASE 8-bis-2, `C1-la-costura.md` §1), y la decisión del owner del
  2026-09-21 sobre sus dos mitades.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8, C9, N7)**: El hecho del fin
  de servicio de una vertical sale de la lista del reloj: quedan cinco, con el número 4 vacío (C8).
  Y los 90 y 180 días son los valores iniciales de dos plazos configurables: la ficha guarda la
  versión de plazos con la que arrancó su reloj, el archivado escribe la fecha de borrado que
  anuncia y `PB9` no borra antes (`DEC-DATA-008`).

---

### DEC-ADDON-003 — El grant con `includesAddons` convierte a $0 el addon YA comprado, y al revocar se apaga sin reparación

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-ADDON-007`**: *«la condición de huérfano no se toca»* (punto 4) dejó de valer; la orfandad de `LISTING` y de `USER`/`GLOBAL` se lee como dice esa decisión · **Decide**: owner
- **El hueco**: el §35.2 dice que con `includesAddons: true` los addons compatibles *«pueden
  utilizarse a costo $0»*, y `B/16` §3.2 agrega *«habilita; no enciende»*. **Las dos frases están
  escritas sobre el addon que TODAVÍA NO EXISTE** — alguien con el grant que después quiere un
  destaque. **Nadie escribió qué pasa con el que la persona YA TENÍA COMPRADO** el día que le cae
  el grant. Con `S13` acotado a *«toda fila viva PRINCIPAL»* (commit `4e383480d`), **su suscripción
  de complemento seguía viva y seguía cobrando**: se le debitaba todos los meses un addon que el
  flag le había declarado gratis.
- **Decisión, y son dos mitades:**
  1. **Al otorgar el grant —y al anclarle una vertical, que es el otro disparador—, se convierte a
     $0**: se cancela la suscripción de complemento y la instancia pasa a colgar del ancla como su
     título.
  2. **Al revocar el grant NO pasa nada**, en el sentido de que **no se repara**: no se reanuda el
     débito viejo ni se emite compensación. El addon **se apaga con el resto**, y *«si lo quiere de
     nuevo, debe volver a suscribirse»*. Es deliberadamente la misma regla que `DEC-GRANT-001` y
     `DEC-TRIAL-009`: revocar corta el servicio y no repara.
- **El mecanismo es una transición propia, `S20`, y NO una ampliación de `S13`.** Ampliar el
  `desde` de `S13` reabriría la acotación *«principal»* que el commit `4e383480d` acababa de poner
  para cerrar el crítico #8, y `S20` además **evalúa una condición** (la compatibilidad), que es lo
  que el §41 exige. `B/03` §3.2.
- **Las cinco cosas de mecánica que la decisión no cubría, resueltas con su razón:**
  1. **Compatibilidad**: no se reinterpreta. Es lo que el §39 hace declarar al **producto**. `S20`
     alcanza al complemento cuyo producto declara compatible **la vertical que el acto ancla**.
     **El no compatible sigue cobrándose**, porque el grant es título **sólo donde ancló**.
  2. **El período ya pagado no se reembolsa** (`DEC-GRANT-001`), y un `UNA_VEZ` no tiene nada que
     convertir ni que devolver.
  3. **La fuente no cambia de forma**: sigue transportando `addon_instance.addon_version_id` y
     nunca `addon_product.version_id` — convertir a $0 **no es volver a comprar**. Lo que cambia de
     referente es el **título**, y como el §2.3 no admite una fuente sin referencia resoluble, la
     instancia registra **el ancla**, no *«el grant»*.
  4. **La instancia**: una `ACTIVE` no cambia de estado; una `PENDING_AUTHORIZATION` no se
     convierte —no hay nada comprado— pero su cobro se cancela igual. **La condición de huérfano
     no se toca: sigue con tres mitades.**
  5. **El detector**: la tabla de puertas a un terminal pasa de **siete a ocho** y la salvedad 4 de
     cuatro a cinco filas. Las comprobaciones de cero llamadas **siguen siendo cuatro**: se
     ampliaron dos, no se agregó ninguna.
- **Dos huecos preexistentes que este acto obligó a cerrar, y conviene saber que se cerraron acá**:
  `B/16` §3.3 (*«al revocar, el addon se corta»*) **no tenía transición para 3 de los 4 scopes** —en
  `LISTING`, `USER` y `GLOBAL` el objetivo nunca muere, así que la orfandad no llegaba nunca—, y lo
  cierra la tercera cláusula del evento de `A5`. Y **`F-8dA3-007` queda medio cerrado**: la columna
  del título que `B/16` §3.1 daba por existente **no existía**, y se escribió nombrando el hallazgo
  para que quien lo tome no agregue una segunda.
- **Lo que queda declarado abierto y NO se resolvió**: un addon de scope `USER`/`GLOBAL` compatible
  con **dos** verticales, en alguien cuyo grant ancla **una**, se convierte igual y queda gratis
  **también en la vertical que el grant no ancló**. Es la lectura literal del §35.2. Acotarlo
  —exigir que el grant ancle todas las verticales que el producto declara— es una decisión de
  producto y está declarada en `B/16` §3.4, sin tomar.
- **Origen**: la disyuntiva que la familia de `S13` de la 9-bis-3 declaró abierta en `B/03` §3.2 y
  `B/02` §2.6, y la elección del owner del 2026-09-21 entre las dos opciones que se le presentaron
  — eligió la 2, que era la recomendada, y contestó de entrada la pregunta que arrastraba.

---

### DEC-ADDON-004 — El complemento que se queda sin instancia muere en el acto: `CANCELLED`, sin período de gracia

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-ADDON-007`**: la condición de huérfano se lee sobre el conjunto de las principales y las anclas vivas, y el complemento de una pausa pedida por el cliente gana `PAUSED` — **y precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R1-c`: el `S21` del complemento corre antes que su propio `S12`; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8; ver su último 📌) · **Decide**: owner
- **El hueco**: un addon recurrente tiene **dos cosas separadas** — la **instancia** (la capacidad
  encendida) y la **suscripción de complemento** (el débito, con preapproval propio,
  `DEC-ADDON-002`). Cuando el addon queda huérfano, el diseño decía qué pasa con la instancia —`A5`
  la apaga— y **no decía en qué estado queda la suscripción**: ninguna transición la llevaba a un
  terminal por esa causa. Agravante medido: **el barrido la seleccionaba por el estado terminal de
  su INSTANCIA**, así que el proceso que la vigila la encontraba por un lado y ella misma no tenía
  estado declarado por el otro.
- **Decisión**: **`CANCELLED` en el acto**, junto con la instancia. **Sin período de gracia y sin
  sostener servicio.**
- **Por qué NO se aplica el patrón de `DEC-SUB-009`** (cancelar en el proveedor de inmediato y
  sostener el servicio hasta el fin del período pagado), que era la alternativa. Tres razones:
  1. **la capacidad ya la apagó `A5`**: no hay servicio que sostener, sólo la fila de un cobro;
  2. el contrato **ya descarta los `COMPLEMENTO` sin `TÍTULO` vivo** (`V/15` §2.6), así que
     sostenerlo no devolvería nada al pliegue;
  3. el costo sería un `CANCEL_SCHEDULED` **con reloj y fecha de fin de servicio sobre un estado
     vacío** — una fila que el barrido tiene que seguir mirando a cambio de nada.

  Dicho corto: **el addon complementa algo que ya no está.** Sostener días de un destaque sobre una
  ficha despublicada no le da nada a nadie.
- **El período pagado no se reembolsa automáticamente**, y va escrito, no implícito
  (`NUCLEO/08` §3, `B/09` §2.4, `S14`). Si corresponde devolver, va por **`DEC-RF-002`** — con su
  confirmación humana. La máquina no sostiene un estado vacío para compensar plata.
- **Es una fila propia, `S21`, y no un efecto de `A5`.** La escritura es sobre la columna de estado
  de una **suscripción**, y una de complemento usa **esa misma máquina**: un efecto de la tabla de
  addon que moviera esa columna es exactamente lo que la **regla 1 de `NUCLEO/03`** no admite.
  Precedente del mismo día: `S20` también lo dispara un acto de otra entidad y también es fila
  propia.
- **El evento se ata al estado de llegada de la instancia, no a un predicado**, y eso es lo que lo
  hace cubrir las dos puertas de la orfandad: las **tres cláusulas de `A5`** confluyen en la
  instancia llegando a `CANCELLED`. **Y alcanza también a `A6`** (la ficha borrada), porque
  excluirlo recreaba el mismo hueco por otra puerta y la razón del owner aplica idéntica.
- **La llamada al proveedor es UNA**: el preapproval de la instancia **es** el de la suscripción de
  complemento (`DEC-ADDON-002`). `S21` **no manda nada** al proveedor — escribe el estado local que
  faltaba. Ni duplicada ni omitida.
- **En el barrido**: las puertas a un terminal pasan de **ocho a nueve**, con `S21` **no exenta**
  (la dejó sin cobrar una llamada nuestra y no tiene rama de fallo). Entra por la **salvedad 1**,
  que ahora **puede nombrar su sujeto directamente** — y la selección por el estado de la instancia
  **no sobra**: es la única que ve la corrida que ejecutó `A5` y no llegó a `S21`.
- ~~**Una tensión previa que este arreglo NO resuelve y queda a la vista**: `12-contrato…` §2.8
  dice que *«desanclar no está declarado»* y `B/16` §4.3 enumera como cuarto momento de
  re-evaluación *«se revoca el grant, o **se retira el ancla de esa vertical**»*.~~ **RESUELTA el
  mismo día por `DEC-ADDON-006`**: el enunciado pasa a nombrar la revocación, que es un acto
  declarado. Se deja tachada y no borrada porque la nota es lo que motivó esa decisión.
- **Origen**: el hueco que la familia de `S13` de la 9-bis-3 dejó nombrado en `B/09` §3 y que la de
  `includesAddons` confirmó abierto, y la elección del owner del 2026-09-21 entre las dos opciones
  que se le presentaron — eligió la 1, que era la recomendada.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R1-c`, opción 2)**: cuando
  la principal y su complemento están en `CANCEL_SCHEDULED` con la misma fecha de fin —por
  `S11` o por `S26`—, en esa fecha corre primero el `S12` de la principal, la orfandad corre
  `A5` y `S21` toma el complemento antes que su propio `S12`. Si su último cobro pagó días
  posteriores, abre el motivo 14, que propone no devolver, y una persona ve el caso y puede
  apartarse. Se eligió contra la recomendación, que era proponer devolver la parte proporcional.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8)**: `S25` a `S28` salieron
  con la revisión del owner (C8).

---

### DEC-SUB-012 — El que paga después de que lo dimos por perdido se reabre, y el tope no es un plazo: es la condición que ya existía

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: `DECLARED_UNPAID` es donde queda un pago manual cuando un admin *«confirma que no
  se pagó»* (§30), y **la máquina no tenía ninguna transición que lo sacara**. Un cliente que
  transfiere dos semanas después dejaba la plata en la cuenta **sin desenlace**. Es el camino
  normal del que se atrasa y después paga, no un caso raro de sucesión.
- **Decisión**: **se puede reabrir.** `MP4` (`DECLARED_UNPAID` → `REGISTERED`) reactiva la
  suscripción.
- **Por qué acá se reabre y en las otras dos decisiones de esta misma semana no.** En
  `DEC-TRIAL-009` (revocar un grant) y `DEC-ADDON-003` (su addon) **nosotros** terminábamos algo
  deliberadamente y **la persona no había puesto plata nueva**. Acá **la persona puso plata**, y
  hacerle repetir el trámite es fricción sobre alguien que está tratando de volver — lo contrario
  de lo que `DEC-SUB-003` eligió al hacer del camino de recuperación *«una salida del problema en
  vez de un muro»*.
- **El tope: se propuso el día 180 y NO cierra.** El orquestador propuso acotar la reapertura a
  *«mientras la ficha no se haya borrado»*, por ser un límite ya existente. Se verificó y falla por
  tres razones, las tres contra el texto:
  1. **es el reloj de la ficha y el sujeto es la suscripción** — una principal cubre **todas** las
     fichas de su vertical, así que un anfitrión tiene N relojes y ninguno es *«el suyo»*; y el
     pagador manual es justo el que menos lo tiene, porque el §17.2 lo admite en **Partner**, cuya
     presencia *«no es una ficha»*;
  2. **`DEC-DATA-002` acaba de volverlo no-monótono** — cuatro hechos de reinicio, el primero *«un
     acto del dueño sobre la ficha»*. Un tope que se reinicia solo no es un tope;
  3. **crea una segunda dependencia sobre una cifra que `G-R5` no vigila**, porque ese guard
     compara sólo tope-de-pausa contra hard-delete.
- **El tope que rige ya estaba escrito, y no es un plazo**: es la **condición 1 de `B/05` §3** —*la
  suscripción existe y está en `GRACE_PERIOD` o `SUSPENDED`*—, la misma que `S7` ya exige. **Cierra
  con actos, no con el calendario**: cancelar la suscripción (una de las doce acciones
  administrativas) o `S13`. **Lo que NO acota, dicho en voz alta**: una `SUSPENDED` de pagador
  manual que nadie cancela **es reabrible indefinidamente**, porque sin preapproval el espejo del
  §10.1 nunca la alcanza.
- **Las cuatro cosas de mecánica, resueltas:**
  1. **Fila propia `MP4`**, no `MP1` ampliado: los efectos difieren de verdad (`S5` desde grace,
     `S7` desde suspendida). `G-R4` sigue contando ~~**tres**~~ **cuatro** pares.
     - ***Corregido el 2026-09-23***: eran tres el día que se escribió y **hoy son cuatro** — el
       cuarto lo creó `S25` (`DEC-SUB-015`). La FASE 9-bis-5 recontó el conjunto entero contra la
       tabla de `NUCLEO/03` §1 regla 7 y corrigió los **cuatro** sitios del corpus; **éste era el
       quinto y vive fuera de él**, que es el *«cuarto desenlace»* que `DEC-METH-012` dejó
       declarado: la aparición que el alcance del rastro excluye por definición. **La razón de la
       decisión no depende de la cifra** — `MP4` sigue sin agregar ningún par.
  2. **Va a `ACTIVE` directo, y es seguro por construcción**: el pagador manual **no tiene débito
     en el proveedor**, así que `PA-5` no tiene sujeto; y si lo hubiera y estuviera cancelado, la
     fila ya no estaría en `SUSPENDED` —el barrido diario la lee y el espejo del §10.1 la habría
     llevado a `CANCELLED`—, donde la condición 1 la rechaza sola.
  3. **Lo adeudado**: `B/12` §5.3 (*«la deuda vieja no se persigue por separado»*) **no aplica**,
     porque su población no existe acá: allá el cliente **deja atrás** la cuota y acá **la paga**.
     No hay remanente ni recargo. Lo que sí se hereda entero es que **no reactiva durante una
     sucesión**: queda pendiente por `S19`.
  4. **El barrido no cambia**: sus nueve puertas y sus cuatro salvedades son sobre terminales **de
     una suscripción**, y `DECLARED_UNPAID` es del `manual_payment` — nunca estuvo ahí. Las doce
     acciones administrativas tampoco: `MP4` es *«registrar un pago manual»* desde otro origen.
- **Una decisión de producto que esto NO resuelve y queda declarada abierta**: **quién crea las
  cuotas de un pagador manual y cuándo** — qué pasa con los períodos que transcurren mientras la
  suscripción está `SUSPENDED`. Es **anterior** a `MP4` (`F-8B2-018`: la máquina tampoco declara
  hoy la entrada a `AWAITING`) y `MP4` **no la agrava**, porque no crea filas de `manual_payment`:
  sólo mueve la que `MP2`/`MP3` cerraron.
- **Origen**: el hueco que la familia del pago manual de la 9-bis-3 dejó declarado abierto en
  `B/03` §3.2, y la elección del owner del 2026-09-21 entre las tres opciones que se le presentaron
  — eligió la 1, que era la recomendada.

---

### DEC-ADDON-005 — La fuga del addon `USER`/`GLOBAL` SE DEJA, y está decidido: no es un pendiente

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso**: un addon de scope `USER` o `GLOBAL` compatible con **dos** verticales, en alguien
  cuyo grant ancla **una**, se convierte a $0 por `S20` —porque *es* un addon compatible— y **queda
  gratis también en la vertical que el grant no ancló**.
- **Decisión: se deja así.** `B/16` §3.4 pasa de *«es una decisión de producto y no se toma acá»* a
  una decisión cerrada, con su causa. **No queda como abierto de `DEC-METH-006`, porque no depende
  de nada**: está elegida.
- **Las tres razones:**
  1. **Es la lectura literal del §35.2.** *«Compatible»* es lo que el **producto** declara (§39);
     acotarlo pediría una **tercera noción** de compatibilidad que ningún § escribe.
  2. **La población pide cuatro condiciones simultáneas**: que el addon sea de scope `USER` o
     `GLOBAL`, que su producto declare dos o más verticales, que el beneficiario lo tenga
     comprado, y que su grant ancle sólo una de ellas.
  3. **Acotarla cuesta más que la fuga**: ataría el acto de otorgar al catálogo de addons del
     beneficiario y obligaría a `S20` a releer el producto — que es justo lo que *«convertir a $0
     no es volver a comprar»* prohíbe.
- **Y no es indefinida**: **se apaga con el grant**, por la tercera cláusula de `A5`
  (`DEC-ADDON-006`).
- **Origen**: declarada por la familia de `includesAddons` en `B/16` §3.4, y la elección del owner
  del 2026-09-21.

---

### DEC-ADDON-006 — La tercera cláusula de `A5` nombra la REVOCACIÓN, porque desanclar no existe

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El defecto**: el evento de `A5` decía *«se retira el ancla que era su título»*, y **retirar un
  ancla no existe en ningún catálogo**: `NUCLEO/08` §3 declara para el grant exactamente **tres**
  escrituras —otorgar, anclarle una vertical nueva, revocar— y la palabra *«desanclar»* **no
  aparece en todo el corpus**. Era una transición esperando un acto que nadie puede producir.
- **Decisión**: la cláusula **se conserva y cambia de enunciado** — pasa a decir **«se revoca el
  grant del que cuelga el ancla que era su título»**. Se descartó declarar el acto de desanclar,
  que era la otra opción y arrastra un acto administrativo nuevo con todo lo que eso implica.
- **Por qué la cláusula NO se borra, que es lo que parecía más simple y es lo peligroso**: es **lo
  único que apaga el addon cuando se revoca el grant, para 3 de los 4 scopes**. En `LISTING`,
  `USER` y `GLOBAL` el objetivo del addon **nunca muere** —la ficha sigue ahí, la cuenta sigue
  ahí—, así que la condición de huérfano **no se cumple jamás**. Sin ella, revocar dejaba al addon
  convertido **funcionando gratis para siempre** y sin suscripción, porque `S20` se la canceló al
  convertirlo.
- **Por qué el enunciado nuevo cubre lo mismo, verificado**: revocar es *«UNA revocación»* sobre
  *«UN instrumento con UN ANCLA POR CADA VERTICAL»* (`12-contrato…` §2.8), o sea **retira todas
  las anclas a la vez**. Y **no hay otro acto que retire un ancla**: otorgar crea y anclar
  **agrega**.
- **Una premisa que esto vuelve falsa, y se retiró**: `B/02` §2.4 justificaba apuntar la columna al
  ancla y no al grant con dos razones, y **la segunda** —*«retirar una vertical cortaría los addons
  de las otras»*— **describía el acto inexistente**. Se retira; la primera alcanza sola (saber **en
  qué vertical** el addon es gratis). **La columna sigue apuntando al ancla: el modelo no cambia.**
- **Origen**: la tensión que `DEC-ADDON-004` dejó nombrada, verificada contra el texto por el
  orquestador —que había propuesto mal la opción de borrar la cláusula—, y la elección del owner
  del 2026-09-21 entre las dos opciones corregidas.

---

### DEC-SUB-013 — La cuota del pagador manual la abre un reloj, y no se abre mientras está suspendido

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 9 completa: la cuota de quien se va; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8; ver su último 📌) · **Decide**: owner
- **El hueco**, que es `F-8B2-018` y es anterior a esta semana: la máquina del pago manual tenía
  **cuatro salidas** —`MP1` a `MP4`— y **ninguna entrada**. **Nadie había declarado quién crea la
  fila `AWAITING` ni cuándo.**
- **Decisión, las dos mitades:**
  1. **La abre un reloj**, al inicio de cada período — el mismo instante en que el proveedor habría
     cobrado. **No la abre un admin a mano**: una cuota que nadie crea es **servicio gratis
     silencioso**, y no falla ruidosamente.
  2. **No se abre mientras la suscripción está `SUSPENDED`.** El que vuelve paga **el período que
     arranca**, no los que pasó suspendido.
- **Por qué la mitad (2), y no es una concesión suelta**: es lo que el diseño ya decidió dos veces
  — `B/12` §5.3 (*«la deuda vieja no se persigue por separado»*) y `DEC-SUB-012` (el que paga tarde
  paga **esa** cuota, no un remanente)— y es coherente con `DEC-SUB-003`: que volver sea *«una
  salida del problema en vez de un muro»*.
- **`MP5`**, la fila nueva: *(sin fila)* → `AWAITING`, evento *«un reloj abre el período»*. La
  máquina **sigue teniendo tres estados**, porque *(sin fila)* vive afuera de la columna, igual que
  en la de suscripción.
- **Corre SÓLO sobre `ACTIVE`**, y los otros cinco vivos tienen su razón escrita:
  `PENDING_AUTHORIZATION` porque el período lo arranca `S2`; `GRACE_PERIOD` ~~porque el período no
  avanza hasta que entra el pago y~~ porque **la cuota ya existe**; `CANCEL_SCHEDULED` porque ningún período
  nuevo empieza antes de `S12`; `SUSPENDED` por la decisión; y `PAUSED` por el punto siguiente.
  - ***Enmendado el 2026-09-21 por la FASE 9-bis-4 (crítico `F-8eB1-002`).*** La mitad tachada era
    falsa: **el período sí avanza**, y lo avanzan `MP1` y `MP4` al quedar registrada la cuota. La
    conclusión —que `MP5` no corra sobre `GRACE_PERIOD`— **no cambia**, y se sostiene entera con la
    mitad que quedó: ahí la cuota ya existe, y `MP5` es idempotente por esa misma condición.
- **La pausa no contradice a `B/06` §7** (*«un pago manual mensual no tiene nada que pausar»*), y
  por dos razones distintas: `CUSTOMER_REQUEST` tiene **población vacía** —`S8` exige
  `puedePausar()`, que da `false`—, y `COURTESY` sí existe, y ahí **no abrir cuota es lo que la
  cortesía significa**: sobre un pagador manual la mitad *«pausar en el proveedor»* de
  `DEC-GRANT-003` no tiene sujeto, así que lo único que queda es no pedirle la plata.
- **Al reabrir por `MP4`, el período se RE-ANCLA al instante de la reactivación.** ~~No es una
  elección: con el ancla vieja el reloj crearía de golpe todo el atraso que la mitad (2) mandó no
  crear.~~ Es específico de esa puerta y **no se escribe en `S7`**, porque el pagador con tarjeta no
  re-ancla (`EX-39`).
  - ***Enmendado el 2026-09-21 por la FASE 9-bis-4 (crítico `F-8eB1-001`), y las dos mitades
    tachadas eran falsas por separado.*** **Sí era una elección**: hoy es un **tope**, no un
    re-anclaje —la fecha salta al instante de la reactivación **sólo si cayó en el pasado**—,
    porque el re-anclaje incondicional le cobraba **dos veces** los días que le quedaban al que
    transfiere dentro del período que estaba pagando. Y el *«de golpe»* **es falso en el
    mecanismo**: `MP5` nombra **un** período por corrida, así que nunca crea todas las cuotas
    juntas; es verdadero sólo en el desenlace acumulado. Esa mitad falsa era la que le agrandaba el
    alcance al remedio hasta una población en la que su propio motivo no existe. **La mitad (2) de
    la decisión no cambia**: el que vuelve sigue pagando el período que arranca y no los que pasó
    suspendido.
  - ***Enmendado otra vez el 2026-09-23 por la FASE 9-bis-5 (crítico `F-8fB1-001`): el tope se
    RETIRÓ entero.*** El tope dejaba la fecha del próximo cobro **en el instante de la
    reactivación**, que es exactamente el valor con el que dispara `MP5`, cuya condición es *«ya
    llegó»*: el que se reabría tras una suspensión larga pagaba el período que pasó suspendido **y**
    el que arrancaba, y `S4` lo devolvía al grace el mismo día. **Un tope sobre una fecha que otra
    condición lee como «ya llegó» no es un tope: es un disparador.** Hoy el mecanismo es una
    **REIMPUTACIÓN de la cuota**: si el período que la cuota cubre ya terminó, `MP4` la reimputa al
    período que arranca en la reactivación antes de registrarla, y el avance de un ciclo sale de
    ahí. La fecha queda en *reactivación + 1 ciclo*. **La mitad (2) se sigue cumpliendo literal**, y
    por un mecanismo que esta viñeta no nombraba. Implementado en `B/03` §7.2 (`7a92b4da4`); **el
    texto vigente es el del capítulo.**
- **Sin aviso nuevo**: el catálogo de `NUCLEO/07` §6 no gana fila. El aviso del §30 al admin no
  cambia de momento — lo que `MP5` le aporta es **el sujeto que no tenía**.
- **Y de paso cierra la otra mitad de `F-8B2-018`**: cómo entra el grace de un pagador manual. No
  hace falta fila nueva, lo carga `S4` con el evento leído **sobre la cuota** y no sobre el
  proveedor, que es lo que el §30 ya ordenaba y lo que `MP1`/`MP2` ya presuponían.
- **Modelo**: `manual_payment` gana **el período** —que el `UNIQUE` de `B/05` §C5 ya presuponía— y
  sus tres campos de registro pasan a anulables. **Sin estado nuevo y sin columna de monto**, que
  se resuelve de la versión anclada.
- **Origen**: `F-8B2-018`, declarado abierto por la familia del pago manual de la 9-bis-3 y
  reafirmado por `DEC-SUB-012`, y la elección del owner del 2026-09-21 entre las tres opciones que
  se le presentaron — eligió la 1, que era la recomendada.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 8f; `09-…` `AO-6`,
  `F-8CB2-005`).** La cuota la abre un reloj **y la cierra la salida**: **tercera cláusula de `MP3`**
  —si la suscripción sale de `GRACE_PERIOD` o de `PENDING_AUTHORIZATION` por cualquier transición que
  no sea `S5`, `S6`, `S2`/`S29` ni `S3`, la cuota abierta pasa a `DECLARED_UNPAID` **sin efecto sobre
  la suscripción**—, en las **diez** salidas del dominio: seis desde el grace (`S13`, `S17`, `S20`,
  `S21`, `S24`, `S26`) y cuatro desde `PENDING_AUTHORIZATION` (`S13`, `S20`, `S21`, `S28`). Sin esto
  la cuota de quien se iba quedaba `AWAITING` para siempre, y registrarla con `MP1` avanzaba un ciclo
  la fecha de una suscripción `CANCELLED`. La máquina sigue con tres estados; `MP4` desde ahí exige la
  fila viva por la condición 1 de `B/05` §3.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8)**: `S25` a `S28` salieron
  con la revisión del owner (C8).

---

### DEC-METH-011 — La obligación alcanza a las DECISIONES, no sólo a los arreglos, y el rastro por aparición es un ARCHIVO

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-010`**, que **no la deroga**: la enmienda se midió y **funciona donde se
  ejecuta**. Lo que esta decisión corrige son las dos puertas por las que se dejó de ejecutar.
- **Problema, medido en la FASE 8-bis-4**: **83 hallazgos, 13 IDs `CRITICA`, 12 defectos críticos
  distintos**, y **12 de 12** los introdujo la tanda anterior. La serie completa:

  | | 8-bis | 8-bis-2 | 8-bis-3 | 8-bis-4 |
  |---|---|---|---|---|
  | críticos distintos | — | 17 | 14 | **12** |
  | atribuidos a la tanda anterior | 25/25 | 17/17 | 13/14 | **12 de 12** |

- **El diagnóstico, y es el primero de las cuatro vueltas que trae evidencia POSITIVA**:
  1. **Los dos únicos commits que ejecutaron la obligación 2 con cifras produjeron CERO de los
     doce críticos.** Uno de ellos, `1e3c3fc9e` —*«72 apariciones no corregidas quedaron
     justificadas una por una»*—, tocó **16 archivos**: exposición comparable a `621332e7c`, que
     tocó **18** y produjo **cinco**. **No es que la enmienda no sirva: no se ejecutó en 9 de los
     11 commits de la tanda.**
  2. **Nueve de los doce críticos salieron de los SEIS commits de decisiones**, que no reportan
     ninguna cifra de apariciones **aunque los seis editan capítulos y los seis editan el núcleo**.
     El generador se mudó: de los commits de arreglo a los de decisión.
  3. **El rastro por aparición no existe como artefacto.** Los once commits de la tanda **no
     agregan ningún archivo**, el worklog no lo contiene, y
     `rg -i "por aparici|declaradas correctas|apariciones recorridas"` sobre `.specs/` —excluidos
     los informes de fase— devuelve **sólo este log**, que es donde la regla se enuncia. Así que
     *«72 justificadas una por una»* es hoy **tan falsable como el «101 declaradas correctas»** que
     motivó `DEC-METH-010`.
  4. **5 de los 9 críticos que se escapan nacen en prosa que el commit escribió o editó** — que es
     exactamente lo que la versión acotada de la obligación 2 saca de su rastro.
- **Decisión, y son dos partes que van juntas:**
  1. **La obligación alcanza a TODO commit que edite el corpus, no sólo a los de arreglo.** Una
     decisión del owner que toca capítulos es un arreglo a los efectos de `DEC-METH-010`: redefine
     términos, crea transiciones y vuelve falsas premisas ajenas igual que cualquier otro. **Las
     tres obligaciones de `DEC-METH-010` corren idénticas sobre ella.**
  2. **El rastro por aparición se escribe como ARCHIVO, no en el mensaje del commit.** Vive en
     `<carpeta-de-la-fase>/rastro-<commit-corto>.md` y lleva, por cada aparición **no corregida**:
     archivo, §, la cita, y **por qué sigue siendo correcta**. Un agregado en el cuerpo del commit
     **ya no cumple la obligación 2**.
- **Por qué el archivo y no el mensaje, dicho en voz alta**: un mensaje de commit **no se puede
  verificar contra nada** —es texto libre que nadie vuelve a leer— y **un mensaje de commit no es
  evidencia de lo que se hizo**, que es una regla que el programa ya aplicaba a los informes y no
  se aplicaba a sí mismo. Un archivo, en cambio, **se grepea, se cuenta y se puede contradecir**:
  la vuelta que viene puede tomar una línea del rastro y mostrar que la resolución era falsa. Eso
  es lo único que convierte *«la miré»* en algo distinto de *«la resolví bien»*, que es el modo que
  `DEC-METH-010` no llegó a cerrar.
- **El costo aceptado, y es el caro de las tres opciones que se presentaron**: escribir el rastro
  de una decisión **cuesta más que la decisión**. `1e3c3fc9e` justificó 72 apariciones y
  `c29b318c7` recorrió 90. Con la extensión a los seis commits de decisiones el volumen crece, y el
  owner lo eligió igual **por encima de la opción barata** —sólo exigir el archivo, sin extender—,
  porque ésa dejaba intacto el modo que produjo **9 de los 12**.
- **Lo que esto NO cierra, declarado como lo declara `DEC-METH-010`**: sigue afuera **«el capítulo
  que nunca nombró el término»**, que ninguna búsqueda devuelve en ningún alcance y sólo encuentra
  recorrer el dominio por el eje del tiempo. Y sigue afuera **la prosa que el propio commit
  escribe**: la obligación 2 acotada excluye los párrafos que el commit tocó, y ahí nacen **5 de
  los 9** que se escapan. Esta decisión **no levanta esa exclusión** — la deja medida para la
  vuelta que viene.
- **Origen**: la FASE 8-bis-4, `20-fase-8-bis-4/C1-la-costura.md` §4, y la elección del owner del
  2026-09-21 entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-DATA-003 — El cupo que vuelve a alcanzar republica solo: `PB3` gana la rama simétrica a la del excedente

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **Cierra** el defecto crítico `F-8eA2-001` de la FASE 8-bis-4.
- **El caso**: un anfitrión con cinco fichas baja de Premium a Básico y el reconciliador le
  despublica tres. Tres meses después **vuelve a Premium y paga el precio entero**, y sus tres
  fichas **no vuelven nunca**. `PB2` tiene dos ramas y la del excedente está declarada como la que
  *«no cambia `cubierto` y sí el cupo»*; `PB3` y `PB7` exigen que `cubierto` **pase** a verdadero,
  y sobre alguien que estuvo cubierto todo el tiempo no hay cambio que disparar. El reconciliador
  tampoco lo levanta: *«actúa sólo si algo bajó»* (`V/15` §4.2). Desde
  `UNPUBLISHED_BY_BILLING` no sale ninguna otra transición salvo el reloj, así que el día 90 `PB4`
  las archiva y el día 180 el hard delete les borra el contenido. **Paga Premium y recibe Básico,
  indefinidamente, sin que nada lo señale.**
- **Decisión**: **`PB3` gana una segunda rama, simétrica a la segunda de `PB2`: *«el cupo vuelve a
  alcanzar»*.** Las fichas del excedente se republican **solas** cuando el cupo las vuelve a
  admitir, sin que el dueño tenga que entrar al panel.
- **Las dos alternativas, y por qué se descartan:**
  - **A mano, con la ficha viva**: el excedente va a un estado nuevo desde el que el dueño
    republica cuando quiere, con el reloj detenido. Cuesta un estado nuevo en la máquina de
    publicación, y **el que no entra nunca al panel igual pierde la ficha**: sólo hace correr el
    reloj más lento.
  - **A mano, reusando `PB8`**: darle a `UNPUBLISHED_BY_BILLING` la salida por acto del dueño que
    hoy sólo tiene `ARCHIVED`. Es la más barata —una fila— pero **el dueño tiene que enterarse, y
    hoy nada le avisa que le despublicaron tres fichas**.
- **El motivo, y es el criterio del owner aplicado literalmente**: *si la persona puso plata, se le
  da salida*. Acá **volvió a Premium y pagó**, que es la forma más explícita que tiene de decir qué
  quiere. Las dos alternativas le cobran Premium y le entregan Básico hasta que entre al panel, y
  el que no entra nunca es justamente el que pierde el contenido el día 180.
- **El costo aceptado, dicho en voz alta**: la rama **obliga a escribir un criterio de orden** —si
  se liberan tres cupos y hay cinco candidatas, cuáles suben—. **No es costo nuevo**: `PB3` y `PB7`
  ya compiten hoy por el mismo cupo sin criterio escrito (`F-8eA2-010`, `F-8eA1-006`), así que el
  criterio hace falta igual. Lo que esta decisión agrega es la obligación de escribirlo ahora.
- **Y el precedente que lo gobierna**: `DEC-SUB-008` ya exige un criterio *«escrito y predecible»*
  para decidir **qué se baja**. Esto lo extiende a **qué se sube**, que es la mitad que faltaba.
- **El riesgo aceptado**: se republica sola una ficha que el dueño **quizá ya no quiere pública**.
  Se acepta porque el estado del que viene no es *«la despubliqué yo»* sino
  `UNPUBLISHED_BY_BILLING` —la bajamos nosotros—, y devolverla al estado anterior a nuestro acto es
  lo que repara nuestro acto. El dueño que no la quiera pública tiene ~~`PB1`~~ **`PB6`** y la
  despublica. *(Corregido el 2026-09-21 por la FASE 9-bis-4: `PB1` sale sólo de `DRAFT`, así que la
  transición que despublica a mano es `PB6`. La decisión no cambia; la sigla estaba mal.)*
- **Los otros cuatro críticos que `DEC-DATA-002` produjo NO llevan decisión y se arreglan**, y va
  escrito acá para no volver sobre el tema: `F-8eA3-002` (el reloj sin columna), `F-8eA3-001` (la
  clave del outbox que manda los dos avisos una sola vez en la vida de la ficha), `F-8eA2-002`
  (`S10` sin rama de fallo) y `F-8eA1-001` (`PB8` inejecutable contra el piso). **Declarar
  cualquiera de los cuatro con causa significaría *«la ficha se borra igual»*, que es exactamente
  lo que `DEC-DATA-002` prohibió**: no son objeciones a la decisión, son la decisión sin terminar
  de escribir.
- **Origen**: la FASE 8-bis-4, hallazgo `F-8eA2-001`, y la elección del owner del 2026-09-21 entre
  las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-007 — La cortesía que el espejo se lleva puesta NO se re-apunta: se re-emite sobre la sucesora cuando autoriza

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R17`: la cortesía re-emitida arranca al agotarse el crédito; ver su 📌) · **Decide**: owner
- **Cierra** el defecto crítico que la FASE 8-bis-4 reportó por **tres** IDs desde tres vectores
  distintos —`F-8eB2-001`, `F-8eB3-001` y `F-8eB1-003`—, verificados como un solo defecto en
  `20-fase-8-bis-4/C1-la-costura.md` §2.
- **El caso**: un cliente con una cortesía vigente —N días sin cobrar, firmados por `SUPER_ADMIN`—
  está en medio de un cambio de plan. **El proveedor da de baja su preapproval por su cuenta**, el
  espejo mata a la predecesora y `S18` cierra la sucesión **re-apuntando la cortesía a la
  sucesora**, que está en `PENDING_AUTHORIZATION`. Ahí `S18` va *«al mismo estado»* y **el único
  evento que lleva a `PAUSED · COURTESY` es `S9`**, que sale de `ACTIVE` y lo dispara
  `SUPER_ADMIN`. Los dos desenlaces le cobran: o `S18` escribe una pausa que ninguna fila declara
  —y la regla 1 la manda a la marca— o la sucesora autoriza, cobra y sigue cobrando con una
  cortesía re-apuntada que es *«una fila de base que no hace nada»*.
- **Decisión**: **la cortesía no se re-apunta en el cierre. `S18` guarda el SALDO DE DÍAS, y la
  cortesía se re-emite sobre la sucesora cuando ésta autoriza** — o sea cuando llega a `ACTIVE`,
  que es exactamente el `desde` que `S9` ya tiene. Lo único nuevo es **dónde vive el saldo** y que
  **el disparador sea la autorización de la sucesora** en vez del acto de `SUPER_ADMIN`.
- **Las dos alternativas, y por qué se descartan:**
  - **Que la sucesora herede la pausa** con una fila nueva que la lleve a `PAUSED · COURTESY` al
    cerrarse la sucesión. Es la más elegante y la más corta de escribir, y **se descarta por una
    razón de método, no de diseño**: apoya el mecanismo en **una capacidad del proveedor que nadie
    midió** —pausar un preapproval que todavía está `pending`—, y lo que sí está medido apunta en
    contra: `EX-11` `VERIFIED` dice que **una pausada no acepta ninguna modificación** (`400`
    explícito). Si no se puede, el diseño queda inejecutable y nos enteramos en FASE 10.
  - **Que la cortesía se pierda y se declare**. Cuesta cero y **es el único que contradice el
    criterio del owner**: la pérdida **no la causa un acto deliberado nuestro** —la causa el
    proveedor dando de baja el preapproval— y la persona tiene días que `SUPER_ADMIN` le firmó.
- **El motivo**: es la única de las tres que **no apoya el diseño en una medición que no existe**, y
  su riesgo cae en un camino que el programa **ya tiene construido y decidido**. Reusa `S9` tal como
  está, con su condición *«no hay pausa vigente»* intacta: una sucesora recién autorizada no tiene
  pausa, así que la fila corre sin tocarse.
- **El riesgo aceptado, dicho en voz alta**: entre que la sucesora autoriza y la cortesía se
  re-emite, **el proveedor puede cobrar el primer pago**. Ese cobro **se devuelve por el camino que
  ya existe** —`DEC-RF-002`, el reembolso que confirma una persona— y **no se inventa un mecanismo
  nuevo** para evitarlo. Se prefiere un cobro que se devuelve por una vía escrita antes que una
  pausa que quizá el proveedor no acepta.
- **Lo que esto NO cambia**: `DEC-GRANT-003` sigue entera —la cortesía se implementa **pausando**,
  porque el piso son ARS 15 (`PC-2`) y ni `free_trial` ni correr la fecha de cobro se pueden
  aplicar a una suscripción viva (`EX-35`, `EX-34`)—. Lo que cambia es **cuándo** se pausa: no en
  el cierre de la sucesión, sino cuando hay una fila `ACTIVE` que se pueda pausar.
- **Origen**: la FASE 8-bis-4, hallazgos `F-8eB2-001` / `F-8eB3-001` / `F-8eB1-003`, y la elección
  del owner del 2026-09-21 entre las tres opciones que se le presentaron — eligió la 2, que era la
  recomendada.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R17`)**: sobre una sucesora
  que vive del crédito de `DEC-SUB-006`, la cortesía re-emitida arranca al agotarse el crédito;
  `S9` sigue corriendo al autorizar y la pausa cruza los N cobros que caen desde ese día.

---

### DEC-SUB-014 — La baja desde `GRACE_PERIOD` corta el servicio en el acto

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El hueco**: al escribir `S22` (desde `PAUSED`) y `S23` (desde `SUSPENDED`), la FASE 9-bis-4
  recorrió los seis estados vivos y encontró que **`GRACE_PERIOD` sigue sin fila de baja**. A
  alguien le rebotó la tarjeta, está en los 7 días de gracia y **decide irse en el medio**: hoy
  ninguna fila lo ejecuta, el intento se va a la marca por la regla 1 del núcleo, y mientras una
  persona lo mira **el reloj del grace sigue corriendo hacia `SUSPENDED`**.
- **Lo que el diseño existente no resolvía**: `DEC-SUB-009` fija que al cancelar se guarda
  **nuestra** fecha de fin de servicio, y **no dice cuál es cuando el período en curso no está
  pagado**. En `S11` (desde `ACTIVE`) la respuesta es clara —el cliente pagó el período, el
  servicio corre hasta que termine—; en `GRACE_PERIOD` **no pagó**.
- **Decisión**: **corta en el acto**, con `fin_real` en el día de la cancelación, igual que `S22` y
  `S23`. Es una fila propia de `B/03` §3.2, con `desde` = `GRACE_PERIOD`, evento *«pide la baja»*,
  `hacia` `CANCELLED` directo — **sin pasar por `CANCEL_SCHEDULED`**, por la misma razón que las
  otras dos: no queda período pagado que sostener.
- **El motivo**: es **el criterio que ya gobierna `S22` y `S23`** —*«no queda período pagado que
  sostener»*— aplicado al estado donde es más literal que en ninguno: **el grace existe porque el
  cobro falló**. El ciclo anterior ya se consumió, que es precisamente por lo que la fila está ahí.
- **Las dos alternativas, y por qué se descartan:**
  - **Correr el reloj del grace y cortar al vencer**, dándole la ventana completa por si paga:
    obliga a un estado intermedio —*«de baja pero viva»*— y **deja el candado `A` ocupado** durante
    esos días, que es **el mismo encierro que `S23` acaba de venir a romper**.
  - **No escribir la fila** y que el que quiere irse espere a que lo suspendan para usar `S23`: le
    pide a alguien que decidió irse que aguante una semana a que lo suspendan por falta de pago, y
    **el correo de suspensión del proveedor insinúa mora** (`PA-5`, medido). Un mal trago por nada.
- **Pendiente de implementación al momento de escribirse**: la fila **no está escrita todavía** en
  `B/03` §3.2. Se difirió a propósito porque la familia de la sucesión estaba editando ese mismo
  archivo, y dos escrituras simultáneas sobre la misma tabla es exactamente lo que esta fase evita
  corriendo las familias en serie. **Entra en una tanda corta posterior**, junto con el recuento de
  todo lo que la fila nueva mueve (las puertas del cap. 09, las transiciones de `B/16` §4.3, la
  regla 7 y las ramas de `B/12` §5.3).
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 1 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-SUB-015 — La suscripción pausada NO entra al piso de una vertical discontinuada: se le avisa, y al volver elige plan nuevo

- **Fecha**: 2026-09-21 · **Estado**: **SUPERSEDED (revisión del owner, 2026-09-28, C8)**: las verticales no se discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces, y este texto queda como punto de partida · **Decide**: owner
- ***Corregido el mismo día, y el error era del encuadre con que se presentó el caso, no de la
  decisión***: esta entrada nació diciendo *«el retiro de un plan»*, y **ese acto no produce el
  caso**. `B/10` §3 dice literal que **«retirar un plan no mueve a nadie»** y que *«un plan retirado
  sostiene a sus clientes por tiempo indefinido»*, y el §4.3 avisa que *«esto NO es el retiro de un
  plan del §3»*. El acto que produce el caso es **la discontinuación de una vertical** (§4.3), que
  es donde la decisión se implementó.
- **El hueco, que es anterior a los arreglos de esta tanda**: `B/10` §4.3 manda a
  `CANCEL_SCHEDULED` a **cada suscripción viva** alcanzada por la discontinuación de una vertical
  —los **60 días de piso**— y **no excluía a las pausadas**, mientras `B/03` §3.3 **prohíbe** llegar
  a `CANCEL_SCHEDULED` desde `PAUSED`, porque **`EX-11` midió que el proveedor rechaza toda
  modificación sobre una pausada**. Es una instrucción que ordena un movimiento imposible: el caso
  moría en la marca. La FASE 9-bis-4 lo encontró al recorrer, no lo creó.
- **El escenario está declarado improbable por el owner, y la corrección se conserva igual.** El
  owner declaró el 2026-09-21 que **una vertical no se va a discontinuar**, y que si algún día se
  decide **se resolverá en el momento**. Eso NO retira nada de lo escrito, y la razón es que
  **la contradicción entre `B/10` §4.3 y `B/03` §3.3 era real con escenario o sin escenario**: un
  capítulo ordenaba lo que otro prohíbe, que es exactamente la clase de defecto que el ciclo
  `DEC-METH-006` existe para eliminar. Lo que la declaración del owner sí cierra es **la pregunta
  del saldo de cortesía sin destino** (ver `DEC-GRANT-010`): no se define, y queda declarada con
  causa.
- **Y la ventana no es un borde raro**: el tope de una pausa son **120 días** y el piso son **60**,
  así que una pausa que sobrevive al piso es el caso **normal**, no la excepción.
- **Decisión, tres partes:**
  1. **La pausada NO entra al piso.** Queda `PAUSED` apuntando a un plan retirado, y **eso es
     legal**: hay que decirlo con todas las letras en `B/10` §4.3, que hoy la incluye sin poder
     alcanzarla.
  2. **El aviso sale al RETIRAR el plan, no al reanudar.** Es la parte que carga toda la ventaja de
     esta opción: el cliente se entera con la pausa corriendo y con tiempo para decidir, en vez de
     encontrarse con la novedad el día que vuelve.
  3. **Al reanudar elige un plan nuevo**, y la fila pausada termina ahí. `S10` no puede llevarla a
     `ACTIVE` sobre un plan que no existe: **qué transición ejecuta ese final es lo que la tanda
     corta tiene que escribir**, y no se inventa acá.
- **El motivo, y es una medición de esta misma vuelta, no una preferencia de estilo**: la
  alternativa recomendada por el agente —mantener la pausa y **congelar el reloj del piso**—
  agregaba **un segundo reloj que se detiene y se reanuda**. Ese mecanismo entró al programa esta
  misma mañana con `DEC-DATA-002` y **produjo cinco de los doce críticos de la FASE 8-bis-4**: el
  reloj sin columna, el aviso que se manda una sola vez, `S10` sin rama de fallo, `PB8` contra el
  piso y el excedente sin vuelta. **Cinco de doce, de un solo mecanismo, en una sola vuelta.**
  Proponer un segundo reloj con hechos de reinicio dos días después de medir eso es repetir a
  sabiendas el mecanismo más caro del programa. Esta decisión **no toca la máquina de estados**: es
  una rama del aviso.
- **Las tres alternativas, y por qué se descartan:**
  - **El piso con el reloj congelado** durante la pausa (la recomendada por el agente): compra la
    garantía *«nadie pierde su plan sin sus 60 días»* al precio de arriba.
  - **El piso sin congelar**: el plan se le vence estando pausado —a la **mayoría** de los que
    pausan, por los 120 contra 60— y hay que escribir igual a qué plan vuelve. Paga casi el mismo
    costo estructural y no compra la garantía.
  - **Interrumpir la pausa** para meterla al piso: **le cortás una pausa que pagó**, o le terminás
    una cortesía antes de tiempo. Acto nuestro, plata suya.
- **Lo que el cliente pierde, dicho sin maquillar**: el **derecho a volver al precio que tenía**,
  que es exactamente para lo que existen los 60 días. **Pero lo perdía igual con el piso**, sólo
  que 60 días después de reanudar. La diferencia real entre las opciones no es *si* pierde el plan
  sino **cuándo se entera**, y acá se entera antes y con la pausa corriendo.
- **Lo que NO está medido, y va escrito porque sostiene la decisión**: **nadie midió cuántas veces
  se retira un plan del catálogo.** No hay una cifra en el corpus. La decisión se apoya en el
  juicio del owner de que es un evento poco frecuente, y **eso es un juicio, no un dato**. Si
  resultara frecuente, la que hay que releer es esta entrada.
- **Un borde que esta decisión NO cierra**: qué pasa con una **cortesía pausada** cuando se retira
  el plan —`SUPER_ADMIN` le firmó N días y el plan desaparece debajo—. Queda abierto como pregunta
  al owner; el precedente de cómo tratarlo es `DEC-GRANT-007`, que resolvió hoy la misma tensión
  por otra puerta.
- **Pendiente de implementación al momento de escribirse**, igual que `DEC-SUB-014`: entra en la
  **tanda corta posterior**, con el recuento de todo lo que mueva.
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 2 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5); la contrapropuesta del owner del 2026-09-21 frente a
  las tres opciones que se le presentaron; y **el cambio de recomendación del agente**, que había
  recomendado el piso con reloj congelado y retiró esa recomendación ante el argumento de la
  medición.

---

### DEC-RF-003 — La rama 6 entra al listado con el default en DEVOLVER

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-o`: tras `S36` la rama 6 no abre marca; ver su 📌) · **Decide**: owner
- **Extiende `DEC-RF-002`**, que no se toca: **ningún reembolso se dispara solo**, y éste tampoco.
  Lo que esta entrada agrega es **qué encuentra escrito la persona que abre el caso**.
- **El hueco**: al escribir `S23`, la FASE 9-bis-4 llevó `B/12` §5.3 de cinco ramas a **seis**. La
  nueva es **una baja desde `SUSPENDED` sobre una predecesora que retiene un pago** por `S19`:
  alguien pagó un período, quedó atrapado en una sucesión que nunca cerró, y **se da de baja él
  mismo**. Las otras cinco ramas traen su desenlace escrito; **ésta dejaba el caso en manos de una
  persona sin decirle qué debería hacer.**
- **Decisión**: **el default es DEVOLVER.** La marca entra al listado accionable con motivo
  *«reembolso por confirmar»*, y la persona **confirma salvo que haya razón para no hacerlo**. La
  confirmación sigue siendo humana y sigue pudiendo decir que no.
- **El motivo**: el pago quedó retenido **porque nuestra sucesión no cerró**, no porque el cliente
  hiciera nada raro. Es el criterio del owner aplicado literal —*puso plata, se le da salida*—, el
  mismo de `DEC-SUB-012` y `DEC-GRANT-007`.
- **Las dos alternativas, y por qué se descartan:**
  - **Sin default, la persona decide caso por caso**: es el estado actual y **es el que ya falló**.
    El crítico `F-8eB3-003` existe precisamente porque una marca sin motivo se volvía
    indistinguible de las otras y **el pago se quedaba**. Un default vacío reproduce ese desenlace
    con más pasos.
  - **El default depende de si el período se consumió** —entero si la baja llega antes de que
    empiece, nada si ya corrió—: es **más justo** y se descarta por una razón de método, no de
    fondo. Pide **una fecha que hay que verificar que exista**, y toda esta familia de críticos
    nació de columnas que nadie escribía; prometer un default apoyado en un dato sin confirmar es
    crear el defecto que la tanda acaba de arreglar cinco veces. **Queda anotada como mejora** para
    cuando se verifique que esa fecha está guardada.
- **El costo aceptado**: si el cliente usó el servicio durante el período, se devuelve un período
  consumido. Se acepta porque la persona que confirma puede verlo y negarse, y porque el caso llega
  ahí por una falla nuestra.
- **Origen**: la FASE 9-bis-4, familia de la baja, pregunta 3 de su rastro
  (`21-fase-9-bis-4/rastro-032f761e0.md` §5), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-o`)**: tras
  `S36`, la rama 6 no abre la marca: el pago retenido lo devuelve el `RF1` de la revocación. La rama
  sigue siendo una, con sus tres filas.

---

### DEC-GRANT-008 — La revocación de un grant guarda MOTIVO, además de fecha y firmante

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El contexto**: la FASE 9-bis-4 le dio a `permanent_grant` la columna **`revocado_en`** —el
  estado que las comprobaciones de cero llamadas necesitaban y que no existía (`F-8eB3-002`)— más
  **quién la firmó**. Faltaba decidir si además se guarda **por qué**.
- **Decisión**: **sí, y es texto libre.** La revocación guarda fecha, firmante y motivo.
- **El motivo**: un *Free Forever* es una concesión discrecional de `SUPER_ADMIN`, y revocarla
  **le corta el servicio a alguien que no hizo nada para provocarlo**. `DEC-TRIAL-009` decidió hoy
  que revocar **consume el trial y no se repara**, apoyándose en que es *«una decisión legítima y
  deliberada»* — y **una decisión deliberada cuyo motivo no se registra es indefendible seis meses
  después**, empezando por ante el propio beneficiario que pregunta por qué le cortaron.
- **Por qué libre y no de lista cerrada** (error / acuerdo vencido / abuso / otro): el volumen es
  bajo —son concesiones firmadas a mano por `SUPER_ADMIN`—, así que el texto libre no genera
  basura, y una lista cerrada obliga a mantenerla mientras el `otro` se come el resto.
- **Origen**: la FASE 9-bis-4, familia del grant y el addon, pregunta 1 de su rastro
  (`21-fase-9-bis-4/rastro-ce52dce5f.md`), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-009 — «A lo sumo un grant vivo por beneficiario» lo garantiza la base, no los nueve consumidores

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED · **Decide**: owner
- **El contexto**: con `revocado_en` (`DEC-GRANT-008`), un beneficiario puede acumular **N filas
  revocadas** y ninguna clave lo impide. *«Grant vivo»* se resuelve hoy mirando
  `revocado_en IS NULL`, así que las revocadas no molestan **mientras ese filtro esté en todos
  lados** — y el inventario dice que hoy son **nueve consumidores**.
- **Decisión**: **un `UNIQUE` parcial sobre beneficiario, restringido a las filas vivas.** La base
  rechaza un segundo grant vivo para el mismo beneficiario.
- **El motivo**: convierte *«hay a lo sumo uno vivo»* en algo que **la base garantiza** en vez de
  algo que nueve lugares tienen que recordar. **Si un consumidor olvida el filtro, encuentra a lo
  sumo una fila viva y no dos**, que es la diferencia entre un resultado incompleto y uno falso.
  Y el precedente es de esta misma vuelta: **`F-8eB3-002` existió porque *«el grant sigue vivo»* se
  daba por sabido sin que nada lo garantizara**, y el programa tiene medido que los inventarios se
  olvidan —la única lista que existía antes **quedó corta en el mismo commit que creó su sexto
  miembro**—.
- **Por qué no rompe ningún caso contemplado**: el programa ya decidió que el grant es **un
  instrumento con un ancla POR VERTICAL**, así que la multiplicidad vive en
  `permanent_grant_vertical` y no en el grant. **Un segundo grant vivo para la misma persona no
  tiene significado escrito en ningún lado.**
- **El costo aceptado**: si algún día apareciera un caso legítimo de dos grants vivos simultáneos,
  la restricción es **difícil de revertir** sobre datos ya escritos. Se acepta porque hoy ese caso
  no existe en ningún capítulo.
- **Origen**: la FASE 9-bis-4, familia del grant y el addon, pregunta 2 de su rastro
  (`21-fase-9-bis-4/rastro-ce52dce5f.md`), y la elección del owner del 2026-09-21 entre las tres
  opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-TEST-001 — Va UN guard nuevo, el de la columna que nadie escribe; el del orden de escrituras NO

- **Fecha**: 2026-09-21 · **Estado**: ACCEPTED — **las cifras de su tercera y cuarta enmienda, precisadas el 2026-09-25**: `inactiva_desde` la escriben hoy **seis hechos más la fila `C`** del corte, y la leen **seis** consumidores (`NUCLEO/01` §1.2, `V/02` §2.5). El guard vigila la lista, no la cifra — **G13 pasó a `V/20` el 2026-09-26** (ver su 📌) — **y enmendada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-k`, con su unidad confirmada el 2026-09-28 por `V2-x`: `G-R9`; ver su último 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N1, C9; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 16 y 48; ver su último 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra E: el control que regenera y compara el SQL generado cuenta como guard, 33 → 34; ver su último 📌) · **Decide**: owner
- **El contexto**: la FASE 9-bis-4 produjo dos clases de defecto que ningún guard vigila, y cada
  una salió de un crítico real. Se evaluó agregar uno por cada una.
- **Decisión: va el primero y no va el segundo.**
  1. **SÍ — *«una condición que lee una columna que ninguna transición escribe»*.** Es
     `F-8eB1-002` exacto: `MP5` disparaba sobre *«el período actual arrancó»* y **ninguna escritura
     del corpus avanzaba esa columna**, así que el pagador manual pagaba **una vez en la vida** y
     seguía cubierto para siempre. El guard recorre cada condición de transición, extrae las
     columnas que lee y exige que **al menos una transición las escriba**.
  2. **NO — *«toda fila con `desde` de conjunto declara cuántas escrituras tiene y en qué
     orden»*.** Es `F-8eB2-002`: `S20` copió de `S13` el *«idempotente y reanudable fila por fila»*
     teniendo **dos** escrituras, y el argumento de `S13` supone una.
- **Por qué el primero sí**: vigila una clase que ya costó **un crítico de dinero**, y **se
  verifica mecánicamente** — cruzar las columnas leídas contra las escritas es una comprobación
  estructural, no un juicio.
- ***Ampliado el mismo día, a pedido del owner: `G-R6` alcanza LAS DOS ÉPICAS, no sólo billing.***
  Nació acotado a las seis tablas de billing porque el crítico que lo motivó era de billing, y
  **nadie planteó la extensión**. Se amplía a las tres máquinas de verticales por una razón
  concreta y no por simetría: ahí vive **`inactiva_desde`**, la columna que `DEC-DATA-002` creó
  **ese mismo día**, con **cuatro escritores nuevos** y **cinco consumidores**, y **lo que decide es
  el borrado irreversible del contenido de una ficha**. Es el candidato más fresco del corpus para
  exactamente el defecto que `G-R6` vigila, y ahí el daño no es dinero: son datos sin vuelta. Se
  agrega su fila en `V/20` §2.
- **Por qué el segundo no, y es la parte que importa**: vigila una **convención de redacción**
  —*«declará tus escrituras»*— que un guard estático **sólo puede comprobar en su forma, no en su
  verdad**. Puede exigir que la fila **diga** cuántas escrituras tiene; no puede verificar que
  **sean ésas**. Sería **un guard que afirma más de lo que prueba**, y el programa tiene la regla
  escrita de que el mensaje de un guard no puede afirmar más que su predicado. Un guard así es
  **peor que no tenerlo**, porque declara cubierta una clase que no cubre.
- ***Y el catálogo estaba incompleto, medido el mismo día***: **`G12` y `G13` existen definidos
  sólo en `B/descomposicion.md`** —el documento de unidades de trabajo— **y no estaban en ningún
  catálogo**, en un § que se declara *«los guards, en un solo lugar… lo que permite preguntar
  "¿están todos?" una vez en vez de siete»*. Es el patrón de **inventario que afirma completitud
  sin tenerla**, el mismo que la FASE 8-bis-4 encontró cinco veces. Se agregan a `B/20` §2. *(El
  salto `G7` → `G9` del catálogo **no** es un agujero: la numeración `G1`-`G13` está repartida
  entre las dos épicas, y `G8` vive en `V/20` §2 — medido.)*

  **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-5`;
  `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** `G13` **pasó a `V/20` §2 y lo construye
  `V4`**, como dice el contrato §6.3; la razón que lo traía a billing (*«el consumidor del contrato
  es billing»*) era falsa. `B/20` §2 lista 15 filas y `V/20` §2, 20; el total de 31 guards no
  cambia (18 en verticales y 13 en billing por columna de unidad).
- **El costo aceptado**: los guards de este programa **no corren todavía** —son declaraciones en
  `B/20` §2 y `V/20` §2 hasta la FASE 10— y **se acepta agregar uno más**, porque la alternativa
  —no escribirlo— garantiza que no llegue a la FASE 10.
- ***La cifra con que se aceptó ese costo era falsa, y se corrige acá con la medición.***
  ~~`C2` midió que 12 de 26 no tienen unidad que los construya, y agregar uno empeora esa
  proporción a 13 de 27.~~ ~~Al agregar también `G12` y `G13` la proporción MEJORA, porque esos dos
  SÍ tienen unidad declarada.~~ **Lo medido el 2026-09-21, recorriendo las filas de las dos tablas
  y la columna de guards de las dos `descomposicion.md`:**

  | | cuántos | |
  |---|---|---|
  | filas de `B/20` §2 | ~~15~~ → **16** | |
  | filas de `V/20` §2 | ~~16~~ → **17** | |
  | guards **distintos** | ~~28~~ → **29** | menos **4** referencias cruzadas (`G-R4`, `G-R5`, `G-R6`, `G-R6-B`) |
  | **sin unidad que los construya** | **14** | la mitad son los `G-R*` |

  > **Estas cifras están ancladas a un SHA y NO describen el presente: son de `7676082e6`,
  > 2026-09-21.** La columna tachada es de `e98727349`, del mismo día y **tres horas antes** — la
  > movió `G-R6-B`, que la tercera enmienda de esta misma entrada introdujo. **El número medido vive
  > en `B/20` §2 y `V/20` §2**, que son los catálogos; acá vive **el costo que se aceptó al
  > decidir**, que es otra cosa y no caduca.
  >
  > **Por qué se ancla en vez de corregirse otra vez**: es la **tercera** vez en un día que este
  > número queda corto dentro de esta entrada, y las dos anteriores se arreglaron a mano. El log
  > estaba **repitiendo un número que se mueve cada vez que alguien toca un catálogo**, que es
  > exactamente lo que la regla de trabajo del owner prohíbe —*los conteos se recuentan con script,
  > no se toman de un índice*—. Anclado al SHA, el número deja de pretender describir el presente y
  > pasa a ser lo que siempre fue: **una medición de un momento**, en la misma forma que usan los
  > rastros. **Decisión del owner del 2026-09-21**, entre retirar la cifra, anclarla, o seguir
  > corrigiéndola a mano.

  **Tres correcciones sobre lo que esta entrada afirmaba**, y ninguna cambia la decisión:
  1. **El *«12 de 26»* de `C2` no era un conteo de catálogo**: era la **unión** de los dos
     catálogos **más** `G12` y `G13` leídos de la descomposición, en un día en que `B/20` §2 listaba
     **once** filas.
  2. **El *«13 de 27»* no describió ningún estado del corpus en ningún momento.** Desde la medición
     de `C2` habían entrado dos guards más —`G-R1-F` y el propio `G-R6`—, **los dos sin unidad**, así
     que los sin-unidad **ya eran catorce antes de que esta decisión se tomara**.
  3. **La mejora es real pero no por donde esta entrada decía.** Los sin-unidad **no se mueven**:
     catorce antes y catorce después, porque `G12` y `G13` ya estaban contados en la unión de `C2` y
     ya tenían unidad. **Lo que mejora es el denominador**: `14 de 26` → **`14 de 28`**.
  **La conclusión de la decisión es correcta; su cifra intermedia no lo era.**
- **Lo que queda sin vigilancia, declarado**: la clase del segundo guard. `S20` demostró que el
  error se comete **copiando de una fila que parece análoga**, y contra eso no hay comprobación
  estructural: lo único que lo detecta es que alguien lea las dos filas juntas.
- ***Tercera enmienda del mismo día: va un guard MÁS, el de la lista de escritores.*** Al escribir
  `G-R6` en `V/20` §2 se midió algo que nadie había planteado: de los **cuatro hechos que escriben
  `inactiva_desde`, sólo uno es una transición** (`PB1`/`PB3`/`PB7`); los otros tres salen del
  registro de eventos, del contrato y de `vertical.fin_de_servicio`. Como el predicado de `G-R6` es
  *«al menos una transición la escribe»*, **el guard queda verde por uno solo de los cuatro**:
  certifica *«alguien la mueve»*, **nunca *«los cuatro la escriben»***. Eso quedó declarado en
  `V/20` §2, y deja como única vigilancia de los otros tres **la lista cerrada de `V/02` §2.5**.
  - **Decisión: la lista lleva guard propio**, que falle si alguien escribe `inactiva_desde` desde
    un lugar que la lista no nombra — exactamente el papel que `G-R1-E` cumple para los inventarios
    del núcleo.
  - **El motivo**: `inactiva_desde` **decide un borrado irreversible**, sus cuatro escritores
    **nacieron el mismo día** (`DEC-DATA-002`), y `G-R6` ya declaró por escrito que no los cubre.
    Es la misma situación que motivó a `G-R1-E`, **con una consecuencia peor**. Y el precedente del
    programa es explícito: **la única lista que existía quedó corta en el mismo commit que creó su
    sexto miembro**, así que una lista cerrada sin guard es una promesa que ya se rompió una vez.
  - **Lo que esto NO contradice**: el segundo guard del rechazo de arriba sigue rechazado. La
    diferencia es medible y no de gusto — aquél sólo podía comprobar su **forma** (*que la fila diga
    cuántas escrituras tiene*), mientras éste comprueba un **hecho**: que no exista un escritor
    fuera de la lista. Uno afirma más de lo que prueba; el otro no.
  - ***Cuarta enmienda, el mismo día: `G-R6-B` vigila las DOS mitades de la lista.*** `V/02` §2.5
    cierra **dos** listas sobre `inactiva_desde` —sus **cuatro escritores** y sus **cinco
    consumidores**— y el guard nació vigilando sólo la primera. **Se le suma la segunda**, porque
    **las dos mitades fallan distinto y la segunda falla peor**: un escritor fuera de la lista mueve
    el reloj cuando no corresponde; **un consumidor que nadie registró LEE el reloj y decide con
    él**, y el consumidor más caro de esa columna **es el hard delete del día 180**. Un lector no
    inventariado es un lugar que borra contenido sin que la lista sepa que existe. Además es la
    simetría que ya tiene el precedente: **`G-R1-E` cubre la mitad consumidores** para los
    inventarios del núcleo.
  - **La condición con que se acepta, y no es decorativa**: **el mensaje del guard tiene que decir
    QUÉ MITAD falló.** Un guard que vigila dos cosas con un solo mensaje afirma más que su
    predicado, que es **exactamente la regla con la que se rechazó el segundo guard** tres párrafos
    más arriba. Sin esa condición, esta enmienda se contradice con su propia entrada.
- ***Quinta enmienda, y va contra la recomendación del agente, que es la razón de que quede
  escrita: LOS GUARDS SIN UNIDAD SE REPARTEN AHORA.*** `C2` lo viene reportando **tres vueltas
  seguidas** (`F-8dC2-003` → `F-8eC2-004`): la proporción de guards sin unidad que los construya
  fue de `11 de 24` a `12 de 26`, y el 2026-09-21 quedó en **14 de 29**. **Un guard sin unidad es
  una promesa escrita que nadie tiene asignado construir cuando llegue la FASE 10.**
  - **La decisión del owner: se reparten ahora**, con el contexto fresco del día en que la mitad de
    ellos se escribió, en vez de declararlos como límite conocido para la FASE 10.
  - **La recomendación del agente era la contraria, y su razón queda acá porque es el riesgo que
    esta decisión acepta**: `C2` midió que **el único de los trece que consiguió dueño lo consiguió
    en la ÉPICA EQUIVOCADA** —`G-R5` vigila un número que declara billing y lo construye una unidad
    de verticales **que corre antes de que ese número exista**—. **Una asignación apurada acierta el
    guard y erra la unidad, y eso es peor que no tener unidad, porque afirma que alguien lo
    construye.**
  - **Las tres condiciones con que se ejecuta, que son lo que hace aceptable el riesgo**: (1) **cada
    asignación lleva su razón medida con cita**, no plausible; (2) **la unidad nace ANTES o CON lo
    que el guard vigila, nunca después** —el criterio que confirmó `V6` para `G-R6-B` y el que
    `G-R5` violó—; y (3) **no se inventa**: un guard sin unidad clara **se declara sin dueño con su
    razón**. **Trece asignaciones medidas y una declarada honestamente valen más que catorce
    plausibles.**
  - **Y se aprovecha para cerrar `F-8eC2-004`**: si se confirma que la unidad de `G-R5` está en la
    épica equivocada, se corrige en el mismo acto.
- **Origen**: la FASE 9-bis-4, preguntas de los rastros del pagador manual
  (`rastro-8f9f31ac0.md`) y del grant (`rastro-ce52dce5f.md`), presentadas juntas al owner el
  2026-09-21 —eligió la 2, que era la recomendada—; la ampliación a las dos épicas pedida por el
  owner el mismo día; la tercera enmienda, sobre la medición de los cuatro escritores que trajo
  el cierre de guards (`rastro-12cc0879f.md`), donde eligió la 2, que era la recomendada; la cuarta,
  sobre las dos mitades de la lista, donde eligió la 1, que era la recomendada; y la quinta, el
  reparto, donde eligió la 1 **contra** la recomendada.
- 📌 **Enmendada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-k`)**: `G-R9`
  vigila la lista cerrada de `PURGED` recorriendo el esquema, y lo construye V6 (unidad y nombre
  confirmados el 2026-09-28, `V2-x`). El programa pasa a 32 guards, 19 de verticales y 13 de
  billing.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N1, C9)**: `G-R3` y `G-R5-B`
  dejan de ser guards y pasan a ser validaciones del panel con su nombre, y `G3` conserva sólo la
  dirección código → catálogo (la otra es una FK de la base); el catálogo queda en 33 guards
  distintos, 18 de verticales y 15 de billing (`DEC-ARCH-013`, `DEC-DATA-008`).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 16 y
  48)**: `G-R6-B` suma una tercera mitad: un lector de `listing.inactiva_desde` que decide archivar,
  borrar o avisar y no consulta `retenciónDetenida`. Y su mitad de escritores vigila también
  `listing.plazos_version`, que se escribe sólo junto con `inactiva_desde`. El catálogo sigue en 33
  guards.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra E;
  `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 E)**: El control que regenera y compara el SQL generado del catálogo de producción
  (lote 2 D de la FASE 5) y de la tabla de claves de `V1` (E) **cuenta como guard**: el catálogo
  pasa de 33 a **34 guards distintos** (ver el 📌 de `DEC-ARCH-013`). La decisión no fijó qué
  unidad lo construye ni a qué mitad suma en el reparto de 18 de verticales y 15 de billing (o 17,
  15 y 1 de `U1`, 📌 O-A de `DEC-ARCH-014`); queda para el owner. Origen: (FASE 5, lote de la
  aplicación, owner 2026-09-30, E).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra Q;
  `38-fase-5/10-decisiones-del-owner.md`; verificación, `VF5-04`)**: el guard 34 es **`G18`** y lo
  construye **`V1`**, con la primera carga que vigila (la tabla de claves), como pide esta decisión
  (*«la unidad nazca ANTES o CON lo que el guard vigila»*). El reparto queda **18 de verticales, 15
  de billing y 1 de `U1`**. Cierra lo que el 📌 anterior dejaba para el owner.

---

### DEC-GRANT-010 — La cortesía sobre una vertical discontinuada se difiere; su re-emisión puede no llegar, y eso queda declarado

- **Fecha**: 2026-09-21 · **Estado**: **SUPERSEDED (revisión del owner, 2026-09-28, C8)**: las verticales no se discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces, y este texto queda como punto de partida · **Decide**: owner
- **Cierra el borde que `DEC-SUB-015` dejó abierto explícitamente.**
- ***Corregido el mismo día, por lo mismo que `DEC-SUB-015`***: nació diciendo *«se retira el plan»*
  y **ese acto no produce el caso** — `B/10` §3: *«retirar un plan no mueve a nadie»*. El acto es
  **la discontinuación de la vertical** (§4.3).
- **El caso**: `SUPER_ADMIN` le firmó a alguien **N días de cortesía**, y la cortesía **se
  implementa pausando** (`DEC-GRANT-003`), así que esa suscripción está `PAUSED · COURTESY`.
  Entonces **se discontinúa la vertical**. Por `DEC-SUB-015` la pausada no entra al piso, se le
  avisa y al volver elige plan nuevo — pero **el que vuelve está en medio de un regalo nuestro**, y
  la vertical sobre la que se lo hicimos está cerrada.
- **Decisión**: **la cortesía se difiere y se re-emite sobre el plan nuevo**, con el **mismo
  mecanismo que `DEC-GRANT-007`** escribió el mismo día: el saldo de días vive en
  `courtesy_grant.saldo_días`, y `S9` —que ya ganó un segundo disparador— la re-emite cuando la
  fila llega a `ACTIVE`. **No se inventa nada nuevo.**
- **El motivo**: es el criterio del owner sobre un caso donde la pérdida **la causaría un acto
  deliberado nuestro** —retirar el plan— **sobre alguien que todavía no recibió nada**. Es el caso
  de `DEC-TRIAL-009` **invertido**, y conviene leerlos juntos: allá la persona **ya había recibido
  la cobertura completa** del plan anclado y por eso el trial gastado no se repara; **acá el regalo
  no empezó a entregarse**.
- **Las dos alternativas, y por qué se descartan:**
  - **Que la cortesía corra hasta agotarse sobre el plan retirado** y recién ahí elija: le da
    exactamente lo que se le firmó, sobre el plan sobre el que se le firmó, pero **mantiene vivo un
    plan retirado hasta que se agote el regalo** — que es justo la garantía que `DEC-SUB-015`
    conservó: **un plan retirado tiene fecha de cierre**.
  - **Que la cortesía se pierda con el plan**, avisando: **contradice el criterio del owner**, por
    la razón de arriba.
- **El costo aceptado**: el plan nuevo puede ser **más caro**, así que los N días regalados valen
  más de lo que valían al firmarse. Es un sobrecosto **nuestro, acotado y consecuencia de una
  decisión nuestra**.
- **La re-emisión puede NO LLEGAR, y eso queda declarado con causa en vez de resuelto.** Una
  vertical discontinuada queda **cerrada a altas para siempre** (`B/10`, la tabla de verticales sin
  fecha), así que **no va a existir la fila nueva que reciba el saldo**, y re-emitirlo en otra
  vertical es lo que `DEC-GRANT-006` prohíbe —la cortesía es **por suscripción**—. El saldo no se
  pierde: **queda diferido y sin emitir.** Se le presentaron al owner tres salidas —pagarlo en otra
  vertical, declararlo perdido con aviso, o convertirlo en un crédito— y **eligió no definir
  ninguna**, con esta razón, el 2026-09-21: *«una vertical no la vamos a discontinuar nunca, y si
  algún día decidimos eso, lo veremos en el momento»*. **Es un desenlace declarado, que es lo que
  `DEC-METH-006` admite**, y no un hueco olvidado: el día que se discontinúe una vertical, esta
  entrada es la que hay que releer.
- **Origen**: la FASE 9-bis-4; el borde declarado abierto en `DEC-SUB-015`; la elección del owner
  del 2026-09-21 entre las tres opciones que se le presentaron —eligió la 1, que era la
  recomendada—; y la pregunta 2 del rastro de la tanda corta
  (`21-fase-9-bis-4/rastro-8d6b27a12.md` §6), que encontró que la re-emisión no tiene destino y que
  el owner cerró declarando el escenario improbable.

---

### DEC-MP-003 — La pausa que hace el proveedor por mora lleva motivo propio, y no entra como pausa del cliente

- **Fecha**: 2026-09-22 · **Estado**: **SUPERSEDED EN PARTE por `DEC-MP-008`** (2026-09-24): se cae
  el motivo `PROVIDER_DUNNING`, y la pausa del proveedor por mora se espeja con `S6`. Sobrevive el
  diagnóstico y que esa pausa no entra por `S8`. Su mitad abierta (*«qué hace el dunning con esa
  fila»*) la había cerrado antes **`DEC-SUB-019`** · **Decide**: owner
- **El hecho que la motiva, medido el 2026-09-21/22** (`RN-2` y `GR-3` de la matriz): **el proveedor
  pausa la suscripción por su cuenta** cuando un ciclo agota sus cuatro reintentos y vence su
  ventana. Está en el mail al vendedor —*«se pausó… no recibimos el pago en la fecha original del
  cobro y los 3 intentos siguientes fallaron»*— y medido sobre tres sujetos de producción, con la
  pausa cayendo **80-105 segundos antes** del `expire_date`. `PS-4` tenía medida la **no**
  auto-reanudación; **la auto-pausa no estaba medida en ningún lado.**
- **Lo que rompía**: `B/03` §10.1 espeja ese `paused` con **`S8`, o sea con motivo
  `CUSTOMER_REQUEST`** — *«el proveedor pausó y nosotros no lo sabíamos»*—, que es la transición de
  *«la persona pide pausar»*. Consecuencias, las cuatro reales:
  1. **el moroso queda FUERA del dunning**: sin `GRACE_PERIOD`, sin reloj, sin `SUSPENDED`;
  2. **se le consume una pausa que no pidió**, contra su tope de cuatro por mes y de 120 días;
  3. **`S10` lo devuelve a `ACTIVE`** al vencer el reloj de la pausa, **sin haber cobrado nada**;
  4. y `paused` ya cargaba **dos** significados, porque es también el mecanismo de la cortesía
     (`DEC-GRANT-003`, forzado por el piso de ARS 15 de `PC-2`).
- **Decisión**: **un motivo nuevo de pausa, `PROVIDER_DUNNING`.** El espejo lo escribe en lugar de
  `CUSTOMER_REQUEST`. Los motivos pasan de **dos a tres**, y **todo lo que lee el motivo de pausa
  hay que recorrerlo** — empezando por `puedePausar()`, los topes del §26 y las salidas `S10`,
  `S22` y `PB*`.
- **Por qué no las otras dos, y la segunda razón es la que más pesa:**
  - **Una columna *«quién pausó»*, escrita cuando pausamos nosotros**: no toca el enum, pero **falla
    abierto** — si no se escribe el registro (un job que se cae, una fila vieja), **una pausa
    nuestra se lee como del proveedor**. El programa lleva cuatro vueltas midiendo que lo que hay
    que acordarse de escribir se olvida: la única lista de consumidores que existía **quedó corta
    en el mismo commit que creó su sexto miembro**.
  - **Mapear el `paused` del proveedor a `GRACE_PERIOD`**: es lo semánticamente correcto —es mora,
    no pausa— y **se descarta por una razón operativa**: **el cobro que cerraría ese grace no lo va
    a intentar nadie**, porque del lado del proveedor la suscripción está pausada y no cobra. Nos
    dejaría un reloj corriendo hacia un pago imposible, más una divergencia permanente contra el
    proveedor que el barrido del cap. 09 tendría que declarar legal. **Se prefiere un estado honesto
    —«el proveedor lo pausó por mora»— antes que uno que promete un cobro que no ocurre.**
- **Lo que esta decisión NO cierra, y va declarado**: **qué hace el dunning con esa fila.** El
  motivo la vuelve distinguible; no dice si entra a `GRACE_PERIOD`, si va directo a `SUSPENDED`, ni
  con qué reloj. Esa decisión **espera el veredicto de la [sonda 49](../docs/mp-probes/probe-49-la-ventana-de-reintentos.mjs)**,
  que se lee el **2026-09-24**: si la ventana de reintentos resulta **fija de 24 h**, el proveedor
  se rinde al día siguiente sin importar el plan y **un `GRACE_PERIOD` de 7 días no lo sostiene
  nadie**; si resulta ser **el ciclo**, con un plan mensual hay un mes de margen y el grace se ata
  al ciclo. **Son dos diseños distintos y el dato llega en dos días.**
- **Lo medido después, el 2026-09-23, y le sirve a lo que queda abierto** (aplicado a `GR-3` de la
  matriz el 2026-09-24): **la pausa del proveedor SÍ se entera por webhook, 5 de 5.** Las cinco
  pausas por mora de producción emitieron `subscription.updated` con latencias de **6,21 s, 6,78 s,
  7,94 s, 12,30 s y 4,60 s** (la de `monto-baja`, dos veces). **Pero el cierre del ciclo fallido NO
  emite nada, también 5 de 5**: la transición `scheduled → processed` —el instante en que el
  proveedor se rinde— no produce evento, y el último `invoice.updated` de `7032113610` llegó **~5 h
  antes** de que el ciclo se cerrara. **Los dos hechos apuntan al mismo lado y hay que leerlos
  juntos**: el dunning puede arrancar por el aviso de la pausa, pero **no puede enterarse por la
  factura** de que el cobro murió — ese hecho **se lee de la suscripción**. Nada de esto cambia lo
  que esta decisión decide ni sus razones; acota **cómo** se va a poder implementar lo que declara
  pendiente.
  > 📌 **Y de paso corrige una cita ajena**: el §2 de
  > [`RESULTS-2026-09-23.md`](../docs/mp-probes/RESULTS-2026-09-23.md) le atribuye a esta decisión la
  > sospecha de que *«el `preapproval` puede no emitir `preapproval.updated`»*. **Esa frase no está
  > escrita acá** y ninguna razón de esta decisión se apoya en ella — verificado el 2026-09-24 contra
  > este mismo bloque. ⚠️ **El `rg` que lo probaba ya no se puede repetir tal cual**: antes de
  > escribirse esta nota, `rg 'preapproval\.updated'` sobre el log entero devolvía **cero líneas**; a
  > partir de acá devuelve **una, que es la de arriba**. Para repetirlo hay que excluir esta nota, o
  > leer el bloque. **No hubo razón caducada que enmendar.**
- **Origen**: la revisión de los mails de `info@mercadopago.com` y de la API de producción del
  2026-09-21/22 (`RN-2`, `GR-3`, `RC-5`, `RC-6`, `RC-7` de la matriz), y la elección del owner del
  2026-09-22 entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-MP-004 — Lo que se le dice al cliente cuando el alta rebota sale del `status_detail`, no de un texto único

- **Fecha**: 2026-09-22 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso, medido sobre nosotros mismos el 2026-09-21/22**: tres intentos de alta en producción,
  **dos rechazados con `cc_rejected_high_risk`** — el **scoring antifraude del proveedor**, no la
  tarjeta—. Lo que MP le muestra al cliente es *«Por motivos de seguridad, tu pago fue rechazado.
  Te recomendamos pagar con el medio de pago y dispositivo que solés usar para compras online»*. Y
  el preapproval queda **`cancelled` en ~83 segundos**, irreversible (`PA-5`, `EX-3`).
- **Lo que faltaba**: `S16` ya sabe que *«el proveedor la canceló al rechazarlo»*, pero **no
  distingue POR QUÉ la rechazó**, y las causas piden decirle cosas opuestas a la persona:
  - **`cc_rejected_high_risk`** → **no tiene que tocar nada de su tarjeta**: probar más tarde, otro
    dispositivo, o escribirnos.
  - **`payment_method_not_ready`, fondos, vencimiento** → **sí tiene que revisar su medio de pago**.
- **Decisión**: **el mensaje se deriva del `status_detail`, con un mapa explícito y un texto
  genérico obligatorio** para los detalles que no estén en el mapa.
- **El motivo, y no es cosmético**: a una causa le pedís que **cambie** algo y a la otra que **no
  cambie nada**. Mostrar *«revisá tu tarjeta»* a alguien rechazado por scoring lo manda a arreglar
  algo que funciona — y como el preapproval ya murió, **cada reintento suyo crea uno nuevo que el
  scoring vuelve a rechazar**. Eso no es hipotético: **es exactamente lo que nos pasó tres veces
  seguidas la noche del 21**.
- **Las dos alternativas:**
  - **Un solo mensaje neutro** para todos los rechazos: nunca miente y no cuesta mantenimiento,
    pero **al que sí tiene un problema de tarjeta no le dice cómo resolverlo**, y va a reintentar
    igual, creando otra alta muerta.
  - **Dejarlo sin especificar**, como está hoy: en la práctica termina siendo *«revisá tu tarjeta»*,
    que es el default de la industria y **el peor posible para el caso `high_risk`**.
- **Lo que hay que tener en cuenta al escribir el mapa**: **`RC-6` midió que el `status_detail`
  cambia entre intentos** —es el del último, no el del primero—. En el **alta** eso no molesta,
  porque hay un solo intento y el preapproval muere ahí; **en una renovación sí**, y el mapa no
  debe leerse temprano.
- **Lo que esta decisión NO cierra**: (1) **el contenido del mapa** —qué `status_detail` existen y
  cómo se agrupan— que se llena con lo medido y no se inventa; y (2) **qué hacemos para que el
  cliente no cree altas muertas en serie** cuando el scoring lo rechaza. La segunda es un problema
  de producto propio y no tiene decisión todavía.
- **Origen**: los tres intentos de alta de la sonda 49 del 2026-09-21/22, y la elección del owner
  del 2026-09-22 entre las tres opciones que se le presentaron — eligió la 1, que era la
  recomendada.

---

### DEC-METH-012 — La justificación de una aparición cubre el CUANTIFICADOR de la cita y no afirma nada que no esté verificado en ella

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **Extiende `DEC-METH-011`, que no la deroga.** `DEC-METH-011` hizo que el rastro existiera; ésta
  dice qué tiene que decir cada línea.
- **Lo que `DEC-METH-011` compró, medido en la FASE 8-bis-5 y acreditado antes que nada**: se
  ejecutó entera —**47 de 47** commits que editan el corpus nombrados en alguno de los diez
  rastros, **1.030** apariciones justificadas una por una— y **es la razón por la que esta decisión
  se puede escribir**. Los ocho informes revisaron **887** líneas y exhibieron **16 líneas falsas
  distintas, con archivo y línea**. Con *«72 apariciones justificadas una por una»* en un mensaje de
  commit, ninguna de las 16 era señalable. **Es la primera vez que el programa mide la CALIDAD de
  una resolución y no sólo su existencia** — entre 1,8 % y 3,1 % de falsas.
- **Y la serie bajó por primera vez en cinco vueltas**: **6 de 8** críticos distintos vienen de la
  tanda anterior, contra 12/12, 13/14, 17/17 y 25/25. Los dos que no vienen son de clases que el
  programa nunca había producido: una **medición externa** (`RC-5`) y una **lectura del conjunto**
  (la dirección inversa del contrato sin constructor).
- **El problema que queda, y es dónde se movió el agujero**: la regla **llega al lugar correcto en
  4 de los 6** críticos y **resuelve mal**. No es que no se ejecute —ése era el diagnóstico de
  `DEC-METH-011`— ni que no alcance: la aparición está en el rastro, recorrida, con su justificación
  escrita, y la justificación es falsa. Dos formas:
  1. **la resolución dice MENOS que la cita** — verifica un sujeto más angosto que el que la cita
     cuantifica (se verificó que los tres avisos *estuvieran*, no que los lectores *fueran cinco*);
  2. **la resolución dice MÁS que la cita** — le agrega una garantía que nadie verificó
     (*«…y ahora esa ficha además tiene cómo volver cuando el cupo se libere»*), y esa cláusula
     nueva es la que cierra el caso en falso.
- **Decisión**: la justificación de cada aparición no corregida **responde por la cláusula entera
  que cita —su cuantificador incluido— y no afirma nada que no esté verificado en la cita misma.**
- **La forma operativa, sacada de las cuatro que fallaron**: **la justificación no puede empezar con
  *«lo que cambió es…»***. Las tres del modo por delta empiezan así —*«lo que cambió es de dónde se
  lee»*, *«lo que cambió es el motivo»*, *«lo que cambia es el alcance del remedio»*—. **Nombrar el
  cambio y descartarlo en la misma frase es la firma del modo.**
- **Y la forma correcta no hay que inventarla: ya está escrita, por el mismo equipo, en el mismo
  artefacto.** Dos líneas del 2 % bueno son el patrón a copiar: *«la cláusula que la salva es la que
  ella misma escribe»* (`rastro-f21d5d828.md` sobre `B/02` §2.2, que además **enumera los seis
  sitios que deliberadamente no tocó y por qué**) y *«si alguna se hubiera escrito como «el último»
  o «de seis», sería falsa»* (`rastro-032f761e0.md` sobre los ordinales del espejo).
- **Lo que compra, y el número sale de una medición y no de una estimación**: **4 de los 6** críticos
  de la vuelta y **9 de las 16** líneas falsas. Es más de lo que ninguna corrección propuesta hasta
  hoy compró.
- **El costo, y es la razón de haberla elegido sola**: **dos renglones de la regla y ningún trabajo
  nuevo por aparición.** No pide recorrer más apariciones: pide que la justificación de cada una
  responda por la cláusula entera. **No agrega ningún mecanismo que alguien tenga que acordarse de
  correr**, que es exactamente el criterio con que `DEC-MP-003` descartó la columna *«quién pausó»*.
- **Las tres que NO van, y qué se acepta al dejarlas afuera** — el owner eligió esta sola por encima
  de la opción que la combinaba con la segunda:
  1. **El barrido de caducidad** (cada línea nombra el `archivo §` del objeto sobre el que afirma, y
     un barrido al cierre re-evalúa las que ese archivo tocó después). **Se acepta que las 6
     caducidades sigan**: una línea verdadera el día que se escribió que un commit POSTERIOR de la
     misma tanda vuelve falsa, sin que nadie edite ni el capítulo ni el rastro. Ninguna de las seis
     produjo un crítico; lo que producen es **la sensación de que el corpus está verificado cuando
     no lo está**. **Se descartó porque agrega mecanismo** —una columna y un comando al cierre— y el
     programa lleva cinco vueltas midiendo que lo que hay que acordarse de escribir se olvida. Se
     detectarán en la vuelta siguiente, como hasta ahora.
     ⚠️ **Y si alguna vez se implementa, no con `git log -S` sobre la cita**: se midió sobre las dos
     caducidades más limpias y **devolvió cero en las dos**, porque la caducidad no cambia la cita,
     cambia lo que la hace verdadera, que vive en otro archivo.
  2. **Levantar la exclusión de la prosa que el commit escribe o edita.** Compra **2 de los 6**,
     contra los 5 de 12 que se le estimaron en la 8-bis-4: **la medición corrigió a la recomendación
     anterior**, que la ponía primera. Sigue siendo la de costo más alto —un commit que escribe tres
     párrafos tendría que justificar cada afirmación que hace—. **El agujero se achicó solo**: de
     5 de 9 a 2 de 6.
  3. **Ampliar el alcance al decision log.** Es el **cuarto desenlace**, que ninguna vuelta había
     visto: el sexto sitio de *«`G-R4` sigue contando tres»* vive en este mismo archivo, que el
     alcance del rastro excluye por definición. Compra 2 conteos falsos. **Se descarta como está y
     queda acotada a futuro**: lo que habría que vigilar del log no es toda aparición sino **las
     cifras del bloque `## Resumen`**; las razones internas de cada decisión son registro histórico
     y caducarlas sería borrar el rastro del programa.
- **Origen**: la FASE 8-bis-5, `22-fase-8-bis-5/C1-la-costura.md` §4.5 (Corrección E), y la elección
  del owner del 2026-09-23 entre las tres opciones que se le presentaron. **Eligió la 2 —la enmienda
  sola, sin el barrido—, apartándose de la recomendación de `C1`**, que proponía las dos juntas. La
  razón del owner es la que el programa ya tiene medida y escrita: **entre dos correcciones, la que
  no agrega mecanismo.** El riesgo aceptado son las seis caducidades, declarado arriba para que se
  pueda evaluar después.

---

### DEC-GRANT-011 — El saldo de cortesía de una sucesión que nadie completó se CIERRA, y se declara

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso, creado por `DEC-GRANT-007`**: la cortesía ya no se re-apunta, se **difiere** en
  `courtesy_grant.saldo_días` y `S9` la re-emite cuando la sucesora autoriza. `S18` cierra la
  sucesión con la sucesora en `PENDING_AUTHORIZATION`, y desde ahí hay **dos salidas**: autorizar
  (`S2` → `S9` re-emite, que es el camino escrito) **o vencer la ventana** (`S3` → `ABANDONED`). La
  segunda deja un `courtesy_grant` con saldo y **sin ninguna fila viva en esa vertical a la que
  volver**.
- **Estaba declarado abierto en el capítulo, no sólo en el rastro**: `B/09` §3, sexta comprobación
  — *«la cortesía queda diferida sin ninguna suscripción a la que volver … **no está decidido**, y
  no se decide acá: queda como pregunta al owner»*.
- **Decisión**: **al vencer la ventana de autorización, el saldo se cierra.** La misma transición
  que lleva la sucesora a `ABANDONED` cierra el `courtesy_grant` diferido, y el cierre **se
  declara** —queda asentado con su motivo, como toda revocación desde `DEC-GRANT-008`—. El
  beneficiario que vuelva a suscribirse **no recupera esos días**.
- **Por qué, y la razón ya estaba escrita**: es el criterio del owner que el programa viene
  aplicando desde la tanda de la 9-bis-3 — *si la pérdida la causa un acto deliberado NUESTRO y la
  persona no puso plata nueva → se declara y no se repara; si la persona PUSO PLATA → se le da
  salida*. Acá **la persona no puso plata** y **el acto que corta es suyo**: abandonar el checkout.
  Es el mismo desenlace que `DEC-TRIAL-009` («revocar un grant no devuelve el trial»), y por las
  mismas razones.
- **Lo que cuesta, dicho en voz alta**: al beneficiario se le pierden días que **`SUPER_ADMIN` le
  firmó**, y el abandono puede ser un error de checkout —una pestaña que se cierra, un pago que se
  cae— y no una decisión. **Se acepta**: quien firmó la cortesía puede volver a otorgarla, que es
  un acto que ya existe —el **primer disparador de `S9`**, *«`SUPER_ADMIN` otorga cortesía»*— y no
  necesita mecanismo nuevo.
  > **Corregido el 2026-09-23**: esta línea decía `S13`, que es el acto de otorgar un **`Free
  > Forever`** y no una cortesía. Lo detectó la familia 4 de la 9-bis-5 y lo verifiqué contra
  > `B/03` §3.2. **El argumento no cambia** —el acto existe igual—, sólo la referencia era falsa.
- **Las dos alternativas, y por qué no**:
  - **Dejar el saldo esperando** a que la persona se suscriba de nuevo: **es la forma que `B/16`
    §1.3 rechaza por escrito** —*«un instrumento abierto sin fecha de cierre»*— y hoy **ninguna
    comprobación lo levanta**: la sexta de `B/09` §3 exige que la fila receptora ya exista en
    `ACTIVE`, así que el saldo quedaría en la base **sin dueño, sin vencimiento y sin nadie que lo
    mire**. Descartada por el propio corpus, no por preferencia.
  - **Darle vencimiento al saldo** —espera un plazo y después se cierra solo—: cierra el agujero de
    la anterior y es más justa que la elegida, **pero es la única de las tres que agrega
    mecanismo**: un reloj más y su barrido. Se descarta por el criterio con que `DEC-MP-003`
    descartó la columna *«quién pausó»* y `DEC-METH-012` descartó el barrido de caducidad, y además
    porque **la población de este caso no la midió nadie**. Si alguna vez se mide y resulta grande,
    ésta es la alternativa a reabrir.
- **Lo que esta decisión NO cierra**: **qué se le muestra al cliente mientras el saldo está
  diferido** (`B/19` §3 obliga a mostrar las cortesías en «Mi Suscripción»). Queda como pregunta
  abierta del censo, y **esta decisión la vuelve más filosa**: con el saldo cerrándose al abandonar,
  decirle *«te quedan N días»* durante la ventana y quitárselos al vencer es peor que no haberlo
  dicho.
- **Y un defecto que NO resuelve, anotado para que no se confunda con ella**: un grant que cae sobre
  una cortesía **diferida** (`B/14` §4.3 la termina *cancelando la suscripción que la pausaba*, y
  acá no hay ninguna). Eso no es una elección entre políticas sino una regla cuyo sujeto no existe:
  es el hallazgo `E2` del censo, severidad `MEDIA`, y lo arregla la tanda.
- **Origen**: la FASE 8-bis-5, `22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md` §`E1`
  —levantado de `rastro-f21d5d828.md` §6 punto 1 y de `B/09` §3—, y la elección del owner del
  2026-09-23 entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-012 — La cortesía diferida se le muestra al cliente CON su condición, no a secas y no escondida

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso**: `B/19` §3 **obliga** a mostrar las cortesías en «Mi Suscripción». Entre el cierre de
  la sucesión (`S18`) y la autorización de la sucesora (`S2` → `S9`), la persona **tiene días
  firmados y no tiene cortesía corriendo** — el estado que `DEC-GRANT-007` creó al diferir el saldo
  en `courtesy_grant.saldo_días`.
- **Decisión**: se muestra el saldo **con la condición que lo activa** — *«te quedan N días, que
  empiezan a correr cuando completes el pago»*. Es una fila de copy en `B/19` §3, y ata esa
  superficie al `saldo_días` de `courtesy_grant`.
- **Por qué, y es la razón que `DEC-GRANT-011` vuelve más filosa**: con el saldo **cerrándose** al
  vencer la ventana de autorización, la ventana en que la persona no ve nada es exactamente la
  ventana en que puede perder los días. **Ésta es la única de las tres opciones que le da la
  información con la que evitar esa pérdida**, y decirlo es además lo que empuja a completar el
  pago.
- **Las dos alternativas, y la tercera se descarta de plano**:
  - **No mostrar nada** hasta que la cortesía vuelva a correr: cuesta cero y **le esconde al
    cliente días que son suyos**, justo cuando puede abandonar y perderlos. Es el mismo hueco que
    `DEC-GRANT-011` por la otra puerta.
  - **Mostrar el saldo a secas** —*«te quedan N días»*, sin la condición—: cuesta lo mismo que la
    elegida y es **estrictamente peor**. Es la clase de promesa que `NUCLEO/07` §5.3 manda
    anticipar, y es el patrón que el programa ya tiene medido en la copy del proveedor —*«Pagaste
    la suscripción»* sobre un cobro que nunca ocurrió (`EX-3`)—, que es lo que motivó la regla de
    que ninguna decisión de soporte se apoye en ella. **Prometer días y después quitarlos es
    exactamente lo que no se hace.**
- **Lo que NO cierra**: el texto exacto de la copy, que es trabajo de producto y se escribe en
  `B/19` §3; y **qué se le dice cuando el saldo efectivamente se cierra** por `DEC-GRANT-011` — el
  aviso de ese cierre no está escrito en ningún capítulo, y la tanda que implemente las dos
  decisiones tiene que resolverlo junto.
- **Origen**: la FASE 8-bis-5, `22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md` §`E3`
  —levantado de `rastro-f21d5d828.md` §6 punto 3—, y la elección del owner del 2026-09-23 entre las
  tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-DATA-004 — Se ratifican las tres formas que la tanda eligió sin consultar: la rama de `PB7`, el orden del cupo y la lista de los cinco

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **la cifra de `H1`, precisada el 2026-09-25**: los consumidores de `inactiva_desde` son **seis**, no cinco (FASE 8 completa `F-8CD1-009`; `V/02` §2.5). Se ratificó la forma de la lista, no su cifra · **Decide**: owner
- **Por qué esta decisión existe**: la tanda 9-bis-4 tomó tres elecciones de forma y las dejó
  escritas como preguntas al owner en sus rastros, sin que nadie las registrara. El censo de la
  FASE 8-bis-5 las levantó (`22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md`, §§ `B2`, `B3`,
  `H1`). **Las tres se ratifican tal como están escritas**, y esta entrada existe para que la
  ratificación quede asentada y no vuelvan a abrirse.
- **`B2` — la segunda rama de `PB7` es la CONDICIÓN de `DEC-DATA-003`, no una extensión.** Queda
  como está en `V/03` §9. La razón: la mitad `UNPUBLISHED_BY_BILLING` del `desde` de `PB4` **es** la
  población del excedente, así que sin esa rama la frase de `DEC-DATA-002` —*«vuelve sola por `PB7`
  y nunca se borra»*— sería falsa justo para ese sujeto. Leerla como extensión costaría **una
  enmienda registrada a una decisión `ACCEPTED`**, que es una decisión ganando alcance sin que su
  entrada lo diga — lo que `DEC-METH-011` pide no hacer en silencio.
- **`B3` — el criterio de orden entre `PB3` y `PB7` queda en «vuelve primero lo que cayó al
  final»**, con el origen sin desempatar. La razón no es la inercia sino una propiedad verificable
  que el texto ya declara: ***«el conjunto que queda publicado depende sólo del cupo y no del
  camino»*** (`V/03` §9). Cualquier otro criterio —antigüedad, elección del dueño, el origen
  desempatando— cuesta tres lugares (`V/03` §9, `V/15` §4.3 y las filas 8 y 19 de `V/19`) **y pierde
  esa propiedad**: el resultado pasaría a depender de por cuántos planes pasó el cliente.
- **`H1` — la lista de los cinco consumidores de `inactiva_desde` queda como está**, con los dos
  avisos de schedule y la superficie del archivado contados por separado, y con la explicación al
  lado para que nadie la lea como lista corta y la «arregle». Reescribirla agrupando los tres avisos
  cuesta tres lugares (`V/02` §2.5, `NUCLEO/01` §1.2 y la referencia cruzada de `B/20` §2) y
  **`G-R6-B` cuenta exactamente lo mismo**: compra legibilidad, no vigilancia. **Está medido**, no
  estimado.
- **El criterio común, escrito para no volver sobre esto**: las tres alternativas descartadas
  compran legibilidad o encuadre y **ninguna compra una comprobación nueva**; las tres cuestan tres
  lugares o una enmienda a una decisión cerrada. **Entre dos formas que el guard no distingue, queda
  la que ya está escrita.**
- **Lo que esta decisión NO ratifica, y va dicho porque vive al lado**: el defecto `H2` del censo
  —`G-R6-B` vigila que no haya intrusos pero **no comprueba que sus lectores declarados sigan
  existiendo**, así que el día que el hard delete deje de leer `inactiva_desde` el guard sigue
  verde—. Eso **no es una elección de forma**: es un defecto `MEDIA` y lo arregla la tanda.
- **Origen**: el censo de la FASE 8-bis-5 §§ `B2`, `B3` y `H1` —levantados de `rastro-5836ec219.md`
  §4 puntos 2 y 3 y de `rastro-31ce26bb2.md` §8 punto 1—, y la ratificación del owner del
  2026-09-23.

---

### DEC-ENT-005 — La CLASE de una clave de entitlement es un atributo declarado del catálogo, no un juicio

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner *(renumerada el 2026-09-25: se llamaba `DEC-ENT-002`, ID duplicado con otra decisión — FASE 8 completa, `F-8CD1-008`)*
- **El problema que cierra**, el crítico #1 de la FASE 8-bis-5 (`F-8fA1-002`, `ALTA`): `G-R3` tiene
  por predicado *«la clave de la clase comercial…»* y **«clase comercial» se usaba en cuatro lugares
  y no estaba definida en ninguno**. El guard más cargado del programa **no podía formar su
  predicado**, y la primera clave que tenía que clasificar era la que la tanda acababa de agregar.
- **Decisión**: la **clase** pasa a ser el **cuarto atributo declarado** de cada clave en el catálogo
  —junto al scope, la estrategia de agregación y los que ya estaban—, con **lista cerrada de dos
  valores: `COMERCIAL` y `DE_ACCESO`**, y su entrada de glosario al lado de *«entitlement medido»*.
  **`G-R3` lee un atributo; no juzga.**
- **Por qué, y es el patrón con que el programa viene cerrando guards inconstruibles**: un predicado
  que obliga al guard a decidir *«¿esta clave es comercial?»* no es ejecutable; uno que le hace leer
  una columna, sí. **Convertir un juicio en una lectura** es lo mismo que hizo `DEC-GRANT-009` al
  mandar el *«a lo sumo un grant vivo»* a un `UNIQUE` parcial en vez de a nueve consumidores.
- **Los precedentes, que están en el mismo capítulo**: el `scope` y la estrategia de agregación ya
  son atributos declarados de una clave (`V/15` §2.3 y §3.2). Y **`NUCLEO/02` §1.2 no lo prohíbe**:
  lo que prohíbe llevar en código son **valores, precios y asignaciones**, no los metadatos de una
  clave.
- **Las dos alternativas, y por qué no**:
  - **Tres valores**, dejando lugar a una clave que no caiga en ninguno de los dos: se descarta
    porque **es una puerta vacía**. Si aparece la clave que no encaja, agregar el tercer valor
    entonces cuesta exactamente lo mismo que ahora **y con un caso real delante** para nombrarlo
    bien.
  - **Definir *«clase comercial»* en prosa** y que `G-R3` la juzgue: **es volver al crítico**. Era el
    estado de partida.
- **Cómo se tomó, y va dicho**: el agente de arreglo de la familia 1 de la 9-bis-5 **la tomó sin
  consultar** —es una decisión de modelo— y la declaró como tal pidiendo ratificación. El owner la
  ratificó el 2026-09-23. **Que la haya tomado un agente no la vuelve menos decisión**: por eso
  tiene entrada propia en vez de quedar sólo en el commit `2e39e6224`.
- **Origen**: `22-fase-8-bis-5/A1-acceso-cruzado-y-autorizacion.md` (`F-8fA1-001` y `F-8fA1-002`), la
  familia 1 de la FASE 9-bis-5 (`6dc5aeb70`, `2e39e6224`) y la ratificación del owner del 2026-09-23
  entre las tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-SUB-016 — La primera cuota de un pagador manual tiene ventana propia: SIETE días corridos, no las 72 h del checkout

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (revisión del owner, C9; ver su 📌) · **Decide**: owner
- **El caso, abierto por la familia 2 de la 9-bis-5**: al cerrar `F-8fB1-004` la primera cuota del
  pagador manual ganó ejecutor —la abre `S1`, en `PENDING_AUTHORIZATION`, donde `S4` no alcanza—, y
  si nadie transfiere, `S3` la lleva a `ABANDONED`, que es **terminal**. **Pero la única ventana
  declarada en todo el corpus son las 72 h de `S3`, escritas para completar un checkout con
  tarjeta**, no para que se acredite una transferencia bancaria.
- **Decisión**: `S3` tiene **dos plazos según el método de pago**. Para el pagador con tarjeta siguen
  las **72 h**. Para el **pagador manual**, la ventana es de **7 días corridos**.
- **Por qué siete, y por qué corridos**: es el único de los tres caminos en que el mecanismo coincide
  con el hecho físico que espera. **Una transferencia interbancaria en Argentina no se acredita en
  72 h si cae un fin de semana largo**, y el costo de equivocarse es asimétrico: se pierde a alguien
  que **ya decidió pagar** contra tener una fila pendiente unos días más. Corridos y no hábiles
  porque un plazo en días hábiles obliga a un calendario de feriados que el programa no tiene y que
  nadie va a mantener — el mismo criterio con que el programa viene descartando mecanismo.
- **Las dos alternativas, y por qué no**:
  - **Dejar las 72 h** —una sola ventana en todo el corpus, costo cero—: se descarta porque el caso
    que falla no es de borde. Una transferencia enviada un viernes se acredita el lunes, y ese
    Partner de buena fe **muere en `ABANDONED`** y tiene que rehacer el alta entera. Si alguna vez
    se vuelve a esta opción, **el aviso del alta tiene que decir el plazo explícitamente**.
  - **Sin ventana**, la fila queda en `PENDING_AUTHORIZATION` hasta que alguien transfiera o un
    humano la cierre: es ***«un instrumento abierto sin fecha de cierre»***, la forma que `B/16` §1.3
    rechaza por escrito y que este mismo día llevó a descartar *«dejar el saldo de cortesía
    esperando»* en `DEC-GRANT-011`. **Mismo criterio, mismo día, mismo rechazo.**
- **Lo que hay que recorrer al implementarla**: `S3` deja de tener un plazo y pasa a tener dos, así
  que **todo lo que cite «72 h» o «la ventana de `S3`» hay que recorrerlo** —`B/03` §3.4 y §7, el
  aviso del alta en `B/19`, y el cap. 07 §2—. Es el trabajo que `DEC-METH-011` obliga a rastrear.
- **Lo que NO cierra**: **qué se le dice a quien se le venció la ventana** y tiene que rehacer el
  alta. No está escrito en ningún capítulo, y es el mismo hueco que `DEC-GRANT-012` dejó abierto para
  el aviso del cierre del saldo. **Las dos las resuelve la misma tanda**, y conviene que sea la misma
  fila de copy.
- **Origen**: la familia 2 de la FASE 9-bis-5 (`44e3d963a`, `cbd3e7093`), que dejó la cifra
  explícitamente sin elegir por ser de producto, y la elección del owner del 2026-09-23 entre las
  tres opciones que se le presentaron — eligió la 2, que era la recomendada.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C9)**: Las 72 horas con tarjeta
  y los siete días con pago manual son el valor inicial del plazo 10 de `NUCLEO/02` §1.5.

---

### DEC-RF-004 — El motivo 14 no tiene UN default: tiene dos ramas, y la que devuelve es la que el cliente no causó

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **precisada el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-n`: `S12`-vía-`S26` pasa al lado que devuelve; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8; ver su último 📌) · **Decide**: owner
- **El caso, abierto por la familia 3 de la 9-bis-5**: al cerrar `F-8eB1-004` el reembolso que `S21`
  declara posible ganó por fin su motivo —el **14**, `COMPLEMENTO_CON_PERÍODO_COBRADO`— y se le puso
  un default **uniforme en NO DEVOLVER**, que es lo que `B/16` §4.4 ya había decidido. **Pero `S21`
  tiene cuatro disparadores y no son equivalentes.**
- **La asimetría, que es lo que decide**: en unos el **cliente actuó** —borró su ficha (`A6`, y
  `DEC-ADDON-001` ya declara que el complemento *«se consume»*) o pidió la baja (primera cláusula de
  `A5`)—. En la **tercera cláusula de `A5`**, en cambio, **se revoca el grant que era su título: el
  cliente no hizo nada y pierde los días que pagó.**
- **Decisión**: el motivo 14 **deja de tener un default único** y pasa a tener **dos ramas**:
  - **`DEVOLVER`** cuando la causa es la **revocación del grant** (tercera cláusula de `A5`);
  - **`NO DEVOLVER`** en los demás disparadores de `S21`, donde el complemento se pierde por un acto
    del propio cliente.
  **La tanda que la implemente enumera los cuatro disparadores y dice de qué lado cae cada uno**, sin
  dejar ninguno implícito.
- **Ampliado el 2026-09-23, ya medidos los cuatro**: `A5` 1ª cláusula *(se da de baja)*, `A5` 2ª
  *(queda huérfana)*, `A5` 3ª *(se revoca el grant que era su título)* y `A6` *(se borra la ficha
  destino)*. **La 3ª va a `DEVOLVER`; las otras tres a `NO DEVOLVER`.**
  **Y la 2ª NO es homogénea, lo que el owner decidió aceptar con una condición.** De las
  ~~seis~~ **DOCE** transiciones que dejan huérfano un addon (`B/16` §4.3), ~~dos~~ **CINCO no son
  un acto del cliente**: `S17` (nuestra), `S12` cuando viene de un `CANCEL_SCHEDULED` que puso
  `S26`, y `S25`, `S27` y `S28` (las tres, la discontinuación de una vertical).
  Por el criterio de esta misma decisión esas cinco irían a `DEVOLVER`, y **quedan en `NO DEVOLVER`
  por MECANISMO**: `S21` conoce la cláusula de `A5` que la disparó, **no cuál de las doce mató al
  título tres saltos antes**, y hacerle llegar esa causa es mecanismo nuevo.
  - ***Enmendado el 2026-09-23, con las cifras ya corregidas: la DISCONTINUACIÓN se parte y el resto
    no.*** Cuando las cifras falsas se corrigieron —doce y cinco, no seis y dos— el owner volvió a
    mirar el reparto y **partió el disparador 2 sólo para la discontinuación**: **`S25`, `S27` y
    `S28` van a `DEVOLVER`**; `S17` y `S12`-vía-`S26` **siguen en `NO DEVOLVER`** con la condición
    de arriba.
    **Por qué justo esas tres, y el argumento es que la razón para no partir era FALSA ahí**: lo que
    sostenía el `NO DEVOLVER` era *«`S21` no puede saber cuál de las doce mató al título tres saltos
    antes»*. **Para la discontinuación eso no se cumple.** No hace falta el mecanismo que se
    descartó: la causa está disponible en el acto mismo.
    > **Precisión del 2026-09-23, y corrige esta enmienda**: la razón se escribió como *«es un acto
    > masivo nuestro que recorre las filas una por una»* **sobre las tres, y eso es verdadero sólo
    > para `S27` y `S28`**. `B/10` §4.3 dice textual que la `PAUSED` ***«no entra al acto»*** y
    > *«termina en `S25` cuando la pausa termina»* — `DEC-SUB-015` la saca del día 0 a propósito.
    > **`S25` llega al mismo lado por otra vía**: su propia guarda **es** la discontinuación (*«el
    > plan ya no se presta»*, que es lo que la separa de `S10`), así que también conoce la causa sin
    > trazar nada hacia atrás. **Son dos vías distintas y el capítulo las escribe separadas**; la
    > frase original, aplicada a las tres, habría metido una premisa falsa en el corpus. Lo detectó
    > la tanda que la implementó y lo verifiqué contra `B/10` §4.3.
    **Y es donde el costo humano es mayor**: `S27` y `S28` **no reciben el piso de 60 días**, porque
    `DEC-SUB-018` se lo niega a la suspendida y a la que esperaba autorización. Son los dos únicos
    caminos en que la persona pierde el complemento que pagó, **no recibe ninguna compensación**, y
    el default le proponía no devolverle nada.
    **Lo que NO se parte, y queda declarado**: `S17` y `S12`-vía-`S26` siguen dependiendo de que
    quien resuelve se aparte del default, **porque ahí el argumento del mecanismo sí vale** — no hay
    un acto nuestro recorriendo esas filas que pueda marcarlas al pasar.
    Elección del owner del 2026-09-23 entre tres opciones — eligió la 3, que era la recomendada.
  **La condición, y es obligatoria**: la fila del motivo 14 **dice en voz alta que esos caminos
  existen**, para que quien resuelve pueda apartarse del default sabiendo cuándo. Un default es una
  propuesta y no una sentencia; lo que no puede ser es una propuesta que contradice el criterio **en
  silencio**. Elección del owner del 2026-09-23 entre tres opciones — eligió la 1, con esta
  condición agregada.
  > **Cifras corregidas el 2026-09-23, y la cadena vale escribirla.** Esta viñeta decía *«de las
  > SEIS… DOS no son del cliente»*. Las dos cifras eran falsas: **son doce y cinco**, verificadas
  > contra la enumeración de `B/16` §4.3 —`S3`, `S12`, `S13`, `S16`, `S17`, el espejo de la baja del
  > proveedor, `S22`, `S23`, `S24`, `S25`, `S27`, `S28`, con `S26` excluida a propósito porque manda
  > la fila a `CANCEL_SCHEDULED`, que sigue viva—. **El «seis» nació de leer el primer tramo de una
  > enumeración de doce**, pasó a `B/03` §3.2, de ahí a esta entrada y de ahí al encargo de la tanda
  > que la implementó; lo frenó la instrucción de verificarlo contra `B/16` §4.3. **El criterio de
  > la decisión no cambia y la condición obligatoria se implementó sobre los cinco.** Lo que sí
  > cambia es el peso de lo aceptado, y por eso se volvió a consultar al owner: **`S27` y `S28` no
  > tienen ninguna compensación**, porque `DEC-SUB-018` les niega el piso de 60 días.
- **Por qué, y la razón ya estaba escrita en el programa**: *si la pérdida la causa un acto
  deliberado NUESTRO y la persona no puso plata nueva → se declara y no se repara; **si la persona
  PUSO PLATA → se le da salida***. En la tercera cláusula **las dos mitades apuntan al mismo lado**:
  la persona puso plata **y** la pérdida la causa un acto deliberado nuestro. Es el mismo criterio
  con que se resolvieron `DEC-TRIAL-009`, `DEC-ADDON-005` y `DEC-GRANT-011`, aplicado a un caso que
  cae del otro lado.
- **Las dos alternativas, y por qué no**:
  - **Dejarlo uniforme en NO DEVOLVER** —costo cero—: se descarta porque **contradice el criterio en
    silencio**. Un default uniforme no es neutral: **esconde que hay un caso en el que nadie del otro
    lado hizo nada**, y lo esconde justo donde hay plata del cliente.
  - **Devolver siempre en el motivo 14**: contradice `DEC-ADDON-001`, que ya declaró consumido el
    complemento de quien borra su propia ficha.
- **Lo que cuesta, dicho**: el motivo 14 es el primero del catálogo con **default por rama** en vez
  de por motivo, así que **hay que recorrer todo lo que cite *«el default del 14»*** y la tabla de
  defaults deja de poder leerse como una columna plana. Es trabajo de rastro, no mecanismo nuevo en
  producción: la rama la decide el disparador, que la transición ya conoce.
- **Origen**: la familia 3 de la FASE 9-bis-5 (`8835bc26a`, `76ee57f12`), que dejó la partición
  explícitamente sin hacer por ser *«decisión de plata, no lectura del corpus»*, y la elección del
  owner del 2026-09-23 entre las tres opciones que se le presentaron — eligió la 2, que era la
  recomendada.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-n`)**: la
  ampliación parte cuatro caminos y deja uno. `S12`-vía-`S26` ya no depende de transportar la causa:
  `S21` la lee en la fecha de fin en la fila de `vertical_discontinuation` de la vertical de la
  principal, y abre el 15. Queda del lado de la regla sólo `S17`. La lectura es por la vertical y no
  por la fila, así que también alcanza a la baja que la persona pidió antes del anuncio y termina
  después.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8)**: Con C8 el disparador 2
  de `S21` ya no se parte y el motivo 15 se llama `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`.

---

### DEC-GRANT-013 — Otorgar un `Free Forever` CIERRA el saldo de una cortesía diferida del mismo beneficiario

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso, que nació con `DEC-GRANT-007`**: desde que la cortesía se **difiere** en
  `courtesy_grant.saldo_días` en vez de re-apuntarse, existe una población nueva —un saldo esperando
  una fila— y `B/14` §4.3 dice *«otorgar un grant termina cualquier cortesía vigente»* **terminándola
  cancelando la suscripción que la pausaba** (`S13`). **Sobre un saldo diferido no hay suscripción
  que cancelar**: la regla, tal como estaba escrita, **no alcanzaba al caso**.
- **Decisión**: `S13` **cierra** el saldo diferido del beneficiario en cada vertical que el acto
  ancla, con `saldo_cerrado_en` y `motivo_cierre = GRANT_PERMANENTE_OTORGADO`. **Esos días no
  vuelven.**
- **Por qué, y la razón la midió la familia 4 recorriendo el mecanismo**: el censo suponía que
  dejarlo vivo produciría *«un regalo de más»*. **No es así.** Después de que `S13` cancela la
  sucesora, **ninguna de las dos rutas de re-emisión de `S9` vuelve a alcanzar ese saldo**, y la
  sexta comprobación del barrido tampoco lo ve, porque resuelve *«la fila que tenía que recibirlo»*
  con esas mismas dos preguntas. Dejarlo abierto no era ser generoso: era dejar ***«un instrumento
  sin dueño, sin vencimiento y sin nadie que lo mire»*** — la forma que `B/16` §1.3 rechaza por
  escrito y que este mismo día se descartó **dos veces** (`DEC-GRANT-011` y `DEC-SUB-016`).
- **Lo que cuesta, y es el riesgo aceptado**: el beneficiario pierde días firmados por `SUPER_ADMIN`
  **al recibir algo estrictamente mejor**, y **si el `Free Forever` después se revoca, esos días no
  vuelven** — queda sin el grant y sin la cortesía. **Se acepta**, con el mismo remedio que
  `DEC-GRANT-011`: `SUPER_ADMIN` puede volver a otorgar la cortesía por el **primer disparador de
  `S9`**, que es un acto que ya existe.
- **Las dos alternativas, y por qué no**:
  - **Ampliar el tercer disparador de `S9`** para que el saldo vuelva a ser alcanzable si el grant se
    revoca: cierra el agujero de arriba, pero es **mecanismo nuevo** en una transición que ya tiene
    tres disparadores, **y el caso que cubre es doble hipótesis** — hay que otorgar un `Free Forever`
    a alguien con cortesía diferida **y después** revocárselo. Si ocurre, el remedio manual existe.
  - **Dejar el saldo vivo sin ampliar nada**: es exactamente el huérfano silencioso descrito arriba.
- **Cómo se tomó, y va dicho**: la familia 4 de la 9-bis-5 **la tomó sin consultar**, declarándola
  como decisión de plata y pidiendo ratificación — el censo había marcado esta lectura como *«la que
  sube `E2` a `ALTA`»*. El owner la ratificó el 2026-09-23. Mismo criterio de registro que
  `DEC-ENT-005`: **que la haya tomado un agente no la vuelve menos decisión.**
- **Origen**: `22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md` §`E2`, la familia 4 de la FASE
  9-bis-5 (`4df8b55f2d`) y la ratificación del owner del 2026-09-23 entre las tres opciones que se le
  presentaron — eligió la 1, que era la recomendada.

---

### DEC-GRANT-014 — `motivo_cierre` es una enumeración CERRADA, porque el que cierra un saldo es una transición y no una persona

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **La tensión aparente**: `DEC-GRANT-008` decidió que la revocación de un grant guarda **motivo en
  TEXTO LIBRE**. Al escribir el cierre del saldo diferido (`DEC-GRANT-011`, `DEC-GRANT-013`), la
  familia 4 de la 9-bis-5 usó una **enumeración cerrada** en su lugar.
- **Decisión**: **`motivo_cierre` es una enumeración cerrada.** No deroga `DEC-GRANT-008`.
- **Por qué, y la distinción es real, no una excepción de conveniencia**: la razón escrita de
  `DEC-GRANT-008` es ***«concesiones firmadas a mano»*** — un humano explicando por qué revoca, que
  es justamente lo que un enum no puede capturar. **Acá el que cierra es una TRANSICIÓN.** Una
  persona necesita explicar; una transición sólo necesita **identificarse**.
- **Lo que compra, y es el mismo movimiento que `DEC-ENT-005`**: convierte *«ningún otro acto puede
  terminar una concesión de `SUPER_ADMIN`»* en algo que **un guard lee**, en vez de prosa que alguien
  tiene que acordarse de respetar. Una enumeración cerrada se gana el lugar cuando su trabajo es
  decir **quién NO está en ella**.
- **Lo que queda vigente, dicho para que nadie lea esta entrada como una derogación**:
  **`DEC-GRANT-008` sigue rigiendo la revocación manual de un grant**, con su motivo en texto libre.
  Las dos formas conviven porque describen dos actos distintos: **enumeración para lo que cierra una
  transición, texto libre para lo que firma una persona.**
- **Las dos alternativas, y por qué no**:
  - **Texto libre también acá**, por uniformidad con `DEC-GRANT-008`: una sola forma, pero **ningún
    guard puede comprobar qué actos cierran saldos** — que es exactamente la clase de vigilancia que
    esta tanda viene construyendo.
  - **Declararlo como regla general de dos formas**: es lo que en los hechos queda, y está escrito
    arriba; no necesita una decisión aparte.
- **Cómo se tomó**: la familia 4 **la tomó sin consultar**, declarándola como decisión de modelo y
  pidiendo ratificación. El owner la ratificó el 2026-09-23. Tercer caso del mismo patrón en esta
  tanda, con `DEC-ENT-005` y `DEC-GRANT-013`.
- **Origen**: la familia 4 de la FASE 9-bis-5 y la ratificación del owner del 2026-09-23 entre las
  tres opciones que se le presentaron — eligió la 1, que era la recomendada.

---

### DEC-RF-005 — El listado ENLAZA al evento que dice cuál condición falló, y no lo copia en la marca

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner
- **El caso**: el motivo 7 (`PAGO_TARDÍO_RECHAZADO`) quedó en `DEVOLVER` con **cuatro condiciones**
  que pueden fallar, y una de ellas —un precio nuevo no propagado— no es culpa del cliente del mismo
  modo que las otras. Hoy **cuál de las cuatro falló se libra a que la persona lea el evento
  crítico**.
- **La regla que el corpus ya tiene escrita, y que verifiqué**: `B/05` §3 dice textual ***«Cuál de
  las cuatro condiciones falló va en el evento y no en el motivo»***.
- **Decisión**: **el listado ENLAZA al evento**. La persona ve el motivo y un vínculo a la condición
  que falló. **La marca no guarda ese dato.**
- **Por qué**: resuelve el problema real —que quien resuelve tiene que ir a buscarlo— **sin
  contradecir `B/05` §3 y sin duplicar** información que ya existe en otro lado. Es superficie, no
  modelo: una fila de `B/19`, cero columnas nuevas.
- **Las dos alternativas, y por qué no**:
  - **Que la marca guarde cuál condición falló** y el listado proponga distinto por condición:
    **contradice una regla escrita del corpus**, que habría que enmendar explícitamente, y duplica
    un dato con dos fuentes que pueden divergir.
  - **Dejarlo como está**, con la persona leyendo el evento por su cuenta: es correcto y es lo que
    hay, pero deja el trabajo de encontrarlo del lado de quien resuelve, todas las veces.
- **Origen**: la familia 3 de la FASE 9-bis-5, y la elección del owner del 2026-09-23 entre las tres
  opciones que se le presentaron — eligió la 3, que era la recomendada.

---

### DEC-SUB-017 — El crédito corto del pagador manual SÍ se corrige, porque su fecha es una columna nuestra

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **precisada el 2026-09-25** (FASE 8 completa: el pago retenido por `S19`; ver su 📌) · **Decide**: owner
- **El caso**: `B/12` §5.4 concluye *«no hay corrección»* apoyándose en la **sonda 48**, que midió un
  **preapproval `pending`** del proveedor. **El pagador manual no tiene preapproval**: su fecha del
  próximo cobro es una **columna nuestra**. La tanda corta de la 9-bis-5 acotó esa conclusión a lo
  que la medición cubre en vez de extenderla, y dejó el caso abierto.
- **Decisión**: **se abre la corrección local para el pagador manual.** Sobre el preapproval
  `pending` del proveedor la conclusión de `B/12` §5.4 no cambia; sobre la copia local, sí se
  corrige.
- **Por qué, y es el punto entero**: el argumento que sostiene *«no hay corrección»* es **«el
  proveedor no nos deja»**, y acá **no hay proveedor que no nos deje**. Extender una conclusión
  medida sobre un sujeto a otro que no comparte su mecanismo es fabricar un hecho.
- **Y hay una razón de forma que pesa igual**: con `DEC-SUB-016` **nosotros** alargamos esa ventana
  de 72 h a **7 días corridos**. Aceptar un crédito corto que **crece por decisión propia** es
  distinto de aceptar uno que impone un tercero. Lo primero hay que corregirlo o dejar de llamarlo
  una restricción externa.
- **Las dos alternativas, y por qué no**:
  - **Aceptar el crédito corto también acá**, declarándolo con causa: la causa que se declararía
    —el límite del proveedor— **no existe en esta población**.
  - **Medirlo antes de decidir** (cuántos días se pierden en el peor caso): defendible, pero la
    corrección es barata y el caso ya está identificado; medir primero sólo retrasa.
- **Origen**: la tanda corta de la FASE 9-bis-5, que acotó la conclusión de `B/12` §5.4 a lo medido,
  y la elección del owner del 2026-09-23 entre las tres opciones que se le presentaron — eligió la
  1, que era la recomendada.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 8 completa)**: un pago de la predecesora
  retenido por `S19` que entra a este recálculo **queda como crédito de la sucesora y no se
  reembolsa** por la rama 1 de `B/12` §5.3. Sin esto, el mismo pago daba el mes como crédito y
  además se devolvía.

---

### DEC-TEST-002 — Un escritor DECLARADO y no implementado bloquea la terminación de su unidad, y no lo vigila un guard

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **precisada el 2026-09-30, con OK del owner** (FASES 6 y 7, lote de la aplicación, M: una segunda condición de terminación, sobre las filas `UNKNOWN`, por `DEC-ARCH-016`; ver su 📌) · **Decide**: owner
- **De dónde sale**: la familia 1 de la 9-bis-5 arregló que `G-R6` naciera en rojo sobre el camino
  normal (`I1`), fijando su dominio en **las tablas que los capítulos declaran** en vez del
  subconjunto construido. **La contrapartida quedó declarada y es real**: un escritor que el capítulo
  declara pero que nadie implementa **pasa en verde**, y esa clase no la vigila nada.
- **Decisión**: **es un criterio de terminación, no un guard.** Ninguna unidad se declara lista si
  deja un escritor declarado sin implementar.
- **Por qué, y son dos razones**:
  1. **Actúa en el momento correcto** — cuando se declara lista la unidad, no cuando alguien lee un
     dato vacío en producción.
  2. **No inventa mecanismo**: la familia 5 acaba de convertir *«asignar un guard»* en *«exigirlo
     para terminar»* (los 29 guards pasaron a ser exigibles en los dos §4), y esto es **la misma
     forma aplicada a los escritores**.
- **Las dos alternativas, y por qué no**:
  - **Un guard nuevo** que compare escritores declarados contra implementados: **sólo puede correr
    cuando exista el código**, o sea FASE 10 en adelante, y hasta entonces no vigila nada.
  - **Aceptar la contrapartida** sin hacer nada: una columna con escritor declarado y sin
    implementar **no la detecta nadie** hasta que alguien lea el dato vacío.
- **Origen**: la familia 1 de la FASE 9-bis-5, que dejó la contrapartida declarada y la mandó a
  `DEC-TEST-001`, y la elección del owner del 2026-09-23 entre las tres opciones que se le
  presentaron — eligió la 3, que era la recomendada.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, lote de la aplicación, M;
  `39-fases-6-y-7/10-decisiones-del-owner.md`)**: la terminación de una unidad tiene, además del
  escritor declarado, **una condición sobre las filas `UNKNOWN` de la matriz en que se apoya**
  (`DEC-ARCH-016`, letra D): la unidad termina si cada una tiene sus dos ramas escritas y una
  prueba por rama contra el proveedor falso; la batería semanal la sigue midiendo y, cuando la fila
  cierra, la rama que no vale se borra. Es de la misma forma que ésta: un criterio de terminación,
  no un guard. Dónde: `16-fase-7-del-paraguas.md` §4.7, momento 1; las dos descomposiciones, §4;
  `B/descomposicion.md` §2.7. Origen: (FASES 6 y 7, lote de la aplicación, owner 2026-09-30, M).

---

### DEC-ARCH-010 — Los tres inventarios de `NUCLEO/01` son capítulo de la unidad `B3`

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED · **Decide**: owner *(renumerada el 2026-09-25: se llamaba `DEC-ARCH-008`, ID duplicado con otra decisión — FASE 8 completa, `F-8CD1-008`)*
- **El caso**: `NUCLEO/01` §2.4, §2.5 y §2.6 **no eran capítulo de ninguna de las 22 unidades**, y
  `G-R1-E` / `G-R1-F` los cuentan. Es el defecto `I3` del censo, **reportado por dos vueltas**
  (`F-8dC2-002`).
- **Decisión**: los tres §§ son **capítulo de `B3`**.
- **Por qué, y las tres razones son verificables**:
  1. **El propio texto declara su lado**: `NUCLEO/01` §2.4 dice *«Todos están del lado de billing y
     sobre filas de billing»*.
  2. **`B3` ya es dueña de `B/02` §2.5** desde la familia 3 (`669a78ccc`), por la misma razón: es
     donde vive el dato que esos dos guards cuentan.
  3. **Hay precedente de la misma forma**: `NUCLEO/01` §1.2 → `V9`.
- **Por qué costaba decidirlo**: `DEC-ARCH-006` hace que asignar un capítulo del núcleo a una unidad
  de una épica sea una decisión de frontera, no de conveniencia. Por eso el agente la declaró en vez
  de darla por obvia.
- **Cómo se tomó**: la familia 5 **la tomó sin consultar** y pidió ratificación; el owner la ratificó
  el 2026-09-23. **Cuarto caso del patrón en esta tanda**, con `DEC-ENT-005`, `DEC-GRANT-013` y
  `DEC-GRANT-014`.
- **Origen**: `22-fase-8-bis-5/01-censo-de-preguntas-abiertas.md` §`I3`, la familia 5 de la FASE
  9-bis-5 (`b91a7b251c`) y la ratificación del owner del 2026-09-23 entre las tres opciones que se le
  presentaron — eligió la 1, que era la recomendada.

---

### DEC-SUB-018 — La suscripción SUSPENDIDA no entra al piso de una vertical discontinuada: va a `CANCELLED`

- **Fecha**: 2026-09-23 · **Estado**: **SUPERSEDED (revisión del owner, 2026-09-28, C8)**: las verticales no se discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces, y este texto queda como punto de partida · **Decide**: owner
- **El caso**: al escribir las tres transiciones de la discontinuación (`S26`, `S27`, `S28`, cerrando
  `F3`), la familia 4 mandó la **suspendida** a `CANCELLED` y **no al piso de 60 días**, con el
  criterio de que **al piso va sólo quien hoy tiene servicio**.
- **Decisión**: **se ratifica.** La suspendida va a `CANCELLED`.
- **Por qué**: el piso de 60 días es una **compensación por un servicio que se interrumpe**, y quien
  está suspendido **no lo tiene**. El reparto lo decide la tabla de qué emite cada estado
  (`12-contrato…` §2.6), que es un árbitro verificable y no un criterio de quien escribe.
- **Lo que cuesta, y va declarado**: esa persona **pierde la ventana de `MP4` para regularizar y
  volver**. Se acepta.
- **Las dos alternativas, y por qué no**:
  - **Mandarla al piso como al resto**: le damos 60 días de servicio a quien no estaba pagando, y
    contradice la tabla de cobertura que decidió el reparto entero.
  - **Darle la ventana de `MP4` antes de cancelar** —si regulariza, entra al piso; si no,
    `CANCELLED`—: es la más justa en abstracto, y **agrega mecanismo** para una población que es la
    intersección de dos casos raros: estar suspendido **y** que justo discontinuemos esa vertical,
    que es un acto que el owner ya declaró que no va a ocurrir. `DEC-GRANT-010` sentó el precedente
    de declarar con causa en ese mismo escenario.
- **Origen**: la familia 4 de la FASE 9-bis-5 (`a577de930e`, `3075b5a84d`, `53df8414ce`) y la
  ratificación del owner del 2026-09-23 entre las tres opciones que se le presentaron — eligió la 1,
  que era la recomendada.

---

### DEC-RF-006 — El motivo 14 se PARTE EN DOS MOTIVOS, y con eso el default vuelve a ser por motivo

- **Fecha**: 2026-09-23 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R4` y `R20`: los motivos 23 y 24, veinticuatro con nueve que devuelven; ver su 📌) — **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27, `V2-n` y `V2-p` el 2026-09-28: el 15 gana el `USER`/`GLOBAL` de `S26` y el `S12`-vía-`S26`, y la marca de la sonda se declara; ver su segundo 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8; ver su último 📌) · **Decide**: owner
- **El hueco, que es ANTERIOR a la partición de `DEC-RF-004`**: `NUCLEO/08` §4.3 dice que la marca
  *«lleva de qué disparador vino»* y `B/19` §6 que la rama *«viaja con la marca»*, pero las columnas
  de `reconciliation_mark` (`B/02` §2.2) son **la suscripción, el motivo, `puesta_en`,
  `levantada_en` y quién la levantó** — verificado contra el texto—: **ninguna es el disparador.**
  `DEC-RF-004` ya exigía distinguir cuatro disparadores desde que le quitó el default único; la
  enmienda de la discontinuación sólo llevó ese dato de cuatro valores a cinco.
- **Y hay un agravante medido**: en la orfandad por discontinuación **la causa no sobrevive en
  ningún lado** una vez que la fila llega a `CANCELLED`, así que *«derivarla al leer»* no tiene de
  qué derivarla.
- **Decisión**: **el motivo 14 se parte en DOS motivos del catálogo** — uno para la orfandad por
  **discontinuación de una vertical** (`S25`, `S27`, `S28`), con default **`DEVOLVER`**; otro para
  el **resto** de la 2ª cláusula de `A5`, con default **`NO DEVOLVER`**. El catálogo pasa de
  **catorce a quince** motivos. **La tanda que la implemente elige los nombres respetando la
  convención del catálogo, y recuenta el conjunto entero** — no le suma uno.
- **Por qué, y no es sólo que sea barata**: `reconciliation_mark.motivo` **ya es una enumeración
  cerrada y ya se escribe al abrir la marca**, en el acto, **cuando la causa todavía existe**. Eso
  cierra el agravante sin columna nueva y sin derivar nada.
- **Y revierte el costo que `DEC-RF-004` había declarado como su precio**: *«el 14 es el primer
  motivo del catálogo con default por rama en vez de por motivo, así que la tabla de defaults deja
  de poder leerse como una columna plana»*. **Con dos motivos el default vuelve a ser por motivo**,
  como en las otras trece filas, y **`G-R1-F` los vigila sin cláusula especial** — se retira la
  cláusula que la familia 3 tuvo que agregarle para alcanzar la rama `DEVOLVER` de un motivo que no
  estaba entre los que devuelven.
- **Lo que hay que resolver al implementarla, y va escrito porque es lo único que la partición
  agrega**: el `UNIQUE(subscription_id, motivo) WHERE levantada_en IS NULL` pasa a **admitir las dos
  marcas abiertas a la vez sobre la misma fila**. Hay que decir **si eso puede ocurrir o está
  excluido por construcción**, y escribirlo donde alguien lo vaya a leer.
- **Lo que sigue vigente**: la **condición obligatoria** de `DEC-RF-004` —decir en voz alta que
  `S17` y `S12`-vía-`S26` son caminos **nuestros** que igual no devuelven— **aplica al motivo que NO
  devuelve**, que es donde esos dos caen.
- **Las dos alternativas, y por qué no**:
  - **Una columna nueva** en `reconciliation_mark` con el disparador: resuelve, pero **agrega una
    columna al modelo** y un valor más que mantener cada vez que `S21` gane un disparador.
  - **Derivarlo al leer**: es lo que el corpus dice hoy y **es lo que está roto** — después de
    `CANCELLED` la causa no está en ningún lado.
- **Origen**: la tanda corta 3 de la FASE 9-bis-5, que declaró el hueco en `B/03` §3.2 y no lo
  resolvió por ser decisión de modelo, y la elección del owner del 2026-09-23 entre las tres
  opciones que se le presentaron — eligió la 3, que era la recomendada.
- ***Precisado el 2026-09-23, y corrige la redacción de esta entrada: la partición es POR DEFAULT,
  no por disparador.*** El texto de arriba describe los dos motivos **hablando sólo del disparador
  2**, y eso deja fuera la **tercera cláusula de `A5`** (la revocación del grant), que el motivo 14
  también cubría y que **`DEC-RF-004` ya manda a `DEVOLVER`**. Si la revocación quedara en el motivo
  que no devuelve, **ese motivo tendría dos propuestas** y *«el default vuelve a ser por motivo»*
  —que esta entrada afirma dos veces— sería **falso**. El reparto correcto, ratificado por el owner:
  - **14 · `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_OTRA_CAUSA`** → `NO DEVOLVER`.
  - **15 · `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN_O_DISCONTINUACIÓN`** → `DEVOLVER`.

  **Ninguno de los dos hereda el nombre pelado, y es deliberado**: el nombre viejo sobrevive en este
  log y en los rastros, que están fuera del corpus y no se editan. Dejárselo al residual lo habría
  **estrechado en silencio**; con los dos sufijados, una aparición del nombre viejo **no está en la
  tabla** y `G-R1-F` la rechaza. Medido: `rg -P 'COMPLEMENTO_CON_PERÍODO_COBRADO(?!_)'` sobre los 46
  archivos del corpus devuelve **cero**.
  **Y por qué no TRES motivos** —revocación, discontinuación y resto por separado, que era la otra
  opción—: hoy las dos causas caen del mismo lado **por la misma razón** (la causa no la puso el
  cliente), así que sería una fila más para mantener en quince lugares por una distinción que **no
  discrimina ninguna propuesta**. Si alguna vez merecen defaults distintos, se parte entonces.
  Elección del owner del 2026-09-23 entre dos opciones — eligió la 1, que era la recomendada.
- **Y `G-R1-F` gana una cláusula que esta entrada no pedía, con el owner enterado**: vigila que
  **las dos marcas no se abran a la vez sobre la misma fila**, que es lo que el `UNIQUE` dejó de
  excluir. **Se deja, por dos razones**: no es un guard nuevo —`G-R1-F` ya existe y ya corre, se
  amplía su predicado—, y lo que reemplaza es **un argumento en prosa**, que es la forma que el
  programa lleva cinco vueltas midiendo que se olvida. El argumento de por qué no puede ocurrir
  queda igual escrito en `B/02` §2.2 y `B/03` §3.2; la cláusula es lo que lo vuelve comprobable.
- 📌 **2026-09-27 (FASE 9 vuelta 2, `R4` y `R20`, con OK del owner)**: se agregan dos motivos
  con `SÍ` y default devolver. El 23, `ORDEN_PAGADA_SIN_INSTANCIA`, cuelga de la instancia del
  addon de única vez y es el único que no cuelga de una suscripción. El 24,
  `IMPORTE_COBRADO_DE_MÁS`, lo abre la comparación de cobros del barrido cuando un cobro
  aprobado supera el monto esperado de su período, y propone devolver la diferencia; y el
  contador de una promo baja sólo con un cobro que salió con el descuento. Son veinticuatro
  motivos y nueve devuelven plata.
- 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-d` el 2026-09-27; `V2-n` y
  `V2-p` el 2026-09-28)**: abren el 15 y no el 14, en la fecha de fin, el `USER`/`GLOBAL` que `S26`
  canceló y todo complemento cuya principal mató `S12` sobre una vertical con fila en
  `vertical_discontinuation`. Siguen siendo veinticuatro motivos, nueve que devuelven. Y la marca 7
  de una sonda del manifiesto del corte nace proponiendo devolver, como toda marca de ese motivo: se
  declara, el owner la levanta sin devolver, y no hay motivo nuevo.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8)**: Con C8 el disparador 2
  de `S21` ya no se parte y el motivo 15 se llama `COMPLEMENTO_CON_PERÍODO_COBRADO_POR_REVOCACIÓN`.

---

### DEC-MP-005 — Seguimos con Mercado Pago, y lo que el proveedor no hace lo suple el diseño

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED · **Decide**: owner
- **El hecho que la fuerza, y no es una comparación**: **la única alternativa con ventaja medida no
  está disponible.** `10-evaluacion-de-proveedor.md` §8.1 tituló *«lo que cambia todo: Mobbex tiene el
  cobro a demanda que MP nos niega»* — y **Mobbex nunca habilitó la cuenta, sin respuesta de
  soporte**. Mercado Pago tampoco respondió la consulta abierta por `R-MP-01`. La evaluación quedó en
  **paso 4 de 6** y **no va a avanzar**, porque lo que falta depende de respuestas de terceros que no
  llegan.
- **Decisión, y son dos cosas:**
  1. **Mercado Pago es el proveedor.** Se cierra la FASE 1C-bis.
  2. **Directriz de diseño**: **lo que MP no hace lo suple nuestro lado**, hasta donde se pueda.
- **Motivo, dicho con precisión porque importa para después**: esto **no es preferir Mercado Pago**.
  Es reconocer que la comparación **no se puede terminar** y que el programa no puede quedar detenido
  esperando a un tercero que no contesta. La ventaja de Mobbex sigue medida y sigue siendo real; lo
  que no existe es la cuenta para usarla.
- **Lo que esta decisión NO cuesta, y por eso se puede tomar hoy**: **ningún capítulo ya escrito.** El
  capítulo 06 abstrajo al proveedor en **ocho capacidades definidas por lo que el dominio necesita, no
  por lo que MP ofrece**, y la evaluación lo midió contra un candidato real: *«cambiar de pasarela no
  invalida un solo capítulo de la spec»* (`10-evaluacion-de-proveedor.md:22-33`). Y **no compromete al
  programa con MP para siempre**: el adaptador de `DEC-ARCH-004` sigue siendo la frontera, y esta
  decisión se revisa si la habilitación aparece.
- **La directriz no es un cambio de rumbo: le pone nombre a lo que el diseño ya venía haciendo.**
  Siete compensaciones ya decididas, medidas en `10-evaluacion-de-proveedor.md:65-79`: el reloj de fin
  de pausa es nuestro porque `PS-4` no auto-reanuda · `DEC-SUB-010` porque `EX-34` no deja correr la
  fecha de una viva · `DEC-SUB-006` cancela y recrea porque `EX-21` no deja mover de plan y `EX-4` y
  `EX-25` no dejan cambiar el ciclo de una viva ni alcanzar a los ya suscriptos · `DEC-ADDON-002` da un
  preapproval por addon porque `EX-5` sólo admite un monto por autorización · `DEC-CONC-001` pone el
  candado del doble cobro de nuestro lado porque `EX-17` no es idempotente · `DEC-GRANT-003` implementa
  la cortesía pausando porque `EX-35` no deja ponerle trial a una viva · y **toda mutación se verifica
  releyendo**, porque la categoría A1 acepta y no aplica.
  > ❌ **Corregido el 2026-09-24, el mismo día en que se escribió: `EX-24` NO va en esa lista, y la
  > primera redacción de esta entrada la incluía.** `EX-24` está `VERIFIED` y mide que **el ciclo de un
  > plan SÍ es editable** —*«verificado por relectura dos veces: `1 days → 2 days` … y `1 months → 2
  > months`»*—, o sea un ÉXITO del proveedor, no una carencia. El error se copió de
  > `10-evaluacion-de-proveedor.md:73`, que agrupa *«cambiar el ciclo (`EX-4`, `EX-24`, `EX-25`)»* bajo
  > lo que no se puede. **Y el mismo documento la lista entre los 9 casos de A1 *«acepta y no
  > aplica»*** (l. 55), que también es falso por la misma razón: son **8**. Lo que sí vale de `EX-24`
  > es su asimetría con `EX-25` —el ciclo del plan se edita pero **no alcanza a los ya suscriptos**—,
  > y eso ya está en `EX-25`. **Lección: una fila `VERIFIED` puede estar catalogada como falla, y la
  > única defensa es abrir la fila en vez de confiar en la tabla que la agrupa.**
- **Lo que esta decisión desbloquea**: el **capítulo 13 entero** (era el único de los 22 sin escribir,
  diferido *«porque depende de con qué pasarela vamos a cobrar»*), el candado `C5` —la columna
  `período`, que `15-fase-9/07-decisiones-del-owner.md:543-546` clasificaba como **bloqueo y no
  pendiente**— y el cierre de la FASE 1C-bis.
- **El riesgo que asume, declarado porque cambia de naturaleza con esta decisión**: **`R-MP-01`** — los
  reembolsos viven en una API que **MP anunció en discontinuación**, y su guía de migración **excluye
  explícitamente a las suscripciones**. Mientras MP era un candidato, era un punto en contra; ahora es
  **el riesgo abierto del sistema**. El capítulo 06 ya mandó tratar esa capacidad como **reemplazable**
  y prohibió que su interfaz filtre el nombre de ningún endpoint hacia el dominio (`06-proveedor.md`
  l. 298-300); el capítulo 13 es donde eso se ejecuta.
- **Las dos alternativas, y por qué no:**
  - **Esperar la habilitación de Mobbex**: es la que tiene la ventaja medida, y **se descarta por no
    tener fecha**. No hay respuesta de soporte, así que esperar no es un plazo: es una espera abierta,
    y detrás de ella está el capítulo 13, el candado `C5` y la FASE 5.
  - **Un merchant of record o un procesador internacional** (`§3.4`, `§3.5`): no se evaluaron a fondo
    porque el paso 4 nunca llegó a ellos. Quedan vivos para el día que esta decisión se revise; hoy
    elegirlos sería decidir con menos información que la que ya tenemos sobre MP.
- **Origen**: la respuesta explícita del owner del **2026-09-24** — *«mobbex seguimos sin que nos
  habiliten y no hay respuesta de soporte, MP tampoco nos respondieron nada… vamos con MP, intentando
  lograr de nuestro lado suplir la mayor cantidad de problemas que MP tiene que ya conocemos»*. Es la
  tercera fuente admitida por la regla 4.

---

### DEC-METH-013 — Cuándo se DEJA DE GIRAR el ciclo 8↔9: cuando la tanda anterior dejó de generar críticos, con tope de dos vueltas

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-METH-008` punto 3** (la condición de corte del ciclo), que a su vez había enmendado
  el punto 2 de `DEC-METH-006`. **No la reemplaza y no la contradice**: le agrega la pregunta que esa
  condición no contesta.
- **El problema, y es una distinción entre dos preguntas que se venían tratando como una:**
  - `DEC-METH-008` punto 3 dice **cuándo se PUEDE CERRAR**: *«hasta que ningún `CRITICA` quede
    abierto sin causa declarada»*. Es una condición sobre el **estado final** del corpus.
  - **Lo que ninguna decisión dice es cuándo se DEJA DE GIRAR**, o sea en qué momento se pasa de
    *«esto se arregla y se vuelve a auditar»* a *«esto se declara con causa y se cierra»*. Sin esa
    segunda pregunta contestada, **la primera es satisfacible en cualquier vuelta** —basta declarar
    causas— o en ninguna, y cuál de las dos ocurre depende de quién esté de turno.
- **Decisión: se deja de girar cuando la tanda de arreglos anterior dejó de generar críticos.** Con
  cuatro cláusulas:
  1. **Un `CRITICA` cuenta como generado por la tanda anterior, y la atribución se dictamina contra
     los DIFFS**, nunca contra mensajes de commit. El programa ya midió el modo de falla que esto
     evita: un rastro que declara *«sigue correcta»* sobre una aparición que **sí** cambió
     (`22-fase-8-bis-5/C1-la-costura.md` §4.2, filas 5 y 3). El dictamen se hace abriendo el hunk.
  2. **Tope de dos vueltas.** Si a la segunda la tanda sigue generando críticos, no se sigue girando
     igual: se pasa a declarar.
  3. **Lo que quede se declara con causa, caso por caso, y lo elige el owner.** Esto **no es nuevo**:
     es `DEC-METH-008` punto 4, y se repite acá porque es la salida a la que esta decisión conduce.
  4. **Un `CRITICA` de dinero no se declara con causa sin que lo lea el owner**, aunque el tope se
     haya alcanzado. **Es la única cláusula que agrega restricción**, y agrega la mínima: no obliga a
     arreglarlo, obliga a que lo vea.
- **Por qué la métrica es la atribución y no el conteo, y está medido**: durante cuatro vueltas el
  **100 %** (o el 93 %) de los críticos venía de la tanda anterior — **25 de 25 · 17 de 17 · 13 de
  14 · 12 de 12** —, y la conclusión razonable era que el generador **era** el acto de arreglar. **La
  8-bis-5 rompió la serie: 6 de 8** (`22-fase-8-bis-5/C1-la-costura.md:783`). Los dos que la tanda no
  produjo son de **clases que el programa nunca había tenido**: `F-8fB3-001`, el primer crítico
  producido por **una medición externa** —`RC-5` midió `charged_quantity` en producción y volvió falsa
  una premisa del `B/09` §4 **sin que el capítulo cambiara una palabra**— y `F-8fC2-001`, un hueco de
  cuatro días que **cuatro vueltas no vieron**, de **la lectura del conjunto**. **Ni la medición
  externa ni la lectura del conjunto se agotan arreglando capítulos**: son los otros dos generadores
  del programa, y no es el ciclo 8↔9 quien los cierra. Contarlos para decidir si girar otra vez
  mandaría a girar por algo que girar no arregla.
- **Las dos alternativas, y por qué no:**
  - **Dejar sólo `DEC-METH-008` punto 3**: no cuesta nada, pero **no acota las vueltas** y deja la
    elección entre seguir y declarar sin criterio escrito. Es lo que hay hoy.
  - **Un tope duro de dos vueltas, con atribución o sin ella**: corta seguro, pero **agrega
    mecanismo** —hay que contar vueltas y arbitrar el desenlace— y **corta a ciegas**: sin la cláusula
    1 el tope se alcanza igual con seis críticos generados que con cero, y esos dos estados no son lo
    mismo.
- **📌 De dónde sale, y la historia importa porque este corte ya se propuso tres veces.**
  [`17-fase-8-bis/C2-liberacion-coexistencia-y-migracion.md`](./17-fase-8-bis/C2-liberacion-coexistencia-y-migracion.md)
  §1.3 midió en la **primera** vuelta que *«lo que baja no es el stock de defectos: es el tamaño de la
  tanda de arreglos anterior»* (l. 81-83) y su §1.4 concluyó que *«con la condición escrita hoy, el
  ciclo no tiene convergencia demostrada»* (l. 114-116). Su §1.5 propuso **tres** remedios:
  1. **extender `DEC-METH-004` al dominio que el ARREGLO crea** — ✅ **aplicado** por `DEC-METH-008`
     puntos 1 y 2, el 2026-09-19;
  2. **medir la tasa, no el conteo** (*«críticos nuevos por decisión aplicada»*, ≈ 0,76 en la 8-bis)
     — ⬜ **sigue sin aplicarse**, y es lo único de los tres que queda. Se declara acá para que no se
     pierda de vuelta: esta decisión usa la **atribución** (¿de dónde vino?) y no la **tasa**
     (¿cuántos por decisión aplicada?), que son preguntas distintas y la segunda sigue sin medirse;
  3. **cortar con causa declarada** — ✅ **aplicado** por `DEC-METH-008` punto 3, y **precisado por
     esta decisión**.
- **Origen**: la elección del owner del **2026-09-24** entre tres opciones — eligió la 2, que era la
  recomendada. ⚠️ **Con una corrección de la que conviene dejar rastro**: las tres opciones se le
  presentaron sobre la premisa de que el criterio del ciclo *«siempre fue: ningún `CRITICA` nuevo»* y
  de que el encargo confundía ese criterio con el de fin de la FASE 9. **Esa premisa era falsa**:
  `DEC-METH-008` había cambiado el criterio del ciclo a *«sin causa declarada»* cinco días antes, así
  que el encargo citaba bien y quien lo corrigió leyó `DEC-METH-006` sin leer las decisiones que la
  enmiendan. **El contenido de las cuatro cláusulas no cambió por eso** —el owner eligió sobre ellas y
  siguen valiendo—; lo que cambió es a qué decisión precisan y con qué argumento. Es el mismo modo de
  falla que ese mismo día se cazó en `DEC-MP-003`: **leer la decisión, no la paráfrasis** — con el
  agregado de que acá no alcanzaba con leerla, había que leer **quién la enmendó**.

---

### DEC-MP-006 — El reloj de cobro es del proveedor: el mandato es el modelo canónico, ~~y el cargo puntual queda declarado como destino~~ sin destino pendiente (2026-09-26)

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED — **cláusula 1 cerrada el 2026-09-26**: el cargo puntual deja de ser destino (ver su 📌) · **Decide**: owner
- **Contesta la pregunta que gobierna el capítulo 13**, declarada en
  `HOS-1354-.../spec.md` §5.1 como *«la primera pregunta cuando esta épica arranque»* y dejada
  explícitamente abierta por el contrato de cobertura (§1.2 y §7). Literal: *«¿el capítulo 13 adopta el
  **cargo puntual contra tarjeta guardada** como modelo canónico, tratando el mandato del proveedor
  —lo que Mercado Pago hace hoy— como **modo degradado**?»*
- **Por qué no se podía esquivar**: decide **quién tiene el reloj**, y eso no se esconde detrás de una
  interfaz — **dos relojes sobre la misma autorización son el doble cobro** que `DEC-ARCH-004` declara
  como riesgo nuestro.
- **El hecho que la decide, y no es una preferencia de diseño**: `EX-31` (`NOT_SUPPORTED`, 2026-09-16).
  El cobro recurrente con credencial guardada —que es exactamente el cargo puntual del modelo
  canónico— **devuelve `403` en las cuatro formas de pedirlo**, con el mensaje idéntico *«The
  application is not authorized to perform this type of payment»*, mientras **la misma orden sin esos
  nodos entra con `201`** (`EX-30`, el control que lo distingue). **El rechazo es del PERMISO, no del
  pedido: no hay forma de armar el request que lo evite.** Y la vía alternativa está cerrada por diseño
  del proveedor: tokenizar una tarjeta guardada **exige recapturar el código de seguridad**, y un
  `card_token` es **de un solo uso** (`EX-12`, re-verificado en producción con tarjeta real).
- **Decisión**: **el reloj de cobro es del proveedor.** El **mandato** (`preapproval`) es el modelo
  canónico del capítulo 13. El cargo puntual **no se descarta: queda declarado como destino**, con dos
  cláusulas:
  1. **Se pide la habilitación** de *«pagos automáticos»* por el canal comercial, **en paralelo y sin
     bloquear nada**. Cuesta poco y cambia el techo del diseño.
  2. **La interfaz del capítulo 13 no puede impedir la migración.** Es lo que `DEC-ARCH-004` ya exige
     para el reembolso, aplicado acá: el modo canónico se elige hoy, **no se cementa**.

  **📌 Precisado el 2026-09-26, con OK del owner.** **El cargo puntual deja de ser destino.** La
  habilitación de *«pagos automáticos»* se pidió por el canal comercial y **no hubo respuesta** —el
  mismo canal que no respondió `R-MP-01`—, y el owner decidió no esperar más: *«no contestaron nada y
  ya no vamos a esperar más»*. **El mandato (`preapproval`) queda como EL modelo, sin destino
  pendiente.** La cláusula 1 se cierra: no queda nada pedido ni nada que revisar cuando llegue una
  respuesta. Si la habilitación apareciera algún día, es una **pregunta nueva** con su propia decisión,
  no la reactivación de ésta. **La cláusula 2 se mantiene** (elección del owner entre mantenerla o
  hacerla caer junto con la 1), y se lee como **higiene de interfaz, no como plan**: es lo mismo que
  `DEC-ARCH-004` exige para el reembolso, no agrega mecanismo, y evita que B6 cemente el mandato en su
  interfaz.
- **🚧 El límite que esta decisión destapa, y va declarado porque es nuevo**: `DEC-MP-005` estableció
  que *«lo que MP no hace lo suple nuestro lado»*. **Esto no se puede suplir.** Un permiso comercial no
  se compensa con código, y las cuatro formas de pedirlo están medidas. **Es el primer caso donde esa
  directriz se topa con un límite duro**, y conviene tenerlo presente antes de prometerla como
  universal. Ironía que queda registrada: elegimos Mercado Pago porque Mobbex no nos habilitó, y el
  modelo de cobro que preferiríamos no lo podemos usar porque Mercado Pago tampoco nos habilita.
- **Lo que se ACEPTA al elegir esto**: **heredamos la política de reintentos del proveedor y no la
  gobernamos** — medida en `GR-3`: cuatro intentos dentro de una ventana de 24 h, y lo que decide el
  desenlace es **vencer la ventana**, no agotar los reintentos.
- **Lo que se EVITA, y es el costo que la pregunta original no enumeraba** (`HOS-1354-.../spec.md`
  §5.1): *«si el reloj es nuestro, **los reintentos también lo son, y son terreno regulado** — hay
  códigos de rechazo que no se pueden reintentar nunca, hay techo de intentos por ventana y hay multas
  por excederlo»*. Hoy eso lo absorbe Mercado Pago adentro del `preapproval`.
- **Consecuencia sobre el resto del programa, y hay que decirla**: `HOS-1354-.../spec.md` §5.2 dejó
  anotado que las filas del **cobro fallido** gobiernan el diseño del grace **sólo mientras el reloj
  sea del proveedor** — con el reloj nuestro *«dejan de ser bloqueantes de diseño y pasan a ser una
  nota del adaptador»*. **Con esta decisión siguen siendo bloqueantes**, y con ellas `RN-3` y la
  [sonda 49](./mp-probes/probe-49-la-ventana-de-reintentos.mjs), que es la que separa *«ventana de
  24 h»* de *«ventana de un ciclo»* y con eso decide qué hace el dunning (`DEC-MP-003`).
- **Las dos alternativas, y por qué no:**
  - **El reloj nuestro, con cargo puntual canónico**: **no está disponible**, medido 4 de 4. Y aun con
    la habilitación otorgada, traería el terreno regulado de arriba — un scheduler de cobro, una
    política de reintentos propia y el riesgo de multa —, o sea **mecanismo caro** a cambio de un
    control que hoy no necesitamos.
  - **Pedir la habilitación y decidir después**: difiere el capítulo 13 **otra vez**, y el canal es el
    mismo que **no respondió** la consulta de `R-MP-01`. Diferir una decisión detrás de una respuesta
    que no llega es lo que `DEC-MP-005` acaba de dejar de hacer.
- **Origen**: la elección del owner del **2026-09-24** entre tres opciones que se le presentaron —
  eligió la 1, que era la recomendada.

---

### DEC-RF-007 — El reembolso de un cobro viejo NO se implementa: pasado el plazo del proveedor, la reparación es manual

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-RF-008`**: la reparación manual se asienta con la acción administrativa 14 · **Decide**: owner
- **Cierra el bloqueo de `RF-3`**, que arrastraba el capítulo 13 —*«el §61 prohíbe implementar sobre
  una fila `UNKNOWN`, así que el capítulo 13 tiene que tratar ese caso como no resuelto»* (`B/05`)—.
- **El problema**: `RF-3` mide **hasta cuándo se puede reembolsar**. Lo medido es que **65 días
  funciona**; la documentación de Mercado Pago dice **180 días desde la aprobación**, y el §58 no
  acepta documentación. El **2026-09-24** se midió además **cuándo podría cerrarse**: el pago más
  viejo de la cuenta de producción es `167913214814`, aprobado el **2026-07-08**, ARS 15 y sin
  reembolsar, así que **cumple 180 días el 2027-01-04** — antes de esa fecha la fila no se puede
  cerrar por ningún camino.
- **La decisión del owner**: *«ni en pedo vamos a esperar a enero… asumimos que la documentación es
  correcta y seguimos… me parece muy poco probable y por ende poco importante que debamos devolver
  dinero más de 6 meses después, y si algún día pasa, lo manejaré a mano»*.
- **Decisión, y se registra de una forma que NO es un apartamiento del método**: **el sistema no
  ofrece la operación de reembolsar un cobro más viejo que el plazo del proveedor.** No es que se
  implemente sobre documentación: **es que no se implementa**. Pasado el plazo, la reparación es
  **manual y queda registrada**, como cualquier otra intervención sobre dinero (`DEC-RF-002`: la
  confirma una persona).
- **Por qué NO es un apartamiento del §58 ni del §61, y conviene leerlos textuales:**
  - El §58 exige comprobar experimentalmente *«absolutamente todas las variantes **necesarias**»*.
    Una variante que **no se implementa** no es necesaria.
  - El §61 dice *«no comenzar implementación de una **capability crítica** mientras siga `UNKNOWN`»*.
    Lo que esta decisión establece es que **reembolsar un cobro de más de seis meses no es una
    capability crítica** del sistema — y eso es una lectura del §61, no una excepción a él.
- **🔎 Y hay un argumento que nadie había hecho, que es el que vuelve segura la decisión: la
  respuesta de `RF-3` NO cambia el diseño.** Si el plazo real fuera **menor** que 180 días, el
  sistema intenta y el proveedor rechaza con un error **ya medido** (`RF-5`: `2063`, `2017`, `2084`,
  con el `message` que no alcanza para distinguirlos) → cae al camino manual. Si fuera **mayor**, el
  sistema rechaza algo que se podía hacer → cae al camino manual. **En los dos casos el desenlace es
  el mismo**, así que el número exacto sólo mueve dónde está el corte, no qué hace el sistema.
  **`RF-3` estaba bloqueando un diseño al que su respuesta no le cambia nada.**
- **Lo que esta decisión SÍ obliga a escribir**, y va al capítulo que aloje la mecánica del
  reembolso: (1) el sistema **no ofrece el botón** pasado el plazo, y lo dice en vez de fallar;
  (2) si lo ofrece y el proveedor rechaza, el error **no se traga**: abre el camino manual con el
  caso identificado; (3) la reparación manual **deja rastro**, porque el histórico de reembolsos es
  nuestro — el buscador del proveedor cubre **sólo doce meses**.
- **El riesgo aceptado, declarado para que se pueda evaluar después**: si el caso resulta más
  frecuente de lo que el owner estima, **cada ocurrencia cuesta trabajo manual** y no hay alerta que
  lo cuente. La conciliación del cap. 09 es la que lo vería primero.
- **`RF-3` queda `UNKNOWN` y deja de bloquear.** No se cierra, porque **no se midió** y marcarla
  `VERIFIED` sobre documentación sería exactamente lo que el §58 prohíbe. Lo que cambia es que su
  respuesta ya no es condición de nada.
- **Origen**: la respuesta explícita del owner del **2026-09-24**, sobre la medición del mismo día
  que le puso sujeto y fecha a la fila.

---

### DEC-MP-007 — No usamos los planes del proveedor: cada preapproval se crea suelto, desde nuestra versión de plan

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED · **Decide**: owner
- **El problema, y no es nuevo: es una premisa que ya decidía alcance sin poder citarse.** Que no
  usamos `preapproval_plan` —el plan del proveedor, un molde del que cuelgan suscripciones— aparecía
  **una sola vez** en todo el diseño: la implicación 4 de `DEC-MAIL-001`, que la atribuye a
  `DEC-MP-002`. **Esa atribución es falsa**: `DEC-MP-002` decide cuándo rige un aumento, no si se
  usan los planes. `preapproval_plan` tiene **cero apariciones** en los capítulos de `HOS-1353`,
  `HOS-1354` y el núcleo (recontado el 2026-09-24). Y de esa premisa dependían tres filas de la matriz
  (`24-inventario-de-compensacion.md`, hallazgo transversal 2).
- **Decisión**: **cada preapproval se crea sin plan del proveedor**, con su monto, su ciclo y su
  `reason` propios, tomados de **nuestra** versión de plan (`D1`).
- **Razones**:
  1. **El catálogo es nuestro y está versionado.** Cambiar el ciclo o el precio de un plan publica
     una versión nueva y **no mueve a nadie** (`D1`, `D13`); mover a alguien es cancelar y recrear
     (`DEC-SUB-006`). El comportamiento que `EX-25` midió en el proveedor —el ciclo del plan cambia y
     los suscriptos no— es **el mismo que nuestro modelo hace a propósito**, así que no hay nada que
     compensar mientras no colguemos las suscripciones de un plan suyo.
  2. **Con un plan del proveedor, la suscripción pierde lo propio en silencio** (`EX-22`): monto
     distinto da `400`, y el resto se descarta sin avisar.
  3. **El `reason` se controla por suscripción** (`DEC-MAIL-001` implicación 4): con planes, el texto
     lo fijaría el plan y haría falta uno por combinación de vertical, tier y ciclo.
  4. **Un aumento se aplica por suscripción de todos modos**: `DEC-MP-002` exige 60 días de aviso a
     los existentes, así que la ventaja de los planes —un solo cambio que alcanza a todos (`EX-23`)—
     no se podría usar.
- **Lo que se resigna, declarado**: **`EX-27`**. `repetitions` (cantidad de cobros) y `billing_day`
  (día fijo del mes) **no funcionan sin plan**. Hoy ninguno se usa: la duración de una promo la
  llevamos nosotros mutando el monto (`DEC-MP-001`). Si algún día hiciera falta cobrar un día fijo
  del mes, **esta decisión es la que hay que releer**.
- **Qué cierra en el inventario de compensación**: `EX-22` y `EX-25` **no aplican** por esta
  decisión; `EX-27` queda **resignada con causa**.
- **La alternativa que se descartó**: declarar sólo `EX-25` con causa y dejar la premisa implícita.
  Es más barata, pero si alguien usa planes del proveedor un día, **vuelven las tres filas sin que
  nada lo avise**.
- **Origen**: el inventario de compensación del 2026-09-24 y la elección del owner del mismo día.

---

### DEC-SUB-019 — Al vencer el grace se cancela el preapproval: la suspensión corta el cobro, no sólo el servicio

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED — **precisada por `DEC-MP-008`** el mismo día: la pausa
  `PROVIDER_DUNNING` que acá *«no se borra»* sí se borra, y el espejo la lee como `S6`; **y su cita de `RN-3`, precisada el 2026-09-25** (FASE 9 completa, `01-…` `C2`; ver su 📌) — **y precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R18` y `R18-b`: la cancelación que pierde la carrera contra el pago, y sus complementos; ver su segundo 📌) — **y precisada otra vez el 2026-09-28, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-q`: la marca 22 sobre un complemento que `S7` ya canceló; ver su tercer 📌) · **Decide**:
  owner
- **Cierra la mitad abierta de `DEC-MP-003`**: *«qué hace el dunning con esa fila»*, que esperaba el
  veredicto de la sonda 49.
- **El hecho que la motiva**: la **sonda 49** (producción, 2026-09-24) midió que **la ventana de
  reintentos del proveedor dura un ciclo**: el cobro de renovación de un preapproval de `2 days`
  trae `expire_date` a **48,0 h** de creado, y los de `1 days` traían 24 h (`GR-3`). **Dos puntos, la
  misma regla.** Para un plan mensual es extrapolación —~30 días—, y para uno anual daría un año,
  que **no está medido**.
- **El problema, y lo planteó el owner**: con un grace de 10 días y un plan mensual, **el proveedor
  sigue reintentando 20 días después de que suspendimos**. Un reintento que entra el día 25 cobra un
  mes entero, y como **la fecha del próximo cobro no se corre con los reintentos** (`EX-34`, y
  `next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24), el día 30 cobra
  **otro**. La persona paga un mes por unos días de servicio, después de haber estado suspendida.
  **Un grace que no corta el cobro es una suspensión a medias.**
- **Decisión**: **`S6`, sobre un pagador con tarjeta, cancela el preapproval en el proveedor en el
  mismo acto en que suspende**, con la regla de relectura de `S17`. Antes de eso sigue preguntando si
  cobró (`S6` con la lectura del `B/09` §4): si cobró, lo que corre es `S5`. **Si la cancelación
  falla, `S6` no ocurre en esta corrida** y la fila sigue en `GRACE_PERIOD` hasta la próxima.
  Volver exige **re-autorizar desde cero** por el checkout: es una sucesión, y `S17` encuentra el
  preapproval ya `cancelled` y no manda nada (`D7`).
- **Y una restricción que la hace funcionar**: **el grace de una versión de plan es siempre más corto
  que su ciclo.** Si no, el proveedor pausa por mora con la fila todavía en `GRACE_PERIOD`, con
  servicio completo y sin nadie que vaya a cobrar. Es **validación de configuración**, no mecanismo.
- **Qué desaparece con esto**: con la restricción cumplida, **el proveedor nunca llega a pausar por
  mora** una suscripción nuestra — cancelamos antes de que se le venza la ventana. La pausa con motivo
  `PROVIDER_DUNNING` de `DEC-MP-003` **no se borra** —el espejo tiene que saber leerla si ocurre, por
  ejemplo si alguien reactiva un preapproval a mano—, pero deja de ser un camino que haya que diseñar.
  Y deja de importar la extrapolación al plan anual: cortamos en el día del grace, no en el del
  proveedor.
- **Lo que se resigna, declarado**: **la recuperación automática después del grace.** A quien le entra
  plata el día 15 ya no se le cobra solo: tiene que volver por el checkout. **Durante el grace nada
  cambia**: un reintento que entra ahí sigue devolviendo la fila a `ACTIVE` por `S5`.
- **Lo que cuesta**: suspender deja de ser un acto interno y pasa a llamar al proveedor. Es **una
  llamada dentro de una transición que ya existe**, de la misma forma que `S23`; no es un job nuevo.
- **Las alternativas, y por qué no**:
  - **Dejar el preapproval vivo y que un reintento reactive** — era la recomendación anterior de la
    misma sesión, antes de la pregunta del owner. **Es el camino que produce el cobro injusto**: la
    reactivación automática tardía es justamente la que cobra un mes por días.
  - **Reactivar automáticamente lo que el proveedor pausó**: agrega un job, le cobra a alguien
    suspendido, y la deuda igual no se recupera (`RN-3`: tras reactivar, el proveedor cobra el ciclo
    siguiente, no los adeudados).
  - **Cancelar recién cuando el proveedor pausa**: deja el grace sin sentido por el mismo motivo que
    la primera, y depende de la ventana que no está medida para el anual.
- **Origen**: la pregunta del owner del 2026-09-24 —*«si la dejamos abierta, va a seguir intentando y
  entonces nuestro período de gracia es medio mentira»*— sobre el veredicto de la sonda 49 del mismo
  día.
- **📌 Precisado el 2026-09-25 (FASE 9 completa, `01-…` `C2`; registro, sin decisión).** La cita
  *«`next_payment_date` avanzando igual sobre un cobro rechazado — `RN-3`, 2026-09-24»* **no está
  registrada en `RN-3`** ni en ninguna fila de la matriz. Lo registrado es que la fecha avanza
  **estando pausada** (`PS-2`, `PS-6`) y que no se puede correr por pedido (`EX-34`). Hasta que se
  registre con fecha y sujeto, **se lee *«observado, no registrado»***. La decisión no depende de esa
  cita: si la fecha esperara, cancelar el preapproval al vencer el grace sigue evitando el cobro
  tardío; lo que cambia es el tamaño del daño que cuenta el ejemplo.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R18` y `R18-b`)**: si `S6`
  —o `S3` sobre una alta— manda la cancelación y el pago (`S5`) o la autorización (`S2`) le
  ganan la escritura, la fila queda `ACTIVE` con el preapproval `cancelled`, y el espejo no la
  corta: la lleva a `CANCEL_SCHEDULED`, con el fin de servicio de `S11`, y `S12` la termina.
  Recibe el período que pagó, y la pantalla le dice que para seguir se vuelve a suscribir. Es la
  respuesta que el owner dio a `S7` en el orden inverso. Y en los dos casos, el espejo y `S7`,
  los complementos recurrentes de esa principal se cancelan por la regla de `S11`: su cobro se
  corta en el acto y se siguen viendo hasta la misma fecha.
- 📌 **Precisada el 2026-09-28, con OK del owner (FASE 9 vuelta 2, verificación, `V2-q`)**: si el
  complemento que `S7` cancela por la regla de `S11` tenía abierta la marca `PAUSA_NO_APLICADA`, la
  cancelación no la resuelve: la levanta una persona después de ver que el complemento ya no cobra.

---

### DEC-MP-008 — Una pausa del proveedor por mora es el fin del grace: se espeja con `S6`, sin motivo de pausa nuevo

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED — **precisada el 2026-09-25 por `DEC-SUB-022`**: sobre la sucesora que entra en grace por esa decisión, un `cancelled` leído en el proveedor también termina el grace con `S6`, no sólo un `paused`; **y otra vez el mismo día, con OK del owner** (FASE 9 completa, 9a y 9b: el primer rechazo cuyo aviso se perdió lo lee el barrido y corre `S4`, y el reloj cuenta desde la lectura; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N8; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, punto 1; ver su último 📌) · **Decide**: owner
- **Supera EN PARTE a `DEC-MP-003`**: se cae el motivo de pausa `PROVIDER_DUNNING`. **Sobrevive** lo
  que `DEC-MP-003` corrigió —que esa pausa **no** es una pausa del cliente y no puede entrar por
  `S8`—, y sobrevive su diagnóstico entero (las cuatro consecuencias de leerla como
  `CUSTOMER_REQUEST`).
- **Qué cambió desde el 22/09**: `DEC-SUB-019` hizo que el grace corte el cobro, y que el grace sea
  siempre más corto que el ciclo. Con eso **el proveedor no llega a pausar por mora en el camino
  normal**: sólo en bordes —un webhook de cobro fallido que se perdió, y la fila sigue `ACTIVE` cuando
  el proveedor pausa; o un preapproval reactivado a mano—. Y **el cliente no puede pausar desde el
  proveedor** (`DEC-MAIL-001` implicación 3: no hay autogestión de su lado), así que un `paused` que
  no pedimos nosotros **es mora**.
- **Decisión**: **un `paused` leído en el proveedor sobre una fila `ACTIVE` o `GRACE_PERIOD` dispara
  `S6`**: la fila pasa a `SUSPENDED` y se cancela el preapproval, con la misma regla de relectura. **El
  proveedor ya se rindió, así que nuestro grace también terminó.**
- **Por qué ahora sí cierra lo que `DEC-MP-003` descartó**: `DEC-MP-003` descartó mapear esa pausa a
  `GRACE_PERIOD` porque dejaba *«un reloj corriendo hacia un pago imposible»*. **Mapearla a
  `SUSPENDED` no tiene ese problema**: no hay reloj esperando un cobro, y es la misma respuesta que
  `DEC-SUB-019` le da al caso normal.
- **Las dos posiciones, porque esto enmienda una decisión del owner**:
  - **La de `DEC-MP-003` (22/09)**: un motivo propio para una pausa que es distinta de las otras dos.
    Era correcta con lo que se sabía entonces: el proveedor pausaba por mora **en el camino normal**
    (medido 5 de 5, `RN-2`, `GR-3`), y nada lo evitaba.
  - **La de ésta (24/09)**: con `DEC-SUB-019`, ese camino ya no existe. Llevar el motivo a los
    capítulos exigía recorrer **22 apariciones en 9 archivos** que leen el motivo de pausa y diseñar
    lo que `DEC-MP-003` había dejado abierto —servicio, salida, cupo—, **mecanismo nuevo para un
    borde**. Reusar `S6` no agrega ninguno.
- **Lo que se resigna**: distinguir en los datos *«suspendida porque venció nuestro grace»* de
  *«suspendida porque el proveedor pausó primero»*. Las dos se ven igual: `SUSPENDED`, preapproval
  cancelado. El registro de eventos (`NUCLEO/02`) guarda cuál de los dos disparadores corrió.
- **Precisa también a `DEC-SUB-019`**, que decía que la pausa `PROVIDER_DUNNING` *«no se borra»*
  porque el espejo tenía que saber leerla: **se borra**, y el espejo la lee como `S6`.
- **Origen**: la familia 7 de la FASE 9-bis-5, y la elección del owner del 2026-09-24 entre tres
  opciones —llevar el motivo como estaba decidido, esta enmienda, o dejar la decisión sin escribir—:
  eligió la recomendada.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, filas 9a y 9b de
  `26-fase-9-completa/10`; `01-…` §1.5 bordes R1-a y R1-b; aplicado en `13` y `17`).**
  1. **Corregido el primer borde** (9a): *«un webhook de cobro fallido que se perdió, y la fila sigue
     `ACTIVE` cuando el proveedor pausa»* deja de ser un camino al `S6` de esta decisión. **Si la
     lectura del barrido (`B/09` §4) da *«intentó y se rechazó»* sobre el período en curso de una
     fila `ACTIVE` con al menos un pago acreditado, corre `S4`**: es el aviso del primer rechazo que
     no llegó (`WH-5`), leído por id como pide `D17`. La persona recibe sus días y sus avisos de
     grace en vez de pasar de `ACTIVE` a `SUSPENDED` al fin de la ventana del proveedor. El agente
     de aplicación lo había declarado como borde; **el owner eligió corregirlo** (opción 1 del
     informe `01`). **Queda como borde** la sucesora de `DEC-SUB-022` sin pago propio cuyo primer
     rechazo se pierde entero: no entra por esta rama y sigue `ACTIVE` hasta que la comparación de
     estado lea `paused` o `cancelled` (`B/12` «NO cierra», declarado por `DEC-METH-015`).
  2. **El reloj del grace cuenta desde que leímos el rechazo**, no desde la fecha del rechazo (9b):
     con un aviso demorado (`WH-2`, hasta 14,3 días), contar desde el rechazo podía dar un grace
     vencido al leerlo y un `S6` sin ningún aviso previo. **Y nunca más allá de la pausa del
     proveedor**: si el proveedor pausa antes de que venza el grace corrido, esta decisión termina
     el grace con `S6`, como está. Ninguna de las dos lecturas mueve plata fuera de un ciclo.

  La entrada no se edita en su contenido.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N8)**: Pendiente de medición
  (revisión del owner, N8): una pausa o una cancelación hecha por el pagador desde su cuenta de
  Mercado Pago no se distingue hoy de una del proveedor; hasta medir, esta decisión la trata como
  mora o como baja del proveedor. `B/12`, lo que no cierra.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, punto 1)**: Medido el
  2026-09-29 (`EX-53`, el owner desde la cuenta del comprador, en la web y en la app): el pagador no
  puede pausar desde su cuenta de Mercado Pago. Un `paused` sin un `PUT` nuestro es, entonces, la
  mora que esta decisión espeja, y la pausa deja de estar pendiente en el 📌 anterior (N8).

---

### DEC-SUB-020 — Un contracargo suspende en el acto, sin grace, y lo sigue una persona

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (ver su 📌) · **Decide**: owner
- **Problema**: un pago que ya registramos puede cambiar después —el cliente desconoce el cargo en
  su banco (contracargo), o alguien lo reembolsa desde el panel del proveedor— y **nadie lo
  compara**: la fila sigue `SUCCEEDED`, el período sigue cubierto y el servicio sigue (FASE 8
  completa, `F-8CB3-009`). No había una sola línea sobre contracargos en el corpus, la matriz ni el
  log.
- **Contexto**: **documental, no medido** (fila `RC-8`, `UNKNOWN`): según la documentación del
  proveedor, un contracargo pasa el pago a `charged_back` con detalle `in_process`, y al resolverse
  a `settled` (perdimos) o `reimbursed` (ganamos); hay un aviso propio (`topic_chargebacks_wh`). No
  se puede fabricar a voluntad: exige una disputa real. **Por la regla 3 de este log, esta decisión
  NO fija cómo se comporta el proveedor**: fija qué hacemos nosotros cuando leemos ese estado, y la
  detección se apoya en `RC-8` con su salvedad declarada.
- **Alternativas**: (1) suspender en el acto, sin grace; (2) tratarlo como un cobro impago y entrar
  al grace; (3) esperar el resultado de la disputa sin tocar nada.
- **Decisión**: **(1)**. Al leer `charged_back` en un pago acreditado, **releído por id** (`D17`),
  corre **`S6`** por un disparador nuevo: servicio cortado y **preapproval cancelado**, para no
  seguir cobrándole a una tarjeta que disputa nuestros cargos. Además se abre una **marca** para que
  una persona siga el caso. Si la disputa se resuelve a nuestro favor (`reimbursed`), la persona
  vuelve por el checkout como cualquier suspendido con tarjeta (sucesión desde `SUSPENDED`,
  `G-R1-A`).
- **Motivo**: el grace existe para *«alguien que venía pagando y tuvo un problema»* (§20); quien
  desconoce un cargo no está en esa situación. Esperar la disputa (3) deja semanas de servicio
  completo con un preapproval que sigue cobrando. Y (1) reusa `S6` tal como está: un disparador
  más, ningún estado nuevo.
- **Lo que NO decide**: el pago reembolsado desde el panel sin pasar por nuestro flujo se detecta
  igual (el barrido relee los pagos acreditados) pero va a una persona con una marca, sin
  suspender: fue un acto nuestro, no del cliente (`DEC-RF-007`).
- **Origen**: FASE 8 completa, racimo `R7`, `F-8CB3-009`; elección del owner del 2026-09-25 entre
  las tres alternativas, tras descartar ese mismo día *«detectar y mandar a una persona»* y
  *«declararlo fuera de alcance»*.
- **📌 Precisado el 2026-09-25, con OK del owner (pendiente 6 de la FASE 8 completa)**: **si la
  fila da servicio, se corta en el acto; si no, sólo la marca.** Una fila en `CANCEL_SCHEDULED` pasa
  a `CANCELLED` ya, sin esperar su fecha de fin; una pausada o terminal sólo abre la marca. **La
  sucesión no lo frena**: un contracargo es una disputa, no una mora que el cambio de plan resuelva,
  así que si la fila es predecesora de una sucesión en curso, `S6` corre igual y la sucesora también
  se corta. Y el aviso a la persona es un **correo propio** —*«desconociste el cargo; mientras se
  resuelve, suspendimos el servicio»*—, no el de mora, que le diría que no pagó.

---

### DEC-SUB-021 — En grace no se cambia de plan: primero se regulariza, y el camino de la tarjeta es cambiarla

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: la salida *«cambiá la tarjeta»* queda **condicionada a `GR-1`**; el suspendido que vuelve pierde la promo; la sucesora declarada en `ACTIVE` la decide **`DEC-SUB-022`**; ver su 📌) — **condición cerrada el 2026-09-26: `GR-1` `VERIFIED`** (ver su segundo 📌) · **Decide**: owner
- **Supera a `DEC-SUB-003`**, entera.
- **Problema**: `DEC-SUB-003` (15/09) prometía que en grace se podía cambiar de plan con **cobro
  inmediato** del plan nuevo y que, si fallaba, la persona **seguía en grace con el plan anterior**.
  Esa decisión es anterior a la sucesión (`DEC-SUB-006`) y a `D8`, y nunca se reconcilió con ellas:
  `D8` obliga a que la sucesora no cobre hasta que vence su ventana, y `S17` cancela la predecesora
  al **autorizar**, no al cobrar. Si el primer cobro de la sucesora falla —y es la misma tarjeta que
  venía fallando—, la sucesora muere en `CHARGE_DECLINED` con la predecesora ya `CANCELLED`: **la
  persona se queda sin nada** (FASE 8 completa, `F-8CD1-002`, `F-8CB1-009`). Además, `DEC-SUB-003`
  se tomó con `GR-1` en `UNKNOWN`.
- **Contexto medido**: `EX-36` (**se puede cambiar la tarjeta de un preapproval sin recrearlo**) y
  `GR-3` (**el proveedor reintenta durante un ciclo**, que con `DEC-SUB-019` cae dentro de nuestro
  grace).
- **Alternativas**: (1) en grace no se cambia de plan, primero se regulariza; (2) mantener la
  promesa haciendo que `S17` cancele la predecesora recién cuando la sucesora **cobra**; (3)
  mantener la promesa y aceptar el hueco.
- **Decisión**: **(1)**. **Desde `GRACE_PERIOD` no se declara una sucesión.** El pagador con tarjeta
  **cambia la tarjeta** (`EX-36`); los reintentos del proveedor cobran con ella, la fila vuelve a
  `ACTIVE` por `S5`, y recién ahí puede cambiar de plan. El pagador manual **paga su cuota**. La
  pantalla del cambio de plan, en grace, dice eso y no ofrece la operación.
- **Motivo**: sigue cerrando los dos abusos que `DEC-SUB-003` quería cerrar —no se limpia el cobro
  fallido ni se esquiva la deuda, porque se paga primero—, usa algo medido en vez de algo `UNKNOWN`,
  y no agrega mecanismo. **Las dos posiciones**: `DEC-SUB-003` sostenía que *«bajarse a un plan más
  barato es cómo alguien sale de un impago»*; ésta sostiene que la salida es la tarjeta, que es la
  que el proveedor sostiene, y que un cambio de plan sobre una deuda abierta no tiene cómo
  garantizar que la persona no se quede sin nada. La (2) se descartó porque deja hasta 72 h dos
  preapprovals vivos, el viejo reintentando la deuda y el nuevo cobrando: el doble cobro que el
  diseño evita.
- **Lo que no cambia**: una sucesión declarada **en `ACTIVE`** cuya predecesora entra en grace
  **durante** la ventana sigue su curso (la protección de `S6` de `B/03` §4 sigue viva para ella); y
  el suspendido con tarjeta sigue volviendo por sucesión (`G-R1-A`), porque ahí no hay preapproval
  que arreglar.
- **Origen**: FASE 8 completa, racimo `R8`; elección del owner del 2026-09-25.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 3a y 3b de
  `26-fase-9-completa/10`; `01-…` §3.5 pendiente 1, §2.5 pendiente 2 y contradicción `C3`).**
  1. **La frase *«los reintentos del proveedor cobran con ella»* queda CONDICIONADA a `GR-1`**, como
     `DEC-SUB-010` lo está a su segunda lectura. El *Contexto medido* no la mide: `EX-36` mide que la
     tarjeta **se puede** cambiar, no que el reintento de un cobro ya abierto use la nueva; y `GR-3`
     mide la ventana sobre sujetos de 1 y 2 días —cuántos reintentos caen dentro del grace de un plan
     mensual es extrapolación—. **Se mide con el próximo rechazo mensual real.** Mientras tanto, **la
     pantalla y los correos del grace no prometen que el reintento use la tarjeta nueva**. La
     decisión no cambia; cambia lo que se le promete al cliente.
  2. **El *Contexto medido* invierte un orden**: con `DEC-SUB-019` el grace es más corto que el
     ciclo, así que **es nuestro grace el que cae dentro de la ventana de reintentos del
     proveedor**, y no al revés. El reintento que cae después del grace es lo que `DEC-SUB-019`
     resignó.
  3. **El suspendido con tarjeta que vuelve por sucesión pierde su promo** (3b): `S18` no re-apunta
     la redención y el código no se canjea dos veces. **Se acepta, y se dice en el aviso de
     suspensión.** El owner lo dejó anotado para mejorarlo más adelante.
  4. **El primer cobro fallido de una sucesora declarada en `ACTIVE` o `CANCEL_SCHEDULED`**, que esta
     decisión dejaba con *«la persona se queda sin nada»*, lo decide **`DEC-SUB-022`**.

  La entrada no se edita en su contenido.
- **📌 Cerrada 2026-09-26: `GR-1` `VERIFIED`, la salida *cambiá la tarjeta* deja de estar
  condicionada** (registro, no reabre la decisión; `26-fase-9-completa/22`). Levanta la condición del
  punto 1 del 📌 anterior. Lo medido (producción, sólo `GET`, sonda 49 `f0be57a1…`, ciclo de 2 días):
  el registro de cobro rechazado del 24/09 pasó a `approved/accredited` con `retry=4` después de que
  el owner cambiara el medio de pago — **el mismo registro, no uno nuevo**. O sea: un pago que entra
  dentro de la ventana de reintentos cierra el ciclo fallido, y el reintento cobra con el medio nuevo.
  **La pantalla y los correos del grace pueden decir que al cambiar la tarjeta se reintenta el cobro
  en el momento**: el cobro entró a las 00:31:45 `-04`, ≈1-2 min después del cambio, fuera del lote
  del minuto :02. Borde que queda: esa hora del cambio la informó el owner (no la API) y es **una sola
  muestra**; y la extrapolación de `GR-3` a un plan mensual (punto 1) no la toca esta medición.

---

### DEC-DATA-005 — La retención sólo toca fichas: el usuario y sus datos no se borran nunca

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: el registro de eventos no guarda el contenido de una ficha; ver su 📌) — **y precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R9`: lo que cuelga de la ficha en `PURGED`, por dueño del dato; ver su segundo 📌) — **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27, `V2-x` el 2026-09-28: la clase del correo de la alerta cerrada y `revalidation_config`; ver su tercer 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, N7, `g1`; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 7, F-C, H-C, I-C, J-C y K-A; F-C contra la recomendación; I-C corrige la elección de H-C; ver su último 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes M-F, M-G, N-C, N-F y N-G; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote H: el seudónimo de la fila de `trial` tras la baja de la cuenta; ver su penúltimo 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lotes 4 a 6, letra E: `trial` y las tablas de sólo agregar nacen sin `deleted_at`; ver su último 📌) · **Decide**: owner
- **Cierra `M-DATA-01`**, que `DEC-DATA-001` implicación 4 dejó abierta: *«qué es exactamente "dato
  operativo eliminable" a los 180»*.
- **Problema**: el día 180 se cuenta **por ficha**, pero la lista de lo que borra (`V/02` §4.1)
  incluía cosas **de la persona** —las preferencias de la cuenta, las señales de identidad— y
  anonimizaba los datos personales dentro de eventos y outbox sin decir de qué eventos. Un dueño con
  una ficha abandonada y otra paga perdía las preferencias de su cuenta al día 180 de la primera, y
  podía ver anonimizados los eventos de su suscripción viva, incluido el aviso de aumento que
  `NUCLEO/08` §1.3 tiene que poder demostrar (FASE 8 completa, `F-8CA3-009`).
- **Alternativas**: (1) el día 180 borra sólo esa ficha, y lo de la persona cuando no le queda nada
  vivo; (2) la retención no toca a la persona nunca.
- **Decisión**: **(2)**, y es del owner, **más estricta que la recomendación (1)**. **El proceso de
  archivar y purgar es sólo para fichas.** El usuario, sus preferencias, sus señales de identidad y
  sus datos personales **no se tocan**, tampoco dentro de eventos o del outbox. El día 180 borra el
  contenido de **esa** ficha —textos, fotos, FAQ, horarios— y sus borradores, y nada más.
- **Las dos posiciones**: la recomendación ataba los datos de la persona a *«no le queda nada vivo
  en ninguna vertical»*; el owner separa las dos cosas: la retención es de fichas, y el usuario no
  es un dato operativo.
- **Lo que NO decide**: la baja de la cuenta **pedida por el propio usuario** (y lo que la ley pida
  para ella) es otro proceso y no lo cubre esta decisión.
- **Acompañan, como reglas de capítulo aprobadas el mismo día** (FASE 8 completa): una ficha cuyo
  contenido se borró pasa a un estado final **`PURGED`**, que no se republica ni cuenta para el cupo
  (`F-8CA2-008`); y **el borrado exige `ARCHIVED`**, con el plazo de `PB5` validado **menor que 6
  meses** (`F-8CA2-014`).
- **Origen**: FASE 8 completa; respuesta del owner del 2026-09-25 al punto (c) de la pendiente 4.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisión 8e; `09-…` `AO-5`,
  `F-8CA3-004`).** La promesa *«el día 180 borra el contenido de esa ficha»* tenía una copia que la
  retención no alcanza: el registro de eventos, append-only (`NUCLEO/08` §1.3), guardaba el valor
  anterior y el nuevo de cada edición. **En los campos de contenido de una ficha —los que borra el día
  180— el evento guarda sólo el NOMBRE del campo**, no sus valores; los demás campos (estado, plan,
  monto, fechas) siguen con los dos. Y se corrige `NUCLEO/01` §1.2, hecho 1: crear, editar y exportar
  se registran como eventos aunque no sean transiciones. Lo que se pierde: poder mostrar *«qué decía
  antes»* una ficha, que ningún capítulo pide.
- 📌 **2026-09-27 (FASE 9 vuelta 2, `R9`, con OK del owner)**: en `PURGED`, lo que cuelga de la
  ficha se trata por dueño del dato, con una lista cerrada (`V/02` §4.1). Lo de un tercero se
  conserva: la conversación queda en sólo lectura y su referencia admite una ficha ausente. La
  alerta de precio se cierra con un aviso al turista. Lo del dueño que sólo sirve a la ficha se
  borra con el contenido.
- 📌 **Precisada con OK del owner (FASE 9 vuelta 2, verificación: `V2-l` el 2026-09-27; `V2-x` el
  2026-09-28)**: el correo de la alerta de precio cerrada es transaccional. Y la configuración de
  revalidación, que tiene `entity_type` y no nombra ninguna ficha, está en la fila de lo que
  `PURGED` no toca.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, N7, `g1`)**: La baja de cuenta
  pedida por el usuario queda fuera de esta épica: soporte a mano con una lista de pasos, y se
  corrige la FAQ (HOS-1393).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 7, F-C,
  H-C, I-C, J-C y K-A; F-C contra la recomendación; I-C corrige la elección de H-C)**: La lista de
  pasos de la baja de cuenta manual se escribe antes del corte, en este orden: la baja del cobro,
  `PB12` por cada ficha y la cuenta (`NUCLEO/08` §1.3). Los tres los hace soporte desde el panel, a
  pedido del dueño y con motivo: el primero con "cancelar una suscripción", que ya existía, el
  segundo con la acción 23, "borrar una ficha ajena a pedido de su dueño", que corre `PB12`, y el
  tercero con la 24, "dar de baja una cuenta a pedido de su dueño", que se rechaza mientras le
  cuelgue una suscripción viva o una ficha fuera de `PURGED`. La 24 no borra la fila de la cuenta:
  la seudonimiza. Reemplaza su nombre, su correo y su teléfono, cierra sus sesiones y la deja sin
  acceso; no toca el registro de auditoría, que conserva el actor y el sujeto por id, ni los cobros;
  y la fila de `trial` que la apunta sigue, con su FK `ON DELETE RESTRICT` y el hash del correo, así
  que la traba contra repetir la prueba no se pierde. Los datos de facturación de la cuenta, el
  nombre y el correo de quien pagó, se conservan tal cual, porque son datos de comprobantes que la
  ley obliga a guardar: viven en el comprobante, que guarda una copia de los dos al emitirse,
  copiados de la fila de `user` dueña del cobro, y que nadie reescribe después; la 24 reemplaza los
  de `user` y la copia queda como estaba. La baja desde Mi Cuenta sigue fuera de la épica
  (HOS-1393).
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-F, M-G, N-C, N-F y N-G)**: La
  acción 24 se rechaza mientras `puedeCobrarle` conteste `sí` (también con una marca
  `CANCELACIÓN_SIN_CONFIRMAR` abierta), le cuelgue una ficha fuera de `PURGED` o, en un Partner, una
  presencia con contenido; y no mientras le cuelgue una fila viva, que verticales no puede evaluar.
  Una suscripción en `CANCEL_SCHEDULED` no la traba: ya está dada de baja en el proveedor y termina
  sola por `S12`, sobre la cuenta ya dada de baja. El paso 1 de la baja manual termina cuando ninguna
  suscripción de la cuenta puede cobrar. Si igual llega un cobro sobre la cuenta dada de baja, `P1`
  deja nulos el nombre y el correo del comprobante y no lo envía, como sobre una lápida, y el CHECK
  lo admite. La fila de outbox guarda la dirección al encolarse, y la supresión por cuenta dada de
  baja no alcanza a lo encolado antes de la 24. Y en un Partner el paso 2 vacía su presencia con una
  acción administrativa nueva, la 25, "vaciar la presencia de un Partner a pedido de su dueño", con
  motivo: las acciones vivas pasan de veintitrés a veinticuatro.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote H)**: Tras la baja de la
  cuenta, el seudónimo de la fila de `trial` se conserva hasta que el abogado conteste la pregunta 5
  de `V/22`; si contesta en contra, soporte los borra todos con una tarea puntual, y se anota quién
  la corrió y cuándo.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lotes 4 a 6, letra E;
  `38-fase-5/10-decisiones-del-owner.md`, racimo `R5-29`)**: la fila de `trial` sigue porque nada
  la puede borrar, y eso incluye el borrado suave: `trial` y las tablas de sólo agregar **nacen sin
  `deleted_at`**, así que el borrado suave de la base, que estampa esa columna en toda tabla que la
  tenga, no las alcanza, y el trigger que rechaza el `DELETE` sobre `trial` no tiene un camino al
  costado.

---

### DEC-ARCH-009 — Un reconciliador diario de cobertura en verticales: el aviso es rápido, el reconciliador es la red

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: la población excluye `MODERATED` e incluye a Partner; ver su 📌) · **Decide**: owner
- **Problema**: el aviso *«la cobertura de (user, vertical) cambió»* (`12-contrato…` §3) es la
  **única** señal que billing le empuja a verticales, y no tiene transporte declarado —el outbox
  del núcleo es sólo de correos—. Tres agujeros (FASE 8 completa, racimo `R10`): (1) si se pierde
  el aviso de que la cobertura **volvió**, la ficha de alguien que paga queda despublicada para
  siempre —las relecturas de respaldo sólo existen en los actos que quitan— (`F-8CA2-002`,
  CRÍTICO; `F-8CC1-005`); (2) una cobertura que **vence por fecha** —cortesía, trial, grant
  temporal— no pasa por ninguna transición de billing y no genera aviso, así que el caché sigue
  diciendo *«cubierto»* (`F-8CA1-007`, `F-8CC1-009`); (3) si se pierde el aviso de la caída, no se
  escribe el hecho 5 del reloj de inactividad.
- **Alternativas**: (1) un reconciliador diario en verticales que vuelve a preguntar al contrato y
  corre la transición que el aviso habría disparado; (2) hacer durable el aviso (outbox con
  reintentos hasta la confirmación) y un emisor diario de vencimientos; (3) sólo arreglar las
  relecturas para que republiquen.
- **Decisión**: **(1)**. Una vez por día, para cada dueño con fichas que no estén en `DRAFT` ni
  `PURGED`, verticales **le pregunta al contrato** si está cubierto y con qué cupo, lo compara con el
  estado de sus fichas y, si no coinciden, **corre la transición que el aviso habría disparado**
  (`PB7`/`PB3` republican, `PB2` despublica), escribe el reloj de inactividad (hechos 2 y 5) e
  invalida el caché. Lo vigila el mismo monitor de cron externo que el barrido de billing.
- **Motivo**: una sola pieza tapa los tres agujeros **sin importar por qué hay diferencia** —aviso
  perdido, fecha vencida o un error nuestro en un camino que nadie previó— y se apoya en la
  pregunta al contrato, que es la fuente de verdad, no en un mensaje. La (2) hacía más confiable la
  entrega pero **entregaba fielmente un aviso equivocado** si billing lo emitía mal, y eran dos
  mecanismos. El costo aceptado: **hasta un día de atraso** en todo lo que el aviso no cubrió.
- **Origen**: FASE 8 completa, racimo `R10`; elección del owner del 2026-09-25.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa; `08-…` §3.3 contradicción 2 y
  `06-…` *«la población del reconciliador»*; `F-8CA2-004`, `R13`, `DEC-ENT-006`).** La población de
  la *Decisión* quedó más angosta que su aplicación, en dos sentidos: (1) **excluye también las
  fichas `MODERATED`**, además de `DRAFT` y `PURGED` —una ficha moderada no se republica por
  cobertura—; (2) **incluye a todo `user + Partner` con una clave de presencia** (página o carrusel,
  `DEC-ENT-006`), que no tiene fichas: sobre ése no corre ninguna transición; resuelve en vivo si el
  conjunto efectivo otorga la clave, lo compara con el caché y, si difieren, **invalida** (`V/03` §9,
  `V/18` §1.6). La entrada no se edita en su contenido.

---

### DEC-TRIAL-010 — El trial se convierte con el primer pago acreditado, y suscribirse termina el trial

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día** (FASE 9 completa: `T6` y `T8`, el botón que manda a publicar, y el corte no es de esta decisión; ver su 📌) · **Decide**: owner
- **Problema**: `T2` (`V/03` §2) convertía el trial **en el instante en que la suscripción pasaba a
  `ACTIVE`**, antes de cualquier cobro. Si el primer cobro se rechazaba —llega entre 26 y 44 minutos
  después de autorizar (`PA-3`)—, la suscripción moría en `CHARGE_DECLINED` y la persona quedaba
  **sin suscripción y sin trial**, que ya no se devuelve (§10.2): una tarjeta rechazada le costaba el
  trial entero (FASE 8 completa, racimo `R12`: `F-8CA2-006`, `F-8CC1-002`).
- **Alternativas**: (1) el trial se convierte recién con el primer pago acreditado; (2) `S16`
  revierte la conversión; (3) aceptarlo.
- **Decisión**: **(1)**. **`T2` exige una suscripción con al menos un cobro acreditado**, no sólo
  `ACTIVE`. Mientras tanto el trial sigue corriendo en paralelo; si el primer cobro se rechaza, la
  persona **sigue en su trial** con los días que le quedaban. Es la regla de `B/12` §4.4 llevada al
  trial: *«un primer cobro rechazado no es una suscripción con un problema, es un alta que no
  ocurrió»*, y un alta que no ocurrió no consume el trial.
- **Y la otra mitad, reafirmada por el owner el mismo día**: **suscribirse durante el trial termina
  el trial.** Si el cobro sale bien, los días que quedaban **se pierden**: la persona eligió pagar
  antes. El owner indicó que ya lo había decidido antes; **no estaba escrito en este log ni en `V/11`**,
  y queda escrito acá. No se difiere el primer cobro al fin del trial: una fecha futura se convierte
  sola en un *free trial* del proveedor (`EX-38`), que es lo que `HOS-1012` eliminó.
- **Origen**: FASE 8 completa, racimo `R12`; elección del owner del 2026-09-25.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, decisiones 6c y 2g de
  `26-fase-9-completa/10`; `07-…` `R12-OWNER-1` y `C-R12-1`).**
  1. **`T6` exige un título que convierte**, el mismo término de `T2`. *Juan* se suscribía, publicaba a
     los diez minutos cubierto por una suscripción con `cobrada: no`, y `T6` le escribía la fila de
     trial consumida; si el primer cobro se rechazaba, perdía un trial que nunca usó. Es la otra
     puerta de lo que esta decisión cerró. **Fila nueva `T8`**: `PRE_TRIAL` → `TRIAL_CONVERTED` al
     aparecer un título que convierte, con la condición *«ya ejerció el evento de activación»*;
     escribe la fila consumida, igual que `T7`. Si el cobro se rechaza, la persona queda en
     `PRE_TRIAL` y su próximo `PB1` arranca el trial.
  2. **Y del owner, además: el botón de suscribirse es inteligente.** Si el usuario todavía no
     publicó en esa vertical, **lo manda a publicar** —lo que arranca el trial— en vez de al checkout.
     `T8` queda como red para quien llega al checkout por otro camino (`V/19`, `B/19`).
  3. **El corte no es parte de esta decisión.** El consolidado de la FASE 8 completa le atribuyó
     *«el corte siembra trials consumidos»* (`25-fase-8-completa/00-hallazgos.md` §5, fila `R12`), y
     esa regla nunca estuvo en esta entrada. **Quedó revertida el mismo día**: el corte no siembra
     trials (`DEC-MIG-005`).

  La entrada no se edita en su contenido.

---

### DEC-METH-014 — La 8-bis-6 se reemplaza por una FASE 8 COMPLETA sobre el diseño vigente, a ciegas del historial

- **Fecha**: 2026-09-24 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-METH-006`** (qué revisa cada vuelta de la FASE 8) **y `DEC-METH-013`** (desde cuándo
  cuenta el tope de dos vueltas). No reemplaza a ninguna de las dos.
- **El problema**: cada 8-bis revisó **lo que la 9-bis anterior produjo** (`DEC-METH-006`), y eso tiene
  un punto ciego: lo que se rompe **entre** partes que nadie tocó en la misma vuelta. **La 8-bis-5 lo
  midió**: 2 de sus 8 críticos no los generó ningún arreglo —`F-8fB3-001`, de una medición externa
  (`RC-5`), y `F-8fC2-001`, de la lectura del conjunto—, y `DEC-METH-013` escribió que esas dos clases
  *«no las cierra el ciclo 8↔9»*.
- **Por qué ahora**: tras cinco vueltas de arreglos locales el diseño está **completo** —22 de 22
  capítulos, inventario de compensación 25 de 25, la 9-bis-5 cerrada, cobro, dunning y conciliación
  definidos—. La primera FASE 8 revisó un diseño con huecos abiertos; ésta revisa uno terminado. Y el
  mismo 24/09 aparecieron **tres textos vencidos lejos del arreglo** (las «dos puertas», *fila viva*,
  la vuelta del suspendido). La pregunta la planteó el owner: *«hacer el análisis no sobre lo
  modificado, sino sobre todo, de cero, como si fuese la primera revisión»*.
- **Decisión**: una **FASE 8 completa** sobre el núcleo, las dos épicas y el contrato de cobertura
  **en su estado vigente**, con agentes nuevos y **ciegos entre sí**, uno por vector:
  - los ocho de la primera FASE 8, para poder comparar contra ella: `A1` acceso cruzado y
    autorización · `A2` máquinas, carreras y huérfanos · `A3` datos, migración y acoplamiento ·
    `B1` doble cobro y pérdida de pago · `B2` máquinas, idempotencia y carreras · `B3` conciliación,
    datos y migración · `C1` la costura · `C2` liberación, coexistencia y migración;
  - **y uno nuevo, `D1` — la coherencia del conjunto**: contradicciones entre capítulos, conteos
    congelados, referencias sin destino, afirmaciones que contradicen la matriz.
- **Reglas de la corrida**:
  1. **Ciegos del historial**: no leen `14-`…`23-`, ni los rastros, ni los informes anteriores.
  2. **El log de decisiones es un dato**: pueden señalar que una decisión rompe algo; no reabrirla
     por preferencia. La matriz es la fuente de lo medido.
  3. **Modelo Opus** para los nueve —decisión de costo del owner: una revisión adversarial que se
     escapa cuesta más que los tokens.
  4. Informes en `25-fase-8-completa/`, y un consolidado donde **la convergencia entre agentes
     ciegos es la señal de severidad**, como en la primera.
- **Relación con `DEC-METH-013`**: **el tope de dos vueltas empieza a contar DESPUÉS de esta
  revisión.** Contesta la pregunta que el handoff del 24/09 dejaba abierta.
- **El costo, declarado**: la primera FASE 8 dio **141** hallazgos. Ésta debería dar menos, pero
  arreglarlos es trabajo de varias sesiones.
- **La alternativa descartada**: una 8-bis-6 sobre los cambios del 24/09. Más barata, pero repite el
  punto ciego que ya costó un crítico, justo después de la tanda más grande del programa.
- **Origen**: la pregunta del owner del 2026-09-24 y su aprobación del texto y de la lista de
  vectores el mismo día. Se arranca **en una sesión nueva, con contexto limpio**, a pedido suyo.

---

### DEC-METH-015 — Los residuos de borde que deja un arreglo se declaran, no se persiguen

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED · **Decide**: owner
- **Precisa `DEC-METH-013`** (cuándo se deja de girar) para el trabajo **dentro** de una vuelta.
- **Problema**: resolviendo los racimos de la FASE 8 completa, cada tanda de arreglos abrió residuos
  nuevos —la pendiente 8 cerró once puntos y abrió cinco—, cada vez más de borde y ninguno crítico.
  Es el mismo mecanismo que `DEC-METH-013` describe para el ciclo 8↔9: **el acto de arreglar es el
  generador**. Perseguir cada borde no termina.
- **Decisión**: los residuos de **borde** que deja un arreglo —los que no mueven plata en el camino
  principal, no dan acceso indebido y no borran datos— **se declaran con su causa** en el «NO
  cierra» del capítulo y **no se abren como pendientes nuevas**. Se sigue con los racimos y los
  críticos. Un residuo que sí toca plata, acceso o datos en el camino principal se trae al owner.
- **Origen**: propuesta del orquestador del 2026-09-25, tras la pendiente 8; aprobada por el owner.

---

### DEC-METH-016 — Una tercera vuelta de la FASE 8 y la FASE 9, entera y desde cero, como excepción declarada al tope de `DEC-METH-013`

- **Fecha**: 2026-09-29 · **Estado**: ACCEPTED · **Decide**: owner
- **Se aparta de `DEC-METH-013` cláusula 2** (tope de dos vueltas) **por única vez**; no la reemplaza
  ni la deroga: el tope sigue valiendo para lo que venga después de esta vuelta.
- **Problema**: después de cerrar la vuelta 2 (2026-09-27/28) el diseño recibió la revisión del owner
  (unas 45 decisiones, `30-revision-del-owner/10-`), 76 casos vecinos (`16-`), las mediciones del
  2026-09-29 (`27-`) y los lotes M a P de la verificación corta (`32-`), que cambian el esqueleto: la
  limpieza total del sistema viejo al principio con la unidad `U1`, el orden nuevo del corte con el
  receptor en la misma ruta y el Worker que contesta `500`, una entrada nueva del contrato
  (`puedeCobrarle`), las acciones administrativas 23 a 25, `S38` y `A7`. La verificación corta midió
  **8 hallazgos que bloqueaban sobre 26 mecanismos nuevos** (`30-` y `31-`), y los lotes N a P, los más
  estructurales, se aplicaron **después** de esa verificación, sin ninguna lectura adversarial ajena.
  Cada tanda del 2026-09-29 destapó casos en partes que no tocaba (50 → 4 → 4 → 7 → 5 → 3 → 3).
- **Decisión**: una **FASE 8 vuelta 3 entera, desde cero**, como la vuelta 2 (`DEC-METH-014`): agentes
  ciegos entre sí y al historial, los mismos vectores, sobre núcleo, las dos épicas, el contrato y la
  FASE 7 del paraguas; consolidado por causa, citas verificadas y atribución contra los diffs desde el
  cierre de la vuelta 2. Después, la FASE 9 con el owner. Con críticos, se declaran con el owner
  (`DEC-METH-013` cláusulas 3 y 4).
- **Alternativas**: (2) una vuelta acotada a lo que cambió desde la vuelta 2: la mitad del costo, pero
  no ve cómo lo nuevo rompe lo viejo, que es la clase que viene apareciendo, y el owner ya la había
  descartado para la vuelta 2; (3) no hacerla y pasar a la FASE 5: se entra a construir con los
  defectos que la tasa medida anticipa.
- **Origen**: propuesta del orquestador del 2026-09-29, a pregunta del owner (*«con todos los cambios
  que metimos entre ayer y hoy, ¿consideras que no hace falta hacer una vuelta más de una fase 8 y
  fase 9 de cero?»*); el owner eligió la 1, la recomendada.

---

### DEC-METH-017 — El criterio de la FASE 5: lo que `U1` borra se lista, y lo demás se clasifica contra el diseño

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED · **Decide**: owner
- **Cumple el gate de `DEC-METH-003`**: es el criterio que esa decisión manda fijar al empezar la
  FASE 5, antes de clasificar ninguna pieza, con el inventario de la FASE 1B
  ([`08-phase-1b-code-discovery.md`](./08-phase-1b-code-discovery.md)) terminado.
- **⚠️ Apartamiento declarado del PDR** (FASE 5, *«Clasificar: KEEP · ADAPT · REWRITE · DELETE ·
  MISSING»*). El PDR no se edita (§3.1): queda registrado acá.
- **Problema**: la plantilla de la FASE 5 está hecha para decidir qué código viejo se salva, y el
  programa ya decidió que `U1` borra al principio todo el sistema viejo de billing (lote N, `30-revision-del-owner/32-`),
  salvo las columnas `owner_suspended`, `plan_restricted` y `billing_unpublished_at`, que viven
  hasta el paso 3 del corte. Aplicada literal, la mitad del trabajo es escribir *«se borra porque
  lo dice `U1`»* pieza por pieza, y lo que sí tiene riesgo no tiene casilla: lo que el diseño **da
  por hecho** del código que queda (permisos, triggers, migraciones `extras`, rutas) y que el
  código puede no hacer. Y la condición *«usable por todas las verticales»* del `KEEP` manda al
  Eje 2 a `REWRITE` por definición (la trampa que nombra `DEC-METH-003`, implicación 3).
- **Alternativas**: (1) la plantilla del PDR, literal, pieza por pieza; (2) dos preguntas
  separadas, la de abajo; (3) sin criterio fijo, caso por caso con argumento.
- **Decisión**: **(2)**, la recomendada.
  1. **Lo de billing que `U1` borra** se lista como `DELETE` citando el lote N, sin otro argumento.
     La lista sirve para verificar que `U1` no deja nada vivo, no para rediscutir el borrado.
  2. **Todo lo demás que el diseño toca** se clasifica **contra el diseño**, en una de cuatro:
     **confirma** (el código hace lo que el diseño supone), **contradice** (el diseño supone algo
     que el código no hace, o hace distinto), **falta** (`MISSING`: el diseño lo necesita y no
     existe) o **adaptar** (existe y hay que cambiarlo para que el diseño se cumpla).
  3. **La plantilla del PDR** (`KEEP`/`ADAPT`/`REWRITE` con sus cinco condiciones) se aplica sólo a
     lo que el diseño **conserva** de fuera del billing viejo.
  4. **Eje 2, explícito**: el comportamiento propio de una vertical (la lista cerrada de ocho ítems
     del cap. 01) **no** se penaliza por no ser genérico ni por no ser usable por todas las
     verticales cuando vive en el módulo de esa vertical, como manda el diseño. Se le exigen las
     otras tres condiciones: correcto, bien testeado y representa el modelo nuevo.
  5. **Toda clasificación lleva su argumento escrito** (`DEC-METH-003`, implicación 4), incluidas
     las de la categoría 2; en la 1, el argumento es la cita.
- **Motivo**: pone el trabajo donde está el riesgo real —las contradicciones entre el diseño y el
  código que queda— sin agregar mecanismo, y no rediscute un borrado ya decidido.
- **Implicaciones**: una **contradice** vuelve al owner si corrige el diseño; si corrige el código,
  entra como trabajo de la unidad que lo toca. La FASE 5 también fija el nombre del package del
  contrato antes de construir `U1` (lote B).
- **Origen**: FASE 5, lote A, 2026-09-30; propuesta del orquestador, el owner eligió la 2.

---

### DEC-SUB-022 — La sucesora de quien venía pagando entra en grace si falla su primer cobro, y el barrido corta ese grace si el proveedor ya se rindió

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día, con OK del owner** (FASE 9 completa, 9d: el alcance de *«venía pagando»*; ver su 📌) · **Decide**: owner
- **Precisa `DEC-SUB-021`** —cubre la población que dejó con *«la persona se queda sin nada»*— **y
  `DEC-MP-008`** —sobre esta sucesora, un `cancelled` leído en el proveedor también termina el
  grace, no sólo un `paused`—. No supera a ninguna.
- **Problema** (`26-fase-9-completa/01-…` §3.5, pendiente 3; sale de `F-8CB1-009`): *Juan* paga
  Básico hace un año. Pide Premium y autoriza; `S17` cancela Básico **al autorizar** y `S18`
  re-apunta sus addons a la sucesora. El primer cobro de Premium, diferido por `D8`, se rechaza. Como
  la sucesora no tiene ningún pago acreditado, corre `S16` y no `S4`: `CHARGE_DECLINED`, terminal, sin
  grace. Juan queda sin plan y con sus addons huérfanos, y tiene que suscribirse desde cero. Lo mismo
  desde `CANCEL_SCHEDULED` (el arrepentimiento). No le pasa al pagador manual —`S29` exige la cuota
  pagada— ni a la sucesora de una `SUSPENDED`, que no tenía servicio. Es el mecanismo que
  `DEC-SUB-021` cerró **en el grace**, sobre la población que quedó afuera.
- **Alternativas**: (1) aceptarlo y decirlo antes de confirmar el cambio; (2) una sucesora cuya
  predecesora venía pagando va a `S4` y no a `S16`; (3) `S17` espera el primer cobro de la sucesora,
  que es la alternativa (2) que `DEC-SUB-021` descartó.
- **Decisión**: **(2), más un control del owner.** Si falla el primer cobro de una sucesora **cuya
  predecesora venía pagando** —tenía al menos un pago acreditado—, **la sucesora entra en grace
  (`S4`) y no muere (`S16`)**. Y **el barrido diario relee su preapproval por id** (`D17`): si el
  proveedor lo **canceló** o lo **pausó**, el grace termina en el acto —`S6`: suspensión,
  cancelación de nuestro lado de lo que quede vivo, y aviso de suspensión con *«volvé a
  suscribirte»*—, con la misma forma que `DEC-MP-008`.
- **Las dos posiciones, porque va contra la recomendación**:
  - **La del orquestador, (1)**: es la única que no reabre la lectura *«grace por autorización»*
    (`B/03` §3.1), y la (2) se apoya en `PA-6`, que está `UNKNOWN`: si el proveedor cancela el
    preapproval ante un primer rechazo, ese grace espera un pago que no puede llegar.
  - **La del owner, (2)**: que Juan, que venía pagando, no quede sin nada. El riesgo de `PA-6` lo
    acota el control: a lo sumo **un día** de grace sobre un preapproval que el proveedor ya dio por
    perdido.
- **Por qué la regla 3 de este log no la frena** (*«una decisión sobre Mercado Pago no puede
  tomarse mientras su fila … diga `UNKNOWN`»*): **la decisión no depende de la respuesta de
  `PA-6`**. Si el proveedor reintenta, el grace cobra como cualquier otro y corre `S5`; si cancela o
  pausa, el barrido lo lee y corre `S6`. Lo que `PA-6` decide es **cuánto dura** ese grace, y el
  control lo acota a un día.
- **Lo que se resigna**: hasta un día de servicio sobre una sucesora que ya no puede cobrar; y que el
  grace deje de leerse sólo *«por autorización»*: para esta población se lee también por la relación
  con la predecesora.
- **Lo que no cambia**: el alta nueva y la sucesora de una `SUSPENDED` siguen muriendo por `S16`;
  y desde `GRACE_PERIOD` sigue sin declararse una sucesión (`DEC-SUB-021`).
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` fila 3c, sobre `01-…` §3.5 pendiente
  3; elección del owner del 2026-09-25, **contra la recomendación** (la primera presentación numeró
  mal las opciones y se volvió a preguntar).
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, fila 9d de
  `26-fase-9-completa/10`; elección del agente de aplicación en `13` §2, ratificada como estaba).**
  **«Venía pagando» es: la sucesión se declaró desde `ACTIVE` o `CANCEL_SCHEDULED`, y la
  predecesora tiene al menos un pago acreditado.** No alcanza a la sucesora de una `SUSPENDED` ni
  al pagador manual (`S29` ya exige la cuota pagada), como dice *Lo que no cambia*. La misma lectura
  sirve para *«cobrada»* en `DEC-ADDON-007` punto 3 (su 📌, 9e).

  La entrada no se edita en su contenido.

---

### DEC-MIG-005 — El corte trata a la cartera vieja como clientes nuevos: de su billing no se conserva nada, no se devuelve la diferencia del aborto y se les regala el trial; se conservan el usuario, sus preferencias y sus fichas

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R2`, `R21` y `R21-b`: el cobro sobre la lápida posterior al día del corte y el titular que sólo conoce el proveedor; ver su 📌) — **y precisada otra vez con OK del owner** (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27, `V2-m` y `V2-r` el 2026-09-28: la fecha del pago, el 1b que la espera y las anuales del viejo; ver su segundo 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C12, sobre el punto 3 de la decisión; ver su último 📌); **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote P-B: el detector lista también los cobros del día del corte sin `payment`; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes F y G: nada se devuelve y el titular que sólo conoce el proveedor; ver su penúltimo 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lotes C y D, con el OK del lote E, y J del lote 1: siguen los puntos 1 y 3 y el hecho del lote F; caen los 📌 del 27/09, de `V2-a`/`V2-m`/`V2-r` y del 29/09, y el del 30/09 en su lote G; el punto 2 queda sin sujeto; ver su último 📌); **y precisada una vez más el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra A, **contra la recomendación**: tras un aborto, la plataforma queda en sólo lectura hasta el reintento; ver su último 📌) · **Decide**: owner
- **Precisa `DEC-MIG-003`** (qué se pierde y qué escribe el corte) **y `DEC-MIG-004`** (su #17 no
  alcanza a la rama de aborto). No supera a ninguna.
- **Problema**: tres preguntas del corte que la FASE 9 completa trajo al owner
  (`26-fase-9-completa/02-…` `AO-1` y `AO-4`; `07-…` `R12-OWNER-3`):
  1. qué pasa con las tablas de billing del sistema viejo y con las columnas que las copian, que
     desde el 2026-09-26 —el primer cobro, `ed00a8fd`— guardan pagos (`F-8CB3-014`, `F-8CA3-007`,
     `F-8CC2-007`);
  2. qué se hace con lo que cobra la rama de aborto a quien se re-suscribe por el link reactivado: el
     proveedor no repite el trial y le cobra en el acto (`F-8CC2-004`; `16-fase-7…` §4.2: *«Qué se
     hace con esa diferencia no está decidido»*);
  3. a quién le escribe el corte una fila de `trial` consumida (regla de capítulo del 2026-09-25,
     `V/21` §2.4).
- **Qué SÍ se conserva, y qué no** (owner, 2026-09-25): de cada cliente actual se conservan **su
  usuario, sus preferencias y sus fichas** —para que no tenga que cargarlas de nuevo—; **todo lo de
  billing arranca de cero**, como si fuera un cliente nuevo: suscripciones, pagos, trials
  consumidos, promos y el historial del sistema viejo. En palabras del owner: *«no conservamos nada
  de los clientes actuales además de su user, sus preferencias y su ficha; todo lo que es billing va
  de cero, como si fueran clientes nuevos.»*
- **Decisión**, las tres del owner y las tres **contra la recomendación**:
  1. **Del billing del sistema viejo no se conserva nada** (2a): el historial no se guarda ni se
     congela, y las tablas se retiran. *«Recién arrancamos; a los clientes que hay los contactamos en
     persona, de a uno, y se vuelven a suscribir. Guardarlo sólo deja basura que después cuesta
     limpiar.»* Lo que el corte tuviera que leer del sistema viejo corre **antes** de retirar esas
     tablas; con el punto 3 no queda nada que leer.
  2. **La diferencia que cobra la rama de aborto no se devuelve** (2d): quien se re-suscribe arranca
     un trial nuevo desde cero. **Aclarado por el owner**: *«cuando en producción pasemos del sistema
     viejo al nuevo, a los clientes que haya en ese momento les hablamos y los tomamos como clientes
     nuevos que recién arrancan: tendrán su trial y luego se suscribirán»*. El trial nuevo es **el
     del sistema nuevo, cuando el corte termina**.
  3. **El corte no siembra trials consumidos** (2g): *«A los clientes ya suscriptos les regalamos el
     trial de nuevo: los tomamos como clientes nuevos. Sólo les respetamos la ficha para que no la
     tengan que cargar de nuevo; la suscripción es como si recién arrancaran.»* **Revierte** la regla
     del 2026-09-25 *«el corte siembra trials consumidos»* (`V/21` §2.4; consolidado
     `25-fase-8-completa/00-hallazgos.md` §5, fila `R12`). **Lo que toca fichas se mantiene**:
     `inactiva_desde` = instante del corte (`NUCLEO/01` §1.2, fila `C`).
- **Las dos posiciones**:
  - **La recomendación**: (1) congelar las tablas viejas en solo lectura, con la retención de
    `payment`, porque un contracargo de un cobro viejo pide su comprobante; (2) aplicarle a la
    diferencia `DEC-MIG-004` —hablarlo, con reembolso manual si hace falta—; (3) sembrar la fila
    consumida sólo a quien ya ejerció el evento (fichas publicadas, suscripciones que autorizaron).
  - **La del owner**: la cartera es chica y conocida, se la llama de a uno y se la trata como
    clientes nuevos. Conservar o sembrar agrega filas heredadas que el sistema nuevo no necesita
    —el mismo argumento de `DEC-MIG-003`: *«el escenario más limpio posible»*—.
- **Lo que se resigna, declarado**:
  - **El comprobante de un cobro del sistema viejo.** Si alguien desconoce ante su banco un cargo
    cobrado bajo el sistema viejo, no hay registro nuestro; queda el del proveedor, cuyo buscador
    cubre doce meses (`DEC-CONC-002` impl. 4).
  - **El trial único como control**, para esta cohorte: quien ya tuvo trial lo vuelve a tener. Son
    personas conocidas.
  - **La diferencia cobrada en el aborto**, a quien se re-suscriba.
- **El §25 del PDR (*«Conservar: … pagos»*): NO se declara apartamiento, y no va al pliego del
  abogado.** Quedan escritas las dos posiciones:
  - **La del orquestador**: el §25 enumera **«pagos»** entre lo que se conserva; habla de la
    retención de una ficha inactiva, pero la lista no distingue de qué sistema. Recomendaba
    declararlo como **noveno apartamiento** del resumen y llevar la pregunta al pliego del abogado
    (`13-pliego-consulta-legal.md`).
  - **La del owner, que decide**: *«no conservamos nada de los clientes actuales además de su user,
    sus preferencias y su ficha; todo lo que es billing va de cero, como si fueran clientes nuevos.
    No hace falta abogado: son personas que conozco, amigos míos.»* La cartera del corte se trata
    como clientes nuevos, y el §25 no se lee como obligación sobre los pagos de un sistema que se
    retira. **El resumen no suma un noveno apartamiento.**
- **Qué vuelve innecesario**: leer las tablas viejas en el corte; el censo de la fila de `trial` y sus
  bordes (`02-…` `DB-6`; `09-…` `DB-5` en su mitad de trial; `07-…` `R12-OWNER-3`); y la rama
  «conservar» de `F-8CC2-007`.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 2a, 2d y 2g, sobre `02-…` `AO-1`
  y `AO-4` y `07-…` `R12-OWNER-3`; respuestas del owner del 2026-09-25, y su posición sobre el §25
  del mismo día, al revisar la propuesta de registro (`26-fase-9-completa/14` §2.3).
- 📌 **Precisado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, `R2`, `R21` y `R21-b`)**: el
  cobro sobre una lápida del corte no se devuelve sólo si es del día del corte (`date_created`
  del registro). Uno posterior abre `PAGO_TARDÍO_RECHAZADO` con la propuesta de devolverlo. La
  población se lee de la re-verificación del día del corte, y un detector corre después del
  corte, con dueño y fecha (`B/21` «NO cierra»). El titular de una autorización que sólo
  conoce el proveedor entra a la población a avisar: antes del aviso previo, una pasada de sólo
  lectura sobre el proveedor lista las autorizaciones vivas con su `payer_email`, y el 1b
  cancela después. Quien aparezca recién en el manifiesto del 1b recibe el aviso después de la
  cancelación, y lo que pierde se declara como en `G1-4`.
- 📌 **Precisado con OK del owner (FASE 9 vuelta 2, verificación: `V2-a` el 2026-09-27; `V2-m` y
  `V2-r` el 2026-09-28)**: el día del cobro se lee en la fecha del pago que aprobó el registro,
  leído por id, y no en el `date_created` del registro, que no se mueve con los reintentos. Qué
  campo del pago la trae se mide en el paso 0 del corte (`EX-48`), y el 1b no arranca sin ese dato:
  si ningún campo es confiable, vuelve al owner antes del corte. Y el paso 0 cuenta las
  suscripciones anuales vivas del viejo (`EX-50`), porque sobre ellas la segunda corrida del
  detector puede caer hasta un año después del corte.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C12, sobre el punto 3 de la
  decisión)**: Precisado por `DEC-MIG-006`: no se siembran trials consumidos; se siembra uno activo
  a cada dueño con una ficha a la vista.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote P-B)**: La primera
  corrida del detector, el día siguiente al corte, lista también, por cada lápida del corte, los
  registros de cobro que el proveedor da aprobados con un pago del día del corte y que no tienen
  `payment`, con la misma lectura del barrido, sin abrir marca ni asentar. Es lo que ve el cobro
  cuyo aviso se perdió durante el cierre de la ruta de avisos, que el barrido no compara sobre una
  lápida del corte; la regla de `G3-1` no cambia, y la lista suma titulares a la llamada.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes F y G; F contra la
  recomendación)**: No se devuelve nada a nadie, y el trial regalado no se presenta como
  compensación. Hecho del owner: no hay anuales vivas en el sistema viejo ni las va a haber antes
  del corte. El titular que sólo conoce el proveedor tiene detector sólo si alguna lectura medida en
  sandbox trae su pagador (`EX-59`); si ninguna, queda declarado sin detector.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lotes C y D,
  con el OK del lote E, y J del lote 1 de la FASE 5; `38-fase-5/20-simplificacion-del-corte.md`
  §11)**: Siguen los puntos 1 y 3 y el hecho del lote F (no hay anuales vivas en el sistema viejo
  ni las va a haber antes del corte). Quedan **`SUPERSEDED`**: el 📌 del 2026-09-27 (`R2`, `R21`
  y `R21-b`: la regla del día del corte, el detector posterior y la pasada sobre el proveedor antes
  del aviso; S-37, S-41, S-42); el de `V2-a`, `V2-m` y `V2-r` (el campo del pago que da el día,
  `EX-48`, y el conteo de anuales, `EX-50`, que pasan a no medirse, y el 1b que los esperaba; S-57,
  S-58); el del 2026-09-29, lote P-B (lo que lista el detector del día siguiente; S-42); y del
  📌 del 2026-09-30, la parte del lote G (el detector del titular que sólo conoce el proveedor,
  S-38); lo del lote F sigue. Un cobro tardío de un débito viejo se trata como cualquier débito
  desconocido: se anota, se cancela y le aparece al owner marcado para decidir la devolución
  (lote C, `DEC-CONC-002`). **El punto 2 queda sin sujeto** (lote D, S-15): abortar el corte es
  restaurar la base y volver a la imagen vieja, sin reabrir la venta, así que nadie se
  re-suscribe por el link. Y *«se conservan … sus fichas»* se acota a las cinco cuentas de la
  lista, una ficha cada una: las fichas de las demás cuentas se borran en el corte (J del lote 1;
  `DEC-MIG-007`). El usuario y sus preferencias se siguen conservando.
- 📌 **Precisada una vez más el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra
  A, **elegida contra la recomendación**; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 A)**: *«Abortar el corte es restaurar la
  base y volver a la imagen vieja, sin reabrir la venta»* (📌 anterior) se cumple dejando puesta
  **la regla que bloquea toda escritura hasta el reintento**: la plataforma entera, las cinco
  cuentas incluidas, queda en sólo lectura mientras tanto. La recomendada era la 3 (levantar la
  regla general y, hasta el reintento, bloquear sólo las rutas de venta del viejo), la única que
  cumplía *«sin reabrir la venta»* sin dejar el sitio congelado por un plazo que nadie fijó; el
  owner eligió la 1, sin lista de rutas (FASE 5, lote de la aplicación, owner 2026-09-30, A; ver
  los 📌 de `DEC-MIG-002` y `DEC-MIG-003`).

---

### DEC-RF-008 — El reembolso tiene máquina mínima, y lo que ocurrió por fuera del flujo se asienta con una acción administrativa nueva

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **recontada el 2026-09-26** (quince acciones; ver su 📌) — **y recontada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `Q-ACC16`: dieciséis acciones; ver su segundo 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C8, C15, N1, C9; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos F-C, H-D e I-C; ver su penúltimo 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, lotes 4 a 6, letra F: las devoluciones de una misma orden se serializan; ver su último 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra J: la serialización la impone un índice parcial; ver su penúltimo 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, segunda tanda, M: la devolución que el índice frenó la manda el barrido; ver su último 📌) · **Decide**: owner
- **Precisa `DEC-RF-007`**: *«la reparación es manual»* gana el acto con que se asienta. No supera a
  ninguna.
- **Problema** (`F-8CB1-015`, que no llegó a ningún capítulo; `26-fase-9-completa/04-…` §R7.5.1 y
  `C-R7-1`): la fila de `refund` tiene una columna *estado* sin valores ni transiciones (`B/02` §2.3),
  así que el reintento que exige el `2084` (`DEC-RF-001` punto 3) no tiene dónde vivir. **Nada
  escribe** la devolución de un `manual_payment` ni la de un cobro más viejo que el plazo del
  proveedor (`DEC-RF-007`). Y los motivos 18 (`REEMBOLSO_FUERA_DEL_FLUJO`) y 19
  (`COBRO_SIN_REGISTRAR`) mandan a una persona a *«asentar»* con un acto que el catálogo no tiene,
  cuando `NUCLEO/08` §3 prohíbe ejecutar una escritura que no esté nombrada en ninguna fila.
- **Alternativas**: (1) máquina mínima y una acción administrativa nueva; (2) sólo el acto de lo
  hecho por fuera, con la fila de `refund` naciendo ya ejecutada; (3) declararlo de borde.
- **Decisión**: **(1)**.
  1. **`refund`: `REQUESTED → CONFIRMED → EXECUTED | FAILED`.** `EXECUTED` lo escribe la relectura
     del proveedor o, en una devolución por fuera, la persona con el comprobante de la transferencia.
     La confirmación sigue siendo humana (`DEC-RF-002`).
  2. **Una acción administrativa nueva: *«asentar un cobro o una devolución que ya ocurrió por
     fuera»***. Cierra los motivos 18 y 19 y la devolución manual, que son el mismo gesto. **El
     catálogo pasa de trece a catorce acciones.**

     **📌 Recontado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `G5-2`;
     `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** El catálogo tiene hoy **quince**
     acciones —la decimoquinta, *«editar el contenido de una ficha ajena»*, sin publicar, destacar
     ni borrar—, y las líneas que lo cuantifican (`NUCLEO/08` §3, `V/17` §3.2 reglas 1 y 3, §3.3,
     §3.4 y su ⚠️, §3.5, `B/19` §6) dicen quince. Lo de arriba es exacto para su fecha.

     **📌 Recontado el 2026-09-27, con OK del owner (FASE 9 vuelta 2, owner 2026-09-27,
     `Q-ACC16`).** El catálogo tiene **dieciséis** acciones: la decimosexta es *«discontinuar una
     vertical»*, de `SUPER_ADMIN`, auditada y con confirmación, que orquesta las dos mitades del
     acto de `DEC-ARCH-011`. Las líneas que cuantifican dicen dieciséis.
- **Motivo**: es plata que sale, en el camino principal de la revocación; no cumple la condición de
  borde de `DEC-METH-015`. Y es escribir lo que ya se hace.
- **Implicaciones**: el asiento de un cobro corre `P1` sobre una fila de `payment` creada en
  `PENDING` con el id del registro, que es lo que emite el comprobante y escribe `covered_period`
  (corrección `C-R7-1`, sin decisión). Las líneas que cuantifican sobre el catálogo —`NUCLEO/08` §3,
  `V/17` §3.2 reglas 1 y 3, §3.3, §3.4, y `B/19` §6— pasan de trece a catorce (ver el 📌 de la
  parte 2).
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` fila 5a, sobre `04-…` §R7.5.1; elección
  del owner del 2026-09-25, la recomendada.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C8, C15, N1, C9)**: Las
  acciones administrativas pasan de dieciséis a veintiuna vivas: sale la 16, discontinuar una
  vertical, con su número sin reusar (C8); entra la 17, migrar a los clientes de un plan retirado
  (C15); y entran de la 18 a la 22, las cinco del catálogo (N1, C9, `L1-f`).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos F-C, H-D e
  I-C)**: Las acciones administrativas pasan de veintiuna a veintitrés vivas: entran la 23, borrar
  una ficha ajena a pedido de su dueño, que corre `PB12` y se evalúa sobre el sujeto como la 15, y
  la 24, dar de baja una cuenta a pedido de su dueño, que la seudonimiza y no la borra, y es
  capacidad del actor; las dos con permiso propio, auditoría, motivo y confirmación por
  destructivas, y las dos las construye `V8`, como la 15. La clase y la unidad las confirmó el
  owner.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lotes 4 a 6, letra F;
  `38-fase-5/10-decisiones-del-owner.md`, racimo `R5-27`, medición `EX-58`)**: Las devoluciones
  de una misma orden se serializan. El `POST` de la devolución contesta con todas las devoluciones
  de la orden, así que el id de la nueva sale por resta contra las ya registradas. Sale de `RF3` la
  rama *«de su mismo monto»* para órdenes; un `409` es un error de programación (una clave mal
  derivada), no *«ya estaba hecha»*; y la nota de `RF2` sobre `RF-6` se corrige: es del pago, y en
  la orden el reenvío devuelve la misma devolución con su id.
- 📌 **Precisada otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra J;
  `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 J)**: La serialización de las devoluciones de una misma orden (📌 anterior) **la
  impone una restricción de la base: un índice parcial que admite a lo sumo una devolución de la
  misma orden esperando su id**, sin candado de fila ni transacción abierta mientras se espera al
  proveedor. Una llamada que nunca responde deja la orden esperando hasta que el barrido la
  reenvía, que ya está diseñado (FASE 5, lote de la aplicación, owner 2026-09-30, J).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, segunda tanda, M;
  `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación, segunda tanda», y los registros `38-fase-5/23-` y `24-` §5)**: La devolución que el índice parcial del 📌 anterior
  frenó —la segunda de la orden, que queda en `CONFIRMED` sin llamada persistida— **la manda el
  barrido en su corrida siguiente, cuando ya no queda ninguna devolución de esa orden esperando su
  id**, con su clave persistida antes (`B/03` §6.1 `RF2`, `B/09` §3; el criterio es de `B11`).
  Origen: (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, M).

---

### DEC-ADDON-007 — Los addons siguen a su título: se pausan con la pausa, mueren cuando ninguna principal los sostiene, y se emiten sólo donde son compatibles

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el mismo día, con OK del owner** (FASE 9 completa, 9e y 9f: qué es *«cobrada»*, y el borrado de la ficha lo ejecuta sólo `A6`; ver su 📌) · **Decide**: owner
- **Precisa** la condición de huérfano de `A5` que `DEC-ADDON-003` punto 4 y `DEC-ADDON-004` dan
  por fija. **No toca `DEC-ADDON-005`**: un ancla viva sigue sosteniendo al addon `USER`/`GLOBAL`
  compatible.
- **Problema** (`26-fase-9-completa/03-…` AL OWNER 1, 3, 4 y 5; `07-…` `R12-OWNER-2`):
  1. un cliente pausa cuatro meses y su addon recurrente le cobra los cuatro sin darle nada, porque
     sin título el pliegue lo descarta (`F-8CC1-004`);
  2. el arreglo de `F-8CA2-003` leía *«la principal **más reciente**»*: un upgrade abandonado deja
     como más reciente a la sucesora `ABANDONED`, y el destaque de quien sigue pagando queda huérfano
     y se cancela, irreversible (`PA-5`);
  3. un addon `USER`/`GLOBAL` sólo queda huérfano si se borra la cuenta: con el plan dado de baja, o
     con un primer cobro rechazado, sigue cobrando sin dar nada;
  4. el contrato no dice en qué verticales se emite un addon `USER`/`GLOBAL` (`F-8CA1-008`).
- **Decisión**, las cuatro por la opción recomendada:
  1. **La pausa pedida por el cliente pausa también sus addons recurrentes de esa vertical, por los
     mismos meses** (4a): `LISTING` y `VERTICAL_SUBSCRIPTION` siempre; `USER`/`GLOBAL` sólo si no
     le queda título en otra vertical compatible. **La suscripción de complemento gana `PAUSED`.**
  2. **Un `LISTING` queda huérfano sólo si NINGUNA principal de ese `user + vertical` está viva y no
     hay ancla viva** (4c), no por el estado de «la más reciente».
  3. **Un `USER`/`GLOBAL` queda huérfano si en ninguna vertical compatible de su producto hay una
     principal viva Y COBRADA ni un ancla viva** (4d). Absorbe `R12-OWNER-2`: el addon comprado
     antes del primer cobro de un plan que después se rechaza queda huérfano.
  4. **Un `USER`/`GLOBAL` se emite sólo en las verticales compatibles de su producto** (4e;
     `12-contrato…` §2.7), con un guard gemelo de `G-R2-B`.
- **Motivo**: la razón de `DEC-ADDON-004` —*«el addon complementa algo que ya no está»*— aplicada a
  lo que vendemos, no sólo a una mora. Cobra exactamente lo que se presta.
- **Lo que cuesta**: N llamadas más por pausa, cada una con relectura, que pueden fallar.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 4a, 4c, 4d y 4e; elecciones del
  owner del 2026-09-25, las recomendadas.
- **📌 Precisado el 2026-09-25, con OK del owner (FASE 9 completa, filas 9e y 9f de
  `26-fase-9-completa/10`; elecciones del agente de aplicación en `15` §2, ratificadas como
  estaban).**
  1. **«Cobrada», en el punto 3 y en la compra de un addon, se lee como en `S4`** (9e): la principal
     tiene un **pago acreditado**, **o** es la sucesora de una predecesora que venía pagando (el 📌
     de `DEC-SUB-022`, 9d). Sin la segunda mitad, todo upgrade dejaba huérfanos en el acto los
     `USER`/`GLOBAL` de quien sigue pagando, porque la sucesora nace sin pago propio. La misma
     lectura vale para *«válida»* al comprar (`ACTIVE` y cobrada, `R12-OWNER-2`).
  2. **El borrado de la ficha sale de la orfandad: lo ejecuta sólo `A6`**, al llegar la ficha a
     `PURGED` (`K-9` del informe `05`, 9f). `A5` ya no borra; `A6` gana también el `desde`
     `PENDING_AUTHORIZATION` que `A5` cubría. Mismo destino y mismo motivo 14, así que no mueve
     plata, y la regla 7 de `NUCLEO/03` no cambia.

  La entrada no se edita en su contenido.

---

### DEC-AUTH-001 — La vertical de un recurso es inmutable y se lee del recurso; lo ajeno existe sólo en público, lo propio no consulta el paso 6, y el caché se invalida por `user`

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el 2026-09-30, con OK del owner** (FASE 5, lotes 4 a 6, letras D y G: el `404` a la ficha ajena `RESTRICTED` y la razón corregida del punto 3; ver su 📌) · **Decide**: owner
- **Registra además** una regla que el owner aprobó el mismo día en la FASE 8 completa y no tenía
  entrada: **`F-8CA1-001`, la vertical de una operación sobre una ficha se lee de la ficha, nunca del
  pedido** (`V/17` §1.2, precisión 6).
- **Problema** (`26-fase-9-completa/08-…` Owner 1; `09-…` `AO-1` a `AO-4`): cinco huecos del orden de
  autorización de `V/17`:
  1. una ficha publicada en Alojamiento se edita cambiándole la vertical a Gastronomía y queda
     publicada sin cobertura ahí; y las fotos de una presencia de Partner se cuentan contra la
     vertical que declara quien las sube;
  2. `S6` suspende Alojamiento y se invalida sólo `user + Alojamiento`: la herencia de Turista VIP y
     las claves globales siguen cacheadas en las otras verticales (`F-8CA1-002`, `F-8CA1-003`);
  3. el paso 2 nombra una cuenta *«inhabilitada»* que no tiene dato, transición ni acción
     (`F-8CA1-010`);
  4. el paso 4 no dice qué puede leer un visitante de lo ajeno (`F-8CA1-011`);
  5. el suspendido no tiene clave para leer lo suyo, justo cuando tiene que regularizar
     (`F-8CA1-013`).
- **Decisión**, las cinco por la opción recomendada:
  1. **La precisión 6 vale para todo recurso que guarda su vertical** —la ficha y su contenido, la
     presencia de Partner, la instancia de addon— **y la vertical de una ficha es inmutable desde el
     alta** (*«nunca una ficha debería poder cambiar de vertical»*, owner). Tercera mitad de `G2`:
     *«una operación escribe la vertical de un recurso que ya existe»*.
  2. **La invalidación del caché del conjunto efectivo es por `user`, no por `user + vertical`**
     (`V/02` §3.2, regla 3): una fuente puede otorgar en otra vertical que la suya.
  3. **«Inhabilitado por abuso» sale del paso 2**; el abuso se trata ficha por ficha con
     `MODERATED` (`PB10`).
  4. **En el paso 4, lo ajeno existe sólo en estado público**: ficha `PUBLISHED`; presencia de
     Partner con la clave vigente y sin moderar (`DEC-ENT-006`).
  5. **Las lecturas de lo propio —Mi Cuenta, su billing, sus fichas— no consultan el paso 6.**
- **Lo que se resigna**: (2) una relectura por vertical del user en cada invalidación; (3) un
  abusador puede crear fichas nuevas y cada una se modera a mano —el abuso es teórico a esta escala
  (`DEC-TRIAL-004`, 22 usuarios)—; (5) la excepción es sólo para esas tres lecturas, no para una
  lectura comercial que alguien llame *«propia»*.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 7a y 8a a 8d, sobre `08-…` Owner
  1 y `09-…` `AO-1` a `AO-4`; elecciones del owner del 2026-09-25, las recomendadas.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lotes 4 a 6, letras D y G;
  `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-26` y `R5-28`)**: **Punto 3**: la razón
  del problema 3 era falsa: la cuenta inhabilitada sí tiene dato. `banned`, `ban_reason` y
  `ban_expires` existen, son del plugin `admin` de Better Auth, que rechaza la sesión de una cuenta
  inhabilitada, y se conservan. Se corrige sólo la razón: el punto 3 no cambia (G, `AUT-016`).
  **Punto 4**: la excepción del contrato de errores de la API que contesta `403` a una ficha ajena
  `RESTRICTED` pasa a `404` en `V5`, con su test, porque lo ajeno existe sólo en estado público (D).

---

### DEC-ENT-006 — La presencia pública de Partner es un entitlement sin máquina: la página y el carrusel son claves, y el admin la baja con un bit de moderación

- **Fecha**: 2026-09-25 · **Estado**: ACCEPTED — **precisada el 2026-09-30, con OK del owner** (FASE 5, lote 1 D y lotes 4 a 6, letra B: `U1` borra las columnas de pago y los crons de partner, y el dueño de un Partner tiene rol de socio; ver su 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letras F y H: el rol de socio se da en el acto que fija al dueño, y las seis columnas de pago que borra `U1`; ver su penúltimo 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, segunda tanda, N y O: el alta directa no fija dueño, y `V7` borra `starts_at` y `ends_at`; ver su ~~último~~ 📌 de N y O); **y precisada otra vez el 2026-09-30, con OK del owner** (FASES 6 y 7, pase de la FASE 6, J: `V7` borra también `tier`; ver su 📌 de J) (FASES 6 y 7, verificación, 2026-09-30, F12) · **Decide**: owner
- **Registra además** la regla del owner del mismo día que no tenía entrada, **`R13`**: *«La página
  propia de Partner Gold no tiene máquina de estados. La lectura pública pregunta si el partner tiene
  HOY el entitlement de presencia pública»*; si no, responde que no existe, 404 (`V/18` §1.6).
- **Problema** (`26-fase-9-completa/08-…` Owner 2 y 3): el carrusel de la home no tiene regla —cero
  apariciones de *«carrusel»* en el diseño— y un Silver que deja de pagar no tiene quién lo retire; y
  sin máquina, el admin no puede bajar una página por su contenido sin **cancelarle el cobro**.
- **Decisión**, las dos por la opción recomendada:
  1. **Clave propia *«presencia en el carrusel»***, que otorgan Gold y Silver, con el mismo caché y el
     mismo reconciliador que la página (7b).
  2. **Un bit de moderación de la presencia**, escrito sólo por la misma acción administrativa que
     `PB10` —moderar o levantar la moderación—; **la presencia se ve si tiene la clave Y no está
     moderada** (7c). Sigue sin haber máquina: es una condición más en la lectura. **El catálogo de
     acciones no crece por esto.**
- **Motivo**: es la forma que `V/18` §1.2 ya eligió para la página —*«una capacidad que se tiene o no
  se tiene»*—, y separa moderación de cobranza, que el código de hoy separa a propósito.
- **Implicaciones**: la población del reconciliador diario de cobertura pasa a ser, en Partner, *«todo
  `user + Partner` con una clave de presencia»* (`DEC-ARCH-009`, su 📌).
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 7b y 7c, sobre `08-…` Owner 2 y 3;
  elecciones del owner del 2026-09-25, las recomendadas.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 1 D y lotes 4 a 6, letra B;
  `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-04` y `R5-24`)**: `U1` borra las columnas de
  pago de `partners`, sus FK y los tres crons de partner, dos de los cuales archivaban la presencia
  de quien dejaba de pagar; la lectura pública queda sin presencia visible hasta `V7` (lote 1 D). Y
  el dueño de un Partner **tiene rol**: se crea un rol de socio con su familia de operaciones, sus
  permisos y su migración de datos, que se asigna al aprobar la postulación, y el paso 3 de la
  cadena pregunta por esa familia. Por `V/17` (*«perder el acceso nunca revoca un rol»*), el rol
  **no se quita** cuando el socio pierde su presencia: la presencia sigue siendo la clave vigente y
  sin moderar de esta decisión (B, **contra la recomendación**, que era declarar el paso 3 vacuo
  para Partner).
- 📌 **Precisada otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letras F y
  H; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 F y H)**: El rol de socio del 📌 anterior **no se asigna al aprobar la
  postulación: se da en el acto que fija al dueño de la presencia**, el reclamo (`DEC-AUTH-004`) o
  el alta directa del admin con dueño. Al aprobar todavía no se sabe cuál es la cuenta del dueño, y
  el rol iría a la cuenta que tenga el correo, que puede no ser la del dueño real (F). Y *«las
  columnas de pago de `partners`»* que borra `U1` son **seis**: `subscription_status`, `plan_id`,
  `subscription_id`, `unpaid_notice_sent_at`, `payment_review_state` y
  `payment_confirmed_through`; `starts_at` y `ends_at` quedan hasta la unidad de socios (H; ver el
  📌 de `DEC-ARCH-014`). Origen: (FASE 5, lote de la aplicación, owner 2026-09-30, F y H).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, segunda tanda, N y
  O; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación, segunda tanda», y los registros `38-fase-5/23-` y `24-` §5)**: **El alta directa de un Partner por el admin no fija
  dueño**: manda el aviso de reclamo, y el rol de socio llega con el reclamo. El *«alta directa del
  admin con dueño»* del 📌 anterior se lee *«cuando queda con dueño»*, y `owner_user_id` lo sigue
  escribiendo sólo el reclamo (N). Y `starts_at` y `ends_at`, que el 📌 anterior deja *«hasta la
  unidad de socios»*, **los borra `V7` con su migración, junto con sus lectores del panel** (O).
  Origen: (FASE 5, lote de la aplicación, segunda tanda, owner 2026-09-30, N y O).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, pase de la FASE 6, J;
  `39-fases-6-y-7/10-decisiones-del-owner.md`, «Lote del pase de la FASE 6»)**: **`partners.tier`
  (Gold o Silver) sale en la misma migración de `V7` que `starts_at` y `ends_at`, con su índice, y
  sus lectores —la página pública y las tres rutas del socio— pasan a leer la clave**: Gold o
  Silver es el plan, y lo que se ve lo decide la clave; la columna que sobrevivía era una segunda
  verdad (`BD-018`). Dónde: `V/descomposicion.md` §2 y §4, `V7`; `V/18` §1.6. Origen: (FASES 6 y 7,
  pase de la FASE 6, owner 2026-09-30, J) (FASES 6 y 7, verificación, 2026-09-30, F12).

---

### DEC-ARCH-011 — Una vertical que deja de admitir altas deja de admitir suscripciones, y su fin de servicio invalida el caché de la vertical entera

- **Fecha**: 2026-09-25 · **Estado**: **SUPERSEDED (revisión del owner, 2026-09-28, C8)**: las verticales no se discontinúan. Discontinuar una vertical queda fuera de esta versión; si algún día hace falta, se diseña entonces, y este texto queda como punto de partida — **precisada el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, `R5`, `Q-ALTAS`, `Q-ALTAS-b`, `R24` y `Q-FECHA`: las dos mitades del acto, dónde vive la fecha y la vertical sin planes vendibles; ver su 📌) — **y precisada otra vez el 2026-09-27, con OK del owner** (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y `V2-i`: acortar la cola, la capa de composición y el reintento; ver su segundo 📌) · **Decide**: owner
- **Registra además** la regla del owner del mismo día que no tenía entrada, **`R11`**: *una vertical
  discontinuada no cubre a nadie desde su fin de servicio* (`12-contrato…` §2.6, `B/10` §4.3).
- **Problema** (`26-fase-9-completa/06-…` AL OWNER `S1` y γ):
  1. `S1` no mira si la vertical admite altas: una alta nueva —o una sucesión— en una vertical que se
     está discontinuando nace con un preapproval que **sigue cobrando después del fin de servicio**,
     contra *«Se deja de cobrar antes de dejar de prestar. Nunca al revés.»* (`B/10` §4). El arreglo
     de `R11` cerró los trials (`T1`) y no las suscripciones;
  2. el día del fin de servicio la fuente deja de emitirse, pero **nadie invalida el caché** de quien
     cubría un grant, una cortesía o un trial: el reconciliador no encuentra diferencia de fichas —el
     barrido ya las bajó— y la entrada sigue otorgando capacidades de una vertical cerrada.
- **Decisión**, las dos por la opción recomendada:
  1. **`S1` exige `situaciónDeVertical(vertical).admiteAltas`**, para el alta nueva **y** para la
     sucesión; la pricing no ofrece planes de esa vertical, y el mensaje es *«esta vertical ya no
     admite altas»* (6a).
  2. **Fila nueva en `V/02` §3.2: llega `fin_de_servicio` → se invalidan todas las entradas de esa
     vertical**; lo ejecuta el barrido del día (`B/10` §4.3), que ya recorre sus fichas (6b).
- **Motivo**: usa un campo que la frontera ya transporta —no hay campo nuevo— y el ejecutor que ya
  existe ese día. Invalidar es borrar, así que lo peor que pasa es recalcular de más.
- **Lo que se resigna**: quien está en `CANCEL_SCHEDULED` en esa vertical no puede cambiar de plan
  durante la cola de la discontinuación.
- **Origen**: `26-fase-9-completa/10-decisiones-del-owner.md` filas 6a y 6b, sobre `06-…`; elecciones
  del owner del 2026-09-25, las recomendadas.
- 📌 **2026-09-27 (FASE 9 vuelta 2, `R5`, `Q-ALTAS`, `Q-ALTAS-b`, `R24` y `Q-FECHA`, con OK
  del owner)**:

  - La invalidación de la vertical entera el día del fin de servicio la invoca el
    reconciliador diario de cobertura de verticales, no el barrido de billing.
  - El acto de `SUPER_ADMIN` que discontinúa tiene dos mitades: verticales escribe
    `admite_altas = no` y billing escribe la fecha y los avisos. La acción administrativa las
    orquesta en ese orden. Billing no escribe `admite_altas`.
  - Si la mitad de billing falla, la acción la reintenta hasta que entra y le muestra al admin
    que el acto quedó a medias; nunca deshace la mitad de verticales. Mientras tanto la
    vertical no admite altas y no tiene fecha, y nadie paga de más.
  - La fecha la guarda `vertical_discontinuation` (`B/02` §2.1): la escribe el acto del día 0
    y la reescribe sólo el acortamiento de `B/10` §4.4.
  - Retirar todos los planes vendibles no cierra la vertical: `T1` y `S1` exigen una versión
    vigente y vendible, y la pantalla dice que la vertical no tiene planes disponibles.
    Cerrarla a altas es discontinuarla.
- 📌 **Precisada el 2026-09-27, con OK del owner (FASE 9 vuelta 2, verificación, `V2-g`, `V2-h` y
  `V2-i`)**: la acción 16 es *«discontinuar una vertical o acortar su cola»*, con el mismo permiso,
  y la confirmación del acortamiento dice cuántos compromisos se reembolsan. Es capa de composición,
  fuera de las máquinas de las dos épicas, y la única que la regla de vigilancia exime por nombre.
  Si la mitad de billing falla, el reintento es automático y lleva la firma y la correlación del
  `SUPER_ADMIN` que confirmó.

---

### DEC-AUTH-002 — Una acción administrativa nunca tiene actor = sujeto

- **Fecha**: 2026-09-26 · **Estado**: ACCEPTED — **precisada el mismo día, con OK del owner** (compara cuentas, no personas; se declara con detector; ver su 📌) · **Decide**: owner
- **Problema**: con roles aditivos, quien confirma una acción del catálogo de `NUCLEO/08` §3 podía
  ser el interesado, y `D11` se cumplía a la letra sin proteger nada.
- **Decisión**: **una acción administrativa nunca tiene `actor = sujeto`.** El paso 3 la rechaza
  (*«sin permiso»*) y la hace otra cuenta con el permiso; regla sin lista.
- **Costo**: quien administra y es cliente necesita una segunda cuenta.
- **Dónde**: `V/17` §3.2 regla 5, `NUCLEO/08` §3, criterio de `V5`.
- **Origen**: `28-…/05-…` §5 `G5-1`, opción 1, la recomendada;
  `28-fase-9-vuelta-1/10-decisiones-del-owner.md`.
- **📌 Precisado el 2026-09-26, con OK del owner (FASE 9 vuelta 1, `Y-2`, opción 1 con su
  cláusula; `28-fase-9-vuelta-1/10-decisiones-del-owner.md`).** **La regla compara cuentas, no personas**: impide
  operarse a sí mismo con la misma cuenta, y no impide a la misma persona con dos —una de staff y
  otra de cliente—, que es justo lo que su costo le pide al que administra y es cliente. **Se
  declara, con detector**: el resumen de `DEC-OBS-001` lista cada acción administrativa que mueve
  plata, con actor y sujeto (`NUCLEO/08` §4.1), y la revisión es humana. **La confirmación por una
  segunda persona entra cuando haya otra persona con el permiso**: hoy, con un owner que opera
  solo, bloquearía la operación (`V/17` §3.2 regla 5 y su «NO cierra»; `27-cierre-Y-resto.md` §2).

---

### DEC-AUTH-003 — El admin edita el contenido de una ficha ajena con una acción propia, y nada más

- **Fecha**: 2026-09-26 · **Estado**: ACCEPTED — **precisada el 2026-09-27** (FASE 9 vuelta 2, `F-8V2A1-004`: la acción 15 no es capacidad del actor; ver su 📌) — **y precisada el 2026-09-28, con OK del owner** (revisión del owner, C7; ver su último 📌) — **y precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, caso F-C; ver su penúltimo 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote 3, letra C, y lotes 4 a 6, letra C: salen la impersonación del código y las puertas de borrado y restauración fuera del diseño; ver su último 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letra L: `fullAdminRole` queda sin ninguna acción; ver su último 📌) · **Decide**: owner
- **Problema** (`G5-2`, `F-8V1A1-003`): ¿el admin tiene escrituras sobre fichas ajenas fuera de las
  catorce? Sin ninguna, soporte pierde la herramienta de hoy (crear a nombre de un dueño, corregir,
  restaurar), y la presión empuja a pedirle la contraseña al cliente —la impersonación que `V/17`
  §3.2 regla 4 prohíbe—.
- **Decisión**: fila decimoquinta de `NUCLEO/08` §3 —crear en borrador a nombre del dueño,
  corregir, restaurar contenido—, **sin publicar, destacar ni borrar**; toda otra escritura del
  admin sobre lo ajeno necesita una fila. Con dos reglas que valen para toda fila: un acto ajeno
  nunca es *«el dueño publica»* (no dispara `T1`) y ningún borrado de ficha sale de otra fila que
  `PB9`/`PB12`.
- **Dónde**: `NUCLEO/08` §3, `V/17` §3, `V/19` §2.
- **Origen**: `28-…/05-…` §5 `G5-2`, opción 2, la recomendada;
  `28-fase-9-vuelta-1/10-decisiones-del-owner.md`.
- 📌 **2026-09-27 (FASE 9 vuelta 2, `F-8V2A1-004`)**: la acción 15 no es capacidad del actor:
  sus pasos 5 a 7 se evalúan sobre el dueño de la ficha. Su aviso es la fila 26 de `V/19` §4.
- 📌 **Precisada el 2026-09-28, con OK del owner (revisión del owner, C7)**: "Entrar como" el cliente
  se agrega en una versión posterior, con la condición de que se registre como hecho por el admin en
  nombre del cliente; cuando se diseñe, se reabre el "ni las que se agreguen" de `NUCLEO/08` §3
  (revisión del owner, C7).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, caso F-C)**: El
  "sin borrar" de la acción 15 vale para la edición de contenido: borrar una ficha ajena a pedido de
  su dueño es la acción 23, otra fila con su permiso.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 3, letra C, y lotes 4 a 6, letra C;
  `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-17` y `R5-25`)**: Vale el diseño sobre el
  código: salen `impersonate` y `set-role` del plugin `admin` de Better Auth, el botón del panel y
  el permiso `USER_IMPERSONATE`; HOS-354 se cierra o se reescribe como el *«entrar como»* de una
  versión posterior, el del 📌 de C7 (lotes 4 a 6, C). Y se retiran todas las puertas de borrado y
  restauración de fichas y de cuentas que el código tiene fuera del diseño: el borrado del dueño
  pasa a ~~`PB9`~~ `PB12` (corregido en la aplicación, 2026-09-30: error de transcripción de
  `38-fase-5/10-`; la opción elegida dice «el del diseño», que es `PB12`), el del equipo a la acción 23 (a pedido y con motivo), y desaparece el borrado
  físico de fichas y de cuentas (lote 3, C).
- 📌 **Precisada otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letra L;
  `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 L)**: Además de `impersonate` y `set-role`, **`fullAdminRole` del plugin `admin`
  de Better Auth queda sin ninguna acción**: salen también `ban`, `delete`, `set-password`,
  `create` y `update`, y con `delete` la puerta de borrado físico de cuentas que el lote 3 C
  retira. **El plugin sigue sólo como guardia del baneo**, cuyo rechazo de sesión no depende del
  rol. La recomendación inicial era la 1 (sacar sólo `delete`); tras pedir más información, el
  coordinador corrigió el riesgo de la 2 —hoy toda ruta del plugin ya contesta `403`, así que
  vaciar el rol no rompe nada que funcione— y recomendó la 2, que el owner eligió (FASE 5, lote de
  la aplicación, owner 2026-09-30, L).

---

### DEC-AUTH-004 — El reclamo de un Partner vincula una sola vez y a la cuenta que reclama, y una cuenta es dueña de a lo sumo un Partner

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema** (FASE 8 vuelta 3, racimo R1: `F-8V3A1-001`, la única crítica de la vuelta, que el
  owner bajó a ALTA, `F-8V3A1-002` y `F-8V3A2-002`): el reclamo de un Partner (`V/18` §2.4) no ponía
  ninguna condición sobre la cuenta ni sobre el vínculo. Verificaba el correo de la cuenta de un
  ocupante que la había creado con esa dirección sin poder verificarla, y el ocupante seguía adentro
  con su sesión; el link no vencía ni se consumía, así que quien leyera el aviso después movía el
  Partner a su cuenta; y nada impedía que una cuenta fuera dueña de dos Partners, con lo que un
  Gold, que se cobra por `user + vertical`, encendía todas las presencias de la cuenta pagando una.
  Y si el link se pudiera armar con el id del Partner, cualquiera lo reclamaba.
- **Alternativas**: sobre la cuenta sin verificar, (1) el reclamo la verifica y cierra todo lo
  previo, o (2) deriva a soporte, como el cambio de correo de la regla 3 de `V/18` §2.4; sobre la cantidad, (1) una
  cuenta, un Partner, o (2) varios, con un cobro por presencia y una regla para el addon de scope
  vertical; sobre el link, (A) un secreto de un solo uso escrito en el diseño, o (B) dejarlo a la
  implementación.
- **Decisión**: el reclamo de un Partner escribe `owner_user_id` sólo si está nulo, y su link es de
  un solo uso; si verifica la cuenta, cierra todas sus sesiones y credenciales previas. Una cuenta
  es dueña de a lo sumo un Partner, con unicidad en la base; el reclamo de un segundo deriva a
  soporte. El link de reclamo lleva un secreto de un solo uso que viaja sólo en el aviso: no se
  puede armar con el id del Partner.
- **Motivo**: la única prueba de que el postulante es dueño de la dirección es que pueda leerla, y
  esa prueba vale sólo si el link no se puede adivinar ni reusar, y si al verificar no queda nadie
  más adentro. Es acceso indebido, no un residuo de borde (`DEC-METH-015`).
- **Relación con el PDR**: ninguna contradicción. El §17.3, camino A, dice *«comprobar si existe
  User Hospeda con el email»* y no dice qué hacer si existe; esta decisión cubre esa rama, y el PDR
  no dice cuántos Partners puede tener una cuenta.
- **Dónde**: `V/18` §2.4, reglas 1 a 5; `V/02` §2.7.
- **Origen**: `37-fase-8-vuelta-3/10-decisiones-del-owner.md`, lotes A, B y AA, los tres la
  recomendada; propuesta en `37-fase-8-vuelta-3/14-aplicacion-cierre.md` § «Para el owner» (punto 2
  de las propuestas para el log y pregunta 12); OK del owner al lote del log el 2026-09-30 (lote
  AB).

---

### DEC-AUTH-005 — Postular un Partner no exige cuenta: es la segunda excepción del guest en el paso 1

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED — **precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes AI y AJ; ver su 📌) — **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lotes 4 a 6, letra A: la postulación de Partner es propia y `alliance_leads` queda para los otros tipos; ver su último 📌) · **Decide**: owner
- **Problema** (FASE 8 vuelta 3, racimo R13, `F-8V3A1-005`): el paso 1 de la cadena de autorización
  (`V/17` §1.2) rechaza al guest salvo en una lectura de lo ajeno en estado público, y `PP1`,
  postular un Partner, es una escritura desde un formulario público. La salida que no rompía el
  producto era eximir la ruta, que es la exención por superficie que el §3.5 del cap. 17 prohíbe.
- **Alternativas** (lote I): (1) postular exige cuenta, la recomendada; (2) se postula sin cuenta,
  como segunda excepción del guest en el paso 1, con límites contra el abuso. Y sobre los límites
  (lote M): (1) captcha y una sola postulación abierta por correo.
- **Decisión**: postular un Partner no exige cuenta: es la segunda excepción del guest en el paso 1,
  acotada a esa escritura, con captcha (Turnstile) y una sola postulación abierta por correo.
  **Contra la recomendación** en el lote I; el lote M, la recomendada.
- **Motivo**: la rama *«el correo no corresponde a ningún usuario»* de `V/18` §2.4 existe para quien
  no tiene cuenta, y exigirla le quitaba esa población. Es una excepción de la cadena, declarada, no
  una ruta exenta: la resolución corre igual.
- **Relación con el PDR**: ninguna contradicción. El §17.3, camino A, empieza con *«interesado
  completa formulario de Partner»* y recién al aprobar comprueba si existe el usuario y lo crea si
  no: el PDR ya supone un postulante sin cuenta. Tampoco es alta self-service: el Partner lo sigue
  aprobando y configurando el admin.
- **Dónde**: `V/17` §1.2, paso 1 y precisión 9; `V/18` §2.2; `V/02` §2.7 y `V/03` §11, la
  restricción de una postulación abierta por correo.
- **Origen**: `37-fase-8-vuelta-3/10-decisiones-del-owner.md`, lotes I (contra la recomendación) y M
  (la recomendada); propuesta en `37-fase-8-vuelta-3/14-aplicacion-cierre.md` § «Para el owner»
  (punto 3 de las propuestas para el log); OK del owner al lote del log el 2026-09-30 (lote AB).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes AI y AJ)**: una cuenta
  con sesión y el correo sin verificar no postula como un visitante sin cuenta: se le pide
  verificar el correo antes de postular (lote AJ, **contra la recomendación**, que era dejarla
  postular como guest). Y el correo de una postulación hecha sin cuenta lo reemplaza la acción 24
  de `NUCLEO/08` §3 a pedido de quien la escribió, con motivo y registro, sin cuenta que dar de
  baja (lote AI).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lotes 4 a 6, letra A;
  `38-fase-5/10-decisiones-del-owner.md`, racimo `R5-23`)**: la postulación de Partner es **propia**
  y la crea `V7` (la de `V/02` §2.7), con su Turnstile y una sola abierta por correo. La lista de
  postulaciones que ya existe, `alliance_leads`, que mezcla otros tipos (patrocinadores, editores,
  proveedores), no se adopta ni se borra: queda para esos tipos, fuera de este programa.

---

### DEC-MIG-006 — El corte publica las fichas que estaban a la vista y le arranca a su dueño una prueba activa

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 5 y 6; ver su 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lote A, con el OK del lote E, J del lote 1 y D del lote 2: las cinco de la lista en vez de las `L8`, la prueba la escribe el script del corte, y sale su 📌 del 29/09; ver su último 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letras B y D: la prueba la escribe la herramienta del corte de `V6`, y la migración copia a una tabla de paso lo que el 5b borra; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, C12, `L1-a`, `L1-b`): C12 decide que el día del corte las fichas
  que estaban a la vista nacen como recién creadas y publicadas, y que la prueba del dueño arranca
  ese día. Quedaban dos formas abiertas: el dueño con varias fichas a la vista (`L1-a`) y las fichas
  que el sistema viejo tenía bajadas por falta de pago (`L1-b`).
- **Decisión**: el día del corte, las fichas que estaban a la vista (`L8`) nacen `PUBLISHED`, como
  recién creadas, y la migración estructural le escribe a cada `(dueño, vertical)` con una de ellas
  una fila de `trial` en `TRIAL_ACTIVE` que arranca en el instante del corte, con el seudónimo de la
  función de `T1` y la campaña previa. Las que el sistema viejo tenía bajadas por falta de pago
  (`L5`, `L7`) nacen en `DRAFT`, y cae entera la regla `R15`. Gates del corte: la lista de
  proveedores del seudónimo cerrada y medida antes del corte, y el recuento de cuentas de la cartera
  que comparten seudónimo en la misma vertical en cero. Un dueño con más de una ficha a la vista no
  se diseña: hoy no hay ninguno. Las dos cuentas del owner reciben la prueba y el grant del 3b; `T2`
  la consume.
- **Reemplaza a**: `G1-1` (R1, FASE 9 vuelta 1), que no tiene `DEC` propio, en lo que decía de la
  cartera. **Precisa** `DEC-MIG-005` punto 3: el corte sigue sin sembrar trials consumidos y siembra
  uno activo (ver su 📌).
- **Dónde**: `30-revision-del-owner/12-aplicacion-verticales-y-contrato.md` §1 (C12).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C12, `L1-a`, `L1-b`); propuesta en
  `30-revision-del-owner/12-…` §3 punto 1 y consolidada en `30-revision-del-owner/14-…` §4.1 punto
  1; OK del owner al lote del log, 2026-09-28 (`30-revision-del-owner/10-…`, *«El lote del log y la
  matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 5 y 6)**:
  En el paso 0 se toman dos recuentos sobre la cartera vieja: si el sistema viejo servía alguna
  ficha que el corte hace nacer `PURGED` o en `DRAFT`, y si da cero el paso 4c se saltea; y cuántos
  dueños tienen más de una ficha a la vista en la misma vertical, que no es gate y vuelve al owner
  si da más de cero.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lote A, con el
  OK del lote E; J del lote 1 y D del lote 2 de la FASE 5; `38-fase-5/20-simplificacion-del-corte.md`
  §11)**: *«Las fichas que estaban a la vista (`L8`)»* pasa a **las cinco de la lista** cerrada que
  fija el owner cuando esté listo para el corte: la migración carga esas cinco fichas, que nacen
  `PUBLISHED` (o lo que diga la lista), y borra las filas de todas las demás, que el backup del 2b
  restaura si hay aborto; cae la tabla `L1`–`L8`, y con ella *«`L5` y `L7` nacen en `DRAFT`»*
  (S-01, S-02). La prueba activa de las cinco no la escribe la migración estructural: la escribe
  después el script del corte, con la función de la aplicación, y se verifica a mano (lote 2 D,
  S-12). Sale el gate de seudónimos compartidos (S-36); queda el de la lista de proveedores
  medida y cerrada antes del despliegue (S-35). *«Un dueño con más de una ficha a la vista no se
  diseña»* pasa a ser premisa (`DEC-MIG-007`, punto 3; S-08). Su 📌 del 2026-09-29 sale entero:
  no hay recuentos en el paso 0, y el 4c corre siempre, sobre las fichas borradas que el viejo
  servía, las tres colecciones y los 22 destinos (S-28). Las dos cuentas de cortesía siguen
  recibiendo la prueba y el grant del 3b (S-13).
- 📌 **Precisada otra vez el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letras B y
  D; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 B y D)**: Las cinco pruebas gratis y sus seudónimos que el 📌 anterior pone en
  *«el script del corte, con la función de la aplicación»* **los escribe la herramienta del corte
  de `V6`**, que es del sistema nuevo, como ya pasa con los regalos de cortesía; el script suelto
  del corte sigue sin importar código de ningún sistema (B). Y antes de borrar las filas de las
  fichas que no son de las cinco, **la migración copia a una tabla de paso el id de cada una, las
  rutas de sus fotos y su token de calendario**; el 5b la recorre y la borra al terminar (D; ver el
  📌 de `DEC-MIG-003`). Origen: (FASE 5, lote de la aplicación, owner 2026-09-30, B y D).

---

### DEC-MIG-007 — Las premisas del corte: reemplazo sin convivencia, cinco cuentas que importan y el resto a cargo del owner, por privado

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: al abrir la FASE 5, las preguntas del lote 1 volvían a traer casos del corte (un
  usuario que entra mientras se corta, un dueño con varias fichas, fichas que no son de clientes)
  que el owner considera fuera de alcance. Sin fijarlo por escrito, cada tanda los vuelve a abrir.
- **Decisión** (palabras del owner, 2026-09-30, al empezar el lote 1 de la FASE 5):
  1. **No conviven las dos versiones.** La vieja se va y entra la nueva; no hay período de
     convivencia que diseñar.
  2. **Un usuario que entre durante el corte no se diseña.** Es casi imposible; si pasa, se ve
     sobre la marcha. Alternativa del owner: antes del corte se bloquea que nadie, nuevo o
     existente, pueda hacer nada.
  3. **Sólo importan cinco cuentas**: las tres que están en prueba o ya pagan y las dos de
     cortesía. De ellas se conserva la información de sus fichas. **Cada una tiene una sola ficha**:
     no se diseña nada para más de una ficha por cuenta después del corte. El resto de las cuentas
     no importa.
  4. **A esas cinco les avisa el owner, por privado**: que después del corte arrancan de cero, con
     la prueba recién iniciada, y que al terminar la prueba se tienen que volver a suscribir. **No se
     programa nada para eso**: ni correos, ni avisos, ni flujos de continuidad.
- **Implicaciones**:
  1. Toda pregunta, hallazgo o mecanismo sobre convivencia, sobre usuarios activos durante el corte,
     sobre varias fichas por cuenta, sobre cuentas fuera de esas cinco o sobre comunicar el corte se
     descarta citando esta decisión, sin volver al owner.
  2. Las decisiones y capítulos del corte que diseñan para esos casos quedan por revisar a la luz de
     ésta. No se marcan `SUPERSEDED` sueltas: cada una se revisa con el owner y se precisa o se
     supera con su motivo.
- **Origen**: owner, 2026-09-30, antes de contestar el lote 1 de la FASE 5 (`38-fase-5/00-consolidado.md`).

---

### DEC-DATA-006 — La pausa pedida por el dueño detiene el reloj de retención de sus fichas

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 12, F-A y H-E; ver su 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote M-H y `VC-VT-05`; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, C14, `L1-c`): C14 decide que la pausa pedida por el dueño
  detiene el reloj de retención de sus fichas y que al volver se reinicia. Faltaba cómo se entera
  verticales, que no lee el estado de billing (`L1-c`).
- **Decisión**: la pausa pedida por el dueño detiene el reloj de retención de sus fichas en esa
  vertical: mientras dure no se archivan, no se borran y no reciben avisos de retención; al volver,
  el reloj se reinicia (hecho 2). Cruza como una pregunta de ida del contrato,
  `retenciónDetenida(user, vertical)`, que contesta billing (sí sólo con una `PAUSED` por
  `CUSTOMER_REQUEST`) y que leen SÓLO `PB4`, `PB5`, `PB9` y los avisos de retención, al ejecutar. No
  va en `fuentes` ni en `cubierto`. Salen `D16` y `G-R5`.
- **Reemplaza a**: `DEC-DATA-002`, EN PARTE, en lo que decía de que el reloj corre durante la pausa
  y en la desigualdad que la protegía (ver su *Estado*).
- **Dónde**: `30-revision-del-owner/12-aplicacion-verticales-y-contrato.md` §1 (C14).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C14, `L1-c`); propuesta en
  `30-revision-del-owner/12-…` §3 punto 3 y consolidada en `30-revision-del-owner/14-…` §4.1 punto
  2; OK del owner al lote del log, 2026-09-28 (`30-revision-del-owner/10-…`, *«El lote del log y la
  matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 12, F-A y
  H-E)**: Todo fin de la pausa, por cualquier camino, reinicia el reloj, también una baja desde la
  pausa. Ese reinicio no se escribe: `retenciónDetenida` devuelve también cuándo terminó la última
  pausa por `CUSTOMER_REQUEST` de la persona en esa vertical, y sus lectores cuentan desde el más
  tardío de dos instantes, `listing.inactiva_desde` y ése, con la versión de plazos que guarda la
  ficha (`listing.plazos_version`), porque el reinicio no escribe otra. La lista de hechos del reloj
  y `G-R6-B` no cambian. Una pausa vencida cuya reanudación no se aplicó la pone delante de una
  persona el barrido diario, con el motivo `REANUDACIÓN_NO_APLICADA`, que ya existía.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote M-H y `VC-VT-05`)**: Los
  avisos previos de retención cuentan desde el más tardío de los dos instantes, con la versión de
  plazos de la ficha, y apuntan al día en que actuaría su lector; la fecha objetivo de su ocurrencia
  sale de esa cuenta. Y la mitad (d) de `G-R6-B` falla también sobre un lector de retención que
  consulta `retenciónDetenida` y no cuenta desde el más tardío de los dos instantes.

---

### DEC-DATA-007 — La moderación tiene dos niveles: pedir un arreglo o bajar la ficha

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 13, 14, 15 y H-G; ver su 📌) · **Decide**: owner
- **Problema** (revisión del owner, C10, `L2-i`, `g3`): C10 decide la moderación en dos niveles, a
  elección del admin y cambiable. Faltaba a dónde vuelve la ficha al levantar la baja (`L2-i`) y qué
  puede hacer el dueño con una ficha moderada (`g3`).
- **Decisión**: moderación en dos niveles, a elección del admin y cambiable en las dos direcciones:
  pedir un arreglo sin bajar la ficha (una marca, `pedido_de_arreglo`, no un estado) o bajarla
  (`MODERATED`). Al levantar la baja, o al pasarla a sólo pedido, la ficha vuelve a donde estaba:
  `DRAFT` si era borrador (`PB11`), y si estaba publicada o bajada por billing,
  `UNPUBLISHED_BY_BILLING` con `PB3` en el mismo acto (`PB13`). Sobre una `MODERATED` el dueño puede
  verla, exportarla, editarla y borrarla (`PB12`, con correo de confirmación), no publicarla. Avisos
  al pedir, al cambiar de nivel y al levantar; listado de arreglos pendientes en el panel. Sigue
  siendo una acción administrativa con un permiso.
- **Reemplaza a**: en parte, lo que `F-8CA2-004` (FASE 8 completa) creó como `PB10`/`PB11`, que no
  tiene `DEC` propio.
- **Dónde**: `30-revision-del-owner/12-aplicacion-verticales-y-contrato.md` §1 (C10).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C10, `L2-i`, `g3`); propuesta en
  `30-revision-del-owner/12-…` §3 punto 5 y consolidada en `30-revision-del-owner/14-…` §4.1 punto
  3; OK del owner al lote del log, 2026-09-28 (`30-revision-del-owner/10-…`, *«El lote del log y la
  matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 13, 14, 15
  y H-G)**: Una ficha moderada desde `ARCHIVED` vuelve por el origen de su archivado. Los dos
  niveles valen sólo para fichas: la presencia de Partner conserva su bit sin niveles. Y el correo
  de confirmación del borrado sale en todo `PB12`, no sólo sobre una moderada; cuando la borra
  soporte a pedido del dueño es el mismo correo, con una línea que dice que fue a su pedido, sin
  fila nueva en el catálogo.

---

### DEC-SUB-023 — Migrar a los clientes de un plan retirado es un tercer camino, aparte del upgrade y del downgrade

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 20 a 27, G-A, I-A e I-B; ver su 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes M-A, M-B, M-C y N-E; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, C15, `L1-g`, `L1-h`, C9): C15 decide migrar a los clientes de un
  plan retirado a un plan vivo de la misma vertical, con aviso de 60 días configurable, en la
  renovación; `B/10` §3.4 decía lo contrario. Faltaban el anual (`L1-g`) y cancelar una migración ya
  anunciada (`L1-h`); con C9, el aviso es un plazo configurable.
- **Decisión**: migrar a los clientes de un plan retirado a una versión vigente y vendible de la
  misma vertical es un acto aparte del `SUPER_ADMIN` (la acción administrativa 17), con aviso previo
  de 60 días por defecto, configurable como el plazo 12 de `NUCLEO/02` §1.5 y nunca menor que el
  mínimo de `DEC-MP-002`, y tres correos (al anunciar, a 30 y a 7 días de la fecha de cada cliente).
  La migración guarda la versión de plazos con que se anunció. Se aplica a cada cliente en su
  renovación, la primera posterior a cumplirse el aviso, también en el anual. Si el destino ofrece
  su ciclo, `S37` muta el monto sobre la misma autorización siete días antes, sin re-autorizar, y el
  cambio de versión entra en la renovación por la cola de `B/12` §2; si no lo ofrece, queda para
  resolver a mano. El excedente tiene la fecha de aplicación; pausados y en grace esperan a volver;
  quien cambia de plan o se da de baja durante el aviso sale; el `SUPER_ADMIN` puede cancelar la
  migración para los que no se aplicaron, con el correo "ya no cambia nada". No es el upgrade de
  `DEC-SUB-007` ni el downgrade de `DEC-SUB-008`: es un tercer camino.
- **Reemplaza a**: ninguna. Toca `DEC-SUB-007`, `DEC-SUB-008` y `DEC-MP-002` (ver sus 📌).
- **Dónde**: `30-revision-del-owner/13-aplicacion-cobro.md` §1 (C15, `L1-g`, `L1-h`) y
  `30-revision-del-owner/14-aplicacion-transversal-y-lote.md` §1 (C9).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C15, `L1-g`, `L1-h`, C9);
  propuesta en `30-revision-del-owner/13-…` §3 punto 2, con el agregado de la tanda 4, y consolidada
  en `30-revision-del-owner/14-…` §4.1 punto 4; OK del owner al lote del log, 2026-09-28
  (`30-revision-del-owner/10-…`, *«El lote del log y la matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 20 a 27,
  G-A, I-A e I-B)**: `S37` muta el monto siete días antes de la fecha de aplicación, un plazo
  técnico y no configurable. Los correos van al anunciar y 30 y 7 días antes de la fecha de
  renovación de cada cliente. La migración sigue siendo la acción 17, aparte de publicar una versión
  de plan, y lo que aplica fila por fila (`S37` y `S38`) es una transición que aplica lo que la
  persona firmó al anunciar. Si la cohorte incluye la cuenta del propio `SUPER_ADMIN`, esa fila se
  excluye y el acto sigue. Cancelar no deshace una mutación ya hecha: a quien está dentro de sus
  siete días le sale un correo que lo explica. `PARA_RESOLVER` no tiene plazo, y el panel muestra su
  antigüedad. Una cortesía temporal vigente el día de la migración espera a volver. Y que pausados y
  en grace esperen es del día de `S37`: si `S37` ya mutó el monto, la fecha de aplicación la aplica
  `S38` igual en `GRACE_PERIOD`, y al volver por `S7` en `SUSPENDED`, vuelva a `ACTIVE` o a
  `CANCEL_SCHEDULED`. Un pagador con tarjeta suspendido vuelve como sucesora: el cambio de versión
  muere con la fila vieja, y su fila de alcance queda `APLICADA` sin que la predecesora haya
  cambiado de versión.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-A, M-B, M-C y N-E)**: Toda
  llegada de una suscripción a un estado terminal, por cualquier camino, también la muerte de la
  predecesora en una sucesión, pasa su fila de alcance `PENDIENTE` o `PARA_RESOLVER` a `FUERA` en la
  misma transacción, con un tercer motivo, "terminó"; los correos de la migración leen `PENDIENTE` y
  dejan de salir. La cohorte son las filas principales de la versión retirada en
  `PENDING_AUTHORIZATION`, `ACTIVE`, `GRACE_PERIOD`, `PAUSED` o `SUSPENDED`; `CANCEL_SCHEDULED` no
  entra, y las que no están `ACTIVE` esperan como una pausada. Sobre un pagador manual `S37` no relee
  ni muta: encola el cambio de versión para la fecha de aplicación y pasa la fila a `APLICADA`, y `S38`
  cambia la versión antes de que `MP5` abra la cuota de ese período. Entre `S37` y su `S38` el monto
  esperado es el precio de lista de la versión destino para su ciclo, sin promos, como en el
  downgrade, y el motivo 24 deriva el precio de la versión que rige el período que cubre el cobro. Un
  cliente `PARA_RESOLVER` recibe sólo el correo del anuncio, con un texto que le dice que lo van a
  contactar; su fila sale a `FUERA` con "cambió de plan" cuando una persona lo resuelve, o con
  "terminó" si su suscripción termina antes, y cancelar la migración la pasa a `CANCELADA`.

---

### DEC-TEST-003 — El Mercado Pago falso miente sólo lo medido, y una batería vigila al proveedor real

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 28, 31, 32, 33, 35 y G-C; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, puntos 3 y 4; ver su 📌 de las mediciones); **y precisada el 2026-09-30, con OK del owner** (FASES 6 y 7, lote de la aplicación, L y B: el recorte del checklist viejo sale y la regla de smoke la reapunta `U1`; ver su 📌 de las FASES 6 y 7) · **Decide**: owner
- **Problema** (revisión del owner, C13, `L3-c`, `L3-d`, N3, `L3-e`, N4, `L3-f`): C13 pide una lista
  cerrada de dónde miente el Mercado Pago falso y por qué, y una batería que vigile al proveedor
  real sin ajustar nada sola; N3 pide pruebas de punta a punta para reducir el smoke manual, y N4
  volver a consultar al proveedor ante cualquier aviso suyo.
- **Decisión**: el proveedor falso tiene dos listas cerradas: trece mentiras medidas, cada una con
  su fila de la matriz, su fecha, su cuenta y la prueba que demuestra que el código la resiste; y
  seis reglas propias del proveedor, que el falso cumple igual. Lo simulado sin medir va aparte. Por
  defecto el falso miente siempre y una prueba puede apagar una mentira nombrándola. Una batería
  repite cada medición semanal en la cuenta de pruebas, mensual en producción y a mano cuando se
  quiera, compara también la forma de las respuestas, avisa por correo y no ajusta nada; si no
  corre, avisa el vigía externo. El falso corre también como servidor HTTP, hay un reloj
  adelantable, y cada sección del checklist de smoke manual que tenga su prueba de punta a punta
  sale del manual; queda manual el checkout real, los correos del proveedor al cliente, Cloudflare y
  los horarios reales. Tres guards nuevos, de `B1`: `G15` (las dos listas), `G16` (vuelve `qzpay`) y
  `G17` (una decisión sin releer por id, también en las acciones administrativas).
- **Reemplaza a**: ninguna.
- **Dónde**: `30-revision-del-owner/13-aplicacion-cobro.md` §1 (C13, N3, N4).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C13, `L3-c`, `L3-d`, N3, `L3-e`,
  N4, `L3-f`); texto exacto de `30-revision-del-owner/13-…` §3 punto 5, consolidado en
  `30-revision-del-owner/14-…` §4.1 punto 5; OK del owner al lote del log, 2026-09-28
  (`30-revision-del-owner/10-…`, *«El lote del log y la matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 28, 31,
  32, 33, 35 y G-C)**: La segunda lista del falso lleva también el comportamiento medido que no es
  mentira ni regla exigida (`RC-7`, `GR-3`, `PS-2`, `PS-6` y el campo `last_charged` de `RC-5`): son
  once, no seis. La batería las relee sobre sujetos que ya existen, sin mutar, y las que no se
  puedan releer así se declaran "vigiladas a mano". El reloj adelantable vive en un package de
  pruebas compartido que importan las dos mitades. La regla de smoke del `CLAUDE.md` raíz se
  actualiza, en el mismo cambio, a medida que cada sección del checklist sale del manual. La
  autorización mensual de la batería en producción la custodia el owner y la renueva cada mes. Y
  cada lectura por id lleva su instante: la decisión rechaza una lectura anterior al comienzo del
  acto, que es el de la decisión sobre ese sujeto; va dentro del tipo, así que `G17` conserva sus
  dos predicados. Queda una ventana de milisegundos entre releer y actuar, porque Mercado Pago no
  ofrece compare-and-swap, y la cubre el barrido.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, puntos 3 y 4)**: La
  segunda lista del falso suma `RP12`, comportamiento medido: cambiar la tarjeta emite un `payment`
  de ARS 0 con `operation_type: card_validation`, por los dos canales y sin nombrar al preapproval
  (`EX-36`, `PA-3`), que el receptor tiene que ignorar; son doce. Y la mentira M6 suma como fuente
  `WH-6`: un mismo `payment` llega una vez por cada canal.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, lote de la aplicación, L y B;
  `39-fases-6-y-7/10-decisiones-del-owner.md`)**: **el recorte del checklist de smoke manual,
  *«cada sección… que tenga su prueba de punta a punta sale del manual»*, se retira por quedar sin
  sujeto**: el checklist viejo vive en `staging` y gobierna al sistema viejo hasta el corte, y `U1`
  borra `.qtm/` en la rama (L). **Y la regla de smoke del `CLAUDE.md` raíz ya no se actualiza sección
  por sección** (el 📌 del caso 32): **la reapunta `U1`, de una vez, al checklist del sistema nuevo
  que `B13` escribe en `docs/billing/`, en dos partes** (B; `DEC-ARCH-016`). Dónde:
  `B/20` §5.1 punto 4; `16-fase-7-del-paraguas.md` §4.6 y §4.7. Origen: (FASES 6 y 7, lote de la
  aplicación, owner 2026-09-30, L y B) (FASES 6 y 7, verificación, 2026-09-30, F4).

---

### DEC-ARCH-012 — El agrupamiento viejo de Gastronomía y Experiencia desaparece del repositorio, ni como histórico

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 8, 9, 19, 41, F-B, F-D, H-A, H-B, I-D, J-B y K-B; ver su 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes M-E y N-A, y `VC-VT-10`; ver su penúltimo 📌) — **y precisada el 2026-09-30, con OK del owner** (FASE 5, lote 1, letras C y H, y lotes 4 a 6, letra G: las migraciones de datos del seed del cobro viejo salen con `U1`, `G8` deja de perdonar `extras/` y la foto del paso 6 la genera Drizzle; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, C3, `L2-a` a `L2-d`): C3 decide que el agrupamiento viejo de
  Gastronomía y Experiencia desaparece por completo, ni como histórico, y que el guard falla en todo
  el repositorio. El §55.1 del PDR admite referencias para auditoría, historia de migraciones y
  datos legacy, y el PDR no se edita.
- **Decisión**: el agrupamiento viejo de Gastronomía y Experiencia desaparece por completo, ni como
  histórico: se deja la excepción del §55.1 del PDR (auditoría, historia de migraciones, datos
  legacy). `G8` falla si su nombre aparece, sin distinguir mayúsculas, en cualquier archivo
  versionado del repositorio, con una sola exención por nombre, el PDR, que no se edita (la causa va
  escrita en el guard). El día del corte, después del 5b, la historia de migraciones de la base se
  reemplaza por una foto de la base tal como queda, y en producción se anota como aplicada; lo mismo
  con las migraciones de datos del seed; ensayado antes en staging, con backup (`16-fase-7…` §4.2,
  paso 6, de V6). El rol de dueño de comercio, sus siete permisos, la tabla de contactos de alta y
  el tipo de partner que lo nombra entran en la limpieza como trabajo de verticales, con su
  migración de datos (de V1), y el tipo de partner se renombra a lo que es, con un nombre a definir
  con el owner. Los datos que lo nombren se reescriben o se borran. La presentación se reescribe
  como "el agrupamiento viejo de Gastronomía y Experiencia", y engram y las memorias se limpian a
  mano.
- **Apartamiento del PDR, declarado**: del §55.1, que dice *«Solo conservar referencias realmente
  necesarias para: auditoría; migration history; comprender datos legacy»*. Suma uno a los del `##
  Resumen`.
- **Reemplaza a**: ninguna.
- **Dónde**: `30-revision-del-owner/14-aplicacion-transversal-y-lote.md` §1 (C3).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C3, `L2-a` a `L2-d`); propuesta y
  consolidada en `30-revision-del-owner/14-…` §4.1 punto 6; OK del owner al lote del log, 2026-09-28
  (`30-revision-del-owner/10-…`, *«El lote del log y la matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 8, 9, 19,
  41, F-B, F-D, H-A, H-B, I-D, J-B y K-B)**: El tipo de partner se renombra a `business`, con la
  etiqueta "Comercio" en español sin cambios, y la migración de datos de V1 reescribe los que tienen
  el valor viejo. Hasta el cierre de HOS-1352 `G8` lleva una lista de pendientes cerrada con tres
  entradas: la historia de migraciones, las migraciones de datos del seed y las carpetas del
  programa en `.specs/` (HOS-1352, HOS-1353 y HOS-1354, y ninguna otra). El paso 6 del corte saca
  las dos historias y en el mismo commit enciende la regla que hace fallar un build destinado a
  producción con una de ellas en la lista, así que el despliegue del paso 3 no falla por ella; el
  commit del cierre de HOS-1352 saca la tercera y extiende la regla a la lista entera. Las 11
  migraciones de datos del seed que importaban el archivo de configuración de planes se congelan con
  sus valores adentro hasta que el paso 6 las saca. El script del corte arma el valor viejo sin
  escribir la palabra de corrido, como el propio `G8`, y no entra a la lista. El `CLAUDE.md` raíz y
  los archivos de i18n que la nombran entran en la limpieza de V1, y también las specs de otros
  issues y `.qtm/`, según el estado de su issue en Linear el día de la limpieza, con la regla del
  owner, "specs viejas e implementadas, las borramos directamente": se borra entera la carpeta de un
  issue `Done`, `In Review` (su código ya está mergeado; el smoke que falta vive en el issue) o
  `Canceled`, la de un issue que ya no existe y todas las de `.qtm/`; se reescribe sin la palabra
  sólo la de un issue en `In Progress` o `Backlog`; y un estado que no se nombra sigue el tipo que
  Linear le da: uno terminado, cancelado o duplicado (`Duplicate`) se borra, y uno en curso, sin
  empezar o backlog (`Todo`, `Working on`, `User Action Pending`, `On Hold`) se reescribe, con `In
  Review` como única excepción. Y al cerrar HOS-1352 los informes históricos del programa salen del
  repositorio (quedan en el historial de git; lo que importe se resume en Linear), el diseño vigente
  se reescribe una vez, sin tachados ni la palabra, y este log y la matriz de validación se quedan y
  se reescriben sin la palabra, con el OK del owner a esa reescritura.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes M-E y N-A, y `VC-VT-10`)**: El
  código del sistema viejo que nombra el agrupamiento viejo (unos 1229 archivos versionados y 326
  rutas con la palabra en el nombre el 2026-09-29, sobre `origin/staging`) sale entero de la rama al
  principio de la épica, en la limpieza del principio, que lo renombra o lo borra junto con el cobro
  viejo (`16-fase-7…` §4.6, `DEC-ARCH-014`). `G8` corre sobre todo el repositorio desde que nace,
  sin lista de pendientes de código: su lista sigue siendo sus tres carpetas, la historia de
  migraciones y las migraciones de datos del seed hasta el paso 6 y las carpetas del programa hasta
  el cierre de HOS-1352, y ninguna más. El trinquete de archivos que el lote M-E le había sumado el
  mismo día salió con el lote N-A, antes de llegar al código. Y la migración de datos de la limpieza
  reescribe a `business` el valor viejo en toda columna que guarde un valor del tipo de partner,
  también `alliance_leads.partner_type`.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 1, letras C y H, y lotes 4 a 6,
  letra G; `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-03`, `R5-08` y `R5-28`)**: Las
  migraciones de datos del seed que usan el cobro viejo (unas cincuenta, no las once que se
  congelaban) **no se congelan hasta el paso 6: las saca de la rama `U1`**, adelantando para ellas
  lo que el paso 6 iba a hacer. La condición que el owner puso, leer antes el runner, se cumplió
  el mismo día: el runner ignora sin error las filas del registro sin archivo y `--baseline-stamp`
  sólo sella lo que está en disco (C). La lista de pendientes de `G8` **deja de cubrir `extras/`**,
  así un extra nuevo con la palabra falla desde el primer día, y `U1` reescribe los extras `032`
  (nombre y comentarios) y `033` (comentario) (H). Y la foto del paso 6 no se genera de la base de
  producción: la genera Drizzle desde el esquema del repositorio y se compara con la base cortada
  (G, `BD-025`).

---

### DEC-ARCH-013 — La configuración de planes vive 100 % en la base, y cambia sólo por acciones administrativas

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 9, 42, 43 y 49; ver su 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lote C: la migración única del catálogo corre dentro de la migración estructural del paso 3; ver su penúltimo 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote 1 C, lote 2 C y D, y lote 3 D: el catálogo como SQL generado, las bases armadas con `db:migrate` y los plazos antes del merge de `V6`; ver su último 📌); **y precisada una vez más el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letras E y B: la tabla de claves viaja como SQL generado y vigilado por el mismo control, que cuenta como guard, 33 → 34, y las pruebas las escribe la herramienta del corte de `V6`; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, N1, `L1-e`, `L1-f`): N1 decide que el archivo de configuración
  de planes de hoy desaparece y que toda la configuración de planes vive en la base. Faltaban cómo
  nace el catálogo de producción (`L1-e`) y cómo cambia después (`L1-f`).
- **Decisión**: la configuración de planes vive 100 % en la base. El archivo de configuración de
  planes de hoy (`packages/billing/src/config/`, 11 archivos y 3378 líneas) se borra entero, con lo
  que lo lee sólo para eso, y no queda archivo de valores ni como punto de partida del seed. El
  catálogo de producción nace el día del corte con una migración de datos única, que corre una vez
  en el paso 3a y nunca más es fuente de nada. Después, los valores sólo cambian por cinco acciones
  administrativas nuevas, de la 18 a la 22, sólo `SUPER_ADMIN`, auditadas y con una confirmación que
  dice qué cambia: publicar una versión de plan, fijar el precio de un ciclo, publicar una versión
  de complemento, crear o cerrar un código promocional y cambiar un plazo. Lo que antes miraban
  guards de CI sobre la configuración lo rechaza el panel o la base: la segunda dirección de `G3` es
  una FK a la tabla de claves; `G-R3` es una validación de publicar una versión de plan, con su
  nombre; el `rank` único por vertical y una sola versión vigente por plan son restricciones de la
  base que el panel chequea antes; los días de prueba no pasan de 0 a más ni al revés; la gracia es
  menor que el ciclo más corto. Las mismas validaciones corren en el paso 3a sobre la base de
  producción. El catálogo de claves sigue en código. El editor del catálogo lo construyen V8 (planes
  y claves) y B13 (precios, complementos y promos).
- **Reemplaza a**: ninguna. Toca `DEC-SUB-002`, `DEC-TRIAL-003`, `DEC-TRIAL-006`, `DEC-TEST-001` y
  `DEC-RF-008` (ver sus 📌).
- **Dónde**: `30-revision-del-owner/14-aplicacion-transversal-y-lote.md` §1 (N1).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (N1, `L1-e`, `L1-f`); propuesta y
  consolidada en `30-revision-del-owner/14-…` §4.1 punto 7; OK del owner al lote del log, 2026-09-28
  (`30-revision-del-owner/10-…`, *«El lote del log y la matriz»*). Que el catálogo de claves siga en
  código lo aplicó la tanda como el diseño ya decía (`NUCLEO/02` §1.2), y el owner no lo decidió
  explícitamente (`30-revision-del-owner/14-…` §3, punto 49).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 9, 42, 43
  y 49)**: Las 11 migraciones de datos del seed que importaban el archivo borrado se congelan con
  sus valores adentro, en el mismo cambio que lo borra, y salen en el paso 6 del corte. Los datos de
  planes que usan desarrollo y las pruebas son datos de demostración, fuera del dual-write: en el
  mismo cambio salen la rama del archivo en `scripts/check-seed-dual-write.sh` y la mención a los
  planes de billing en la regla del `CLAUDE.md` raíz. La migración única del catálogo falla si
  alguno de los cinco plazos sin valor escrito está vacío, y el owner los fija antes del ensayo del
  corte en staging. Y las claves, de los entitlements y de los límites, siguen en el código; los
  valores viven en la base.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lote C)**: La migración de datos
  única del catálogo corre dentro de la migración estructural del paso 3 del corte, antes de la
  escritura `C` y de la prueba del corte, que la leen; el paso 3a sólo la verifica. Si falla a la
  mitad, el corte entra en la rama de aborto.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 1 C, lote 2 C y D, y lote 3 D;
  `38-fase-5/10-decisiones-del-owner.md`, racimos `R5-03`, `R5-12`, `R5-13` y `R5-19`)**: El
  catálogo va en la migración como **SQL generado por un script TypeScript** y vigilado por un
  guard que lo regenera y compara; las pruebas y los seudónimos de las cinco cuentas los escribe
  después el script del corte, con la función de la aplicación, y se verifican a mano: se resigna
  que sea todo una sola operación atómica (lote 2 D; ver el 📌 de `DEC-MIG-006`). Las bases de
  desarrollo, de tests de integración y del e2e nocturno se arman con `db:migrate`, como `e2e-pr`,
  así que las filas de referencia tienen una sola fuente (lote 2 C). Las once migraciones de datos
  del seed que importaban el archivo borrado ya no se congelan hasta el paso 6: las saca de la rama
  `U1` (lote 1 C; ver el 📌 de `DEC-ARCH-012`). Y los cinco plazos sin valor escrito los fija el
  owner **antes del merge de `V6`**, no antes del ensayo del corte, porque la migración que falla si
  alguno está vacío corre en cada revisión automática desde que se mergea (lote 3 D; ver el 📌 de
  `DEC-DATA-008`).
- 📌 **Precisada una vez más el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letras
  E y B; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 E y B)**: **La tabla de claves de `V1` viaja como SQL generado y vigilado,
  con el mismo mecanismo y el mismo control que el catálogo** del 📌 anterior: un script
  TypeScript genera el SQL desde el catálogo de claves del código, se commitea, y el control que
  regenera y compara cubre las dos cargas. Llega antes que el catálogo, con `V1`: sin ella, una
  clave nueva del código no está en la tabla y el panel no la puede asignar a ningún plan. **Ese
  control cuenta como guard: los guards pasan de 33 a 34** (E; ver el 📌 de `DEC-TEST-001`). Y las
  pruebas y los seudónimos de las cinco cuentas que el 📌 anterior pone en *«el script del corte,
  con la función de la aplicación»* **los escribe la herramienta del corte de `V6`**; el script
  suelto sigue sin importar código de ningún sistema (B; ver el 📌 de `DEC-MIG-006`). Origen:
  (FASE 5, lote de la aplicación, owner 2026-09-30, E y B).

---

### DEC-DATA-008 — Todo plazo que decide cuándo pasa algo es configurable, y cada reloj cuenta con la versión con que arrancó

- **Fecha**: 2026-09-28 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (revisión del owner, casos vecinos, casos 43, 44, 45, 46, 47, 50 y H-F; ver su 📌) — **y precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, M-2 y lote L-B; ver su último 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote N-H; ver su último 📌); **y precisada el 2026-09-30, con OK del owner** (FASE 9 vuelta 3, lotes K y R: la lista cerrada pasa a dieciocho plazos, con los valores de los tres nuevos; ver su penúltimo 📌); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, lote 3, letra D: los cinco sin valor se fijan antes del merge de `V6`; ver su ~~último~~ penúltimo 📌); **y precisada otra vez el 2026-10-01, con OK del owner** (corte del MVP, BD: la tabla de plazos de verticales, su versión 1 y la acción 22 los crea `V6`; ver su ~~último~~ penúltimo 📌); **y precisada otra vez el 2026-10-02, con OK del owner** (corte del MVP, BU y BV: la ventana del resumen de conciliación es el plazo 19 y la fecha límite de la Fase 1 sale de los plazos 1 y 4; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, C9, C11, `L2-g`, `L2-h`, N7): C9 y C11 deciden que todo plazo en
  días o meses es configurable desde el panel por el `SUPER_ADMIN`, que el panel rechaza valores
  contradictorios y que un cambio no adelanta fechas ya anunciadas. Faltaban si algún plazo técnico
  también (`L2-g`) y cómo un reloj no adelanta una fecha ya avisada (`L2-h`).
- **Decisión**: todo plazo en días o meses que decide cuándo pasa algo lo configura el `SUPER_ADMIN`
  desde el panel, con la acción "cambiar un plazo" (la 22); los números del diseño son valores
  iniciales. La lista es cerrada, quince plazos repartidos entre las dos mitades (`NUCLEO/02` §1.5).
  Ningún plazo técnico es configurable (los 15 minutos del caché, las 26 horas del vigía, los 3 días
  de reintento de una mutación, las esperas del corte, los 7 días de `S37`), ni los que fijan
  Mercado Pago o la ley; los días de prueba, la gracia y la pausa son del catálogo y cambian
  publicando una versión de plan. Cambiar un plazo publica una versión nueva de los plazos de su
  mitad, que queda registrada; cada reloj guarda la versión con la que arrancó y cuenta con esa, así
  que un cambio nunca adelanta una fecha ya anunciada. El panel rechaza lo que se contradice:
  archivar antes que borrar; el `N` de `PB5`, en su peor caso en días, menor que el plazo de borrado
  (lo que era `G-R5-B`, que pasa a validación con su nombre); cada aviso antes del hecho que
  anuncia; el aviso de un aumento o de una migración nunca menor que el mínimo de `DEC-MP-002`. El
  archivado escribe la fecha de borrado que anuncia y `PB9` no borra antes de esa fecha: se cierra
  el espacio entre archivado y borrado que estaba declarado abierto (`K-5`, `B-2`, `B-3`).
- **Reemplaza a**: la cota de 6 meses literales de `G-R5-B` que el owner fijó el 2026-09-25 (FASE 8
  completa), sin `DEC` propio. Toca `DEC-DATA-001`, `DEC-DATA-002`, `DEC-TRIAL-007`, `DEC-SUB-016` y
  `DEC-MP-002` (ver sus 📌).
- **Sin decidir**: si configurar el 90 y el 180, que el §25 del PDR fija, es un apartamiento; se
  recomienda declararlo (`30-revision-del-owner/14-…` §3, punto 46) y lo decide el owner. Hasta
  entonces no se suma al `## Resumen`.
- **Dónde**: `30-revision-del-owner/14-aplicacion-transversal-y-lote.md` §1 (C9, C11).
- **Origen**: `30-revision-del-owner/10-decisiones-del-owner.md` (C9, C11, `L2-g`, `L2-h`, N7);
  propuesta y consolidada en `30-revision-del-owner/14-…` §4.1 punto 8; OK del owner al lote del
  log, 2026-09-28 (`30-revision-del-owner/10-…`, *«El lote del log y la matriz»*).
- 📌 **Precisada el 2026-09-29, con OK del owner (revisión del owner, casos vecinos, casos 43, 44,
  45, 46, 47, 50 y H-F)**: Configurar el 90 y el 180, que el §25 del PDR fija, es un apartamiento
  declarado del PDR, el décimo; el PDR no se edita. Los cinco plazos sin valor escrito (el `N` de
  `PB5`, los avisos previos de retención, el techo de días de prueba, la postulación de Partner
  atrasada y la espera tras un rechazo) los fija el owner antes del ensayo del corte en staging, y
  la migración única del catálogo falla si alguno está vacío. El mínimo de `DEC-MP-002` queda en 60
  días: se puede alargar, no acortar. Alargar un plazo tampoco alcanza a los relojes ya arrancados:
  cada uno cuenta con su versión. Los plazos de las dos mitades van en una sola pantalla, compuesta
  en la app del panel, que lee las dos mitades por la API sin importar ninguna, así que `G14` no la
  marca. Y la cota de `G-R5-B` queda atada al plazo de borrado, no a 6 meses literales.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, M-2 y lote L-B)**: Los
  180 días que se guarda una entrega de aviso, por cualquiera de los dos canales (`DEC-MP-009`,
  `B/02` §2.7) son un plazo técnico más, no configurable, como los que esta decisión nombra.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-H)**: La versión 1 de los
  plazos de cada mitad, con los quince valores, la crea la migración estructural del paso 3 del
  corte, antes que la escritura `C` y la prueba del corte, que la guardan, y el paso 3a sólo la
  verifica. La migración falla si alguno está vacío, y el owner fija los cinco sin valor escrito
  antes del ensayo del corte en `staging`.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 9 vuelta 3, lotes K y R)**: La lista cerrada
  pasa de quince a dieciocho plazos: la ventana de relectura de la cancelación por rechazo (plazo
  16), el escalamiento de una marca abierta (plazo 17) y la ventana de las comprobaciones de pagos
  acreditados y de órdenes pagadas (plazo 18), los tres de billing. Sus valores los fijó el owner
  (lote R): el 16, 7 días; el 17, 7 días; el 18, 180 días. La versión 1 de los plazos que crea el
  paso 3 lleva los dieciocho, y los otros cinco sin valor escrito los sigue fijando el owner antes
  del ensayo del corte en `staging`.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lote 3, letra D;
  `38-fase-5/10-decisiones-del-owner.md`, racimo `R5-19`)**: Los cinco plazos sin valor escrito los
  fija el owner **antes del merge de `V6`**, y no antes del ensayo del corte en `staging`, como
  decían los 📌 anteriores: la
  migración que falla si alguno está vacío corre en cada revisión automática (`e2e-pr` corre
  `db:migrate`) desde que se mergea, no recién en el ensayo.
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (corte del MVP, BD, la 1)**: la tabla
  versionada de los plazos de verticales, su versión 1 con sus valores y la acción 22, *«cambiar un
  plazo»*, sobre sus claves, **los crea `V6` al corte, en la misma migración que la escritura `C`**,
  junto con la versión guardada en la ficha (`plazos_version` y `borrado_anunciado`); `V9b` sólo los
  lee. Estaban en la fila de `V9`, que con Z dejó de ser pieza, y ninguna de sus mitades los nombraba,
  aunque la escritura `C` y la prueba del corte ya leían la versión 1. La mitad de billing no cambia
  (`B2`). Dónde: `V/descomposicion.md` §2 (fila de `V6` y de `V9b`), §2.11 y §4;
  `16-fase-7-del-paraguas.md` §4.6; `41-corte-del-mvp/10-decisiones-del-owner.md`, BD.
- 📌 **Precisada otra vez el 2026-10-02, con OK del owner (corte del MVP, BU y BV, las dos la 1)**:
  **BU**: la ventana `N` del resumen de conciliación de `DEC-OBS-001` (*«`N` es configuración
  (§9)»*) es **una clave más de la lista cerrada, la 19, en la tabla versionada de plazos de billing
  de `B2`**, que cambia la acción 22; su valor inicial lo fija el owner antes del merge de `B11`.
  **BV**: **la fecha límite de la Fase 1 (`V9b`) es el instante del corte más el plazo 1 menos el
  plazo 4, con la versión 1 de los plazos**; la Fase 1 se mergea a producción antes de esa fecha y
  su gate la verifica contra ese número. Como cada reloj guarda la versión con que arrancó, un
  cambio de plazo posterior no la adelanta. Dónde: `NUCLEO/02` §1.5; `B/descomposicion.md` §2 y §4
  (filas de `B2` y `B11`); `16-fase-7-del-paraguas.md` §4.7, *«Las fases posteriores»*;
  `41-corte-del-mvp/10-decisiones-del-owner.md`, BU y BV.

---

### DEC-MP-009 — El canal IPN se escucha y se guarda, sin actuar

- **Fecha**: 2026-09-29 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (mediciones del 2026-09-29, lote L-B: se guarda también Webhooks y la tabla cambia de nombre; ver su 📌) — **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lotes N-D y O-B; ver su último 📌) · **Decide**: owner
- **Problema** (revisión del owner, N9 y `L3-g`): el proveedor avisa por dos canales, Webhooks e
  IPN, y el receptor de hoy descarta IPN en silencio (HOS-159). `L3-g` pidió medir antes de decidir
  qué hace el receptor nuevo con IPN; los casos 39 y G-D dejaron una salida para si `WH-6` no se
  llegaba a medir.
- **Contexto medido**: `WH-6` (2026-09-29, sandbox con los dos canales escuchando, y producción por
  sus logs): IPN entrega sólo `payment` (12 de 12 en sandbox, 8 de 8 en producción), cada pago llega
  una vez por canal, IPN no trae `version` (`EX-2`) ni se verifica con la clave de la aplicación
  (`EX-13`), y ningún hecho de suscripción llega por IPN. `RF-7` vio una vez en producción un
  `merchant_order` por IPN tras un reembolso. `WH-5` y `EX-15` se cerraron con los dos canales.
- **Alternativas**: (1) apagar IPN en el panel el día del corte y descartarlo en el receptor; (2)
  escucharlo y guardarlo sin actuar; (3) procesarlo como a Webhooks.
- **Decisión**: (2), a propuesta del owner. El receptor nuevo guarda cada entrega de IPN entera en
  `ipn_delivery` (`B/02` §2.7), una tabla sólo de altas que ninguna decisión lee y que `G17` nombra,
  con una retención técnica, no configurable, de 180 días; procesa sólo la entrega `payment` de
  Webhooks. El panel de la aplicación de producción queda con IPN activo, y en el corte su URL se
  apunta al receptor nuevo. Tres meses después del corte se revisa lo guardado de IPN contra lo
  recibido por Webhooks, y con ese dato se decide si se apaga
  ([HOS-1399](https://linear.app/hospeda-beta/issue/HOS-1399)).
- **Motivo**: el owner: *«lo escuchamos y lo guardamos, pero sin hacer nada más; en el futuro
  podemos revisar esa data y ver si realmente no nos sirve de nada, o nos estamos perdiendo de
  algo»*. **Contra la recomendación**, que era la (1).
- **Implicaciones**: (1) `G17` suma un tercer predicado, *«algo lee `ipn_delivery`»* (`B/20` §2);
  (2) el requisito de `L3-g` (ningún efecto doble) se prueba con el duplicado de Webhooks y la copia
  de IPN en el mismo segundo (`B/06`, «NO cierra»); (3) `EX-13` no se mide para IPN (M-3); (4) qué
  se guarda de Webhooks para poder comparar en HOS-1399 lo decidió el owner en el lote L, letra B
  (`30-revision-del-owner/27-…`; ver su 📌).
- **Reemplaza a**: la salida condicional de los casos 39 y G-D (`30-revision-del-owner/16-`, lote D
  letra J y lote G letra D), que no tenía `DEC` propio.
- **Origen**: `30-revision-del-owner/27-decisiones-sobre-las-mediciones.md` (M-2); aplicada en
  `30-revision-del-owner/28-aplicacion-mediciones-al-diseno.md`.
- 📌 **Precisada el 2026-09-29, con OK del owner (mediciones del 2026-09-29, lote L-B)**: El receptor
  guarda también cada entrega de Webhooks, en la misma tabla, con su canal y los mismos 180 días,
  y tampoco la lee nadie: la procesa como siempre, desde la entrega y la relectura. Sin eso la
  revisión de HOS-1399 no puede contestar si Webhooks perdió algo, porque un `payment` nuestro no
  dice si lo trajo un aviso o el barrido, y los registros del servidor duran unos cuatro días. La
  tabla deja de ser sólo de IPN y cambia de nombre: `ipn_delivery` pasa a ser
  `provider_notification` (`B/02` §2.7), y el predicado (c) de `G17` la nombra así.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote N-D)**: El paso 4b del corte
  verifica el apuntado de la URL de IPN con una entrega real de `payment`: la herramienta del corte
  hace un pago chico con la tarjeta del owner, directo por la API de pagos del proveedor, mira que su
  entrega IPN quedó guardada en `provider_notification` y lo devuelve, con el reembolso releído por
  id. La sonda de Webhooks no lo verifica, porque IPN entrega sólo `payment`. La URL de IPN es la
  tercera cosa que la vuelta atrás deshace, y a la vuelta no se verifica: el viejo contesta las
  entregas IPN sin guardarlas, y no mueve plata.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lote O-B)**: La URL de IPN no
  se apunta en el corte. El receptor nuevo sirve la misma ruta que el viejo, con la marca de
  Webhooks en una URL y sin ella en la otra, así que los dos canales llegan donde ya llegaban; el
  4b sólo verifica, con el mismo pago chico. La tercera cosa de la vuelta atrás deja de ser la URL
  de IPN y pasa a ser ese pago: si quedó sin devolver, se devuelve y se relee por id.

---

### DEC-ARCH-014 — El sistema viejo sale entero de la rama al principio de la épica, antes de construir el nuevo

- **Fecha**: 2026-09-29 · **Estado**: ACCEPTED — **precisada el 2026-09-29, con OK del owner** (verificación corta, lotes O-A y O-B: la unidad que hace la limpieza y el corte sin URL que mover; ver su 📌); **y precisada otra vez el 2026-09-29, con OK del owner** (verificación corta, lote P: el Worker que cierra la ruta, el detector que ve lo perdido y el package del contrato que crea `U1`; ver su ~~antepenúltimo~~ 📌 del lote P); **y precisada el 2026-09-30, con OK del owner** (FASE 5, lotes 1 y 2: lo que suma `U1` y la unidad nueva del outbox, `U2`; ver su ~~penúltimo~~ 📌 de los lotes 1 y 2); **y precisada otra vez el 2026-09-30, con OK del owner** (FASE 5, simplificación del corte, lote C, con el OK del lote E: el 📌 del lote P pierde el Worker y el detector; ver su ~~último~~ ~~antepenúltimo~~ 📌 del lote C); **y precisada una vez más el 2026-09-30, con OK del owner** (FASE 5, lote de la aplicación, letras H y E: las seis columnas de pago de `partners` que borra `U1`, y los guards en 34; ver su ~~último~~ ~~penúltimo~~ 📌 de H y E); **y precisada otra vez el 2026-09-30, con OK del owner** (FASES 6 y 7, letra F, y K del lote de la aplicación: la unidad `U3`, el script del corte, las 25 unidades y su orden después de `U1`; ver su ~~último~~ 📌 de F) (FASES 6 y 7, verificación, 2026-09-30, F10); **y precisada otra vez el 2026-09-30, con OK del owner** (FASES 6 y 7, pase de la FASE 6, I: los tres guards sin destino entran a la lista de `U1`; ver su 📌 de I) (FASES 6 y 7, verificación, 2026-09-30, F12) · **Decide**: owner
- **Problema** (verificación corta, 2026-09-29, lote N-A): el código del sistema viejo, que corre en
  producción hasta el corte, dejaba rojos a `G8` (unos 1229 archivos que nombran el agrupamiento
  viejo) y a `G16` (cinco `package.json` que declaran `qzpay`), y ninguna unidad lo borraba. El lote
  M le había puesto dos parches, un trinquete de archivos en `G8` y `G16` acotado al package del
  cobro, y la tanda que lo aplicó preguntó quién borraba el sistema viejo después del corte
  (`30-revision-del-owner/33-` §3, D-1).
- **Alternativas**: (1) limpiar todo al principio de la épica; (2) borrar a medida que se avanza,
  con cada unidad que reescribe una parte. Las tres salidas de D-1 (dos unidades nuevas después del
  corte, un paso 7 del corte o el commit del paso 6) partían de que los dos sistemas convivían en la
  rama.
- **Decisión**: el owner, textual: "ya habíamos definido que no conviven nunca los 2 sistemas, así
  que esta pregunta no tiene sentido [...] tenemos que estar 100 % seguros de eliminarlo por
  completo y no dejar código basura". La primera unidad de trabajo del programa borra todo el cobro
  viejo (`qzpay` y sus cinco `package.json`, sus rutas, sus crons, su adaptador y lo que sólo el
  sistema viejo usa) y renombra o borra todo lo que nombra el agrupamiento viejo; recién después se
  construye lo nuevo. `G8` y `G16` miran todo el repo sin listas de pendientes de código. Mientras la
  app de la rama está rota, las dos mitades se construyen y se prueban contra los simuladores del
  contrato. Producción sigue con el sistema viejo, desde `main`, hasta el paso 3 del corte.
- **Motivo**: sin convivencia, el código viejo en la rama no le sirve a nadie, y cada parche para
  convivir con él (una lista que sólo se achica, un guard acotado) era mecanismo para un estado que
  no se quería.
- **Implicaciones**: (1) el trinquete de `G8` del lote M-E y el acotamiento de `G16` del lote M-D
  salen el mismo día, sin llegar al código; (2) las tres carpetas de la lista de `G8` siguen, las dos
  historias hasta el paso 6 y las carpetas del programa hasta el cierre de HOS-1352; (3) ninguna otra
  unidad arranca antes de que la limpieza esté mergeada en la rama del paraguas; (4) la rama compila
  aunque su comportamiento esté roto; (5) la migración que genera el borrado del esquema viejo saca
  de la base las tablas viejas de billing en el paso 3 del corte; (6) quedan para el owner qué unidad
  hace la limpieza y cómo se reordenan los pasos 3 y 4b del corte, porque la imagen del paso 3 ya no
  sirve la ruta de avisos del sistema viejo (`30-revision-del-owner/34-` §3).
- **Reemplaza a**: la salida de `30-revision-del-owner/33-` §3, D-1, que no tenía `DEC` propio.
- **Dónde**: `16-fase-7-del-paraguas.md` §4.6; `V/20` §2 (`G8`); `B/20` §2 (`G16`); las dos
  descomposiciones, §3.
- **Origen**: `30-revision-del-owner/32-decisiones-sobre-la-verificacion.md` (lote N, letra A);
  aplicada en `30-revision-del-owner/34-aplicacion-lote-n.md`.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes O-A y O-B)**: Las dos
  preguntas de la implicación (6) están contestadas. **O-A**: la limpieza la hace `U1`, una unidad
  propia del paraguas, antes de `V1` y de `B1`, que hace sólo la limpieza y construye `G8` en el
  mismo cambio; `G16` sigue en `B1`, porque su predicado (b) necesita el package del cobro. El
  programa pasa a 23 unidades y el reparto de guards a 17 de verticales, 15 de billing y 1 de `U1`,
  33 en total. `U1` no es de ninguna épica, así que las dependencias entre épicas siguen en once.
  **O-B**: el receptor nuevo sirve la misma ruta que el viejo, `/api/v1/webhooks/mercadopago`; el
  borde la cierra desde que se apaga el contenedor viejo hasta que las lápidas del paso 4 están
  verificadas, el proveedor recibe error y reintenta a la misma URL, y el 4b sólo verifica, la
  sonda de Webhooks y el pago chico de IPN (`DEC-MP-009`). `EX-46` queda sin sujeto. Qué código
  contesta el borde cerrado, para que el proveedor reintente, y qué pasa con lo que se pierda si el
  cierre pasa la escalera de reintentos quedaron para el owner
  (`30-revision-del-owner/35-aplicacion-lote-o.md` §3). Dónde: `16-fase-7-del-paraguas.md` §4.2 y
  §4.6; las dos descomposiciones, §2 a §4.
- 📌 **Precisada el 2026-09-29, con OK del owner (verificación corta, lotes P-A, P-B y P-C)**: Las
  dos preguntas que el 📌 anterior dejó para el owner están contestadas. **P-A**: la ruta de avisos
  no la cierra una regla de bloqueo, que contesta un `4xx` sin reintento medido, sino un Worker del
  borde que contesta `500`, el único código con reintento medido (`WH-4`), con una cabecera propia
  que lo distingue de un `500` de la aplicación; se prende antes de apagar el contenedor viejo, se
  apaga al final del paso 4, vive con el script del corte y lo deja listo el ensayo del paso 0
  (`DEC-MIG-003`). **P-B**: lo que se pierda durante el cierre lo lista el detector del día
  siguiente al corte, sin abrir marca ni asentar (`DEC-MIG-005`). **P-C**: `U1`, al terminar la
  limpieza, crea vacío el package del contrato; `V1` y `B1` arrancan en paralelo y cada una llena
  su parte (`DEC-ARCH-006`). Las dependencias entre épicas siguen en once y los guards en 33, con el
  mismo reparto: `G14` sigue en `V1`. Dónde: `16-fase-7-del-paraguas.md` §4.2 y §4.6; `B/21`, «NO
  cierra»; `B/09` §3; `12-contrato-de-cobertura.md` §7.1; las dos descomposiciones.
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, lotes 1 y 2;
  `38-fase-5/10-decisiones-del-owner.md`)**: **`U1` crece**, sin código nuevo del diseño salvo el
  package vacío del contrato. Saca los gates de entitlement y de limits de las rutas de las
  verticales y deja la cadena de permiso y propiedad que ya tienen; `V5` agrega el paso de
  cobertura y suma el criterio de salida *«ninguna ruta de escritura de vertical sin el paso de
  cobertura»* (lote 1 A). Renombra `billing_notification_log` a un nombre neutro, le saca la
  columna y la FK de cliente del cobro, y su índice pasa del extra `004` a uno propio (B). Saca de
  la rama las migraciones de datos del seed que usan el cobro viejo; la condición de la lectura
  del runner quedó cumplida el mismo día (C; ver el 📌 de `DEC-ARCH-012`). Borra las columnas de
  pago de `partners`, sus FK y los tres crons de partner (D; ver el 📌 de `DEC-ENT-006`). Borra,
  con sus lectores, `users.service_suspended`, `owner_promotions.plan_restricted` y
  `experiences.has_active_subscription`; el tipo de cambio, los patrocinios y las promociones del
  dueño quedan (E). Retira `is_featured` y `featured_by_entitlement` en las tres tablas: el
  destaque vuelve sólo como complemento pagado, y la home queda sin destacados hasta entonces (F).
  Borra `archive-abandoned-drafts` aunque no sea cobro (G). Reescribe los extras `032` (nombre y
  comentarios) y `033` (comentario) (H). Recrea los enums de la base sin los valores del cobro
  viejo, incluido el de permisos (unos 790 valores), con una migración de datos que saca las filas
  de roles y overrides con esos permisos (I, **contra la recomendación**). Borra las cuatro
  variables de rate limit del cobro y las diez que sólo usa el sistema viejo; las de Mercado Pago
  quedan para `B1`, salvo `STATEMENT_DESCRIPTOR`, que no queda (lote 2 E). Y crea el package del
  contrato con el nombre de `DEC-ARCH-015`, vacío, con `description` y `README`. **Y el programa
  pasa de 23 a 24 unidades**: una unidad nueva del paraguas, **`U2`, el outbox común**, que depende
  de `U1` y la necesitan antes `V6`, `V9`, `B4` y `B12`, las primeras que encolan (lote 2 A y B; ver
  el 📌 de `DEC-ARCH-005`). Como `U1`, no es de ninguna épica: no es una dependencia entre épicas.
  *(Recuento de los cruces de la aplicación de la FASE 5, 2026-09-30: las dependencias entre épicas
  son **doce**, no once como dicen los 📌 de O-A y P-C de esta decisión y el de `DEC-ARCH-006`; la
  duodécima, `V4` sobre `B1` por la interfaz del reloj, es de la FASE 9 vuelta 3, `F-8V3C1-006`.
  Recontadas con script sobre `B/descomposicion.md` §2.6: filas 1 a 7, 9 a 12 y 14. `U2` no suma.)*
- 📌 **Precisada el 2026-09-30, con OK del owner (FASE 5, simplificación del corte, lote C, con el
  OK del lote E; `38-fase-5/20-simplificacion-del-corte.md` §11, S-40, S-42 y S-45)**: El 📌 del
  lote P pierde el Worker del borde (P-A) y el detector del día siguiente al corte (P-B), y el de
  O-B, el cierre de la ruta de avisos hasta que las lápidas del paso 4 estén verificadas: el corte
  ya no escribe lápidas, y la ruta de avisos queda abierta durante todo el corte, como única
  excepción de la regla que bloquea toda escritura (lote B). El package del contrato que crea
  `U1` (P-C) sigue.
- 📌 **Precisada una vez más el 2026-09-30, con OK del owner (FASE 5, lote de la aplicación, letras
  H y E; `38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», y `38-fase-5/21-cruces.md` §5 H y E)**: En la lista de `U1`, *«borra las columnas de pago de
  `partners`»* son **las seis del cobro viejo**: `subscription_status`, `plan_id`,
  `subscription_id`, `unpaid_notice_sent_at`, `payment_review_state` y
  `payment_confirmed_through`; `starts_at` y `ends_at` quedan hasta la unidad de socios (H; ver el
  📌 de `DEC-ENT-006`). Y los guards que cuentan los 📌 de O-A y P-C, 33, pasan a **34**: el
  control que regenera y compara el SQL generado del catálogo y de la tabla de claves cuenta como
  guard (E; ver el 📌 de `DEC-TEST-001`, que deja abierto a qué unidad suma). Origen: (FASE 5, lote
  de la aplicación, owner 2026-09-30, H y E).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, letra F;
  `39-fases-6-y-7/10-decisiones-del-owner.md`)**: **el programa pasa de 24 a 25 unidades**. Una
  unidad nueva del paraguas, **`U3`, el script del corte**: los pasos 1a, 1b y 2 de
  `16-fase-7-del-paraguas.md` §4.2 (censo sin filtro tomado del proveedor, cancelación, relectura
  por id, completitud contra el `total` del paginado y manifiesto), que estaban descriptos y no los
  construía ninguna unidad. **Sin dependencias de código**: habla directo con la API del proveedor.
  **Lista cuando corre entera contra la cuenta de pruebas**, y **se mergea en la rama del paraguas
  antes del ensayo del corte**. *«La fecha del §2»* que su texto le ponía se lee como la de su
  diseño, que ya está escrito, y deja de frenar a `U1`. Como `U1` y `U2`, no es de ninguna épica:
  no le suma ninguna a las doce dependencias entre épicas, y no suma guards~~, que siguen en 34~~
  (el total pasa a 35 por `G19`, de `V5`: FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H; ver `DEC-METH-018`).
  **Entra después de `U1`, en paralelo con `V1`, `B1` y `U2`, y sólo tiene que estar mergeada
  antes del ensayo; `U1` sigue siendo el primer PR de la rama** (FASES 6 y 7, lote de la aplicación, owner 2026-09-30, K).
- 📌 **Precisada el 2026-09-30, con OK del owner (FASES 6 y 7, pase de la FASE 6, I;
  `39-fases-6-y-7/10-decisiones-del-owner.md`, «Lote del pase de la FASE 6»)**: **la lista de `U1`
  crece**: borra `check-product-domain-vocabulary.sh` y `check-product-domain-raw-sql.sh`, con sus
  scripts de `package.json`, su entrada en `check:guards` y su paso en `ci.yml`, y reescribe la
  cabecera y el mensaje de `check-no-binary-vertical-ternary.sh` sin la palabra vieja y sin los
  helpers que borra, sin tocar su patrón ni su alcance; **`V1` lo retira en el mismo PR en que entra
  `G1`**, con el caso de `HOS-1079` entre los que hacen fallar a `G1`. Los tres nombran la palabra
  vieja, así que sin esto `G8` no nace verde. Ninguno suma un guard del programa. Dónde:
  `16-fase-7-del-paraguas.md` §4.6, punto 4; `V/descomposicion.md` §2 y §4, `V1`; `V/20` §2, `G1`.
  Origen: (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, I) (FASES 6 y 7, verificación, 2026-09-30, F12).
  Ninguna unidad depende de ella; la necesitan el ensayo (paso 0) y los pasos 1a, 1b y 2. Y `U1`
  suma una cosa: **reapunta la regla de smoke del `CLAUDE.md` raíz** al checklist del sistema nuevo
  (letra B; ver `DEC-ARCH-016`). Dónde: `16-fase-7-del-paraguas.md` §2, §4.2 y §4.6; las dos
  descomposiciones, §3 y §4; `spec.md`. Origen: (FASES 6 y 7, owner 2026-09-30, F).

---

### DEC-ARCH-015 — El package del contrato se llama `@repo/billing-verticals-contract`

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: el package del contrato (`12-contrato-de-cobertura.md` §7.1; `DEC-ARCH-006`) lo
  crea vacío `U1` (lote P-C), así que su nombre tiene que estar fijo antes de construir `U1`, y la
  FASE 5 es quien lo fija (`DEC-METH-017`, implicaciones). El nombre tiene que decir, a quien lo lea
  dentro de un año, que es el acuerdo entre la mitad que cobra y la que publica, y no un pedazo de
  ninguna de las dos.
- **Alternativas**: `@repo/coverage-contract` (el owner la descartó: no se entiende qué es;
  *coverage* se lee también como cobertura de tests); `@repo/billing-contract` y
  `@repo/billing-boundary` (nombran un solo lado y parecen parte de billing);
  `@repo/vertical-billing-contract` (largo); `@repo/billing-verticals-bridge` (*puente* sugiere
  código que traduce o mueve datos, y el package sólo define preguntas y respuestas);
  `@repo/plan-access` (esconde la dirección inversa y el reloj); `@repo/entitlements-contract` (se
  confunde con el catálogo de claves de `V1`).
- **Decisión**: **`@repo/billing-verticals-contract`**, en `packages/billing-verticals-contract`.
- **Motivo**: nombra las dos partes y qué es. La palabra `billing` no complica a `G14`, que
  reconoce el package por su nombre exacto y no por prefijo.
- **Implicaciones**: `U1` lo crea con ese nombre; `G14` lo nombra exacto.
- **Origen**: FASE 5, lote B, 2026-09-30; el owner descartó la primera propuesta del orquestador
  (`@repo/coverage-contract`), pidió más opciones y eligió la 1 de la segunda tanda, la recomendada.

---

### DEC-METH-018 — La FASE 6 queda cerrada por absorción en la FASE 5, con un pase sobre lo que la 5 no clasificó

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED · **Decide**: owner
- **Problema**: la tabla de estado de la spec mostraba la FASE 6 (rewrite/reuse) abierta. El PDR no
  le pide un entregable distinto del de la FASE 5: le pide **un criterio de desempate** sobre la
  clasificación de la 5, inclinado a `REWRITE` —*«ante duda razonable entre seguir refactorizando
  una pieza problemática y reescribirla limpiamente, preferir reescribir»*— y con la carga de prueba
  del lado de conservar (`39-fases-6-y-7/00-propuesta.md` §1.1). `DEC-METH-017` metió ese criterio
  dentro de la FASE 5 y `DEC-ARCH-014` le sacó el caso que la motivaba, el cobro viejo, que ya no se
  reutiliza en nada. Pero **dos de los cinco informes de la FASE 5 no aplicaron la plantilla a lo
  que conservan**: `38-fase-5/01-permisos-y-roles.md` (14 piezas) y `38-fase-5/02-base-de-datos.md`
  (15) clasificaron sólo en las cuatro categorías del punto 2 de `DEC-METH-017` y **no dieron
  `KEEP`/`ADAPT`/`REWRITE`**, que su punto 3 exige. Ahí está exactamente la pregunta de la FASE 6: el
  núcleo de autorización se conserva con tres piezas `ADAPTAR` de severidad ALTA (`AUT-003`,
  `AUT-004`, `AUT-005`), y nadie comparó con argumento remendar contra reescribir. Y **tres guards
  del repo quedaron sin destino** (`check-product-domain-vocabulary.sh`,
  `check-product-domain-raw-sql.sh` y `check-no-binary-vertical-ternary.sh`), que el inventario de
  guards de la FASE 9 le dejó a la FASE 6 (`15-fase-9/04-inventario-de-guards.md`): los dos primeros
  salen 0 sobre nada después de `U1`, y el tercero la FASE 9 lo da a la vez por muerto y por la
  defensa viva contra la duplicación por vertical.
- **Alternativas**: (1) un pase corto ahora, en paralelo a `U1`; (2) el pase al atomizar cada
  unidad (`V5` para autorización, `V2` y `V6` para base), como condición de entrada; (3) darla por
  cerrada como está.
- **Decisión**: **(1)**, la recomendada.
  1. **La FASE 6 queda cerrada por absorción en la FASE 5** (`DEC-METH-017`) **más el pase de
     abajo**.
  2. **El pase**: un agente aplica la plantilla de `DEC-METH-017` punto 3 a las 29 piezas que los
     informes 01 y 02 conservan y a los tres guards sin destino, con argumento escrito por pieza.
     Escribe su propio informe (`39-fases-6-y-7/20-pase-fase-6.md`); los informes 01 y 02 no se
     editan.
  3. **Corre en paralelo a `U1`** y no la frena: `U1` borra y no toca ninguna de esas piezas, salvo
     los tres guards si el pase los manda a su lista.
  4. **Su resultado vuelve al owner sólo si una pieza sale `REWRITE` o si cambia el alcance de una
     unidad**, incluido que un guard entre a la lista de `U1`. Lo demás se aplica sin volver.
  5. **Las dos descomposiciones dejan de remitir *«qué se reescribe»* a la FASE 5**: remiten a esta
     decisión.
- **Motivo**: cierra la FASE 6 con la carga de prueba donde la puso `DEC-METH-003` (*«criterio de
  FASE 5 como gate»*), antes de que `V5` se atomice, y no frena `U1`. Con (2) lo decide quien
  implementa y con apuro, y la carga de prueba se da vuelta sola; con (3) queda *«una mitad vieja y
  una mitad nueva»* justo en la autorización, y dos guards verdes sobre nada.
- **Implicaciones**: (1) la FASE 6 pasa a ✅ en la tabla de estado de `spec.md`; (2) si el pase manda
  borrar alguno de los tres guards, entra a la lista de `U1` (`16-fase-7-del-paraguas.md` §4.6) con
  el OK del owner, porque cambia su alcance; (3) no es un apartamiento del PDR: la FASE 6 no pide un
  entregable propio, y la que el PDR describe es la que corre acá *(lo derivé y lo marco, de
  `00-propuesta.md` §1.1)*.
- **Resultado del pase** (FASES 6 y 7, pase de la FASE 6, owner 2026-09-30, H a J;
  `39-fases-6-y-7/20-pase-fase-6.md`): **el pase se hizo**. Sobre las 29 piezas: **13 `KEEP`
  · 11 `ADAPT` · 1 `REWRITE` · 4 que ya no se conservan** (el owner las retiró en lotes de la
  FASE 5). El núcleo de autorización se remienda —la resolución, la puerta HTTP, la propiedad y la
  escritura de permisos ya hacen los pasos 1, 3 y 4 con suites propias— **salvo el actor de
  sistema (`AUT-005`), el único `REWRITE`**. Lo que volvió al owner lo cerraron tres respuestas,
  todas la recomendada: **H**, el actor de sistema se reescribe en `V5` (una fábrica con el rol
  `SYSTEM`, identificador por job y permisos explícitos, que rechaza los de las 25 acciones; los
  actores armados a mano pasan a ella; la cadena rechaza `_isSystemActor` en las 25; y un guard
  nuevo, **`G19`**, falla ante un actor de sistema armado fuera de la fábrica: **los guards pasan
  de 34 a 35**, 19 de verticales, 15 de billing y 1 de `U1`); **I**, `U1` borra
  `check-product-domain-vocabulary.sh` y `check-product-domain-raw-sql.sh` con su cableado y
  reescribe el texto de `check-no-binary-vertical-ternary.sh`, que `V1` retira cuando entra `G1`,
  con el caso de `HOS-1079` entre los que lo hacen fallar; **J**, `V7` borra `partners.tier` con
  su índice en la misma migración que `starts_at` y `ends_at`, y sus lectores pasan a la clave.
  Los `ADAPT` que no volvieron se aplicaron a su unidad sin elegir nada (punto 4 de la decisión):
  `V5` (`AUT-003`, `AUT-004`, `AUT-010`, `AUT-027`), `V8` (`AUT-015`, `BD-013`), `V7` (`BD-009`) y
  `V1` (`BD-014`); `BD-010` y `BD-026` ya estaban en sus unidades. **Con H a J la FASE 6 queda
  cerrada.**
- **Dónde**: `39-fases-6-y-7/00-propuesta.md` §1; `39-fases-6-y-7/20-pase-fase-6.md`;
  `16-fase-7-del-paraguas.md` §4.6; `V/descomposicion.md` §2, §4 y §6; `V/17` §3.3; `V/20` §2;
  `B/descomposicion.md` §4 y §6; `spec.md`, *«Estado»*.
- **Origen**: FASES 6 y 7, pregunta G, 2026-09-30 (`39-fases-6-y-7/10-decisiones-del-owner.md`);
  propuesta del orquestador, el owner eligió la 1, la recomendada.

---

### DEC-ARCH-016 — Los gates de aceptación del programa: cinco momentos, cada uno con una condición que se comprueba desde afuera

- **Fecha**: 2026-09-30 · **Estado**: ACCEPTED — **precisada el 2026-10-01, con OK del owner** (corte del MVP, Y; ver su ~~📌~~ primer 📌; **y otra vez el 2026-10-02**, BQ: el ensayo recorre la rama de aborto y la medición de `EX-49` lleva la etiqueta `prod`; ver su segundo 📌) · **Decide**: owner
- **Problema**: el PDR pide definir los *acceptance gates* (FASE 7) y no los define, y
  `16-fase-7-del-paraguas.md` §5 los dejaba como el último ítem pendiente de la FASE 7 del paraguas,
  con plazo *«antes de que nazca la rama»*. Lo que existía estaba en cuatro documentos, y faltaba:
  el CI en la rama (`DEC-CI-001` está aceptada y sin aplicar, así que el PR de `U1` entraría sin
  lint, typecheck, tests ni guards); qué hace una fila `UNKNOWN` con la terminación de una unidad
  (*«no está escrito en ninguna decisión»*, `B/descomposicion.md` §2.7); el estado en Linear de una
  unidad terminada; una lista única antes del PR final; sobre qué datos se ensaya el corte y qué es
  un ensayo verde; un smoke manual del sistema nuevo (`F-8cC2-005`, ALTA, nunca resuelto: la rama de
  spec borró los checklists que gobiernan al viejo, `U1` borra `.qtm/`, y el nivel de producción de
  la regla del `CLAUDE.md` es insatisfacible para un reemplazo); y cuándo se da por aceptado el
  programa.
- **Alternativas**, por pregunta (`39-fases-6-y-7/00-propuesta.md` §3): **A**, cuándo se enciende
  el CI en la rama: (1) un PR chico a `staging` antes de crear la rama; (2) como primer commit de la
  rama; (3) adentro del PR de `U1`. **B**, el smoke manual: (1) un checklist nuevo en dos partes;
  (2) sin smoke manual; (3) el viejo hasta el corte y el nuevo después. **C**, los datos del ensayo:
  (1) la base de `staging` como está; (2) una copia de producción con los correos reescritos; (3)
  una copia de producción sin tocar. **D**, una fila `UNKNOWN`: (1) la unidad termina con las dos
  ramas escritas y probadas contra el falso; (2) no termina hasta que la fila cierre; (3) termina
  como en la 1, pero el corte no avanza con filas abiertas. **E**, la aceptación: (1) al terminar el
  paso 6 y el smoke del mismo día; (2) el primer cobro real de una cuenta nueva y siete días de
  barrido limpio; (3) después de la primera renovación.
- **Decisión**: en las cinco, **la 1 de A, B y D, la 2 de C y E: todas la recomendada**, y con ellas
  lo derivado (D-1 a D-5 de la propuesta, §2.3). **Un gate de aceptación es el momento en que algo
  se da por bueno y el trabajo siguiente puede apoyarse en él, con una condición que alguien de
  afuera puede comprobar**, y son cinco:
  1. **Por unidad**: el criterio de su fila; sus guards escritos, enchufados en `pnpm check:guards`
     y en el job `guards` de `ci.yml` y rotos a propósito contra el job; `DEC-TEST-002`; **cada fila
     `UNKNOWN` en que se apoya con sus dos ramas escritas y una prueba por rama contra el proveedor
     falso**, y la batería semanal la sigue midiendo: cuando cierra, la rama que no vale se borra
     (D); sus e2e adaptados en el mismo PR; el PR a la rama con `CI Pass` en `SUCCESS` sobre el
     rollup completo; y una revisión de contexto fresco antes del merge. **En Linear pasa a `Done`
     al mergearse en la rama**, y **las etiquetas `status-needs-smoke-*` van sólo en `HOS-1352`**
     (D-2). **El CI de la rama se enciende antes de que la rama nazca**: los cambios `C-1` a `C-8`
     de `DEC-CI-001` y el guard de destino entran en un PR propio a `staging`, titulado
     `[NOSPEC:epic-ci]` y sin `HOS-1352` (A).
  2. **Por épica, antes del PR final a `staging`**: las 25 unidades en `Done`; `staging` mergeado
     hacia la rama y verde en su último `push`; `e2e-pr`, `codeql`, `lighthouse` y `a11y-sweep` con
     conclusión `success` fechada después del último merge a la rama; y el merge lo decide el owner
     (D-3).
  3. **Antes del ensayo del corte**: el ensayo corre sobre **una copia de la base de producción
     restaurada en `staging`, con los correos reescritos a una casilla que no entrega y la lista
     real de las cinco**, que se borra al terminar (C); arranca con la imagen vieja desplegada y **es
     verde cuando cada verificación del §4.2 pasó, en su orden, sin tocar nada a mano fuera de lo
     que el paso dice**; cualquier intervención no escrita lo vuelve rojo y se escribe antes del
     reintento (D-5).
  4. **Antes del corte real**: los ocho gates de la simplificación del corte, con el ensayo definido
     como arriba y la parte de `staging` del smoke adentro (D-4).
  5. **Después del corte**: **el programa se da por aceptado cuando el sistema nuevo acreditó su
     primer cobro real de una cuenta que se suscribió después del corte, y el barrido diario corrió
     siete días seguidos sin una divergencia sin explicar**; esa observación retira la etiqueta de
     smoke de producción de `HOS-1352` y dispara la tarea de cierre; si nadie se suscribe, se revisa
     a los 30 días (E).

  **El smoke manual del cobro nuevo** (B): un checklist del sistema nuevo en dos partes, que escribe
  `B13` en `docs/billing/` ~~junto con el recorte que ya tenía~~ (el recorte del checklist viejo se retira por quedar sin sujeto: el checklist viejo vive en `staging` y gobierna al sistema viejo hasta el corte, y el nuevo de `B13` lo reemplaza con el corte: FASES 6 y 7, lote de la aplicación, owner 2026-09-30, L): la de `staging` se ejecuta dentro del
  ensayo; la de producción, en un paso 5c después del 5, con la tarjeta del owner y un monto
  aprobado de antemano (un checkout real, su devolución, el correo de Mercado Pago, la caché del
  borde y los horarios de los crons el primer día). `U1` reapunta la regla de smoke del `CLAUDE.md`
  raíz en la rama. **Los tres checklists viejos se restauran en la rama de spec antes de que su PR
  entre a `staging`**, porque gobiernan al sistema viejo hasta el corte (hecho en el acto,
  `39-fases-6-y-7/10-decisiones-del-owner.md`).
- **Motivo**: cada gate queda con una condición que se puede comprobar sin preguntarle a nadie. A:
  el PR de `U1`, el más grande del programa, es el primero que corre CI completo, y `V1` y `B1` no
  arrancan sobre una rama que no compila. B: cubre exactamente lo que el diseño declara que no se
  puede simular, y no deja al sistema viejo sin su gate mientras cobra. C: es el único ensayo que
  prueba la migración que borra sobre lo que va a borrar, y un fallo en producción deja la
  plataforma entera en sólo lectura (`DEC-MIG-002`). D: es la forma que el diseño ya usa, y esperar
  una medición que no se puede provocar (`GR-2`, `PA-6`, `RC-8`) puede no terminar nunca. E: el
  cobro es lo único que el sistema nuevo no puede haber hecho antes del corte, y es lo que el
  programa existe para hacer.
- **Implicaciones**: (1) **precisa `DEC-CI-001`**: su implicación 1 (*«no está aplicado… la
  aplicación la decide el owner»*) queda contestada por A (ver su 📌; FASES 6 y 7, lote de la
  aplicación, owner 2026-09-30, M); (2) **precisa `DEC-TEST-002`**: la
  terminación de una unidad tiene una condición más, sobre las filas `UNKNOWN` en que se apoya (D;
  ver su 📌, M);
  (3) `F-8cC2-005` queda resuelto por B; (4) la FASE 7 del paraguas queda cerrada
  (`16-fase-7-del-paraguas.md` §5), y con ella la FASE 7 en la tabla de estado de `spec.md`; (5) en
  Linear, `status-needs-smoke-prod` va en `HOS-1352` y en ninguna unidad; (6) la matriz no cambia.
- **Dónde**: `16-fase-7-del-paraguas.md` §4.7 (nuevo), §2, §4.2 (paso 0 y paso 5c) y §4.6;
  `DEC-TEST-003` (su 📌 de las FASES 6 y 7, por L y B) (FASES 6 y 7, verificación, 2026-09-30, F4);
  `V/descomposicion.md` §4; `B/descomposicion.md` §2.7 y §4; `V/20` §2.1 y §5; `B/20` §2.1, §4.1 y
  §5.1.
- **Origen**: FASES 6 y 7, preguntas A a E, 2026-09-30
  (`39-fases-6-y-7/10-decisiones-del-owner.md`; con ellas el owner aprobó lo derivado del §2.3 de
  `39-fases-6-y-7/00-propuesta.md`); propuesta del orquestador, el owner eligió en las cinco la
  recomendada.
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, Y)**: **el momento 2 cuenta las
  piezas del corte**: *«las 25 unidades están en `Done`»* pasa a ser *«las 22 piezas del corte
  (`DEC-ARCH-017`) están en `Done`»*. Las ocho piezas posteriores no frenan el PR final del
  paraguas: cada fase posterior es aditiva y tiene su propio gate, y el momento 1 vale para sus
  piezas igual que para las del corte (`DEC-ARCH-017`, AE). Los momentos 3 a 5 no cambian
  (`16-fase-7-del-paraguas.md` §4.7; `41-corte-del-mvp/10-decisiones-del-owner.md`, Y).
- 📌 **Precisada otra vez el 2026-10-02, con OK del owner (corte del MVP, BQ, Q1 y Q2, las dos la
  1)**, sobre el momento 3 (*«qué es un ensayo verde»*) y el paso 0: **el ensayo recorre la rama de
  aborto una vez, en `staging`, sobre la misma copia**: una falla provocada después del 1b, y se
  verifica restaurar el 2b, la imagen vieja, los inversos (b) y (c) y la regla del 0b puesta hasta
  el reintento (Q1); y **la medición de `EX-49` se registra con la etiqueta `prod`**: lee datos de
  producción sin mutar nada y es gate del corte real, aunque el paso 0 decía *«ninguna en
  producción»* (Q2). Dónde: `16-fase-7-del-paraguas.md` §4.2 (el paso 0 y la rama de aborto) y
  §4.7, momento 3; `41-corte-del-mvp/10-decisiones-del-owner.md`, BQ.

---

### DEC-ARCH-017 — El MVP: el corte lleva 22 piezas y ocho llegan después, en fases aditivas sobre el sistema nuevo

- **Fecha**: 2026-10-01 · **Estado**: ACCEPTED — **precisada el 2026-10-01, con OK del owner** (corte del MVP, AP a AU y AV; ver sus dos 📌; **y otra vez el mismo día**, AW: las cuatro fases posteriores; ver su tercer 📌; **y otra vez el mismo día**, BC, BF, BG y BH: tres comportamientos sin pieza, la herramienta del 4b, el esquema de promos y cortesías y las superficies de `B13` que confirman actos de otra fase; ver su cuarto 📌; **y otra vez el mismo día**, BJ, que reemplaza a BI: el rechazo de la compra de Turista VIP; ver su quinto 📌; **y otra vez el 2026-10-02**, BL, BN, BO, BP y BR: las llamadas a lo posterior por interfaz, la pieza que crea una tabla que usan dos del corte, la revocación de una cortesía, el Turista VIP heredado en `S2` y las flechas de `U2`; ver su sexto 📌) · **Decide**: owner
- **Problema**: el plan del 2026-10-01 pedía un corte con lo indispensable y fases posteriores, y el
  MVP no existía como decisión: sólo estaba en el handoff y en el worklog (`03-handoff.md`,
  `02-worklog.md`). Medido contra el grafo escrito, la lectura previa —diferir addons, Partner,
  cambios de plan, retención y retiro de planes enteros— **rompe tres aristas** (`V8` sobre `V7`,
  `B9` sobre `B8`, `B13` sobre `B10`), y sin partir unidades lo único diferible es `B12` y parte de
  `V9`. Además el MVP choca en la letra con `DEC-ARCH-007` (*«juntas y terminadas»*, *«despliega una
  sola vez»*) y con el momento 2 de `DEC-ARCH-016` (*«las 25 unidades en `Done`»*)
  (`41-corte-del-mvp/00-propuesta.md` §0, §3 y §5).
- **Alternativas**: las del lote Y a AE (`41-corte-del-mvp/00-propuesta.md` §6): **Y**, precisar
  las dos decisiones o no hacer MVP; **Z**, partir cinco unidades, no partir o reescribir aristas;
  **AA**, addons al corte con su modelo y su fuente, enteros o enteros después; **AB**, Partner con
  su migración al corte, entero o entero después; **AC**, retención partida, entera al corte o entera
  después; **AD**, todo el esquema al corte o sólo lo que se lee desde el día uno; **AE**, una rama
  épica por fase o PRs de unidad directo a `staging`.
- **Decisión**: en las siete, **la 1, la recomendada**:
  1. **El corte** (Y, Z): **30 piezas**, **22 al corte y 8 después**. Al corte, enteras (17):
     `U1`–`U3`, `V1`–`V6`, `B1`–`B7` y `B11`; y las mitades *a* de las cinco partidas: `V8a`,
     `V9a`, `B8a`, `B9a` y `B13a`. Después (8): `V7`, `V8b`, `V9b`, `B8b`, `B9b`, `B10`, `B12` y
     `B13b`.
  2. **El criterio** (`00-propuesta.md` §2): una pieza va al corte si sin ella no se apaga el viejo
     ni se ejecuta el corte; si sin ella el sistema nuevo cobra mal o regala; si escribe un dato que
     no se reconstruye; si cambia la forma de una tabla que tiene filas el día del corte; o si la
     exige el grafo. **Lo que se difiere llega sin tocar nada de lo construido.**
  3. **La partición** (Z), con los alcances de `00-propuesta.md` §1: `V8a` (todo `V8` salvo lo de
     Partner) y `V8b` (la fila 22 y el panel de postulaciones); `V9a` (el registro de los actos del
     dueño) y `V9b` (los jobs, `PB9` y los avisos); `B8a` (la baja, `S11` y `S12`) y `B8b` (cambio de
     plan, de ciclo, pausa, cierre de la sucesión y `S38`, con `G-R1-C`); `B9a` (los grants, su
     fuente, su piso y la herramienta del 3b) y `B9b` (promos, cortesías, `S9`, `S34`, `S35` y el
     canje con `extenderTrial`); `B13a` (todo `B13` salvo lo de addons) y `B13b` (las filas de
     addons y el aviso del destaque que se sigue cobrando). **La rama de sucesión de `S1` queda sin
     ruta hasta `B8b`**, y cada unidad partida tiene una pasada de dependencias ocultas antes de
     cerrar la spec consolidada.
  4. **Addons** (AA): al corte, el modelo de addons entero (productos, versiones, instancias,
     compra) y la fuente `ADDON` real sobre la tabla vacía, con `G-R2-C`; la venta, el destaque y la
     orfandad (`B10`), después.
  5. **Partner** (AB): al corte, la migración estructural de `V7` (borra `starts_at`, `ends_at` y
     `tier` con su índice, y agrega el `UNIQUE` parcial sobre `owner_user_id`), con sus lectores de
     `tier` retirados; la presencia, la postulación, el reclamo y el rol, después.
  6. **Retención** (AC): `V9a` al corte; la función del seudónimo pasa de `V9` a `V4`, que la usa
     primero; `V9b` se mergea antes de la primera fecha en que un aviso de retención podría salir.
  7. **El esquema** (AD): **todo el esquema de las 25 unidades** —tablas, columnas, enums, `FK`,
     `UNIQUE`, `CHECK` y los extras— **nace en las migraciones de la rama antes del corte**; una
     fase posterior no trae migración estructural.
  8. **Las fases posteriores** (AE): una rama épica nueva por fase, con los mismos gates por unidad,
     que entra a `staging` entera.
  9. **Los guards al corte: 34 de 35**; queda afuera `G-R1-C`, de `B8b`.
- **Motivo**: con la partición el grafo cierra con cero violaciones (`00-propuesta.md` §3.2,
  `aristas.py`), y el MVP respeta el motivo de `DEC-ARCH-007` —ninguna épica sola, sin tercera
  implementación, sin convivencia—. AA y AD cumplen la condición de `G13` (las seis respuestas
  reales nacen al corte, aunque lean tablas vacías) y la de que una fase posterior no reescriba
  filas: *«un `no` porque la tabla está vacía no es un `no` porque el código no pregunta»*
  (`00-propuesta.md` §4.2). AB y AC evitan una migración de datos disfrazada sobre filas escritas
  desde el corte, y la pérdida de los reinicios del reloj de retención.
- **Implicaciones**: (1) **precisa `DEC-ARCH-007` y `DEC-ARCH-016`** (Y; ver sus 📌); (2) la
  partición, los alcances, el seudónimo en `V4` y el esquema se escriben en `V/descomposicion.md`,
  `B/descomposicion.md` y `16-fase-7-del-paraguas.md` §4.6–§4.7, y después en el árbol de Linear;
  (3) las cinco unidades partidas pasan a diez piezas en Linear; (4) quedan abiertos los puntos de
  `10-decisiones-del-owner.md`, *«Lo que la propuesta no pudo verificar»*; (5) la matriz no cambia.
- **Dónde**: `41-corte-del-mvp/00-propuesta.md`; `41-corte-del-mvp/10-decisiones-del-owner.md`;
  `16-fase-7-del-paraguas.md` §4.6 y §4.7; `V/descomposicion.md` §2 a §4; `B/descomposicion.md` §2,
  §2.6, §3 y §4.
- **Origen**: corte del MVP, preguntas Y a AE y AF, 2026-10-01
  (`41-corte-del-mvp/10-decisiones-del-owner.md`); propuesta del orquestador, el owner eligió en
  todas la recomendada.
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, AP a AU, todas la 1)**, sobre lo
  que dejó la pasada de dependencias ocultas de la partición (`41-corte-del-mvp/20-aplicacion.md`):
  (AP) **el esquema de lo posterior lo crea al corte la pieza dueña de la tabla de la que cuelga**
  —el de `V7`, con su migración estructural y los lectores de `tier` retirados, `V6`; la cola de
  cambios, las columnas de la sucesión y las dos tablas de `B12`, `B3`; promos y cortesías, `B9a`;
  addons, `B4`, que le agrega a `payment` la columna de la instancia—, con el drift guard sobre la
  rama de cada fase como mitigación; (AQ) la fuente `CORTESÍA` real la contesta `B9a`, con la de
  `GRANT`; (AR) `B8a` es `S11`, `S12`, `S23` y `S24`, y `S22` queda en `B8b`; (AS) **las ramas de
  las piezas del corte que tocan lo posterior se implementan enteras al corte sobre el esquema
  vacío**, `S20`, `S21`, `S32` y `S33` pasan a la pieza del corte que las llama, se prueban con
  filas sembradas, y la fase posterior sólo agrega lo que crea filas; (AT) **el gate de cada fase
  posterior es el momento 2 aplicado a su rama más el checklist de smoke extendido**, con la parte
  de `staging` antes del merge y la de producción como un 5c propio; (AU) `B13a` muestra en Mi
  Suscripción *«todavía no se puede cambiar de plan: date de baja al fin del período y volvé a
  suscribirte»* y `B8b` lo saca: **la única excepción declarada a *«aditiva»***, acotada a ese
  texto (`16-fase-7-del-paraguas.md` §4.6 y §4.7; `V/descomposicion.md` §2.14;
  `B/descomposicion.md` §2.12).
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, AV, la 1)**, sobre lo que AP y AS
  dejaron en conflicto (`41-corte-del-mvp/20-aplicacion.md` §5): **las tablas del modelo de addons
  pasan de `B4` a `B3`** —precisa el renglón de addons de AP—, y `payment` nace en `B5` con la
  columna de la instancia; la fuente `ADDON` y `G-R2-C` siguen en `B4`; **`S21` y la orfandad
  (`A5`) van a `B5`**, su primer llamador, y **`S32` y `S33` a `B7`**. El grafo no gana flechas
  (`16-fase-7-del-paraguas.md` §4.6; `B/descomposicion.md` §2.12).
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, AW, la 1)**, sobre AE (*«una rama
  épica nueva por fase»*, que no fijaba cuántas fases ni qué pieza va en cada una): **las fases
  posteriores son cuatro, en este orden: Fase 1, `V9b` sola —tiene que estar mergeada antes de la
  primera fecha en que un aviso de retención podría salir (AC)—; Fase 2, `B8b` y `B9b`; Fase 3,
  `B10`, `B13b` y `B12`; Fase 4, `V7` y `V8b`**. Respeta el grafo: `V9b` y `B9b` antes de `B10`,
  `B13b` antes de `B12`, `V7` antes de `V8b`. Cada fase lleva su gate (AT)
  (`16-fase-7-del-paraguas.md` §4.7, *«Las fases posteriores»*;
  `41-corte-del-mvp/10-decisiones-del-owner.md`, AW).
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (corte del MVP, BC, BF, BG y BH, todas la
  1)**, sobre lo que dejaron el mapa de cobertura de la spec consolidada y el análisis de errores de
  las fuentes que ese mapa reportó. **BC**: tres comportamientos que ninguna fila asignaba tienen
  pieza: `DEC-ENT-004` (el Turista VIP pago que el plan hereda se cancela en el acto, sin reembolso)
  es de `B3`; la acción 6 (el plan y el método de pago de un Partner) es de `V7`, sobre el pago manual
  de `B5`; y el invariante 9 de `NUCLEO/04` (verticales simultáneas en estados distintos) es de `V3`,
  con `B3`. **BF**: la herramienta del paso 4b —la sonda de Webhooks, el pago chico con su
  devolución, la consulta a `provider_notification`, sus ids al manifiesto y los inversos (b) y (c)
  de la rama de aborto (`DEC-MP-009`)— es del script del corte, `U3`; su entrega real al receptor de
  `B3` se prueba en el ensayo. Sin flechas nuevas: `U3` sigue entrando en paralelo con `V1`, `B1` y
  `U2`. **BG**: el esquema de promos y cortesías pasa de `B9a` a `B3`, como AV hizo con addons y por
  el propio criterio de AP (cortesías y redenciones cuelgan de `subscription`): lo leen antes `S3` y
  `S14` (`B3`), `P1` (`B5`), la sexta comprobación del barrido (`B11`) y Mi Suscripción (`B13a`).
  `B9a` conserva las fuentes `CORTESÍA` y `GRANT`, `S13`, `S20` y la herramienta del 3b. Precisa
  AP. **BH**: las superficies de `B13` van con la fase del acto que confirman o editan: las filas 13
  y 13-bis del `B/19` §4, que confirman la acción 2 de `B9a`, pasan a `B13a`, con la flecha nueva
  `B9a → B13a`; el editor de códigos promocionales va a `B9b`, con su operación; `B13b` queda con el
  aviso del destaque y el editor de versiones de complemento. Precisa Z, cuya premisa (*«lo de
  addons de `B13` son las filas 13 y 13-bis»*) no era cierta. Recontado con `41-corte-del-mvp/`:
  30 piezas, 22 al corte, 35 guards con 34 al corte, 60 flechas y cero violaciones. Dónde: las dos
  descomposiciones, §2 y §4; `16-fase-7-del-paraguas.md` §4.2 y §4.6;
  `41-corte-del-mvp/aristas.py`; `41-corte-del-mvp/10-decisiones-del-owner.md`, BC, BF, BG y BH.
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (corte del MVP, BJ, la 1, que reemplaza a
  BI)**, sobre la mitad de `DEC-ENT-003` que ninguna pieza construía: *«mientras su plan comercial se lo
  dé, no puede comprar Turista VIP: la UI no lo ofrece y la API lo rechaza»*. **La construye `B3`**:
  comprar Turista VIP es elegir un plan de la vertical Turista, es decir `S1` (`B/03` §3.2), y `S1`
  suma la guarda *«el `user` no tiene un plan vigente que herede Turista VIP»*; al perder ese plan, la
  compra vuelve a admitirse. **También la ejercen `B13a`**, cuya pricing no la ofrece (`B/19` §4), y
  **`V3`**, cuya resolución de capacidades contesta si el plan vigente lo hereda (`V/15` §6.3). **El
  código de error del rechazo queda abierto**: `apps/api/docs/error-contract.md` no lo fija. BI ponía
  la dueña en `B5` y se retira: su premisa era errónea, porque el checkout es el alta de `B3` y `B5`
  es el registro del dinero. Sin flechas nuevas. Dónde: `B/descomposicion.md` §2 y §4 (fila de `B3`);
  `41-corte-del-mvp/10-decisiones-del-owner.md`, BI y BJ.
- 📌 **Precisada otra vez el 2026-10-02, con OK del owner (corte del MVP, BL, BN, BO, BP y BR, todas
  la 1)**, sobre lo que dejó el triage de los abiertos de la spec consolidada. **BL**: una pieza
  anterior que llama a algo que construye una posterior **escribe su rama entera y la llamada
  contra una interfaz interna, y la posterior trae la implementación sin tocar código anterior**; si
  lo llamado ya existe cuando llega la anterior, la anterior lo hace entero; y un criterio que
  necesita la implementación real va al *«Lista cuando»* de la posterior. Aplicada: `B5` y `B7`
  llaman a `S18`, `S31` y `S38` por interfaz y `B8b` la implementa; `B3` escribe la rama de
  sucesión de `S1` sin ruta y `B8b` agrega la ruta; `B5` escribe la cuarta comprobación y llama a
  `A6` por interfaz, y `B10` la implementa; `V6` encola el aviso *«al archivar»* con su plantilla en
  `PB4` y `PB5`, y `V9b` suma los dos avisos previos y el job; el grace que vence contra el falso
  como servidor pasa del criterio de `B1` al de `B7`. Precisa AS y Z, sin otra excepción a
  *«aditiva»* que AU. **BN**: **cada tabla nace, con todas sus restricciones (AD), en la primera
  pieza del grafo que la escribe o la referencia; si una `FK` suya apunta a una tabla que nace
  después, nace con la dueña de la tabla destino**, y la rama que la escribe se completa ahí con
  filas sembradas (AS): `B3` crea `manual_payment` e `idempotency_key`; `B5`, `refund` con su
  índice parcial y `reconciliation_mark_payment`; `V9a`, `domain_event` (inferido: ninguna pieza
  anterior la escribe). Precisa AP y AV. **BO**: revocar una cortesía temporal (acción 1) es
  reanudar antes del fin por un acto del `SUPER_ADMIN`, **un tercer evento de `S10`**, con
  `fin_real` y la relectura, sin reembolso y con el aviso a la persona; lo agrega `B9b`, con su
  fila en `B/19` §4. **BP**: el Turista VIP pago que el plan nuevo hereda (`DEC-ENT-004`) **se
  cancela en `S2`, cuando el plan comercial pasa a `ACTIVE`, con el correo antes**: precisa el *«en
  el acto»* de BC, y es lo único que cumple *«el servicio no se interrumpe»*. **BR**: **`U2` va
  antes que `B3` y que `V4`**, que encolan antes que las piezas que ya la esperaban y cubren por
  transitividad al resto, y los correos *«reembolso de revocación fallido»* y *«cobro duplicado
  detectado»* tienen fila en el catálogo de `NUCLEO/07` §6, transaccionales, no suprimibles, a
  `SUPER_ADMIN` y al producirse, con `B11` como dueña. Recontado con `41-corte-del-mvp/`: 30
  piezas, 22 al corte, 35 guards con 34 al corte, 62 flechas —las dos de BR— y cero violaciones. La
  letra BM, el cambio de precio al corte, queda pendiente de una aclaración. Dónde: las dos
  descomposiciones, §2, §2.12 y §2.14, §3 y §4; `B/03` §3.2 (`S2`, `S10`); `B/19` §4;
  `NUCLEO/07` §1.4 y §6; `NUCLEO/08` §3 y §4.1; `16-fase-7-del-paraguas.md` §4.6;
  `41-corte-del-mvp/aristas.py`; `41-corte-del-mvp/10-decisiones-del-owner.md`, BL, BN, BO, BP y BR.

---

### DEC-METH-019 — La spec consolidada es la única fuente para implementar, y se acepta sólo con trazabilidad mecánica y dos verificaciones ciegas

- **Fecha**: 2026-10-01 · **Estado**: ACCEPTED — **precisada el 2026-10-01, con OK del owner** (corte del MVP, AX y AY: las 38 filas `MIXTO` y qué es un ítem normativo; ver su 📌; **y otra vez el mismo día**, AZ: tres familias más son normativas; ver su segundo 📌; **y otra vez el mismo día**, BA, BB y BE: la lista cerrada de sólo citables y la pseudo-pieza `CORTE`; ver su tercer 📌; **y otra vez el 2026-10-02**, BK, BS y BT: el punto 7 alcanza tres familias más de texto superado, los detalles que las fuentes dejan a la implementación y las mediciones de producción; ver su cuarto 📌) · **Decide**: owner
- **Problema**: el diseño vigente está repartido en 38 archivos, con 2.803 líneas tachadas y
  precisiones en prosa (📌, salvedades, residuos). Implementar sobre eso obliga a cada agente a
  reconstruir qué vale, y el owner lo dijo así: *«si no es perfecto, desarrollamos sobre una base
  no sólida»* (`03-handoff.md`, plan del 2026-10-01, paso 2).
- **Alternativas**: las del lote AF a AO (`41-corte-del-mvp/10-decisiones-del-owner.md`).
- **Decisión**: en todas, **la 1, la recomendada**:
  1. **Inventario cerrado por script** de 18 fuentes sobre un SHA congelado.
  2. **La spec, en `spec-consolidada/` del paraguas**, con lo vigente sin tachados y lo muerto en
     `90-retirados.md`; cada ítem con su ancla `<a id="...">` y su `Origen: archivo:línea`.
     **Se organiza por pieza del corte y de cada fase**, con catálogos únicos (núcleo, transiciones,
     guards, etc.) (AH).
  3. **`trazar.py` en 0 en las dos direcciones**, y además: todo ítem vivo cubierto por ≥1 AC, todo
     AC con ≥1 test y todo AC citando su fuente (AL).
  4. **Dos verificaciones ciegas opuestas** —qué falta y qué se inventó— con canarios, hasta una
     vuelta sin `BLOQUEA`; los verificadores comprueban también que toda US, AC y test tiene fuente,
     y el canario incluye un AC inventado (AL).
  5. **Lo anterior queda congelado como histórico**; un cambio posterior se escribe en la
     consolidada y en el log.
  6. **Las `spec.md` de `HOS-1353` y `HOS-1354` quedan reemplazadas**: siguen como stubs con su
     frontmatter, por Linear, y un aviso que apunta a la consolidada (AG).
  7. **Lo ambiguo lo adjudica un agente**: las 33 filas `MIXTO` y los 📌 que caen en prosa, con
     cita y hash de línea; el owner revisa sólo las adjudicaciones que cambian el sentido de una
     regla (AI).
  8. **Las US, los AC y los tests se derivan, nunca se inventan**: cada uno cita ≥1 ítem fuente
     (`INV`, `TRANS`, `DEC`, `LISTA`, `GUARD`, `MP`…); lo que no tiene fuente va a `80-abiertos`
     como pregunta al owner (AL).
  9. **La forma** (AM): US y AC por pieza (30), US por actor (anfitrión, dueño de comercio, partner,
     admin, turista, sistema/cron), AC en Given/When/Then con id `AC:<pieza>:n`; el *«Lista cuando»*
     es el AC de salida.
  10. **El mapa AC → test** (AN), por pieza, con tipos de lista cerrada: unitario, integración con
      DB, ruta API (contrato de errores), guard estático, migración (desde cero y sobre datos), e2e
      web/admin y smoke manual con etiqueta (local/staging/prod, MP sandbox). Cada invariante con ≥1
      test; cada transición con un test de integración, incluidas las prohibidas; cada uno de los 35
      guards con su prueba de mutación.
  11. **La plantilla por pieza** (AO), completa: una sección que no aplica se declara «N/A» con su
      razón y nunca se borra (objetivo, alcance y fuera; US y AC; reglas con refs a los catálogos;
      modelo de datos y migraciones con su carril; API con rutas, tier, permisos y errores; UI web y
      admin e i18n; cron y outbox; env vars; auditoría y observabilidad; seguridad; testing
      esperado; smoke y etiquetas; dependencias, rollback y despliegue; labels de Linear; abiertos y
      `Origen:`).
  12. **Las letras U a X del 2026-10-01** fueron operativas de la promoción #3447 y no de diseño:
      se explican con una línea en `00-indice.md` de la consolidada y no entran al inventario (AJ,
      AK).
- **Motivo**: cada condición se comprueba sin preguntarle a nadie: el inventario y `trazar.py` dicen
  si algo falta o sobra, y las verificaciones ciegas buscan lo que un script no ve. Derivar con
  cita obligatoria impide que la consolidación agregue diseño sin decisión.
- **Implicaciones**: (1) **el PDR, el log y la matriz no se tocan** salvo el registro de esta
  decisión y de `DEC-ARCH-017`; (2) **las adjudicaciones de `MIXTO` quedan versionadas y caducan si
  cambia la fuente** (el hash de línea lo detecta); (3) la consolidación es la tarea de cierre de
  `spec.md` (*«Al cerrar HOS-1352»*) adelantada, y su resultado es la fuente del árbol de Linear;
  (4) la matriz no cambia.
- **Dónde**: `41-corte-del-mvp/10-decisiones-del-owner.md`, lote AF a AO; `spec-consolidada/`
  (a crear en la consolidación).
- **Origen**: corte del MVP, preguntas AF a AO, 2026-10-01
  (`41-corte-del-mvp/10-decisiones-del-owner.md`); propuesta del orquestador, el owner eligió en
  todas la recomendada.
- 📌 **Precisada el 2026-10-01, con OK del owner (corte del MVP, AX y AY, las dos la 1)**, sobre lo
  que dejó la etapa de inventario y adjudicación (`spec-consolidada/_trabajo/`, sobre `0dbe448276`):
  (a) **las filas `MIXTO` son 38 y no 33** (punto 7 y AI): medidas con un criterio uniforme
  —una fila con alguna celda que arranca tachada y que no está muerta— suman seis filas de *«qué deja
  funcionando»* de las piezas (`B10`, `B4`, `B6`, `B8`, `U1` y `V2`) que el conteo previo no miraba,
  y sale una, el *«Lista cuando»* de `U1`, que leído en su columna no tiene nada tachado; lo cuenta
  `spec-consolidada/scripts/inventario.py`; (b) **un ítem «normativo» de AL** (punto 3) —el que
  exige ≥1 AC— es una decisión (menos las de metodología, `DEC-METH-*`), un 📌, una fila de pieza,
  un *«Lista cuando»*, un guard, una invariante, una transición, una acción administrativa, un
  plazo, un motivo, un candado, una regla `RP` o `M`, un paso del corte, un gate o un traslado del
  corte (el esquema, la transición → pieza y la instancia de addon → pieza); **la matriz, las letras
  del owner y la lista de piezas son sólo citables**; (c) los restos que la adjudicación encontró en
  `B/descomposicion.md` —el modelo de addons de `B10` o de `B4`, que es de `B3` (AV), y `S20`, `S21`
  y `A5` con `B10`, que van a `B9a` (AS) y a `B5` (AV)— se corrigen en la fuente (AY). La agrupación
  de las fases posteriores (AW) precisa AE y va en el 📌 de `DEC-ARCH-017`
  (`41-corte-del-mvp/10-decisiones-del-owner.md`, AW a AY).
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (corte del MVP, AZ, la 1)**, sobre el
  punto (b) del 📌 anterior: **también son normativas, y exigen ≥1 AC, las transiciones que no
  existen (`B/03` §3.3), las validaciones del panel que conservan nombre de guard (`G-R3` y
  `G-R5-B`) y las dependencias entre épicas (`B/descomposicion.md` §2.6)**, que AX no nombraba. Lo
  sólo citable sigue siendo la matriz, las letras del owner y la lista de piezas
  (`41-corte-del-mvp/10-decisiones-del-owner.md`, AZ).
- 📌 **Precisada otra vez el 2026-10-01, con OK del owner (corte del MVP, BA, BB y BE, todas la
  1)**, sobre AX y AZ. **BA y BB**: pasan a **sólo citables, en una lista cerrada por script** que
  vive en `03-contrato-de-cobertura.md` de la consolidada, los ítems normativos que ninguna pieza
  construye: `INV:17`, `INV:33` a `INV:37`, `DEC-CI-001` con sus 📌 primero y segundo, `DEC-CI-002`,
  `DEC-ARCH-005` con su primer 📌, el tercer 📌 de `DEC-ARCH-017`, `DEC-MIG-002`, el quinto 📌 de
  `DEC-MIG-005`, el segundo de `DEC-AUTH-003`, el cuarto de `DEC-DATA-005` y el segundo de
  `DEC-MP-008` (BA, 18); y los 📌 que sólo retiran algo o son notas de registro: el segundo de
  `DEC-OBS-001`, el segundo de `DEC-ADDON-004`, el segundo de `DEC-SUB-013`, el primero de
  `DEC-MP-003` y el primero de `DEC-SUB-019` (BB). El tercer 📌 de `DEC-TRIAL-004` (teléfono,
  identificador fiscal y dispositivo no se guardan) no pasa a la lista: **se cubre con un AC negativo
  en `V4`** (BB). **BE**: los ítems cuya dueña es el corte (pasos, gates de los momentos y de las
  fases, y las DEC que sólo el corte ejecuta) llevan su AC en **la pseudo-pieza `CORTE`**:
  `AC:CORTE:n` y `TEST:CORTE:n` en `30-el-corte.md`, con tipo smoke manual (el ensayo en `staging`,
  el 5c en producción) o guard estático; `trazar.py` la acepta. Precisa AM sin cambiar la forma de
  las 30 piezas (`41-corte-del-mvp/10-decisiones-del-owner.md`, BA, BB y BE).
- 📌 **Precisada otra vez el 2026-10-02, con OK del owner (corte del MVP, BK, BS y BT, todas la
  1)**, sobre los puntos 7 y 8. **BK**: **el punto 7 (AI) se amplía a tres familias de texto
  superado que ningún 📌 tacha**: las cuatro decisiones `SUPERSEDED EN PARTE` (`DEC-MIG-001`,
  `DEC-MIG-002`, `DEC-DATA-002` y `DEC-MP-003`), las precisadas *«por otra decisión»* de la fila del
  resumen (siete pares, con el *«cinco consumidores»* del cuerpo de `DEC-DATA-004`) y la fila
  `EX-46` de la matriz. Cada una lleva un veredicto `PARCIAL` con cita y hash, la consolidada omite
  lo muerto con «[…]» y su nota, y el owner revisa sólo lo que cambia el sentido de una regla, como
  en AI; el log y la matriz siguen sin editarse (implicaciones 1 y 4). **BS**: **los detalles que
  las fuentes dejan a la implementación** —la ruta, el permiso y el `error.code` de cada acto y de
  cada rechazo, el nombre de una tabla auxiliar, una cadencia, las listas que viven en el código, el
  texto de un aviso que la fuente deja a producto, los labels de Linear, las credenciales— **los
  propone el PR de la pieza dueña siguiendo lo escrito del repo, los aprueba la revisión de
  contexto fresco del momento 1** (y el owner en el PR cuando es texto al cliente o un permiso
  nuevo) **y quedan escritos en la sección de la pieza en la consolidada al mergear**; no entra lo
  que es regla comercial ni lo que cambia comportamiento. Precisa el punto 8: no es diseño sin
  decisión, porque lo decide el repo escrito y lo aprueba una revisión. **BT**: **una medición de
  producción que una pieza necesita la corre esa pieza** con `hops psql --target=prod`, en sólo
  lectura y contando, antes de su merge, y deja el número en el PR; si no da cero, vuelve al owner
  con el número antes del merge, y una salida vacía no es un cero. Dónde:
  `16-fase-7-del-paraguas.md` §4.7, momento 1; `spec-consolidada/scripts/adjudicar.py` y
  `spec-consolidada/_trabajo/adjudicacion.json`; `41-corte-del-mvp/10-decisiones-del-owner.md`, BK,
  BS y BT.

---

## Resumen

| | Cantidad |
|---|---|
| Decisiones tomadas | ~~**126**~~ ~~**134**~~ ~~**135**~~ ~~**136**~~ ~~**137**~~ ~~**139**~~ ~~**142**~~ ~~**144**~~ **146** — con **`DEC-ARCH-017`** y **`DEC-METH-019`** (2026-10-01, corte del MVP, con OK del owner a los lotes Y a AE y AF a AO: el MVP y la spec consolidada; recontado con script el 2026-10-01, `^### DEC-[A-Z]+-\d+` sobre el log, sin repetidos, da 146, 127 funcionales más 19 de metodología); con **`DEC-METH-018`** y **`DEC-ARCH-016`** (2026-09-30, FASES 6 y 7, con OK del owner al lote: la FASE 6 cerrada por absorción en la 5 con el pase G, y los gates de aceptación; recontado con script el 2026-09-30, `rg -o "^### DEC-[A-Z]+-\d+"` sobre el log, sin repetidos, da 144, 126 funcionales más 18 de metodología); con **`DEC-METH-017`**, **`DEC-MIG-007`** y **`DEC-ARCH-015`** (2026-09-30, FASE 5: el criterio de la FASE 5, las premisas del corte y el nombre del package del contrato; recontado con script el 2026-09-30, FASE 5, aplicación del log: la cifra decía 139 y los encabezados eran 142, porque las tres entraron sin sumarse acá); con **`DEC-AUTH-004`** y **`DEC-AUTH-005`** (2026-09-30, FASE 9 vuelta 3, con OK del owner al lote del log: el reclamo de un Partner vincula una sola vez y una cuenta es dueña de a lo sumo un Partner; postular un Partner no exige cuenta); con **`DEC-METH-016`** (2026-09-29: una tercera vuelta de la FASE 8 y la FASE 9, entera, como excepción al tope de `DEC-METH-013`); con **`DEC-ARCH-014`** (2026-09-29, verificación corta: el sistema viejo sale entero de la rama al principio de la épica); con **`DEC-MP-009`** (2026-09-29, mediciones: el canal IPN se escucha y se guarda sin actuar); con las **ocho de la revisión del owner** (2026-09-28, con OK del owner al lote): **`DEC-MIG-006`** (el corte publica las fichas que estaban a la vista y arranca una prueba activa), **`DEC-DATA-006`** (la pausa del dueño detiene la retención), **`DEC-DATA-007`** (la moderación en dos niveles), **`DEC-SUB-023`** (migrar a los clientes de un plan retirado), **`DEC-TEST-003`** (el Mercado Pago falso y la batería), **`DEC-ARCH-012`** (el agrupamiento viejo de Gastronomía y Experiencia desaparece), **`DEC-ARCH-013`** (la configuración de planes vive en la base) y **`DEC-DATA-008`** (los plazos configurables); con las **dos de la FASE 9 vuelta 1** (2026-09-26): **`DEC-AUTH-002`** (una acción administrativa nunca tiene actor = sujeto) y **`DEC-AUTH-003`** (el admin edita el contenido de una ficha ajena con una acción propia); con las **siete de la FASE 9 completa** (2026-09-25): **`DEC-SUB-022`** (la sucesora de quien venía pagando entra en grace), **`DEC-MIG-005`** (el corte trata a la cartera vieja como clientes nuevos: se conservan el usuario, sus preferencias y sus fichas; el billing arranca de cero), **`DEC-RF-008`** (máquina del reembolso y acción 14), **`DEC-ADDON-007`** (los addons siguen a su título), **`DEC-AUTH-001`** (el orden de autorización), **`DEC-ENT-006`** (la presencia de Partner) y **`DEC-ARCH-011`** (la vertical que no admite altas); y las del 2026-09-25 de la FASE 8 completa: **`DEC-TRIAL-010`** (2026-09-25: el trial se convierte con el primer pago), **`DEC-ARCH-009`** (2026-09-25: reconciliador diario de cobertura en verticales), **`DEC-METH-015`** (2026-09-25: los residuos de borde se declaran, no se persiguen), **`DEC-DATA-005`** (2026-09-25: la retención sólo toca fichas), **`DEC-SUB-021`** (2026-09-25: en grace no se cambia de plan; supera a `DEC-SUB-003`), **`DEC-SUB-020`** (2026-09-25: un contracargo suspende en el acto, sin grace) y las ocho del 2026-09-24, con **`DEC-METH-014`** (la FASE 8 completa desde cero), con **`DEC-SUB-019`** (al vencer el grace se cancela el preapproval) y **`DEC-MP-008`** (una pausa del proveedor por mora es el fin del grace): **`DEC-MP-005`** (seguimos con Mercado Pago, y lo que el proveedor no hace lo suple el diseño), **`DEC-MP-006`** (el reloj de cobro es del proveedor: el mandato es el modelo canónico), **`DEC-RF-007`** (el reembolso de un cobro viejo no se implementa: la reparación es manual), **`DEC-METH-013`** (cuándo se deja de girar el ciclo 8↔9) y **`DEC-MP-007`** (no usamos los planes del proveedor) |
| De metodología | ~~15~~ ~~16~~ ~~**17**~~ ~~**18**~~ **19** *(2026-10-01: suma **`DEC-METH-019`**, la spec consolidada; recontado con script el mismo día, 127 funcionales más 19 de metodología dan las 146)* *(2026-09-30: suma **`DEC-METH-018`**, el cierre de la FASE 6; recontado con script el mismo día, `rg -o "^### DEC-METH-\d+"` sin repetidos da 18, y 126 funcionales más 18 de metodología dan las 144)* *(2026-09-30: suma **`DEC-METH-017`**, el criterio de la FASE 5; recontado con script el mismo día, 125 funcionales más 17 de metodología dan las 142)* *(por prefijo; ~~once —`DEC-METH-005` a `-015`—~~ doce, de `DEC-METH-005` a `-016`, están bajo el encabezado funcional porque se escribieron en orden cronológico; `26-fase-9-completa/09` `C-15`; recontado el 2026-09-30 con script, 123 funcionales más 16 de metodología dan las 139, con OK del owner, FASE 9 vuelta 3, lote AN)* |
| Funcionales | ~~**109**~~ ~~**111**~~ ~~**119**~~ ~~**120**~~ ~~**121**~~ ~~**123**~~ ~~**125**~~ ~~**126**~~ **127** *(2026-10-01: `DEC-ARCH-017`, el MVP; recontado con script)* *(2026-09-30: `DEC-ARCH-016`, de las FASES 6 y 7; recontado con script)* *(2026-09-30: `DEC-MIG-007` y `DEC-ARCH-015`, de la FASE 5)* *(2026-09-26: `DEC-AUTH-002` y `DEC-AUTH-003`; 2026-09-28: las ocho de la revisión del owner; 2026-09-29: `DEC-MP-009`, de las mediciones, y `DEC-ARCH-014`, de la verificación corta; 2026-09-30: `DEC-AUTH-004` y `DEC-AUTH-005`, de la FASE 9 vuelta 3)* |
| **Precisadas sin `SUPERSEDED`** | ~~**26**~~ ~~**29**~~ ~~**34**~~ ~~**35**~~ ~~**44**~~ ~~**47**~~ ~~**58**~~ ~~**66**~~ ~~**68**~~ ~~**69**~~ ~~**70**~~ ~~**71**~~ ~~**73**~~ ~~**74**~~ ~~**75**~~ **76** *(recontado con script el 2026-10-02, tras los cinco 📌 del lote BK a BV del corte del MVP (con OK del owner; BM, con su aclaración): caen sobre `DEC-ARCH-016`, `DEC-ARCH-017`, `DEC-METH-019`, `DEC-DATA-008` y `DEC-MP-002`, que ya estaban contadas, y la cifra no se mueve, 76; `SUPERSEDED` sigue en 12)* *(recontado con script el 2026-10-01, tras los tres 📌 del lote BA a BH (con OK del owner): caen sobre `DEC-METH-019`, `DEC-ARCH-017` y `DEC-DATA-008`, que ya estaban contadas, y la cifra no se mueve, 76)* *(recontado con script el 2026-10-01, tras el 📌 de AZ (con OK del owner): cae sobre `DEC-METH-019`, que ya estaba contada, y la cifra no se mueve, 76)* *(recontado con script el 2026-10-01, tras los 📌 del lote AW a AY del corte del MVP (con OK del owner): suma `DEC-METH-019`, que había nacido con el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 75 a 76; `DEC-ARCH-017`, que recibe el de AW, ya estaba contada)* *(recontado con script el 2026-10-01, tras el 📌 del lote AP a AU del corte del MVP (con OK del owner): suma `DEC-ARCH-017`, que había nacido con el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 74 a 75)* *(recontado con script el 2026-10-01, tras los dos 📌 del corte del MVP (letra Y, con OK del owner): suma `DEC-ARCH-016`, que tenía el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 73 a 74; `DEC-ARCH-007` ya estaba contada, y `DEC-ARCH-017` y `DEC-METH-019` nacen con el *Estado* en `ACCEPTED` a secas)* *(recontado con script el 2026-09-30, tras los 📌 del lote de la aplicación de las FASES 6 y 7 (letra M, con OK del owner): suman `DEC-CI-001` y `DEC-TEST-002`, que tenían el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 71 a 73; el resultado del pase de la FASE 6 entra en `DEC-METH-018` como campo propio y no como 📌, así que `DEC-METH-018` no suma)* *(recontado con script el 2026-09-30, tras el 📌 de las FASES 6 y 7 (letra F, con OK del owner al lote): cae sobre `DEC-ARCH-014`, que ya estaba contada, y `DEC-METH-018` y `DEC-ARCH-016` nacen con el *Estado* en `ACCEPTED` a secas, así que la cifra no se mueve, 71; `SUPERSEDED` sigue en 12)* *(recontado con script el 2026-09-30, tras los dieciocho 📌 de la aplicación de la FASE 5 (con OK del owner a los lotes 1 a 6 y al lote E de la simplificación del corte): suman `DEC-AUTH-001` y `DEC-ENT-006`, que tenían el *Estado* en `ACCEPTED` a secas, y sale `DEC-MIG-004`, que pasa a `SUPERSEDED`; la cifra pasa de 70 a 71; las otras trece que reciben 📌 ya estaban contadas, y `DEC-MIG-002` sigue en la fila de `SUPERSEDED`)* *(y recontado con script el 2026-09-30, tras los once 📌 del lote de la aplicación de la FASE 5, letras A a L, con OK del owner: caen sobre `DEC-MIG-003`, `DEC-MIG-005`, `DEC-MIG-006`, `DEC-ARCH-013`, `DEC-ARCH-014`, `DEC-TEST-001`, `DEC-ENT-006`, `DEC-CONC-002`, `DEC-RF-008` y `DEC-AUTH-003`, que ya estaban contadas, y sobre `DEC-MIG-002`, que sigue en la fila de `SUPERSEDED`; la cifra no se mueve, 71, y `SUPERSEDED` sigue en 12)* *(y recontado con script el 2026-09-30, tras los tres 📌 de la segunda tanda del lote de la aplicación de la FASE 5, letras M a P, con OK del owner: caen sobre `DEC-RF-008` (M), `DEC-ENT-006` (N y O) y `DEC-MIG-003` (P), que ya estaban contadas; ninguna decisión nueva, las decisiones siguen en 142 —125 funcionales y 17 de metodología— y esta cifra no se mueve, 71)* *(recontado el 2026-09-25: decía ~~2~~ y eran 11, porque contaba sólo las precisadas por otra decisión y dejaba afuera las que tienen 📌 con OK del owner; y recontado otra vez el mismo día con script, tras registrar las elecciones 9a–9h que el owner ratificó: suman `DEC-SUB-022`, `DEC-ADDON-007` y `DEC-ARCH-006`; y recontado con script el 2026-09-26, tras los 📌 de la FASE 9 vuelta 1: suman `DEC-ARCH-005`, `DEC-RF-001`, `DEC-SUB-010`, `DEC-RF-008` y `DEC-MP-006`. Criterio: el campo *Estado* entero —puede ocupar varias líneas— dice precisada, recontada, enmendada o cerrada, y no dice `SUPERSEDED`. `DEC-MIG-002` recibió su 📌 el mismo día (`G4-1`) y **no suma**: está `SUPERSEDED EN PARTE`, y se cuenta en esa fila; y recontado con script el 2026-09-27, tras los 📌 de la FASE 9 vuelta 2: suma `DEC-AUTH-002`, que dice precisada en su *Estado* desde el 2026-09-26 y faltaba en la cifra. ~~Los dieciséis 📌 de la vuelta 2 no mueven la cifra: las siete decisiones que los reciben con marca en su *Estado* (`DEC-ADDON-004`, `DEC-RF-001`, `DEC-SUB-019`, `DEC-MIG-004`, `DEC-MIG-003`, `DEC-ARCH-006` y `DEC-DATA-005`) ya estaban contadas, y las otras nueve no llevan marca en su *Estado*~~; y recontado con script el mismo 2026-09-27, después de que las otras nueve sumaran su marca al *Estado* con OK del owner (FASE 9 vuelta 2, `Q-ESTADO`): suman `DEC-ADDON-002`, `DEC-GRANT-007`, `DEC-SUB-009`, `DEC-RF-006`, `DEC-MIG-005`, `DEC-ARCH-011`, `DEC-TRIAL-004`, `DEC-AUTH-003` y `DEC-LEGAL-001`, y la cifra pasa de 35 a 44; el 📌 de `Q-ACC16` en `DEC-RF-008` no la mueve, porque ya estaba contada; y recontado con script el 2026-09-28, tras los quince 📌 de la verificación de la FASE 9 vuelta 2 (`V2-y`, con OK del owner): suman `DEC-OBS-001`, `DEC-RF-003` y `DEC-RF-004`, que tenían el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 44 a 47; las otras doce que reciben 📌 ya estaban contadas; y recontado con script el 2026-09-28, tras los treinta 📌 de la revisión del owner (con OK del owner al lote): suman trece que tenían el *Estado* en `ACCEPTED` a secas (`DEC-TRIAL-003`, `DEC-TRIAL-006`, `DEC-TRIAL-007`, `DEC-TRIAL-008`, `DEC-ENT-001`, `DEC-ENT-002`, `DEC-SUB-002`, `DEC-SUB-007`, `DEC-SUB-008`, `DEC-SUB-016`, `DEC-MP-002`, `DEC-ARCH-004` y `DEC-ARCH-007`), y salen dos que pasan a llevar `SUPERSEDED` (`DEC-DATA-002`, en parte, y `DEC-ARCH-011`, entera), y la cifra pasa de 47 a 58; las otras dieciséis que reciben 📌 ya estaban contadas; y recontado con script el 2026-09-29, tras los diecisiete 📌 de los casos vecinos de la revisión del owner (con OK del owner al lote): suman ocho que tenían el *Estado* en `ACCEPTED` a secas (`DEC-MIG-006`, `DEC-DATA-006`, `DEC-DATA-007`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-SUB-023`, `DEC-TEST-003` y `DEC-DATA-008`), y la cifra pasa de 58 a 66; las otras nueve que reciben 📌 ya estaban contadas; y recontado con script el 2026-09-29, tras los diez 📌 de la verificación corta: caen sobre decisiones ya precisadas, y `DEC-ARCH-014` nace sin precisar, así que no suman; y recontado con script el 2026-09-29, tras los tres 📌 del lote O de la verificación corta: suma `DEC-ARCH-014`, que tenía el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 68 a 69; `DEC-MIG-003` y `DEC-MP-009` ya estaban contadas; y recontado con script el 2026-09-29, tras los cuatro 📌 del lote P de la verificación corta: caen sobre decisiones ya precisadas (`DEC-ARCH-014`, `DEC-MIG-003`, `DEC-MIG-005` y `DEC-ARCH-006`), y la cifra no se mueve; y recontado con script el 2026-09-30, tras los siete 📌 de la FASE 9 vuelta 3 (con OK del owner al lote, lote AB): caen sobre decisiones ya precisadas (`DEC-DATA-005`, `DEC-ARCH-013`, `DEC-DATA-008`, `DEC-ARCH-006`, `DEC-RF-001`, `DEC-CONC-001` y `DEC-MIG-005`), y `DEC-AUTH-004` y `DEC-AUTH-005` nacen sin precisar, así que la cifra no se mueve; y recontado con script el 2026-09-30, tras los dos 📌 del lote AN de la FASE 9 vuelta 3 (con OK del owner): suma `DEC-AUTH-005`, que tenía el *Estado* en `ACCEPTED` a secas, y la cifra pasa de 69 a 70; `DEC-ARCH-006` ya estaba contada)* — **por otra decisión**: **`DEC-SUB-019`** por `DEC-MP-008` (el motivo `PROVIDER_DUNNING` que decía conservar), **`DEC-METH-006`** por `DEC-METH-008` (que le enmendó el punto 2 el mismo día) y por **`DEC-METH-013`**, `DEC-MP-008` por `DEC-SUB-022`, `DEC-RF-007` por `DEC-RF-008`, y `DEC-ADDON-003` y `DEC-ADDON-004` por `DEC-ADDON-007`; **con 📌 o puntero del owner**: `DEC-DATA-001`, `DEC-SUB-006`, `DEC-CONC-002`, `DEC-MAIL-001`, `DEC-GRANT-003`, `DEC-GRANT-004`, `DEC-MIG-003`, `DEC-SUB-017`, `DEC-SUB-020`, `DEC-SUB-021`, `DEC-ARCH-008`, `DEC-ARCH-009`, `DEC-TRIAL-010`, ~~`DEC-DATA-002`~~, `DEC-DATA-004`, `DEC-TEST-001`, `DEC-DATA-005`, ~~`DEC-MIG-004`~~, `DEC-SUB-013`, `DEC-PROMO-001`, **`DEC-SUB-022`** (9d), **`DEC-ADDON-007`** (9e, 9f), **`DEC-ARCH-006`** (9h); **y desde el 2026-09-26** (FASE 9 vuelta 1): **`DEC-ARCH-005`** (contradicción (b)), **`DEC-RF-001`** (`F-8V1B1-005`, `G5-4`), **`DEC-SUB-010`** (`G5-3`), **`DEC-RF-008`** (`G5-2`), **`DEC-MP-006`** (cláusula 1) y **`DEC-AUTH-002`** (actor = sujeto compara cuentas); **y desde el 2026-09-27** (FASE 9 vuelta 2, `Q-ESTADO`): **`DEC-ADDON-002`**, **`DEC-GRANT-007`**, **`DEC-SUB-009`**, **`DEC-RF-006`**, **`DEC-MIG-005`**, ~~**`DEC-ARCH-011`**~~, **`DEC-TRIAL-004`**, **`DEC-AUTH-003`** y **`DEC-LEGAL-001`**; **y desde el 2026-09-28** (FASE 9 vuelta 2, verificación, `V2-y`): **`DEC-OBS-001`**, **`DEC-RF-003`** y **`DEC-RF-004`**; **y desde el 2026-09-28** (revisión del owner): **`DEC-TRIAL-003`**, **`DEC-TRIAL-006`**, **`DEC-TRIAL-007`**, **`DEC-TRIAL-008`**, **`DEC-ENT-001`**, **`DEC-ENT-002`**, **`DEC-SUB-002`**, **`DEC-SUB-007`**, **`DEC-SUB-008`**, **`DEC-SUB-016`**, **`DEC-MP-002`**, **`DEC-ARCH-004`** y **`DEC-ARCH-007`**; tachadas, las dos que salieron el mismo día al recibir su `SUPERSEDED`; **y desde el 2026-09-29** (revisión del owner, casos vecinos): **`DEC-MIG-006`**, **`DEC-DATA-006`**, **`DEC-DATA-007`**, **`DEC-ARCH-012`**, **`DEC-ARCH-013`**, **`DEC-SUB-023`**, **`DEC-TEST-003`** y **`DEC-DATA-008`**; **y desde el 2026-09-29** (mediciones del 2026-09-29, recontado con script): **`DEC-MP-009`**, nueva y precisada el mismo día por el lote L-B, y **`DEC-CONC-001`**, por el lote L-C; **y desde el 2026-09-29** (verificación corta, lote O, recontado con script): **`DEC-ARCH-014`**; **y desde el 2026-09-30** (FASE 9 vuelta 3, lote AN, recontado con script): **`DEC-AUTH-005`**; **y desde el 2026-09-30** (FASE 5, recontado con script): **`DEC-AUTH-001`** y **`DEC-ENT-006`**; tachada, `DEC-MIG-004`, que salió el mismo día al recibir su `SUPERSEDED`. Los otros cuatro 📌 de las mediciones caen sobre decisiones que ya estaban precisadas y no suman. La entrada vieja **no se editó en su contenido**: lleva el puntero en su campo *Estado*, como `DEC-MIG-001`. ⚠️ **Leer `DEC-METH-006` sola da el criterio de corte equivocado** |
| | Recontadas el 2026-09-16 leyendo los encabezados, no a mano: la tabla venía arrastrando **un error de uno** desde antes de esta sesión. La plantilla del formato (`### DEC-<AREA>-<NNN>`) no es una decisión y no se cuenta |
| `SUPERSEDED` | ~~**6**~~ ~~**11**~~ **12** — **`DEC-MIG-004`** por `DEC-MIG-007` (2026-09-30, FASE 5, simplificación del corte, lote E: su mecanismo humano es la premisa 4, y los defectos #15 y #16, el umbral de veinte y el día 180 quedan sin sujeto) · **las cinco de la revisión del owner** (2026-09-28): **`DEC-SUB-015`**, **`DEC-SUB-018`**, **`DEC-GRANT-010`** y **`DEC-ARCH-011`**, enteras, por C8 (las verticales no se discontinúan; sin decisión que las reemplace), y **`DEC-DATA-002` EN PARTE** por `DEC-DATA-006` (se cae que el reloj corre durante la pausa y la desigualdad que la protegía; sobrevive el resto) · **`DEC-MIG-002` EN PARTE** por `DEC-MIG-003` (sobrevive *«se siguen tomando altas»*, se cae *«se transcriben a mano»*; puntero registrado el 2026-09-25), **`DEC-SUB-003`** por `DEC-SUB-021` (2026-09-25, entera), `DEC-SUB-001` por `DEC-SUB-005`, `DEC-SUB-005` por `DEC-SUB-006`, **`DEC-MIG-001` EN PARTE** por `DEC-MIG-003` (sobrevive *«cero código de migración»*, se cae el destino) y **`DEC-MP-003` EN PARTE** por `DEC-MP-008` (sobrevive el diagnóstico, se cae el motivo `PROVIDER_DUNNING`) |
| **Preguntas del owner abiertas** | **0 de 25** |
| Bloqueantes de FASE 2 que decide el owner | **9 de 9 cerradas** — `BD-MP-04` volvió al owner y la cerró `DEC-ADDON-002` |
| Bloqueantes de FASE 2 que decide el experimento | **0 abiertas** — `BD-MP-01` (pausa) la cerró `DEC-SUB-010` y `BD-MP-02` (cortesía) la cerró `DEC-GRANT-003`, las dos el 2026-09-16 con el reloj leído; `BD-MP-03` la había cerrado `DEC-MP-001`; `BD-MP-04` tiene sus filas medidas pero **le sobrevivió una elección de diseño** |
| Decisiones condicionadas a FASE 1C | ~~**2**~~ **1** — `DEC-SUB-010`, a la segunda lectura del reloj (¿la fecha corre +1 ciclo por vencimiento **indefinidamente**, o sólo la primera vez?) · ~~y **`DEC-SUB-021`** (desde el 2026-09-25), a `GR-1`: si un pago con la tarjeta cambiada durante el grace cierra el ciclo fallido~~ (tachado 2026-09-26: `GR-1` `VERIFIED`, ver el 📌 de `DEC-SUB-021`) |
| | `DEC-SUB-006` y `DEC-SUB-007` **se destrabaron el 2026-09-16**: `EX-33` quedó `VERIFIED` en **producción con tarjeta real**, medido tres veces sobre el mismo pagador. El checkout respeta la fecha de primer cobro futura, así que el cliente que cambia de ciclo no paga dos veces. ⚠️ Pero la medición trajo `EX-38` de arriba: el proveedor **convierte esa fecha en un free trial** y se lo anuncia al cliente como «Tu prueba gratis comenzó». El mecanismo funciona; **lo que hay que resolver es qué le decimos nosotros a alguien a quien el proveedor acaba de anunciarle una prueba gratis sobre días que ya pagó** |
| Decisiones de arquitectura del owner | **4**, las cuatro del 2026-09-18 — **`DEC-ARCH-004`**: el billing se implementa de nuestro lado, con la pasarela detrás de un adaptador. Es la **primera decisión del programa que no sale de una medición sino de un criterio del owner**. **`DEC-ARCH-005`**: el programa se parte en dos épicas **autónomas**, `HOS-1353` (verticales, arranca) y `HOS-1354` (billing, espera). **`DEC-ARCH-006`**: la frontera entre las dos es un contrato único con dos implementaciones desde el día uno — la condición B de `DEC-ARCH-004` aplicada a esta frontera. **`DEC-ARCH-007`**: se desarrollan en paralelo y **se liberan juntas** — ninguna llega a producción sola, y una rama de integración del paraguas lo hace cumplir |
| Apartamientos declarados del PDR | ~~**8**~~ ~~**9**~~ ~~**10**~~ **11** *(2026-09-30, recontado en la aplicación del log de la FASE 5: suma **`DEC-METH-017`**, que se declara apartamiento de la plantilla de la FASE 5 del PDR, *«Clasificar: KEEP · ADAPT · REWRITE · DELETE · MISSING»*, y no se había sumado acá)* *(2026-09-28: suma **`DEC-ARCH-012`**, del §55.1, el agrupamiento viejo de Gastronomía y Experiencia que desaparece ni como histórico~~; serían 10 si el owner declara el del §25 por los plazos configurables, `DEC-DATA-008`~~)* *(2026-09-29: suma **`DEC-DATA-008`**, del §25, los 90 y 180 días de la retención que pasan a ser configurables (casos vecinos, caso 46))* *(2026-09-30: **`DEC-AUTH-004`** y **`DEC-AUTH-005`** no suman: el §17.3 no dice qué hacer si el correo ya tiene usuario ni cuántos Partners tiene una cuenta, y su camino A ya supone un postulante sin cuenta)* *(recontado el 2026-09-25: eran 7 porque faltaba `DEC-MAIL-001`. `DEC-MIG-005` **no suma un noveno**: el orquestador proponía declarar el §25 —«Conservar: … pagos»— y consultarlo con el abogado; el owner decidió que no hace falta, porque la cartera del corte se trata como clientes nuevos. Las dos posiciones están en esa entrada)* — **`DEC-MAIL-001`** (§43 y §64.25: antes de cancelar, el correo **sí** bloquea la acción; el invariante 25 del núcleo la registra como la única que contradice un invariante del §64 de frente), `DEC-ENT-001` (§10.3), `DEC-GRANT-002` (§34) y **`DEC-ARCH-003`** (§10.6, el `SUSPENDED` doble, que ya estaba anticipado acá y el 2026-09-17 tomó ID propio), **`DEC-OBS-001`** (§22.1, el aviso agregado en vez de uno por evento), **`DEC-METH-004`** (§65, la FASE 9 con cuatro salidas en vez de los cuatro documentos, y el criterio de «resuelto»), **`DEC-SUB-011`** (§11 y §64.8, el invariante 8 cuenta compromisos y no filas) y **`DEC-METH-006`** (§65, la FASE 8 vuelve a correr sobre lo que la 9 produjo, en vez de fases en secuencia) |
| Decisiones de la FASE 9 | **6**, las seis del 2026-09-19 — `DEC-GRANT-005` (el grant anclado al plan, con trinquete), `DEC-CONC-003` (la marca, que **revisa una razón escrita del owner**), `DEC-SUB-011` (compromisos, no filas), `DEC-MIG-003` (no se migra), `DEC-METH-006` (el ciclo 8 ↔ 9) y `DEC-METH-007` (el gate de FASE 5, con criterio de dos filtros). Salieron de las 37 preguntas que los cinco racimos resueltos dejaron para el owner |
| Decisiones de la FASE 9 completa | **7 nuevas y ~~15~~ 18 precisiones**, del 2026-09-25, sobre las 32 respuestas del owner a los 33 puntos (`26-fase-9-completa/10`). Nuevas: `DEC-SUB-022`, `DEC-MIG-005`, `DEC-RF-008`, `DEC-ADDON-007`, `DEC-AUTH-001`, `DEC-ENT-006`, `DEC-ARCH-011`. Precisiones: `DEC-SUB-021`, `DEC-MP-008`, `DEC-MIG-003`, `DEC-MIG-004`, `DEC-MAIL-001`, `DEC-RF-007`, `DEC-PROMO-001`, `DEC-ARCH-009`, `DEC-TRIAL-010`, `DEC-CONC-002`, `DEC-DATA-002`, `DEC-DATA-005`, `DEC-SUB-013`, `DEC-ADDON-003`, `DEC-ADDON-004`. Y ocho correcciones de registro sin decisión: `DEC-MIG-002` (el puntero de su supersesión), `DEC-DATA-004`, `DEC-TEST-001`, `DEC-SUB-019`, `DEC-ARCH-008`, `DEC-DATA-001`, `DEC-SUB-006`, `DEC-SUB-017`. **Y las ocho elecciones de los agentes de aplicación que el owner ratificó el mismo día** (`26-fase-9-completa/10`, filas 9a–9h; dos corregidas por él, 9a y 9h), registradas como 📌: `DEC-MP-008` (9a, 9b), `DEC-MAIL-001` (9c), **`DEC-SUB-022`** (9d), **`DEC-ADDON-007`** (9e, 9f), `DEC-PROMO-001` (9g) y **`DEC-ARCH-006`** (9h); las tres en negrita son las precisiones que suman |
| Decisiones de la revisión del owner | **8 nuevas, 30 📌 y 5 `SUPERSEDED`**, del 2026-09-28, sobre los 15 comentarios y las 9 notas del owner a la presentación (`30-revision-del-owner/10-decisiones-del-owner.md`), en el lote de `30-revision-del-owner/14-aplicacion-transversal-y-lote.md` §4 que el owner aprobó entero. Nuevas: `DEC-MIG-006`, `DEC-DATA-006`, `DEC-DATA-007`, `DEC-SUB-023`, `DEC-TEST-003`, `DEC-ARCH-012`, `DEC-ARCH-013`, `DEC-DATA-008`. `SUPERSEDED`: `DEC-SUB-015`, `DEC-SUB-018`, `DEC-GRANT-010` y `DEC-ARCH-011` enteras, `DEC-DATA-002` en parte. Registro: `30-revision-del-owner/15-aplicacion-log-y-matriz.md` |
| Casos vecinos de la revisión del owner | **0 nuevas, 17 📌, 0 `SUPERSEDED`**, del 2026-09-29, sobre los 76 casos vecinos decididos (`30-revision-del-owner/16-`: los 50 de los lotes A a E, y los lotes F, G, H, I, J y K, de cuatro, cuatro, siete, cinco, tres y tres); registros `17-` a `23-`. Lote en `30-revision-del-owner/23-aplicacion-casos-lote-k.md` §4, que el owner aprobó entero el 2026-09-29. Registro: `30-revision-del-owner/24-aplicacion-casos-log-y-matriz.md` |
| Mediciones del 2026-09-29 | **1 nueva, 6 📌, 0 `SUPERSEDED`**, sobre M-1 a M-5 (`30-revision-del-owner/27-`) y los diez puntos de `25-` § 4, en el lote de `30-revision-del-owner/28-aplicacion-mediciones-al-diseno.md` § 4, más el lote L de `27-` (letras A, B y C), que el owner aprobó el 2026-09-29. Nueva: `DEC-MP-009`. 📌: `DEC-MP-008`, `DEC-SUB-009` (con la letra A), `DEC-TEST-003`, `DEC-DATA-008` (con la letra B), `DEC-MP-009` (letra B) y `DEC-CONC-001` (letra C). Registro: `30-revision-del-owner/29-aplicacion-lote-l-log-y-matriz.md` |
| Verificación corta | **1 nueva, ~~10~~ ~~13~~ 17 📌, 0 `SUPERSEDED`**, del 2026-09-29, sobre los ocho hallazgos que bloquean (el lote M de `30-revision-del-owner/32-`, todas la recomendada), los menores que se aplicaron sin elección (`30-` y `31-`) y el lote N de `32-` (lo que pidió elegir la tanda que aplicó el lote M; N-A reformulada por el owner). Nueva: `DEC-ARCH-014` (N-A). 📌: `DEC-SUB-023` (M-A, M-B, M-C, N-E), `DEC-ARCH-004` (M-D, N-A), `DEC-ARCH-012` (M-E, N-A, `VC-VT-10`), `DEC-ARCH-006` (M-F, N-A, N-C), `DEC-DATA-005` (M-F, M-G, N-C, N-F, N-G), `DEC-DATA-006` (M-H, `VC-VT-05`), `DEC-CONC-001` (N-B), `DEC-MP-009` (N-D), `DEC-DATA-008` (N-H) y `DEC-ENT-002` (N-I); **y el lote O de `32-`** (lo que pidió elegir la tanda que aplicó el lote N, las dos la recomendada): `DEC-ARCH-014` (O-A, O-B), `DEC-MIG-003` (O-B) y `DEC-MP-009` (O-B); **y el lote P de `32-`** (lo que pidió elegir la tanda que aplicó el lote O, las tres la recomendada): `DEC-ARCH-014` (P-A, P-B, P-C), `DEC-MIG-003` (P-A), `DEC-MIG-005` (P-B) y `DEC-ARCH-006` (P-C). Registros: `30-revision-del-owner/33-aplicacion-lote-m-y-menores.md`, `30-revision-del-owner/34-aplicacion-lote-n.md`, `30-revision-del-owner/35-aplicacion-lote-o.md` y `30-revision-del-owner/36-aplicacion-lote-p.md` |
| FASE 9 vuelta 3 | **2 nuevas, 7 📌, 0 `SUPERSEDED`**, del 2026-09-30, sobre las decisiones del owner de los lotes A a AA (`37-fase-8-vuelta-3/10-decisiones-del-owner.md`; contra la recomendación, F, I y J), en el lote de `37-fase-8-vuelta-3/14-aplicacion-cierre.md` § «Para el owner» que el owner aprobó el 2026-09-30 (lote AB), con Q sumado a `DEC-ARCH-006`, Y a `DEC-CONC-001`, los valores de R a `DEC-DATA-008` y AA a `DEC-AUTH-004`. Nuevas: `DEC-AUTH-004` (A, B, AA) y `DEC-AUTH-005` (I, M). 📌: `DEC-DATA-005` (H), `DEC-ARCH-013` (C), `DEC-DATA-008` (K, R), `DEC-ARCH-006` (D, Q), `DEC-RF-001` (L), `DEC-CONC-001` (E, Y) y `DEC-MIG-005` (F, G). Registro: `37-fase-8-vuelta-3/16-aplicacion-log-y-matriz.md` |
| FASE 5 | **3 nuevas, 18 📌 sobre 16 decisiones, 1 `SUPERSEDED`**, del 2026-09-30. Nuevas: `DEC-METH-017` (lote A del criterio), `DEC-MIG-007` (las premisas del corte) y `DEC-ARCH-015` (lote B del nombre). 📌 de los lotes 1 a 6 (`38-fase-5/10-decisiones-del-owner.md`; contra la recomendación, 1 I y 4 B): `DEC-ARCH-014` (1 A a I y 2 E), `DEC-ARCH-005` (2 A y B), `DEC-ARCH-012` (1 C, 1 H y 6 G), `DEC-ARCH-013` (1 C, 2 C, 2 D y 3 D), `DEC-DATA-008` (3 D), `DEC-MIG-003` (3 E y F), `DEC-ENT-006` (1 D y 4 B), `DEC-AUTH-001` (4 D y 6 G), `DEC-AUTH-003` (3 C y 4 C), `DEC-AUTH-005` (4 A), `DEC-DATA-005` (4 E) y `DEC-RF-008` (5 F); y del lote E de la simplificación del corte (`38-fase-5/20-simplificacion-del-corte.md` §11, con las letras A a D): `DEC-MIG-002`, `DEC-MIG-003`, `DEC-MIG-005`, `DEC-MIG-006`, `DEC-CONC-002` y `DEC-ARCH-014`. `SUPERSEDED`: `DEC-MIG-004`, por `DEC-MIG-007`. Registro: `38-fase-5/18-aplicacion-log-y-matriz.md`. **Y el lote de la aplicación** (`38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación», letras A a L; contra la recomendación, A): **0 nuevas, 11 📌 sobre 11 decisiones, 0 `SUPERSEDED`** — `DEC-MIG-002` (A), `DEC-MIG-003` (A, C y D), `DEC-MIG-005` (A), `DEC-MIG-006` (B y D), `DEC-ARCH-013` (E y B), `DEC-TEST-001` (E), `DEC-ARCH-014` (H y E), `DEC-ENT-006` (F y H), `DEC-CONC-002` (I), `DEC-RF-008` (J) y `DEC-AUTH-003` (L); G y K no contradicen ninguna decisión viva y no dejan 📌; los guards pasan de 33 a 34 (E). Registro: `38-fase-5/25-aplicacion-lote-de-aplicacion-nucleo-y-log.md`. **Y la segunda tanda del lote de la aplicación** (`38-fase-5/10-decisiones-del-owner.md`, «Lote de la aplicación, segunda tanda», letras M a P, todas la recomendada): **0 nuevas, 3 📌 sobre 3 decisiones, 0 `SUPERSEDED`** — `DEC-RF-008` (M), `DEC-ENT-006` (N y O) y `DEC-MIG-003` (P); el 34 de los guards es `G18`, de `V1`. Registro: `38-fase-5/27-aplicacion-segunda-tanda-cobro-paraguas-y-log.md` |
| FASES 6 y 7 | **2 nuevas, ~~1 📌~~ ~~3 📌~~ 6 📌, 0 `SUPERSEDED`** *(con la verificación ajena, `39-fases-6-y-7/21-verificacion.md`: suman `DEC-TEST-003` (L y B, FASES 6 y 7, verificación, 2026-09-30, F4), `DEC-ARCH-014` (I) y `DEC-ENT-006` (J, FASES 6 y 7, verificación, 2026-09-30, F12); las tres ya estaban contadas entre las precisadas, que siguen en 73)*, del 2026-09-30, sobre las siete preguntas del lote (`39-fases-6-y-7/10-decisiones-del-owner.md`, letras A a G, todas la recomendada, con lo derivado del §2.3 de `39-fases-6-y-7/00-propuesta.md`). Nuevas: `DEC-METH-018` (G: la FASE 6 cerrada por absorción en la 5, con el pase sobre las 29 piezas y los tres guards) y `DEC-ARCH-016` (A a E: los gates de aceptación). 📌: `DEC-ARCH-014` (F: `U3`, el script del corte, y las 25 unidades; y K del lote de la aplicación: `U3` entra después de `U1`). ~~`DEC-ARCH-016` precisa además a `DEC-CI-001` y a `DEC-TEST-002` desde su propio texto, sin 📌 en ellas.~~ **Y el lote de la aplicación** (`10-decisiones-del-owner.md`, «Lote de la aplicación (K–M)», todas la recomendada): 📌 en `DEC-CI-001` y `DEC-TEST-002` por la precisión de `DEC-ARCH-016` (M), y el recorte del checklist viejo de `B13` sale de `DEC-ARCH-016` (L). **Y el lote del pase de la FASE 6** (`10-decisiones-del-owner.md`, «Lote del pase de la FASE 6 (H–J)», todas la recomendada): el resultado del pase entra en `DEC-METH-018`, y los guards pasan de 34 a 35 con `G19`, de `V5` (H). La matriz no cambia. Registro: `39-fases-6-y-7/11-aplicacion.md` |
| Corte del MVP | **2 nuevas, ~~2 📌~~ ~~3 📌~~ ~~4 📌~~ ~~6 📌~~ ~~7 📌~~ ~~10 📌~~ ~~11 📌~~ 16 📌, 0 `SUPERSEDED`**, del 2026-10-01 y el 2026-10-02, sobre los lotes Y a AE, AF a AO, AP a AU, AV, AW a AY, AZ, BA a BH, BI a BJ (BI, reemplazada por BJ) y BK a BV (BM, con la aclaración del owner) (`41-corte-del-mvp/10-decisiones-del-owner.md`, todas la recomendada). Nuevas: `DEC-ARCH-017` (Y a AE, AF: el MVP) y `DEC-METH-019` (AF a AO: la spec consolidada). 📌: `DEC-ARCH-007` y `DEC-ARCH-016` (Y), `DEC-ARCH-017` (AP a AU, AV y AW, BC, BF, BG y BH, y BJ), `DEC-METH-019` (AX y AY, AZ, y BA, BB y BE) y `DEC-DATA-008` (BD); **y del lote BK a BV, el 2026-10-02**: `DEC-ARCH-016` (BQ), `DEC-ARCH-017` (BL, BN, BO, BP y BR), `DEC-METH-019` (BK, BS y BT), `DEC-DATA-008` (BU y BV) y `DEC-MP-002` (BM). La matriz no cambia; las precisadas pasan a 76 con `DEC-METH-019` (`DEC-ARCH-017` ya estaba contada), y los tres 📌 del lote BA a BH caen sobre decisiones ya contadas: siguen en 76, recontado con script; el 📌 de BJ cae sobre `DEC-ARCH-017`, ya contada: siguen en 76, recontado con script; y los cinco 📌 del lote BK a BV caen sobre decisiones ya contadas: siguen en 76, recontado con script el 2026-10-02. Registro: `41-corte-del-mvp/20-aplicacion.md` |
