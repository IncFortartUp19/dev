# Inc · Exploracions visuals 01

Primera ronda del 13/11/2026. No és una identitat definitiva ni una aprovació de llançament.

| Variant | Accent | Direcció |
| --- | --- | --- |
| Nexus | Cian #a5f3fc | Òrbites, precisió, superfícies fosques |
| Aurora | Lavanda #d8b4fe | Formes suaus, atmosfera, creativitat |
| Signal | Llima #dcff9b | Geometria angular, titulars en majúscules, acció |

Totes utilitzen fons gairebé negre, titulars blancs i textos secundaris clars.
Nexus és la variant inicial; el selector de capçalera aplica qualsevol variant a totes les rutes.
El Laboratori visual (`#disseny`) presenta les tres direccions i recull observacions per variant.
La preferència es desa a `incforstartup.theme.v1`; les notes, a `state.designNotes`, dins del
registre local existent, i s’inclouen a l’exportació JSON.

Implementació: `themes.css` amplia els estils existents mitjançant variables; `themes.js`
afegeix el selector, la ruta de comparació i el formulari. Les dades de projectes no es migren.

Validació: sintaxi JavaScript, comprovació del repositori, inspecció visual al navegador,
canvi de les tres variants, navegació a portada i persistència de la variant i d’una nota
al recarregar. Estils adaptatius afegits; pendent revisió específica en dispositius mòbils.

## Properes rondes proposades

- Comparar llegibilitat i jerarquia amb projectes reals.
- Valorar densitat del tauler, navegació mòbil i composició de les fitxes.
- Combinar elements preferits abans de fixar la identitat visual.
- Revisar accessibilitat completa amb teclat, zoom, mòbil i contrast.

## Backend: pendent i independent del tema

Les variants no implementen persistència compartida ni permisos. Per aprofundir el producte:
1. Connectar identitat i membresies a l’API existent.
2. Persistir projectes, necessitats, candidatures, acords i revisions amb autoria.
3. Validar aïllament, concurrència i revocació d’accés amb comptes reals.
4. Connectar coneixement aprovat i cites protegides després d’aquestes proves.

Aquests punts són un ordre de treball proposat, no capacitats desplegades.
