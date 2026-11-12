# RLS de projectes privats i base d’emmagatzematge

## RLS implementada

La migració `0003` activa `ENABLE ROW LEVEL SECURITY` i `FORCE ROW LEVEL SECURITY` a `project_vaults`, `vault_memberships` i `vault_events` a PostgreSQL. SQLite manté l’esquema per desenvolupament, però no ofereix aquesta barrera.

El servidor valida OIDC, resol el compte intern i fixa `app.actor_id` amb `set_config(..., true)` dins de la transacció. Un hook SQLAlchemy el torna a establir després de commit/rollback. Una sessió nova comença amb context buit encara que reutilitzi connexió. No es llegeix aquest context de headers ni del cos d’una petició.

| Taula | Lectura | Escriptura |
| --- | --- | --- |
| ProjectVault | Creador o membre del projecte | Crear només amb created_by propi; sense política UPDATE/DELETE |
| VaultMembership | Membresia pròpia o membres del projecte que es posseeix | Inserció pel propietari; es pot revocar un membre però no el propietari; sense UPDATE |
| VaultEvent | Només el propietari del projecte | Actor i propietari han de coincidir amb el context; sense UPDATE/DELETE |

Cada membresia/esdeveniment té `owner_id`, vinculat a `(vault_id, created_by)` mitjançant una FK composta. No n’hi ha prou d’inventar un owner_id per escriure en un altre projecte. El rol owner només és vàlid si user_id coincideix amb owner_id. Les polítiques eviten funcions SECURITY DEFINER i consultes recursives entre membresia i projecte.

Sense context, les lectures no retornen files i les insercions protegides es rebutgen. L’API continua fent les comprovacions de permisos; RLS cobreix també consultes accidentals sense filtre. Aquest increment aplica RLS als vaults, **no** a les taules acadèmiques de Campus ni a la taula global d’identitats.

## Identitat SQL i arrencada

Separar sempre:

- **Migracions:** rol administratiu que gestiona esquema i polítiques; no s’utilitza al servidor web.
- **Runtime:** login amb privilegis de dades mínims i sense propietat d’esquema/taules, superusuari, CREATEROLE ni BYPASSRLS. La base de concessions és `apps/api/scripts/runtime-role.sql`; executar-la una vegada com a administrador després de les migracions i assignar el rol al login real.

En `APP_ENV=production`, l’API comprova en arrencar que les cinc taules existeixen després de la migració 0004 amb RLS forçada i que ni el rol actual ni el login original tenen pertinença a rols superusuari/BYPASSRLS o propietaris d’aquestes taules. Arrencar amb el compte de migracions falla. La contrasenya/identitat SQL real no es crea amb aquest repositori.

RLS no protegeix davant d’un administrador de DB, credencials privilegiades compromeses ni execució SQL arbitrària que pugui canviar el context. No autoritzar consultes lliures del client; aplicar mínim privilegi, parametrizació i control de serveis també fora de la DB.

Les migracions no s’executen automàticament a l’arrencada. Fer backup i comprovar l’upgrade en un entorn de prova amb dades representatives; la migració backfill owner_id des del projecte existent i rebutja relacions incompatibles.

## Proves amb PostgreSQL real

`tests/test_rls.py` crea un login efímer sense privilegis d’owner/superusuari/BYPASSRLS i s’hi connecta realment. Verifica:

- Consultes sense WHERE i context buit.
- Aïllament de dos propietaris i lectura de membresia pròpia.
- Concessió i revocació amb un compte que continua autenticat.
- FK contra propietat inventada, bloqueig de canvis de propietari/rol i d’esborrat d’auditoria.
- Commit/rollback i reutilització de connexions sense heretar el compte anterior.
- Rebuig del rol administratiu al control de runtime.

S’executen al job PostgreSQL 16 de GitHub; es marquen skipped a SQLite. El rol de proves rep permisos SQL addicionals UPDATE/DELETE expressament per demostrar que les polítiques els bloquegen. La concessió de producció és més restrictiva.

## Blob: mòdul Terraform preparat, sense desplegar

`infra/terraform/modules/private-documents` és independent i encara no s’instancia des de `environments/dev`. Per tant, afegir-lo al repositori no afegeix recursos al pla actual ni modifica Azure.

Inclou StorageV2 a France Central per defecte, sense endpoint públic, Shared Key, blobs anònims ni rèplica entre tenants; TLS 1.2, versions i soft-delete de set dies; contenidors `quarantine` i `released`; Private Endpoint de Blob amb zona DNS existent; Defender for Storage amb anàlisi on-upload i límit explícit de GB/mes.

Requereix tres principals de Storage diferents (i posteriorment un quart de lliurament Event Grid):

- Càrrega: Blob Data Contributor només a quarantine.
- Lectura: Blob Data Reader només a released.
- Promoció: Blob Data Contributor als dos contenidors.

El rol builtin Contributor inclou lectura i esborrat dins del contenidor; no és un rol write-only. Cap d’aquestes identitats s’entrega a un participant. Un servei amb aquestes credencials continua sent una frontera privilegiada; l’autorització de cada document ha de quedar a l’API. La descoberta de dades sensibles està desactivada; l’anàlisi de malware és la funcionalitat configurada.

El mòdul rep una zona `privatelink.blob.core.windows.net` ja vinculada a la VNet i un topic Event Grid custom per resultats de Defender. La primera versió només preparava infraestructura; la [migració 0004 i el circuit posterior](private-document-pipeline.md) afegeixen consumidor, cua i API, encara sense desplegar. La configuració de xarxa admet el bypass AzureServices per la integració de serveis de confiança, amb l’accés públic desactivat. Cal verificar la compatibilitat real de Defender, Event Grid, DNS i xarxa a la subscripció/regió abans de donar-la per operativa.

Els tests Terraform usen un provider mock: comproven configuració i separació de rols, no connectivitat real, detecció de malware, permisos de Microsoft ni costos. Defender, scans i Storage comportaran costos en aplicar el mòdul; el límit de scans no és un límit total de facturació. Si s’esgota, tot document sense resultat verificat ha de continuar bloquejat.

## Encara no s’habilita la càrrega sensible

Actualització: la [implementació posterior](private-document-pipeline.md) incorpora aquestes peces amb RLS i rols separats. Encara cal configurar i verificar la integració a Azure abans d’activar la càrrega. No confiar en tags editables del blob, un resultat enviat pel navegador o un nom de fitxer. Vincular resultat a storage account, blob, versió/ETag i comprovació de contingut; resultats absents, sospitosos, duplicats o fora d’ordre no poden alliberar el fitxer.

En descàrrega: comprovar membresia actual, projecte del document, estat alliberat i versió; respondre com attachment amb no-store/nosniff i auditar. Sense URLs públiques ni SAS reutilitzables de llarga durada. Un fitxer ja descarregat no es pot revocar.

MFA/step-up, federació amb el proveïdor real, retenció/supressió de versions i còpies, restauració i revisió del conjunt continuen sent requisits del pilot. No hi ha encara URL pública ni fitxers sensibles allotjats amb aquest increment.
