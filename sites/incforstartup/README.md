# Site IncForStartUp

Còpia del codi del Site de treball, actualitzada el 13 de novembre de 2026.

- Site: https://incforstartup.independentankle2.chatgpt.site
- Commit d’origen al repositori Sites: `983769536c39e48e8cacef64e5cf190cbf8fe8a0`.
- Accés del Site: privat, només el propietari. Aquest repositori GitHub és públic.
- Aplicació estàtica independent de `apps/web` i `apps/api`; sense dependències de compilació.

## Execució local

Des de l’arrel del repositori:

```sh
python3 -m http.server 4173 --directory sites/incforstartup/public
```

Obre http://localhost:4173. El desat requereix un navegador amb localStorage disponible.

## Funcionalitat conservada

Campus obert, projectes de qualsevol disciplina, laboratori d’idees, direcció de projectes,
registre d’aprenentatges, preparació jurídica i operativa, recorregut de la idea a l’empresa,
i necessitats i aportacions vinculades a projectes amb propostes, acords, evidències i historial.

Les universitats són el focus inicial. També hi tenen lloc iniciatives personals, startups i
empreses de qualsevol sector. BF és només un projecte vinculat amb desenvolupament propi.

## Límits i dades

Les dades són locals al navegador, sota `incforstartup.workspace.v1`, i es poden exportar com a JSON.
Aquesta còpia inclou codi i contingut de la interfície; no inclou dades de localStorage,
exportacions de l’usuari, credencials, tokens ni la configuració privada d’allotjament.
No hi ha sincronització entre comptes, enviament de candidatures, signatura d’acords,
pagaments, control d’accés per projecte ni IA connectada en aquest Site.
Els camps de visibilitat i els estats són anotacions de planificació.
Les referències a PR i proves anteriors són informació històrica mostrada pel Site.

## Validació

- Comprovació de sintaxi JavaScript amb `node --check`.
- Formulari d’aportacions provat al navegador: rebutja verificació sense proposta,
  acord/termini i evidència/persona revisora; desat comprovat després de recarregar.
- La prova del navegador s’ha fet al Site abans de copiar aquests mateixos fitxers.
- No s’han validat serveis backend ni integracions entre comptes.

## Continuïtat

En cada increment del Site, actualitzar aquesta carpeta i la documentació en una branca
amb PR. GitHub i Sites tenen repositoris separats: no hi ha sincronització automàtica.
La publicació a Sites manté el seu flux propi i no es dispara des d’aquesta còpia.
Els dissenys de Canva i el brief visual es documenten a `docs/design/incforstartup-canva.md`.
