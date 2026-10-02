# Decisiones vigentes

Las decisiones `ACCEPTED` (y las `SUPERSEDED EN PARTE`, en lo que sobrevive) del decision log del
paraguas, en su forma efectiva, con sus 📌 vivos; y, al final, el registro de las letras del owner.
Fuente congelada: `{{SHA}}` (`DEC-METH-019`, punto 1). Lo
retirado —las decisiones `SUPERSEDED` enteras, los 📌 muertos y la letra BI— vive en
[`90-retirados.md`](90-retirados.md) y acá sólo se enlaza.

## Cómo se lee

- **Orden**: por área (`TRIAL`, `SUB`, `MP`, `ENT`, `ADDON`, `PROMO`, `AUTH`, `DATA`, `MAIL`, `ARCH`,
  `MIG`, `GRANT`, `LEGAL`, `TEST`, y las áreas que el log usa sin listarlas en su *Formato*:
  `CONC`, `RF`, `OBS`, `CI`; `METH` al final), y dentro de cada área por el número del log.
- **Cada decisión**: su ancla, su título sin lo tachado, `Origen:` (la línea de su encabezado en el
  log; la entrada sigue hasta el encabezado siguiente), la pieza **dueña** de su AC según
  `_trabajo/cobertura.json` («Dueña del AC»), las que **también** la ejercen con su rol, y los tipos
  de test mínimos; después, el texto de la entrada con lo tachado omitido.
- **Los 📌**: en el lugar exacto donde el log los escribe, el texto de la decisión deja un puntero
  `→ ver 📌n`; el 📌 se desarrolla enseguida de la decisión, con su propia ancla, su `Origen:` y
  su dueña. Si la adjudicación (`_trabajo/adjudicacion.json`) dice que el 📌 **reemplaza parte** de
  lo anterior, el puntero lo dice. Un 📌 retirado deja sólo el puntero a `90-retirados.md`.
- **Adjudicación `PARCIAL`**: la parte del 📌 que una fuente posterior superó sin tacharla está
  omitida y marcada «[…]»; debajo, una nota dice qué se omitió y qué línea lo supera.
- **`SUPERSEDED EN PARTE`** (`DEC-MIG-001`, `DEC-MIG-002`, `DEC-DATA-002`, `DEC-MP-003`): su propio
  campo *Estado* (o su «⚠️ Qué sobrevive») declara qué parte vale, y llevan además adjudicación
  `PARCIAL` (BK): la parte muerta está omitida y marcada «[…]», con su nota «Parte sin efecto» al
  final del cuerpo, como cualquier otra `PARCIAL`.
- **Sólo citables**: las decisiones de metodología (`DEC-METH-*`, owner AX) y la lista cerrada de
  BA y BB (`03-contrato-de-cobertura.md`) no llevan AC; su entrada lo dice.
- Los vínculos relativos del log se reescribieron para que resuelvan desde esta carpeta
  (`../docs/…`).
