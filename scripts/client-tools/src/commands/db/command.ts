import type { ClientCommand } from '../../registry.ts';
import { runDbFresh } from './fresh.ts';
import { runDbMigrate, runDbSeed, runDbStudio } from './migrate-seed-studio.ts';
import { runDbStart, runDbStop } from './start-stop.ts';
import { runDbUpdateTemplate } from './update-template.ts';

/** `hops db-start` — bring the shared Postgres + Redis containers up. */
export const dbStartCommand: ClientCommand = {
    name: 'db-start',
    summary: 'Levanta Postgres y Redis (compartidos por todos los worktrees)',
    scope: 'local',
    run: (argv) => runDbStart({ argv })
};

/** `hops db-stop` — take them down, naming who else is using them. */
export const dbStopCommand: ClientCommand = {
    name: 'db-stop',
    summary: 'Baja Postgres y Redis, avisando a qué worktrees corta',
    scope: 'local',
    run: (argv) => runDbStop({ argv })
};

/** `hops db-migrate` — run the three migration lanes in order. */
export const dbMigrateCommand: ClientCommand = {
    name: 'db-migrate',
    summary: 'Pone la base al día: esquema, extras y data-migrations',
    scope: 'local',
    run: (argv) => runDbMigrate({ argv })
};

/** `hops db-seed` — load a seed set into the target database. */
export const dbSeedCommand: ClientCommand = {
    name: 'db-seed',
    summary: 'Carga datos en la base del worktree',
    scope: 'local',
    run: (argv) => runDbSeed({ argv })
};

/** `hops db-studio` — Drizzle Studio, pointed at the right database. */
export const dbStudioCommand: ClientCommand = {
    name: 'db-studio',
    summary: 'Abre Drizzle Studio apuntado a la base del worktree',
    scope: 'local',
    run: (argv) => runDbStudio({ argv })
};

/** `hops db-fresh` — recreate databases from the template. */
export const dbFreshCommand: ClientCommand = {
    name: 'db-fresh',
    summary: 'Rehace una base desde el template (sin tocar el volumen)',
    scope: 'local',
    run: (argv) => runDbFresh({ argv })
};

/** `hops db-update-template` — rebuild the template from staging. */
export const dbUpdateTemplateCommand: ClientCommand = {
    name: 'db-update-template',
    summary: 'Reconstruye hospeda_template con lo último de staging',
    scope: 'local',
    run: (argv) => runDbUpdateTemplate({ argv })
};
