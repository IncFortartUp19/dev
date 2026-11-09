# Allotjament de l’aplicació: base Container Apps

Proposta per al MVP: Next.js per a la web i FastAPI per a l’API, executats com a contenidors a Azure Container Apps. Aquesta fase només defineix la infraestructura d’allotjament; no crea encara contenidors d’aplicació ni implementa el producte.

## Recursos del pla

- Subxarxa dedicada `snet-container-apps`, `10.20.1.0/24`, sense solapament amb la subxarxa d’endpoints privats existent. Delegació `Microsoft.App/environments`.
- Azure Container Registry Basic, amb nom derivat de la subscripció, credencials d’administrador desactivades i imatges autenticades. Basic utilitza un endpoint de xarxa públic; no és un registre amb Private Link. Les imatges no es publiquen anònimament.
- Entorn Azure Container Apps a France Central, connectat a la VNet i a Log Analytics. Workload profile Consumption, sense perfils Dedicated ni redundància entre zones en aquest entorn dev.

L’entorn utilitza un balancejador extern per permetre la futura web pública. No hi ha cap aplicació, ingress de servei ni URL de producte desplegada en aquesta fase. La futura API podrà tenir ingress intern. La integració amb la VNet permetrà arribar a l’endpoint privat del Key Vault, però encara caldran identitats i permisos de secrets.

Azure pot crear recursos auxiliars en un grup administrat per Container Apps. No s’han de modificar manualment. Container Registry té cost propi; els costos de xarxa, logs i futurs workloads també s’han de tenir en compte. Consumption no implica que tota la infraestructura sigui gratuïta.

## Abans d’aplicar

Un operador de la subscripció ha de registrar `Microsoft.App` i `Microsoft.ContainerRegistry` si encara no estan registrats. `Microsoft.Network` i `Microsoft.OperationalInsights` ja s’han utilitzat en fases anteriors. La identitat GitHub no disposa de permisos de registre a nivell de subscripció.

El pla previst és de tres creacions i cap canvi als recursos existents. El workflow d’apply continua limitat a la fase de xarxa anterior: s’actualitzarà després de revisar el pla d’allotjament.

## Fases següents

1. Desplegar aquesta base després de revisar el pla.
2. Preparar web/API i construir les imatges.
3. Configurar AcrPush per a la identitat de construcció i AcrPull per a les identitats d’execució, amb rols limitats al registre. Contributor no substitueix aquests rols de dades; els haurà d’assignar un operador autoritzat.
4. Desplegar les aplicacions amb identitats administrades, sondejos de salut i límits d’escalat.
5. Configurar PostgreSQL i l’accés de dades quan definim el model de l’aplicació.

Referències: [xarxes de Container Apps](https://learn.microsoft.com/azure/container-apps/custom-virtual-networks) i [workload profiles](https://learn.microsoft.com/azure/container-apps/workload-profiles-manage-cli).
