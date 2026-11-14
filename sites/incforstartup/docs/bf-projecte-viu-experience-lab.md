# Inc Experience Lab 02 — BF Projecte Viu (pilot UX)

> **Estat:** prototip estàtic, dades de mostra; no és backend, producte BF, RAG, Inc AI real, Inc Agreements ni Inc Proof verificat. No publicar el prototip ni fer-lo servir amb dades reals. La issue #27 continua bloquejant la integració funcional.

## Enllaç d'entrada

Obrir `sites/incforstartup/public/bf-projecte-viu-lab.html` al navegador com a fitxer local o via servidor de desenvolupament estàtic. Funciona sense dependències de compilació ni internet. La ruta no substitueix la Home existent ni integra dades amb el backend.

## Hipòtesi de disseny

Una persona fundadora pot portar el projecte BF des de la pregunta inicial fins a una decisió argumentada sense necessitat de donar d'alta un equip, vincular finances, publicar documents o signar acords. BF és un exemple local, independent dels repositoris, la marca i els espais de producció de BF.

## Mapa de pantalles

| Pantalla | Objectiu | Traçabilitat |
| --- | --- | --- |
| Home | Reprendre BF i veure la pregunta activa | Inc Home, #11 |
| Projecte Viu | Editar intenció, pregunta i etapa; persistir fitxa | #5, #11 |
| Proves | Preparar nova prova i registrar resultat (inclòs inconcloent) | #6–#7, #12–#13 |
| Evidències | Mostrar observacions i referències declarades amb abast | #13, futur #40 |
| Inc AI | Explicar, sense model remot, opcions en funció del resultat | #14, futur #24 |
| Inc Connect | Vista prèvia d'una necessitat, amb projecte privat | #8, #15, #20–#21 |
| Traçabilitat | Decisions humanes amb motiu i historial local | #14, futur #22–#23 |

## Ruta de prova manual (10 minuts)

1. Obrir l'HTML, comprovar etiqueta privada i absència d'alertes en consola.
2. Editar intenció/pregunta, desar i recarregar; confirmar persistència **només al mateix navegador**.
3. A **Proves**, seleccionar «Validar la proposta 1-of-1»; personalitzar el criteri, desar.
4. Introduir observació i evidència **fictícies**, marcar «Inconcloent» i registrar.
5. A **Inc AI**, comprovar que no afirma haver validat el resultat i recomana reformular/limitar la prova.
6. Registrar una decisió humana «Reformular» amb motiu; comprovar-la a Traçabilitat.
7. A **Inc Connect**, introduir una necessitat fictícia de confecció i generar vista prèvia; comprovar que no hi ha cap petició de xarxa, publicació, invitació ni canvi de privacitat.
8. Exportar JSON local, comprovar estat, reiniciar demo i comprovar que torna a dades inicials.
9. Repetir amb resultat favorable i desfavorable; revisar UI en mòbil, navegació per teclat i zoom 200%.

## Fitxa de BF i supòsits

- Marca BF — Be First i orientació streetwear premium; concepte de peces úniques 1-of-1 i BF90 es fan servir com a context il·lustratiu del pilot.
- La pregunta de validació, els experiments, les necessitats i els resultats són **propostes de prova**, no fets verificats de BF.
- No s'importen arxius, dades de clients, imatges, estratègia ni originals de BF des de Canva o altres repositoris.

## Dades i privacitat

- `localStorage` sota `inc.demo.bf-projecte-viu.v1`, sense autenticació, backend, ACL, RLS, servidors, sincronització ni IA externa.
- El guardat és local i explícit; en dispositiu compartit, les dades locals no són confidencials: **usar només dades de demostració**.
- «Publicar necessitat» no existeix en aquesta demo; la vista prèvia no fa res públic.
- Els textos de l'usuari s'escapen abans de presentar-se; la demo no inclou HTML arbitrari ni càrregues d'arxius.
- Inc AI és un arbre de resposta determinista local (no hi ha cites perquè no es recuperen fonts).
- Exportació manual local; reinici confirma la supressió de la demo del navegador actual, sense efectes a GitHub ni a BF.

## Contractes previstos per backend (no implementats)

| Entitat canònica | Camps mínims futurs | Invariant |
|---|---|---|
| Project | id, owner, audience, question, intent, stage, revision | private-by-default, ACL server-side |
| Experiment | id, project_id, question, method, criterion, active_state | prova no obligatòria a la creació |
| Result | id, experiment_id, result_class, observations, timestamp | resultat inconcloent vàlid |
| Evidence | id, source_revision, reference, rights, audience, provenance | declaració no és verificació |
| Decision | id, experiment_id, actor, type, rationale, revision | només actor autoritzat |
| PublishableNeed | id, source_project, curated_public_fields, audience, consent | mai heretar visibilitat de tot el projecte |

Aquesta demo **no** és font de veritat d'aquestes entitats ni implementa els contractes d'accés. Cal definir aquests contractes després de resoldre #27 i abans de qualsevol integració amb dades reals.

## Criteris que no s'han de confondre

- Prototip executable en navegador ≠ prova E2E del backend.
- Recordar al navegador ≠ persistència autenticada del projecte.
- Evidència declarada ≠ validada per tercers.
- Inc AI local ≠ recomanació RAG amb cites/ACL.
- Vista prèvia d'una necessitat ≠ publicació ni consentiment de contacte.
- Decisió registrada localment ≠ signatura d'acord ni contribució verificada Inc Proof.

## Pròxims increments després de revisió UX

1. Feedback del flux BF: temps de primera acció, comprensió de privacitat, fricció i terminologia; tests amb dos perfils ficticis diferents.
2. #27: resoldre models/migracions i fonts de veritat. PR #17 + #11/#5: fer funcionar la fitxa persistent i autenticada.
3. #12 + #6: prova activa; #13 + #7: resultats/evidències; #14: decisió; #15: ampliació gradual.
4. #20/#21: publicació granular i contacte consentit; #24/#40: procedència i recuperació autoritzada; després #22/#23 i Cross-project.

## Definition of Done del pilot

- [x] Circuit visual BF end-to-end amb navegació i estat local.
- [x] Invariants explícits: privat per defecte, resultats inconcloents, recomanació ≠ decisió, vista prèvia ≠ publicació.
- [x] Documentat el límit de demo i el pla de prova manual.
- [ ] Validació manual en navegadors i accessibilitat (pendent, no reclamar prova passada).
- [ ] Revisió de producte / disseny per l'usuari.
- [ ] Integració autenticada en backend (fora d'abast, bloquejada per #27).
