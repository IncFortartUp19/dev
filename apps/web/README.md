# IncForStartUp Campus — web

Next.js, React i TypeScript, amb dos modes separats:

- **Demostració local** a `/demo`: dades fictícies, projectes a localStorage i fitxers a IndexedDB. El selector permet provar professor i alumne, sense autenticació real.
- **Campus connectat** a `/campus`: login OIDC, sessió HttpOnly i dades de l’API FastAPI. Cada participant utilitza el seu compte; el rol depèn de la membresia de l’espai.

## Executar

Node.js 24 i npm:

```bash
cd apps/web
npm ci
cp .env.example .env.local
npm run dev
```

Obre http://localhost:3000. Per defecte mostra la demostració. Amb `CAMPUS_MODE=connected`, la portada obre el portal autenticat; cal configurar les variables d’identitat i l’API descrites a [Campus connectat](../../docs/product/connected-campus.md). Sense configuració, el login informa que el pilot està en preparació i no dona accés a dades.

Per provar professor i alumne reals, utilitza dos perfils de navegador o una finestra normal i una de privada. Dues pestanyes del mateix perfil comparteixen sessió.

## Validar

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Les proves E2E de demostració arrenquen el servidor de producció al port 3100. En un entorn amb Chromium instal·lat, pots indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. `QA_BASE_URL` permet provar un servidor de demostració ja engegat.

## Prova connectada sense credencials reals

Requereix Python 3.12, uv, OpenSSL i les dependències d’`apps/api` instal·lades:

```bash
npm run build
npm run test:connected
```

Arrenca serveis efímers a loopback: proveïdor OIDC HTTPS (9443), API (8100) i web (3400). Utilitza dos comptes i claus generades només per a les proves. No afegeix cap bypass d’autenticació al codi de l’aplicació ni necessita credencials de Microsoft/Azure. Vegeu el document del mode connectat per als límits i el funcionament.

## Estat funcional

El mode connectat permet crear espais, generar invitacions d’un sol ús, acceptar-les, crear equips i projectes, presentar versions de text i publicar feedback amb rúbrica. La nota es calcula també al servidor. Les revisions publicades són immutables en aquesta fase.

La càrrega de documents al servidor queda pendent: els fitxers del prototip només existeixen en la demostració local. No hi ha IA connectada, enviament de correus ni aparador automàtic. La fitxa curada de BeFirst és a Projectes incubats de la demostració i no consulta el seu repositori privat.

[Abast del MVP](../../docs/product/campus-mvp.md) · [Model de dades](../../docs/product/data-model.md) · [Login i mode connectat](../../docs/product/connected-campus.md).

`/lab`: laboratori independent de validació (problema, públic, hipòtesi, experiment i aprenentatge). Esborrany en memòria amb exportació/importació JSON; no es desa al compte ni s’envia a una IA.
