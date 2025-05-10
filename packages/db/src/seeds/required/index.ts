import { seedRequiredDestinationAldeaSanAntonio } from './aldea-san-antonio.seed';
import { seedRequiredDestinationBasavilbaso } from './basavilbaso.seed';
import { seedRequiredDestinationCaseros } from './caseros.seed';
import { seedRequiredDestinationChajari } from './chajari.seed';
import { seedRequiredDestinationColon } from './colon.seed';
import { seedRequiredDestinationColoniaElia } from './colonia-elia.seed';
import { seedRequiredDestinationConcordia } from './concordia.seed';
import { seedRequiredDestinationFederacion } from './federacion.seed';
import { seedRequiredDestinationGchu } from './gchu.seed';
import { seedRequiredDestinationIbicuy } from './ibicuy.seed';
import { seedRequiredDestinationLarroque } from './larroque.seed';
import { seedRequiredDestinationLiebig } from './liebig.seed';
import { seedRequiredDestinationPuebloBelgrano } from './pueblo-belgrano.seed';
import { seedRequiredDestinationPuertoYerua } from './puerto-yerua.seed';
import { seedRequiredDestinationSanJose } from './san-jose.seed';
import { seedRequiredDestinationSanJusto } from './san-justo.seed';
import { seedRequiredDestinationSanSalvador } from './san-salvador.seed';
import { seedRequiredDestinationSantaAna } from './santa-ana.seed';
import { seedRequiredDestinationUbajay } from './ubajay.seed';
import { seedRequiredDestinationUrdinarrain } from './urdinarrain.seed';
// Importar todos los seeds individuales de destinos
import { seedRequiredDestinationUruguay } from './uruguay.seed';
import { seedRequiredDestinationVillaElisa } from './villa-elisa.seed';
import { seedRequiredDestinationVillaParanacito } from './villa-paranacito.seed';

export async function seedRequiredDestinations() {
    console.log('[seed] 🌎 Seeding required destinations...');

    await seedRequiredDestinationUruguay();
    await seedRequiredDestinationColon();
    await seedRequiredDestinationGchu();
    await seedRequiredDestinationConcordia();
    await seedRequiredDestinationFederacion();

    await seedRequiredDestinationVillaParanacito();
    await seedRequiredDestinationIbicuy();
    await seedRequiredDestinationCaseros();
    await seedRequiredDestinationSanJusto();
    await seedRequiredDestinationSanJose();

    await seedRequiredDestinationChajari();
    await seedRequiredDestinationBasavilbaso();
    await seedRequiredDestinationLiebig();
    await seedRequiredDestinationLarroque();
    await seedRequiredDestinationPuebloBelgrano();

    await seedRequiredDestinationPuertoYerua();
    await seedRequiredDestinationSanSalvador();
    await seedRequiredDestinationSantaAna();
    await seedRequiredDestinationUbajay();
    await seedRequiredDestinationUrdinarrain();

    await seedRequiredDestinationVillaElisa();
    await seedRequiredDestinationColoniaElia();
    await seedRequiredDestinationAldeaSanAntonio();

    console.log('[seed] ✅ Required destinations seeded');
}
