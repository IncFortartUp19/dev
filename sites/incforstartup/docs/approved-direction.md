# Inc · Direcció aprovada i revisions pendents

Decisions d’Omar del 13 de novembre de 2026. Aprovació de la direcció conceptual; no significa que totes les funcions estiguin implementades ni que els textos siguin definitius.

| Punt | Espai | Decisió i treball pendent |
| --- | --- | --- |
| 1 | Entrada immersiva | Aprovat. Començar la transició en entorn de proves, branca `dev`. Fragments de coneixement, idees i tecnologia connecten amb el nucli i obren el portal. |
| 2 | Punt de partida | Aprovat. Les tres intencions han de tenir missatges propis millorats. Textos pendents de treballar amb Omar; no fixar-los com a definitius. |
| 3 | Campus | Aprovat amb revisions. És el punt de partida del llançament, no el límit de públic d’Inc. Revisar també les entrades dels punts 1 i 2 per arribar a tothom de manera clara, concisa i útil. |
| 4 | Mostres d’idees | Aprovat. Biblioteca de possibilitats amb adaptació, combinació, preguntes i aprenentatges documentats. |
| 5 | Laboratori | Aprovat. Taller per formular, qüestionar i provar; separar aportacions personals, suggeriments d’IA i evidències. |
| 6 | Mètodes | Aprovat amb punts per millorar. Orientació adaptada al context; precisar les recomanacions i la seva utilitat. |
| 7 | Projectes | Aprovat amb revisió especial de l’experiència d’usuari. Fer més evident el propòsit, el que s’ha après i la següent acció; evitar sobrecàrrega inicial. |
| 8 | Persones i recursos / Finançament | Aprovat. Plantejar un espai propi i personalitzat de finançament, relacionat amb els projectes i diferenciat de la col·laboració general. |
| 9 | Coneixement i IA | Aprovat. Memòria amb context, fonts, evidències, revisions i permisos. |
| 10 | De la idea a l’organització | Aprovat. Camins diversos: empresa, cooperativa, recerca, cultura, iniciativa social o continuïtat dins una organització. |
| 11 | Construïm Inc | Aprovat. Fer visibles experiments, estat real i decisions obertes del portal. |

## Prova implementada ara

`sites/incforstartup/public/entrada-dev.html` és una entrada alternativa de desenvolupament. Carrega el mateix portal i afegeix exclusivament la transició experimental. `index.html` no s’ha modificat amb aquesta prova. No s’ha desplegat al Site existent ni s’ha integrat a `main`.

- Activació del nucli: els fragments convergeixen i el nucli s’obre durant 650 ms.
- Accés directe: entra sense esperar la transició.
- Moviment reduït o moviment pausat: entrada immediata.
- Les entrades posteriors al nucli en la mateixa sessió ometen la transició.
- Escape permet saltar la transició; una doble activació no la duplica.
- El focus passa al títol de l’interior. La fallada de sessionStorage no impedeix entrar.
- La prova usa l’emmagatzematge local existent si se serveix al mateix origen; no elimina ni importa dades.

Aquesta és una primera prova de moviment. La transformació visual completa dels fragments en elements de navegació encara necessita exploració de disseny. No representa una connexió nova amb IA ni permisos de backend.

## Com executar la prova

Des de `sites/incforstartup`:

```sh
node --test tests/entry-transition.test.cjs
python3 -m http.server 8080 --directory public --bind 127.0.0.1
```

Obrir `http://127.0.0.1:8080/entrada-dev.html`. És un servidor local per revisar la branca, no un desplegament de proves compartit.

## Finançament: proposta a desenvolupar

Un espai propi amb dues intencions provisionals: «Busco finançament per avançar» i «Vull contribuir al desenvolupament d’un projecte». Els textos continuen oberts.

La vista del projecte podria organitzar l’objectiu de finançament, la fase, l’ús previst dels recursos, les fites i la documentació disponible. Les oportunitats es podrien orientar segons sector, fase i preferències explícites. Caldrà definir criteris, visibilitat de documents i persones autoritzades abans de connectar dades reals.

No implica activar pagaments, recomanacions d’inversió ni contacte automàtic amb finançadors. La primera feina és definir què necessita entendre i decidir cada participant.

## Següent revisió amb Omar

1. Missatge principal d’Inc i missatge específic de cada intenció d’entrada.
2. Campus com a primera comunitat de llançament dins una plataforma oberta a tothom.
3. Escena d’ús de Projectes: persona, necessitat, acció i resultat visible.
4. Relació entre Finançament, Projectes i Persones i recursos.
5. Ajustos del selector de mètodes segons casos reals.

## Validació

Sis proves de comportament: entrada inicial, moviment reduït/repetició, doble activació/Escape, emmagatzematge no disponible, clic modificat i cancel·lació per navegació. Revisió visual de la nova transició en navegador i mòbil pendent.
