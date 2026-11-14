# Pla d'implementació a `dev`: Projecte Viu i col·laboració federada

> Pla per a un conjunt de PR petites amb revisió; **no autoritza fusionar PR #17, #26 ni desplegar recursos**. Estat del repo revisat 14-11-2026: `dev` SHA `d1fcc9ee8bcd04c842017d018aa6829cc0fc6eeb`; PR #17 (fitxa) oberta cap a dev, PR #26 (demo conceptual) draft cap a dev, PR #2 (RAG) draft cap a main. Cap canvi directe sobre dev en aquest paquet.

## Regles del desenvolupament

- Integrar per **vertical slices** que acabin en Projecte Viu. No fer microserveis o stores independents per Identity/Connect/Knowledge/Spaces abans de justificar-ho.
- Proves multiusuari i multi-projecte a backend: ACL/RLS/tenancy; frontend no és control d'accés.
- Esquemes i migracions versionats i compatibles, idealment evitar col·lisions de revisions Alembic (PR #2 i #17 tenen antecedent de migració `0005`; inspeccionar i resoldre abans d'aplicar).
- Mantenir estàtica la demo PR #26 sense compartir les dades; evolucionar UI integrant `apps/web` amb API autenticada després de definir contractes i permisos.
- Cada funcionalitat necessita política de dades, anonimització, estat de retirada i auditoria abans d'habilitar personalització, federació o publicació.
- Prohibir fusió directa a `main` o desplegament automàtic des d'aquesta branca de documentació.

## Fases amb portes de qualitat

| Fase | Prioritat | Resultat verificable | Issues |
| --- | --- | --- | --- |
| 0 | Bloquejant | Revisió PR #17, #26, dependències, contractes, esquema i conciliació de migracions; pipeline verd | #11, nova issue de reconciliació |
| 1 | P0 | Fitxa privada, acció activa, resultat/evidència, decisió, ampliació; flux complet autenticat | #11–#15 |
| 2 | P0 | Identitat/facetes, privacitat granular, Passport declarat/evidències, política de compartició | #19, #20, nova Passport |
| 3 | P1 | Necessitats publicables, Discovery/Connect consentit, Agreements versionats, Inc Proof | #21–#23, nova Discovery |
| 4 | P1 | Memòria de preferències, coneixement editorial aprovat, Knowledge Passport i RAG amb ACL | #24, noves Memory/Knowledge |
| 5 | P1 | Collaborative Space federat, participants/recursos/acords/accions amb refs, sortida C governada | noves Spaces/Lifecycle |
| 6 | P2 | Knowledge Impact, Lineage, retorn voluntari, proves multi-organització, accessibilitat i pilot | #25, noves Impact/E2E |

## Contractes i proves mínimes de cada fase

### Projecte Viu
- `POST/GET/PATCH` de fitxa sota identitat autenticada; auto guardat i privada per defecte; experiment/acció activa amb historial; resultat/evidència/decisió amb timestamps.
- No col·locar documents de prova a la fitxa pública o a les recomanacions.

### Identity / Passport
- `person_id`, `facet_id`, `visibility_policy`, `skill_claim`, `learning_goal`, `contribution_reference`.
- El selector de faceta mai canvia permisos de recursos. Persona B no pot veure facet privada de A. Publicació d'Inc Proof subjecta a autorització de projectes/drets.

### Discovery / Connect / Agreements
- `publishable_need` és una projecció revisada i limitada del Projecte Viu.
- Intenció, disponibilitat i skill declarada no impliquen qualificació verificada.
- Draft version/hash, confirmacions bilaterals per versió, idempotència i concurrència; cap atorgament implícit de permisos.

### Memory / Knowledge / AI
- Preferències `session` i `persisted_opt_in` separades, amb controls d'esborrament i desactivació; no utilitzar clics com a preferències persistents per defecte.
- Coneixement amb `source_id`, `revision`, `rights_scope`, `acl`, `approval_record`, `validity_state`, `retention_policy`.
- Proves negatives: una font revocada no surt a resultats, cites ni cache. Dades personals no entren en corpus transversal ni entrenament automàtic.

### Collaborative Space / Exit C
- `collaboration_space`, `space_member_project`, `space_action`, `shared_resource_grant`, `agreement_revision`, `withdrawal_event`, `closure_review`.
- Estat provisional: draft / pending_approvals / active / paused / closing / closed / cancelled. Membership withdrawn és estat d'una part.
- Una retirada només revoca els accessos que legalment/contractualment correspongui; no elimina resultats comuns ni genera drets nous.
- Conservar versions immutables d'acord; si canvia l'abast, revalidació de parts implicades.
- Test e2e: Projectes A i B, A deixa l'espai, B continua sota condicions, evidència d'A sense permís deixa de ser llegible, resultat comú autoritzat es preserva, no hi ha fuites en llistats ni a Inc AI.

### Knowledge Impact
- `view`, `declared_use`, `adaptation`, `confirmed_feedback`, `measured_outcome` tenen semàntica diferent.
- Dades agregades que no reidentifiquin consultors; contactes només per Inc Connect amb consentiment.
- Atribució Inc Proof per contribució, no per simple lectura ni per membresia en projecte.

## Dependències i criteris de merge

1. Prioritzar tancament tècnic de #11 (PR #17 només amb aprovació explícita). Fer revisió del model de dades i no assumir que PR #26 és una implementació funcional.
2. Introduir #12–#15 en PR independents amb tests de regressió; en paral·lel preparar contractes de permisos/identitat.
3. Implementar #19–#23 amb proves de dos usuaris; després coneixement i RAG (PR #2 necessita reconciliació).
4. Només activar Collaborative Spaces quan project actions, ACL i Agreements tinguin contractes estables.
5. PR final d'integració amb flux end-to-end: user A projecte privat → necessitat → B interès/acord → contribució/Proof → coneixement aprovat → Projecte C col·laboració → retirada i continuïtat C.

## No fer encara

- No entrenar ni fine-tunejar Inc AI amb converses, documents ni preferències.
- No fer públic el Site de demo ni activar trànsit real sense auditoria de permisos.
- No implementar pagaments, transaccions entre organitzacions ni propietat intel·lectual automàtica.
- No activar la via legal/contractual com a certificat jurídic sense assessoria.
- No unir informació entre espais de diferents productes, inclòs BF.

## Concepte a debatre tot seguit (no aprovat)

Governança d'un Collaborative Space amb tres o més membres: quòrum, veto per drets propis, decisions ordinàries, retirada, gestió de disputes. Recomanació de partida: cada part té control exclusiu dels seus recursos/drets, les decisions operatives segueixen la governança pactada i les decisions que alteren drets requereixen consentiment dels titulars afectats.
