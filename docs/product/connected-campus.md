# Campus connectat: dos comptes i permisos per espai

## Recorregut implementat

1. El professor inicia sessió amb el seu compte i crea un espai docent.
2. Genera una invitació d’un sol ús i comparteix l’enllaç manualment.
3. L’alumne obre l’enllaç, s’identifica amb el seu propi compte i confirma l’acceptació.
4. L’alumne crea un equip, un projecte i una entrega de text.
5. El professor, amb el mateix compte que va crear l’espai, consulta i avalua l’entrega.
6. L’alumne veu el feedback i pot presentar una altra versió, preservant l’historial.

Són dues identitats independents. Es demana al proveïdor que permeti seleccionar compte (`prompt=select_account`); es pot adaptar amb `CAMPUS_OIDC_PROMPT` si el proveïdor no ho admet. No cal crear un compte addicional per avaluar: el professor convida i avalua amb el seu compte; l’alumne presenta amb el seu. Per provar-ho manualment cal fer servir dos perfils de navegador, o una finestra normal i una de privada. Obrir dues pestanyes del mateix perfil comparteix la sessió i no representa dos usuaris.

El rol depèn de cada espai. Una persona pot ser docent del seu propi espai i alumna en un altre; crear un espai no li permet avaluar en espais aliens. Els noms i rols del token OIDC no concedeixen permisos docents.

## Rutes i separació de dades

- `/campus`: espais i projectes del compte, carregats des de l’API.
- `/campus/join`: acceptació explícita d’una invitació amb el compte identificat.
- `/login`: inici de sessió OIDC; indica que el pilot està en preparació si falten configuracions.
- `/demo`: prototip amb dades locals i selector de professor/alumne, separat del Campus connectat.
- `/`: mostra la demostració per defecte; `CAMPUS_MODE=connected` redirigeix al portal autenticat.

La vista connectada no utilitza localStorage ni IndexedDB per guardar projectes o access tokens. No importa dades de la demostració ni de BeFirst. La fitxa de BeFirst continua sent un catàleg curat a la demostració i no representa accés a informació privada de l’altre producte.

## Login i sessió

S’utilitza Auth.js / NextAuth `5.0.0-beta.32`, fixat al lockfile, amb un proveïdor OIDC configurable i authorization code flow amb PKCE, state i nonce. És una versió prerelease compatible amb Next.js 16; s’ha de revisar i mantenir abans d’un pilot públic.

Els tokens d’accés del proveïdor es mantenen dins de la sessió xifrada Auth.js en cookies HttpOnly, SameSite=Lax i Secure quan l’origen és HTTPS. Auth.js gestiona la fragmentació de cookies grans. Ni `/api/auth/session` ni les props dels components client exposen access, refresh o ID tokens. No es persisteixen refresh tokens: quan caduca el token d’accés cal tornar a iniciar sessió. La sessió de l’aplicació té una durada màxima d’una hora, limitada també per la caducitat del token del proveïdor.

Tancar la sessió elimina la sessió d’aquesta aplicació; la sessió SSO del proveïdor d’identitat és independent. No hi ha revocació global de tots els dispositius en aquesta fase.

## Proxy servidor i autorització

El navegador crida `/api/campus/...` al mateix origen. El proxy llegeix exclusivament la cookie de sessió i afegeix el bearer token en la petició servidor-servidor cap a FastAPI. Un header Authorization enviat pel navegador no substitueix la sessió.

El proxy limita les rutes i els mètodes, només admet els paràmetres de paginació, rebutja redireccions del backend i limita el cos JSON dels POST a 64 KiB. Les mutacions exigeixen l’Origin exacte de l’aplicació. Les respostes autenticades no es poden guardar en memòria cau. L’API continua comprovant cada membresia; el proxy i els botons de la interfície no són l’autorització final.

Els GET de membres d’espai requereixen el professor d’aquell espai. Els membres d’un equip només són visibles per al seu professor i els membres del mateix equip. Les respostes no inclouen emails ni subjectes OIDC.

## Invitacions

L’enllaç usa `/campus/join#token=...`. El fragment no s’envia al servidor web ni al proveïdor OIDC. El client el retira de la barra d’adreces i el conserva temporalment en sessionStorage d’aquella pestanya durant el login. Només es presenta a l’API en acceptar la invitació i s’esborra després de l’acceptació. La política de referrer és `no-referrer`.

Aquest token d’invitació és un secret d’accés temporal: cal compartir-lo només amb el destinatari. El servidor en desa un hash i imposa caducitat de 24 hores, revocació i un sol ús. Una invitació d’equip exigeix que el receptor ja sigui alumne de l’espai. No s’envien correus automàtics ni s’utilitzen credencials de `hello@incforstartup.es`.

## Configurar un proveïdor real

No s’ha creat cap tenant ni registre d’aplicació amb aquest canvi. Cal seleccionar el proveïdor d’identitat dels participants (per a un pilot obert, valorar Entra External ID) i configurar-lo separadament de Microsoft 365 i de la identitat de desplegament de GitHub.

1. Registrar un client web confidencial amb callback local `http://localhost:3000/api/auth/callback/campus-oidc`. A Azure, registrar només l’URL HTTPS real, per exemple `https://campus.incforstartup.es/api/auth/callback/campus-oidc`.
2. Exposar/autoritzar l’scope d’accés de la Campus API i l’audiència corresponent. L’audiència de l’access token per a l’API pot ser diferent del client ID web; no s’ha d’enviar l’ID token com a token d’API.
3. El proveïdor ha de donar discovery OIDC amb authorization, token, JWKS i userinfo endpoints, suport de PKCE S256 i ID tokens signats. La integració utilitza `client_secret_post`. L’API actual accepta tokens RS256 i verifica emissor, audiència i caducitat.
4. Copiar `apps/web/.env.example` a `.env.local` i configurar `AUTH_URL`, `AUTH_SECRET`, `CAMPUS_API_URL`, `CAMPUS_OIDC_ISSUER`, `CAMPUS_OIDC_CLIENT_ID`, `CAMPUS_OIDC_CLIENT_SECRET` i `CAMPUS_OIDC_SCOPE`.
5. A l’API, configurar `OIDC_ISSUER`, `OIDC_AUDIENCE` i `OIDC_JWKS_URL` del mateix emissor, amb l’audiència de recurs correcta. Executar les migracions abans d’arrencar.
6. Generar `AUTH_SECRET` amb una eina criptogràfica, per exemple `openssl rand -base64 48`. Guardar els secrets en configuració protegida/Key Vault; mai a GitHub ni en variables `NEXT_PUBLIC_`.
7. En desenvolupament web, utilitzar `localhost`, perquè NextRequest normalitza els hosts IP de loopback. A Azure, utilitzar un domini HTTPS exacte. Publicar només darrere d’un proxy de confiança amb l’host correcte; l’origen de les mutacions ha de coincidir amb AUTH_URL.

Sense aquests valors, el login i el proxy no permeten accés a dades. No hi ha fallback de contrasenya, header d’impersonació ni comptes de proves habilitats al servidor de l’aplicació.

## Proves automatitzades

```bash
cd apps/api
uv sync --locked
cd ../web
npm ci
npm run build
npx playwright install chromium
npm run test:connected
```

La prova arrenca un proveïdor OIDC **només de proves** a loopback HTTPS, l’API FastAPI amb una base SQLite temporal migrada i el servidor Next.js de producció. Genera claus RSA, certificat local i secrets efímers. El procés Next confia explícitament en el certificat de prova mitjançant NODE_EXTRA_CA_CERTS; no es desactiva la verificació TLS del servidor. El navegador de proves accepta aquest certificat local només en aquest mode.

El proveïdor comprova client, callback, PKCE i codis d’un sol ús; emet ID tokens amb l’audiència web i access tokens amb l’audiència API. Auth.js valida el callback i FastAPI valida els tokens signats. Dos contextos de navegador independents representen professor i alumne. Les proves comproven invitació, entrega, avaluació, feedback compartit, nova versió, permisos diferents entre espais, logout i el rebuig de peticions sense cookie o d’origen aliè.

Els fitxers `tests/support` no formen part de l’autenticació de producció i no es poden iniciar sense RUN_CONNECTED_E2E=1. Aquestes proves no substitueixen una validació amb el proveïdor real del pilot.

## Encara pendent

Càrrega de documents a Azure Blob, configuració del proveïdor real, desplegament HTTPS i validació del pilot amb usuaris reals. Les entregues connectades d’aquesta fase són de text. L’avaluació publicada és immutable i la rúbrica és la mateixa de quatre criteris de l’API; la configuració i les correccions auditables es desenvoluparan després.
