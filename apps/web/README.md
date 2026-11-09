# IncForStartUp Campus — prototip

Frontend Next.js amb dades fictícies i emmagatzematge al navegador. No té autenticació real, API compartida ni IA connectada; no és un pilot amb alumnes reals.

## Executar

Node.js 24 i npm:

```bash
cd apps/web
npm ci
npm run dev
```

Obre http://localhost:3000. El selector de la capçalera permet provar professor i alumne. L’ajuda permet exportar o restablir les fitxes locals. Els fitxers adjunts es conserven a IndexedDB i no s’inclouen en l’exportació JSON.

## Validar

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Les proves E2E arrenquen la compilació de producció al port 3100. En un entorn amb Chromium ja instal·lat, pots indicar `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`. Per provar un servidor ja engegat, configura `QA_BASE_URL` amb la seva URL.

## Provar el recorregut

1. Professor: crea un espai docent.
2. Alumne: crea un projecte dins d’aquest espai i presenta una entrega amb fitxers.
3. Professor: obre el projecte, puntua els quatre criteris i publica feedback.
4. Alumne: presenta una nova versió i consulta el feedback de la versió anterior.

Els canvis persisteixen en el mateix navegador, però no es comparteixen entre dispositius ni pestanyes en temps real. No introdueixis treballs confidencials ni dades personals reals. El límit del prototip és de cinc fitxers de 10 MB per entrega, subjecte a la quota del navegador.

[Abast del MVP](../../docs/product/campus-mvp.md) · [Model del backend](../../docs/product/data-model.md).
