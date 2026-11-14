# IncForStartUp — Direcció conceptual consolidada (14-11-2026)

**Tipus:** decisions de producte aprovades a la conversa; NO equival a programari implementat, resultats de recerca, assessorament legal, evidència empírica ni contingut autoritzat per entrenar models.
**Origen:** revisió i iteracions conceptuals amb la persona fundadora, 14/11/2026.
**Estat:** aprovat com a direcció exploratòria, pendent de disseny, criteris d'acceptació i validació amb usuaris.
**Àmbit:** IncForStartUp. **No barrejar amb BF**.

## 1. Decisions de producte

| ID | Àrea | Decisió |
|---|---|---|
| INC-D01 | Proposta de valor | Projectes vius **i** ecosistema de persones: un nucli de projecte que evoluciona, més comunitat i recursos |
| INC-D02 | Campus | És un espai especialitzat de l'únic Inc, no una segona plataforma ni un límit de públic |
| INC-D03 | IA | Primer rol: ajudar a formular/validar hipòtesis i interpretar evidències; distingir observacions i conclusions |
| INC-D04 | Entrada | Tres intencions adaptatives: Crear / Participar / Explorar, sense perfils rígids ni registre forçat per consultar contingut públic |
| INC-D05 | Inici de sessió | Inc Home híbrid i dinàmic: reprendre feina i accions, més oportunitats de descoberta |
| INC-D06 | Privacitat | **Granular + progressiva**. Projectes privats per defecte; compartir recursos seleccionats només amb acció explícita |
| INC-D07 | Col·laboració | Equip estable amb rols **i** aportacions puntuals de perímetre limitat |
| INC-D08 | Descobriment | **Bidireccional**: projectes publiquen necessitats, persones ofereixen aportacions, organitzacions plantegen recursos/reptes |
| INC-D09 | Primer contacte | Contacte lleuger consentit i, si té sentit, proposta estructurada |
| INC-D10 | Propostes | Esborrany compartit; modificacions invaliden confirmacions anteriors; acceptació de la **mateixa versió** per les dues parts |
| INC-D11 | Reconeixement | **Inc Proof**: aportacions declarades, confirmades o amb evidències; visibilitat controlada i autoritzada |
| INC-D12 | Identitat | **Un compte i una identitat coherent, amb facetes adaptables** (estudiant, emprenedor/a, mentor/a, professional...), controls per audiència i per context |

## 2. Invariants no negociables de disseny

1. La identitat personal no és equivalent als rols, permisos, propietat intel·lectual o titularitat jurídica d'un projecte.
2. Canviar de faceta no dona accés a recursos, no barreja contextos Campus/empresa i no amplia audiències.
3. No hi ha comunicació automàtica amb altres persones ni enviament de candidatures per part de la IA.
4. Un contacte acceptat no és un acord; un acord acceptat no és un contracte per defecte ni concedeix permisos per si sol.
5. Cap projecte o recurs canvia a públic de manera implícita per incorporar equip, finançament o aportacions.
6. La compartició requereix vista prèvia del contingut, audiència i permisos; revocació bloqueja consultes futures, però no elimina còpies ja distribuïdes.
7. Els perfils d'aportacions no exposen dades de projectes privats sense les autoritzacions necessàries.
8. No es creen puntuacions globals de persones ni etiquetes de «verificat» que prometin més del que realment s'ha comprovat.
9. Les recomanacions de la IA han de declarar motiu, fonts, incertesa i l'opció de descartar-les.
10. **Consulta de coneixement, RAG, memòria de producte i entrenament de models són coses diferents**: cap conversa, projecte privat o dada personal entra a entrenament automàtic.
11. La IA no processa converses privades silenciosament; cal una activació i base jurídica adequada per al cas d'ús.
12. Les decisions conceptuals no substitueixen proves d'usabilitat, conformitat legal, permisos de publicació o mesures d'eficàcia real.

## 3. Vocabulari coherent

- **Projecte Viu**: unitat persistent de treball (pregunta, accions, proves, evidències, decisions).
- **Faceta**: presentació contextual de la identitat personal; no és un compte nou ni un permís.
- **Inc Connect**: necessitats, ofertes, coincidències explicables i primer contacte consentit.
- **Inc Connections**: interacció i conversa entre parts.
- **Inc Agreements**: esborranys i versions de compromisos operatius compartits, confirmacions bilaterals.
- **Inc Proof**: registre de contribucions i evidències amb reconeixement delimitat.
- **Inc AI**: assistència de validació, recomanacions contextuals i explicables, sense decisions automàtiques d'accés.

## 4. Com pot nodrir-se Inc AI d'aquest treball

**Fase A — registre editorial.** Aquest document és una font de direcció de producte aprovada, amb data i àmbit. Es pot indexar en un corpus intern de coneixement de producte amb procedència i control de versions, sempre que el seu propietari autoritzi l'ús dins l'espai corresponent.

**Fase B — recuperació protegida.** Definir identificadors de document, `scope=internal-product`, autor/owner, `approval_status=approved-concept`, versió, `valid_from`, tags i nivell d'accés. El motor RAG comprova autorització **abans de recuperar i abans de citar**. El contingut no ha de barrejar-se amb dades dels usuaris del portal.

**Fase C — assistència.** Pot respondre qüestions de criteris de producte citant `INC-Dxx`, però ha d'indicar que són decisions conceptuals i no funcionalitats completades. Si hi ha contradiccions, preval una decisió nova aprovada, no la mera data del text.

**Fase D — validació.** Proves de recuperació amb perfils autoritzats/no autoritzats, de qualitat de cites, desactualització i resistència a injectar instruccions en documents. No s'entrena ni es fine-tuneja cap model simplement per crear aquest document.

## 5. UX de demo i límits

Demo a `sites/incforstartup/public/inc-connect-concept-demo.html` (branca `concept/inc-identity-connect-proof-demo`). Dades sintètiques, sense persistència, API, autenticació, xat ni AI externa; les confirmacions i els reconeixements són il·lustratius. **No és un lloc desplegat ni una funcionalitat de producció**.

## 6. Integració amb el backlog existent

- **#11** fitxa curta privada: la porta d'entrada de Crear. La seva PR #17 requereix aprovació abans de fusionar.
- **#12–#14** acció/evidència/decisió: cor del Projecte Viu i de la validació per IA.
- **#15 / #8–#10** expansió condicionada de col·laboració i recursos: el nou treball ha de reutilitzar-les, no duplicar funcionalitats.
- La demo i les noves issues són un **circuit dependent**, no una substitució de la priorització ja acordada.

## 7. Proper debat conceptual

Identitat única i facetes adaptables: definir **facetes predeterminades, separació per audiència i context (Campus/independent/empresa), recuperació de permisos i control de la persona sobre la seva trajectòria**. No assumir que una identitat pública universal és apropiada per a totes les activitats.
