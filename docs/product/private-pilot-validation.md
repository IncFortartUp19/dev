# Documents privats: accés reforçat, interfície i validació Azure

## Resultat de la comprovació real del 12 de novembre de 2026

S’ha executat [Private documents Azure preflight](https://github.com/IncFortartUp19/dev/actions/runs/43239315575) amb la identitat OIDC de desplegament, en mode només lectura. Login, subscripció i tenant són correctes.

Al grup `rg-incforstartup-dev` s’han observat identitat gestionada, Key Vault, Log Analytics, VNet, DNS privat i Private Endpoint. No s’han trobat els tipus de recurs de Storage de documents, Event Grid, Service Bus, PostgreSQL ni Container Apps desplegades. La identitat disponible tampoc ha permès verificar el context i les polítiques d’accés condicional a Microsoft Graph. Això no demostra que no hi hagi un registre d’aplicació o una política en algun altre àmbit del tenant.

El resultat és **blocked**. No s’han executat el test real de Defender, la prova des de xarxa privada ni una autenticació humana amb MFA. El workflow falla expressament davant d’aquests prerequisits absents; no és un error de les proves locals de codi. L’informe JSON només inclou comptadors i resultats, no polítiques amb dades d’usuaris, secrets o documents. L’artifact es conserva un dia; els resultats del run queden als logs.

El workflow utilitza `DOCS_STORAGE_ACCOUNT_ID`, `DOCS_EVENT_GRID_TOPIC_ID` i `DOCS_SERVICE_BUS_NAMESPACE_ID` de l’entorn GitHub dev quan s’hagin desplegat els recursos. No busca ni reutilitza el storage de Terraform com a magatzem de documents. No crea recursos ni llegeix claus de Storage.

## Interfície implementada

`/private` és una zona autenticada separada de Campus i de la demostració. Permet crear/seleccionar un vault, consultar documents, pujar PDF/TXT i descarregar els alliberats. Mostra quarantena, bloqueig i errors; un lector no pot pujar. L’actualització d’estat és manual. No hi ha dades de mostra al portal real ni persistència local de documents/projectes.

El navegador crida `/api/private/...` al mateix origen. El BFF utilitza exclusivament la cookie HttpOnly; un Authorization aportat pel navegador no la substitueix. Els POST requereixen Origin exacte. Les rutes són una llista tancada i no exposen administració de membres ni callbacks d’escàner. La càrrega i la resposta binària tenen límit de 10 MiB. La resposta d’error no copia diagnòstics interns del backend; la descàrrega retorna attachment, no-store i nosniff.

Cada descàrrega torna a passar pel backend i la RLS. Un botó habilitat a la pantalla no dona permisos. Les URL Blob privades i els tokens d’accés no s’envien al client. La mateixa sessió pot entrar a Campus i al portal privat, amb exigències diferents.

## Accés reforçat implementat al backend

Configurar el mateix context als dos serveis:

```dotenv
# API
OIDC_PRIVATE_AUTH_CONTEXT=c1
# Web
CAMPUS_PRIVATE_AUTH_CONTEXT=c1
```

L’API valida primer signatura, issuer exacte, audiència, scope i client autoritzat. A les rutes privades exigeix que l’access token signat contingui `acrs: ["c1"]`. No accepta un header X-MFA, un camp del formulari, un correu verificat ni `amr: ["mfa"]` com a substitut d’aquest contracte.

Si falta el context, retorna insufficient_claims/step_up_required. La web torna al proveïdor OIDC amb un claims request construït al servidor i redirigeix només a `/private`. Cap claims request ni URL externa aportada pel navegador determina el destí o l’exigència. Els access tokens continuen fora del JSON de sessió i dels components client.

En producció, una ruta privada sense context configurat retorna 503; activar documents sense context és un error de configuració. Campus no adquireix aquest requisit globalment. En desenvolupament es conserva la possibilitat d’executar l’API sense la política, però la interfície ho assenyala i deshabilita les càrregues en aquest cas. `policy_enforced` significa que el backend aplica el contracte de context; **no** acredita una verificació en viu de la política d’Entra.

## Pas administratiu d’Entra que no s’ha executat

Aquest increment prepara Microsoft Entra amb authentication context de workforce/B2B. No crea un tenant, no modifica polítiques globals i no configura automàticament External ID. Si es tria un proveïdor amb un altre contracte d’assurance, s’haurà d’adaptar explícitament; no hi ha fallback que interpreti qualsevol claim com a MFA.

Un administrador del tenant ha de:

1. Registrar/verificar els clients web/API d’usuaris, independents de la identitat GitHub. Utilitzar emissor d’un tenant concret i audiència/scope API correctes. Callback web: `/api/auth/callback/campus-oidc` al domini HTTPS real.
2. Publicar el context `c1` i associar-lo a una política **enabled** que exigeixi MFA o una força d’autenticació apropiada per a tots els usuaris admesos al portal privat. Un context publicat però sense política efectiva no acredita MFA. Report-only no és suficient per obrir documents sensibles.
3. Revisar convidats, federació entrant, exclusions i reutilització d’MFA d’altres tenants. El compte es vincula a issuer/sub, no per coincidència de correu. Una exclusió que permeti obtenir c1 sense l’exigència acordada invalida el criteri del pilot.
4. Validar freqüència de reautenticació i sessió amb la política d’Entra. No es confon iat d’un token recent amb una MFA recent, ni s’exigeix una nova OTP si una autenticació forta vigent ja satisfà la política.
5. Provar amb participants de pilot i revisar els registres de sign-in/accés condicional abans d’habilitar `DOCUMENTS_ENABLED`. Mantenir les càrregues tancades mentre es comprova la configuració.

Cal comprovar la llicència d’Entra Conditional Access: Exchange Online Plan 1/2 no equival a Entra ID P1/P2. La revisió administrativa ha de respectar les polítiques existents i els comptes de recuperació; aquest codi no les desactiva ni intenta evitar restriccions de dispositiu.

Per auditar la configuració amb Graph cal un accés de lectura adequat (`Policy.Read.ConditionalAccess`) en una identitat autoritzada. Contributor del grup Azure no dona aquest permís de directori. El preflight només reconeix automàticament un cas conservador d’MFA obligatòria per al context i tots els usuaris, sense exclusions ni condicions addicionals; forces d’autenticació, excepcions i dissenys més complexos requereixen revisió específica.

## Prova real després del desplegament

Abans de donar el pilot per validat:

- Desplegar API/web, PostgreSQL amb migracions i logins separats, identitats, Blob/Defender, Event Grid i Service Bus. Revisar el pla de costos i RBAC: la identitat GitHub actual està definida com a Contributor, sense concessió general per crear role assignments ni polítiques d’Entra.
- Des del runtime de la VNet, verificar DNS privat, connexió TLS, identitats i permisos sobre Blob, DB i cua. El runner públic de GitHub no substitueix aquest punt de prova.
- Comprovar autenticació local desactivada on correspongui i publishers/sender/receiver de mínim privilegi. Recordar l’excepció documentada d’ingress públic autenticat del topic Event Grid de resultats; Blob continua privat.
- Amb dos comptes reals, confirmar que no s’entra al vault sense el context i que la política real satisfà MFA. Verificar que ni un header ni un token d’un altre client/emissor eviten el control.
- Pujar només dades sintètiques: un TXT net i un fitxer de prova antimalware reconegut pel servei. Capturar ID de document, estats, ETag/versió i rebuts en l’entorn privat, sense publicar contingut, tokens ni URLs signades.
- Confirmar bloqueig abans de l’anàlisi, alliberament únicament del net, bloqueig d’infectats/no analitzables, duplicats/reintents, descàrrega i checksum. Provar revocació i accés creuat amb l’altre compte.
- Verificar alertes de DLQ, pressupost de scanning, quotes/rate limiting, retenció, neteja d’orfes i restauració abans d’admetre documents reals.

No es declara superada cap d’aquestes proves amb dobles de Storage o un issuer de proves. El mode browser E2E incorpora aquests dobles en fitxers fora del paquet de producció i requereix RUN_CONNECTED_E2E=1 amb SQLite efímera.
