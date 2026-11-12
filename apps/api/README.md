# IncForStartUp Campus API

API FastAPI amb SQLAlchemy i migracions Alembic. SQLite facilita el desenvolupament local; PostgreSQL és el destí previst per al backend compartit. Les proves de GitHub Actions executen el mateix recorregut amb SQLite i PostgreSQL 16 efímer.

## Executar localment

Requisits: Python 3.12 i [uv](https://docs.astral.sh/uv/).

```bash
cd apps/api
uv sync --locked
cp .env.example .env
uv run --env-file .env alembic upgrade head
uv run --env-file .env uvicorn campus_api.main:create_app --factory --reload --host 127.0.0.1
```

Documentació interactiva: http://127.0.0.1:8000/docs. `/healthz` comprova el procés i `/readyz` la connexió i la presència de migracions.

Amb els camps OIDC buits, pots obrir la documentació però no operar amb dades protegides: sense token es retorna 401; amb un token i sense proveïdor configurat es retorna 503. No hi ha un header de demostració ni una contrasenya universal per saltar-se l’autenticació.

## Autenticació

Configura conjuntament `OIDC_ISSUER`, `OIDC_AUDIENCE` i `OIDC_JWKS_URL` del proveïdor d’identitat d’usuaris de Campus. La URL de JWKS ha de ser HTTPS. L’API accepta access tokens RS256 i verifica signatura, emissor, audiència, expiració, data d’emissió i subjecte. El primer accés vàlid crea el perfil identificat per emissor i subjecte. No emmagatzema contrasenyes.

Els rols del token no concedeixen permisos docents: les autoritzacions es consulten a la base de dades per espai i equip. Un professor en un espai no rep accés a un altre espai. El token de GitHub OIDC utilitzat per desplegar infraestructura no és un token d’usuari per a aquesta API. El codi del login i el mode connectat són a `apps/web`; l’elecció/configuració del proveïdor real d’usuaris resta pendent.

Les proves simulen la identitat dins del procés de pytest; aquest mecanisme no està habilitat al servidor. Les proves específiques d’autenticació utilitzen tokens RSA signats i comproven el rebuig de signatures alterades, tokens caducats i emissor/audiència incorrectes.

## Recórrer l’API

1. Un usuari autenticat crea un espai amb `POST /v1/spaces` i esdevé docent d’aquell espai.
2. El docent crea una invitació amb `POST /v1/spaces/{id}/invitations`. El token, visible només a la resposta de creació, caduca en 24 hores i es desa com a hash.
3. Un alumne autenticat accepta amb `POST /v1/invitations/accept` i `{"token":"…"}`. És d’un sol ús.
4. L’alumne crea un equip amb `POST /v1/spaces/{id}/teams`. El servidor l’afegeix a l’equip.
5. Per afegir companys, un membre crea una invitació amb `POST /v1/teams/{id}/invitations`. El receptor ja ha de ser alumne de l’espai; una invitació d’equip no permet entrar a l’assignatura.
6. Un membre crea el projecte amb `POST /v1/teams/{id}/projects` i presenta versions amb `POST /v1/projects/{id}/submissions`.
7. El docent publica la revisió amb `POST /v1/submissions/{id}/reviews` i quatre puntuacions entre 0 i 10. El total es calcula al servidor amb pesos 30/30/25/15. La rúbrica es conserva com a snapshot de cada revisió.

Les revisions publicades són immutables en aquesta primera API: un segon POST retorna 409. No hi ha encara un flux auditable de correccions de qualificacions. Les entregues també són immutables; el següent lliurament crea una versió nova, sense perdre la revisió anterior.

`GET /v1/spaces`, `/spaces/{id}/teams`, `/spaces/{id}/projects` i `/projects/{id}/submissions` accepten `limit` (1–100) i `offset` (0–10000). La paginació s’aplica després del filtratge d’autorització. No hi ha llistat públic de projectes ni d’usuaris.

La numeració de versions utilitza un comptador atòmic dins de la transacció i una restricció única `(project_id, version_number)`. Els esdeveniments d’auditoria no copien tokens, documents ni contingut del feedback.

## Proves

```bash
uv run ruff check campus_api migrations tests
uv run ruff format --check campus_api migrations tests
uv run pytest -q
```

Les proves fan upgrade/downgrade de migracions i verifiquen el recorregut complet, la separació de permisos, la caducitat i revocació d’invitacions, la persistència, les signatures JWT i sis entregues concurrents. Per provar amb PostgreSQL, utilitza només una base efímera anomenada `campus_test` mitjançant `TEST_DATABASE_URL`; les proves esborren les taules al final. No configuris mai una base amb dades reals per executar pytest.

Les migracions versionades no s’executen automàticament en arrencar el servidor. Genera i revisa una migració nova per a cada canvi d’esquema.

## Límits d’aquest increment

- El frontend `apps/web` disposa de mode connectat a `/campus`, amb proxy de servidor i OIDC. Cal configurar el proveïdor real del pilot; `/demo` continua separat amb dades locals.
- Les entregues de l’API són textuals. La càrrega privada de fitxers a Azure Blob i el seu control d’accés són el següent increment; els fitxers del prototip encara són locals.
- No s’envien correus: els tokens d’invitació es distribueixen manualment. `hello@incforstartup.es` no s’utilitza com a remitent ni requereix credencials aquí.
- No hi ha verificació institucional de professors, recuperació de comptes ni IA connectada.
- La publicació d’aparadors i les dades de BeFirst no s’importen a les taules acadèmiques.

`APP_ENV=production` exigeix PostgreSQL, OIDC, `OIDC_REQUIRED_SCOPE`, `OIDC_ALLOWED_CLIENTS` i orígens CORS HTTPS explícits. El proveïdor ha d’emetre l’scope delegat i azp/appid en els access tokens. Abans d’un pilot amb persones reals cal completar login, protecció davant abús/rate limiting, càrrega de documents, gestió de comptes i desplegament HTTPS. Aquest canvi no desplega Azure ni modifica DNS.

Els professors poden consultar `/v1/spaces/{id}/members`. `/v1/teams/{id}/members` està limitat al professor de l’espai i als membres del mateix equip; les respostes no exposen emails ni subjectes OIDC.

## Projectes privats independents de Campus

La migració `0002` afegeix vaults amb membresies pròpies. `POST /v1/vaults` rep `{"name":"Projecte"}`; `GET /v1/vaults` només retorna els espais del compte i el seu rol. `GET /v1/vaults/{id}` comprova membresia. El propietari pot consultar `/members` i `/events`, concedir una membresia amb `POST /members` i `{"user_id":"UUID intern del destinatari","role":"reader"}` (o contributor), i revocar-la amb `DELETE /members/{user_id}`. Els llistats accepten limit 1–100 i offset 0–100000. No es concedeix owner ni es pot eliminar el propietari.

No s’hereten permisos docents ni d’altres projectes. No es vinculen comptes per email. El destinatari ja ha d’haver iniciat sessió a l’API; el propietari ha de verificar el seu ID per un canal conegut. La interfície d’incorporació i el flux de sol·licitud/acceptació resten pendents. Els registres d’auditoria d’aquesta fase no són immutables contra administradors.

La migració `0003` aplica RLS forçada a PostgreSQL per vaults, membresies i esdeveniments. Encara no hi ha càrrega sensible ni integració de documents amb Blob. Consulta [l’arquitectura i criteris d’activació](../../docs/product/private-startup-security.md). Les respostes `/v1/` són no-store; els access tokens admeten una audiència única. En desenvolupament, scope/client són opcionals per compatibilitat amb proves; en producció són obligatoris.

En producció, arrencar amb un rol propietari, superusuari o BYPASSRLS falla. Les migracions requereixen un compte separat del runtime; les concessions inicials són a `scripts/runtime-role.sql`. Consulta [RLS i preparació de Blob](../../docs/product/rls-and-document-storage.md). Els tests RLS realment connecten amb un login limitat al job PostgreSQL.
