# IncForStartUp — Model funcional unificat (14-11-2026)

> **Estat:** decisions conceptuals aprovades, no funcionalitats implementades. Document de consolidació per preparar desenvolupament a `dev`, subjecte a PR, proves i revisió. No indexar com a coneixement públic, ni utilitzar per entrenar models. No inclou dades personals ni contingut de projectes reals.

## 1. Nord de producte

**Projecte Viu** és el nucli: idea curta → acció/prova activa → evidències/resultat → decisió (continuar, reformular, demanar ajuda, pausar, tancar) → expansió només quan calgui. Cap informació es perd en simplificar la vista. Inc és una plataforma per fer evolucionar iniciatives i persones de tots els sectors; Campus és el primer espai especialitzat, **no** un producte apart. Entrada Crear / Participar / Explorar i Inc Home adaptativa.

**Invariants**
- Projectes, aportacions, documents i preferències privats per defecte; permisos per objecte, audiència i durada. Publicar una necessitat no fa públic el projecte.
- Les recomanacions són explicables, descartables, amb procedència i només basades en dades autoritzades. Mai enviar missatges, oferir compromisos, donar permisos ni publicar sense acció de la persona autoritzada.
- Participar en un projecte, confirmar una contribució, acceptar un contacte i acceptar un acord són accions diferents; cap transfereix IP o propietat per si sola.
- Les autoritzacions i polítiques de retenció poden persistir o canviar independentment del cicle de vida de col·laboració. Revocar l'accés futur no destrueix còpies ja rebudes legítimament.
- La verificació de contribucions significa el que efectivament s'ha comprovat; no una garantia universal de competència.
- RAG/recuperació protegida i memòria de producte **no són entrenament de models**. Documents interns i converses no entren a entrenament automàtic.
- Mantenir el projecte BF separat dels espais, dades, personalització i proves d'Inc.

## 2. Model d'entitats, responsabilitat i orígens

| Àrea | Responsabilitat canònica | Relacions, sense còpies indiscriminades |
| --- | --- | --- |
| Projecte Viu | project, short_card, experiment/action, result, evidence, decision, need | Creador i equip autoritzat |
| Identity Passport | person/account, facet, declared skill, learning goal, visibility, authorized portfolio reference | Les facetes són presentació, no permisos |
| Inc Discovery / Connect | opportunity (vista publicable de need o oferta autoritzada), match explanation, consented contact | No compartir identitat ni dades de contacte sense consentiment |
| Inc Agreements | proposal, immutable revision, bilateral confirmation, operational commitment | Dues identitats distintes confirmen la mateixa versió |
| Inc Proof | contribution claim, confirmation provenance, linked evidence refs, publication authorization, dispute | No transferir documents privats al passaport |
| Inc Memory | session preference, explicitly stored preference, personal context with retention and deletion | Desactivar / eliminar / ignorar interacció són accions diferents |
| Inc Knowledge | learning candidate, approval record, knowledge passport, source/revision, audience grant, rights policy | La font pot estar validada però no compartida |
| Knowledge Impact | declared reuse, feedback, adaptation, provenance/lineage | Consulta ≠ ús declarat ≠ resultat mesurat |
| Collaborative Space | space, member project, shared action, shared item, collaboration agreement, lifecycle | Projectes membres mantenen dades i identitat pròpies |

## 3. Decisions aprovades després d'INC-D01–D12

| ID | Decisió |
| --- | --- |
| INC-D13 | Identity Passport: identitat central, presentacions visuals diferents per context, sense perfils duplicats |
| INC-D14 | Evolució híbrida del Passport: propostes d'actualització, aprovació personal i visibilitat independent |
| INC-D15 | Competències híbrides: declarades lliurement, associables a experiències/Inc Proof, i objectius d'aprenentatge; no deducció de domini automàtica |
| INC-D16 | Discovery híbrid: oportunitats per aportar avui **i** oportunitats per aprendre/explorar nous sectors |
| INC-D17 | Adaptació controlada: l'usuari configura les fonts de personalització i pot cercar sense utilitzar el Passport |
| INC-D18 | Inc Memory controlada: preferències temporals i persistents voluntàries, amb revisió, desactivació i eliminació diferenciades |
| INC-D19 | Aprovació de coneixement segons contingut i drets: responsable del projecte + consentiments/autoritzacions addicionals aplicables |
| INC-D20 | Coneixement federat per audiència: privat, projectes convidats, organització/Campus, públic; accés no implica dret de reutilització |
| INC-D21 | Incentiu de valor compartit i Inc Proof controlat; sense rànquings ni incentius a sobrepublicar |
| INC-D22 | Retorn de valor progressiu: impacte documentat, retorn voluntari, col·laboració opcional; permisos independents i sense identificar consultors per defecte |
| INC-D23 | Col·laboració federada híbrida: projectes autònoms + espai conjunt de recursos, acords, accions i evidències seleccionats |
| INC-D24 | **Continuïtat governada i reversible (C):** espai col·laboratiu pot continuar, pausar o tancar; sortida per part segons acord, sense dret d'accés nou ni esborrat indiscriminat de registres legítims |

**Propostes encara no aprovades com a funcionalitat definitiva**: els noms Inc Journey, Skills Graph, Discovery Paths, Knowledge Impact, Knowledge Lineage i Value Network són vocabulari conceptual útil. Desenvolupar-los només quan el seu valor respecte al circuit bàsic estigui validat.

## 4. Contracte de Collaborative Space

**Entrada:** una o més iniciatives autoritzades proposen un objectiu compartit. Per ser federat, un espai ha de vincular almenys dos projectes que conserven la seva identitat. Una activitat dins un únic projecte segueix sent un equip col·laborador del Projecte Viu.

**Recursos:** el `space` conté referències i elements creats expressament per a la col·laboració; no importa automàticament carpetes ni bases de dades dels membres. Cada compartició té `resource_id`, `origin_project_id`, `audience_scope`, `rights_policy`, `grant_id` i `expires_at` si correspon.

**Acords:** fase de contacte ≠ acord. La proposta és un esborrany amb revisions immutables: canvi d'objectiu, responsabilitat, drets, durada o condicions invalida les confirmacions existents. Confirmar la mateixa versió és necessari, però accés tècnic i validesa jurídica es gestionen separadament.

**Accions:** cada tasca/prova compartida té un ID canònic i resultats versionats. Els projectes membre mostren projeccions condicionades als permisos, mai còpies desconnectades. Les evidències originals poden conservar permisos més estrets que les conclusions.

**Estats proposats:** `draft` → `pending_approvals` → `active` ⇄ `paused` → `closing` → `closed`; `withdrawn` com estat de la **participació d'un projecte**, no necessàriament de l'espai. `cancelled` abans d'activar. `closing` obliga a resoldre propietat, accés, retenció i compromisos pendents.

**Governança de sortida (DECISIÓ C):**
1. La part sortint pot aturar noves aportacions segons els termes aplicables i sol·licitar la revocació d'accés futur als seus recursos.
2. Els materials preexistents continuen regits per drets d'origen; els resultats conjunts continuen regits pels acords de cada versió.
3. La sortida no elimina proves, autoria, incidències, reconeixements verificats ni registres legals legítimament conservables; es revisen minimització i retenció.
4. Una altra part no hereta automàticament propietat, permisos ni llicències per aquesta sortida.
5. Si cal modificar l'objectiu o les parts, s'obre una revisió de l'acord i es requereixen confirmacions adequades; si no es poden obtenir, l'espai pot pausar-se o tancar-se.
6. Les referències visibles dins dels Projectes Vius es filtren en lectura; no exposar noms de projectes/identitats ocultes a usuaris no autoritzats.
7. Disputa, suspensió, abandonament unilateral, incompliment i expiració tenen rutes de revisió i auditoria, no es resolen amb eliminació automàtica.

**Casos a provar:** universitat surt però startup continua; expiració de consentiment documental; baixa d'un col·laborador amb Inc Proof; propietat intel·lectual conjunta no resolta; dos projectes amb visibilitats diferents; invitació revocada; simultaneïtat d'aprovacions; projecte pausat i eventualment reprès.

## 5. Knowledge Network i IA

`Knowledge Passport`: registre de procedència amb owner, versió, estat de revisió, àmbit, evidències, audiència i política de drets. Pot estar validat i continuar privat; compartir lectura no és llicenciar reutilització. Federació és un conjunt de polítiques i índexs autoritzats, no una sincronització general de dades.

`Knowledge Impact`: observar categories separades: consulta (si comunicable), ús declarat, adaptació documentada, retorn confirmat i impacte mesurat. Cap puntuació global de valor o professional. Permetre estadístiques agregades, retorn voluntari i sol·licituds de contacte com a preferències independents. No comunicar identitat dels receptors per defecte.

`Knowledge Lineage`: derivacions/aplicacions referencien fonts i revisions permeses, sense transferir IP o dret de redistribució. Una nova prova pot generar un nou aprenentatge, no sobrescriure l'original.

`Inc AI`: recuperació d'autorització en consulta i citació, distinció **fet/interpretació/proposta**, respecte a retirada de fonts, no training automàtic. Pot ajudar a transformar una idea en propera prova del Projecte Viu, però la persona en confirma l'acció i la informació compartida.

## 6. Exemple transversal obligatori

1. Persona A crea Projecte Viu privat i registra una primera prova.
2. A obre una necessitat publicable sense exposar el projecte intern.
3. Persona B descobreix l'oportunitat amb filtres o Passport opcional; accepta iniciar contacte.
4. A i B negocien proposta i confirmen exactament la mateixa revisió; permisos s'autoritzen a part.
5. B realitza una aportació, registra prova/evidència i A confirma l'abast; Inc Proof ofereix una referència publicada voluntàriament.
6. Projecte C s'interessa en un aprenentatge explícitament federat; veu només la fitxa i les fonts autoritzades.
7. Els projectes A i C obren un Collaborative Space amb objectiu, accions i recursos compartits seleccionats.
8. El projecte C abandona. L'espai queda pausat o continua segons l'acord, mantenint autoria i drets d'origen i revocant els accessos que correspongui.
9. El projecte A recull un retorn voluntari, opcionalment el transforma en una nova prova i revisa si aprova un nou aprenentatge compartible.

## 7. Fonts i estat de validació

- Decisions conceptuals inicials: `sites/incforstartup/docs/inc-concept-identity-connect-proof-2026-11.md` a PR #26, encara no fusionada.
- Demo existent: `sites/incforstartup/public/inc-connect-concept-demo.html` a PR #26, amb dades fictícies i sense backend.
- Issue de Projecte Viu #11–#15, epic #18 i #19–#25; aquest document amplia el model, no substitueix les implementacions ni tanca issues.
- **No hi ha proves amb usuaris finals, control d'accés multi-tenant implementat per Collaborative Spaces ni ingesta/entrenament d'Inc AI implícits en aquesta especificació.**
