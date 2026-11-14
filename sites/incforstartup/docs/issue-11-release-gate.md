# Issue #11 — Revisió de seguretat/producte i porta de desplegament

**Estat: implementat i provat en CI; desplegament real BLOQUEJAT fins a evidències i aprovació.** La PR #17 no s'ha de fusionar a `dev` sense permís explícit del propietari.

## 1. Resultat de la revisió del codi

- API: `/v1/idea-drafts`, OIDC verificat amb issuer/audience/scope/azp, propietari de l'actor derivat de token verificat; sense `owner_id` aportat pel client.
- Persistència: `idea_drafts` amb `visibility='private'` i CHECK SQL que no permet un altre valor; GET/POST restringits per propietari; usuari aliè rep 404. No existeix cap endpoint de publicació ni de compartició.
- PostgreSQL: RLS `ENABLE` + `FORCE` i polítiques owner-only; startup de producció comprova rol limitat i RLS de totes les taules protegides.
- BFF: `/api/private` només accepta rutes aprovades, cookies de sessió, token servidor, origen correcte en POST i respostes `no-store`.
- UX: pregunta obligatòria, intenció/prova/nom opcionals, recuperació i edició; avís de canvis sense desar. `CAMPUS_MODE=connected` no pot caure silenciosament a la demo local si falla OIDC; un error de càrrega bloqueja el desat fins a restaurar l'accés.
- Demo local i backend autenticat són dos espais de dades separats; **no s'ha implementat importació automàtica** per evitar una transferència no autoritzada.
- Proves: unitàries de camps i persistència; API SQLite/PostgreSQL, signed OIDC i RLS amb identitats diferents; Playwright connected prova login, desat, recàrrega i 404 per un altre usuari. Comprovar l'últim SHA/CI a la PR abans d'aprovar.

## 2. Riscos de producte encara oberts

1. No hi ha gestió de conflictes entre pestanyes/dispositius: l'últim desat pot sobreescriure un altre canvi. No fer servir multiusuari sobre una mateixa fitxa.
2. La llista carrega els últims 50 esborranys; abans d'un llançament massiu s'ha de definir paginació i UX d'accés als antics.
3. Falten política de retenció, exportació i supressió de dades, backup/restauració i auditoria operativa d'esborranys.
4. Els missatges d'error són genèrics; abans de beta cal validar accessibilitat mòbil i flux de reautenticació amb usuaris reals.
5. Sense proves de dos dispositius reals, caducitat de tokens ni rotació de claus de l'IdP.
6. Les dades de la demo local no es migren. Informar clarament els usuaris abans d'obrir un portal autenticat.

## 3. OIDC i MFA — configuració que cal verificar al tenant real

- **Identitat d'usuaris, no la identitat GitHub de desplegament.** Confirmar quin tenant d'Entra, tipus de comptes (workforce/B2B/External ID), URL real HTTPS del portal i entorn `dev` de pilot.
- Registrar/verificar **dos identificadors** d'aplicació: web confidential client i API amb audience/scope delegat. Callback web exacte `https://<host>/api/auth/callback/campus-oidc`.
- Configurar al runtime, des de Key Vault o secrets del servei, sense valors sensibles a Git:
  - Web: `CAMPUS_MODE=connected`, `AUTH_URL`, `AUTH_SECRET`, `CAMPUS_API_URL`, `CAMPUS_OIDC_ISSUER`, `CAMPUS_OIDC_CLIENT_ID`, `CAMPUS_OIDC_CLIENT_SECRET`, `CAMPUS_OIDC_SCOPE`, `CAMPUS_PRIVATE_AUTH_CONTEXT`.
  - API: `APP_ENV=production`, `DATABASE_URL` amb login API limitat, `CORS_ORIGINS` explícits, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL`, `OIDC_REQUIRED_SCOPE`, `OIDC_ALLOWED_CLIENTS`, `OIDC_PRIVATE_AUTH_CONTEXT`.
  - `CAMPUS_PRIVATE_AUTH_CONTEXT` i `OIDC_PRIVATE_AUTH_CONTEXT` han de coincidir (p. ex. `c1` **només després de verificar que existeix**).
- Entra Conditional Access: authentication context **disponible i publicada**, política **enabled** efectiva exigint MFA/força d'autenticació adequada per a TOTS els usuaris inclosos, amb exclusions/convidats i controls d'accés revisats. `report-only` no satisfà el requisit.
- Fer prova interactiva amb dos comptes de pilot: obtenir `acrs` adequat després del step-up; sense context, accés denegat; API amb token d'un altre client/audiència rebutjada.
- Un GitHub Actions OIDC per desplegar infraestructura **no equival** a OIDC dels usuaris ni acredita MFA.

## 4. Infraestructura necessària abans de desplegar

L'última evidència documentada a `docs/product/private-pilot-validation.md` (2026-11-12) diu que al grup dev faltaven PostgreSQL i Container Apps, i que la verificació de Conditional Access a Graph no tenia autorització suficient. Això és **històric**: repetir l'inventari amb credencials d'auditoria i no assumir que continua igual.

- Comprovar recursos realment presents i aprovats: registry, Container Apps Environment, web pública HTTPS, API interna, PostgreSQL privat, DNS, identitats i Key Vault. Els fitxers Terraform actuals preparen la base de Container Apps però **no constitueixen per si sols el desplegament d'aplicacions**.
- Confirmar costes, permisos de role assignment, identitats d'execució, networking privat, firewall, TLS, migracions i health probes.
- Aplicar `alembic upgrade head` amb un **rol de migració** després de backup i comprovació de restauració. El login API d'execució no és propietari de taules ni té `BYPASSRLS`. Verificar `FORCE RLS` i privilegis després de la migració.
- Construir imatges web/API reproduïbles des del SHA aprovat; registrar digests; no escriure secrets a imatges, Dockerfiles ni logs.
- Desplegar primer **preproducció** a un entorn aïllat amb URL HTTPS, sense dades reals. Publicar web només per als participants de pilot, API no exposada directament.
- `DOCUMENTS_ENABLED=false` fins que el circuit de fitxers/escàner estigui validat. El desat d'idees no necessita habilitar càrrega de documents.

## 5. Porta de validació GO / NO GO (sense merge)

- [ ] CI de l'últim SHA: web, API SQLite/PostgreSQL, Playwright connected i higiene = success.
- [ ] Revisió humana de seguretat del diff, dependències i configuració del runtime.
- [ ] Inventari i permisos reals Azure verificats (read-only), sense inferir recursos a partir del Terraform.
- [ ] Entra OIDC/MFA Conditional Access validat per administrador i en sign-ins reals.
- [ ] PostgreSQL i RLS verificats dins de la xarxa de preproducció amb un rol no privilegiat.
- [ ] Revisions de privadesa, retenció i missatges de producte acceptades.
- [ ] Smoke: crear / reobrir / editar amb usuari A; usuari B no ho pot llistar, obtenir ni modificar; sessió caducada falla tancat.
- [ ] Rollback assajat: tornar a la imatge anterior mantenint backup i dades; la migració `0005` és additiva, no eliminar la taula si conté dades d'usuaris.
- [ ] Aprovació explícita de la persona responsable abans de qualsevol merge `dev` o habilitació d'un entorn públic.

**Decisió:** amb CI verda, la part de codi és candidata a revisió final, però sense inventari Azure/Entra real i smoke test no es pot afirmar que el desplegament estigui preparat ni executat.
