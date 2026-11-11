# IncForStartUp Campus — primera fase

## Decisió de producte

Oferir l’eina directament a professors i alumnes, amb adopció individual i invitacions per espai. No cal una implantació institucional per iniciar el pilot. Els contactes amb universitats serviran per trobar participants i recollir feedback.

La necessitat que volem validar és donar continuïtat als projectes: presentació, entregues successives, feedback docent i millora. La plataforma no substitueix inicialment el campus virtual ni el registre oficial de qualificacions.

## Primera implementació: prototip navegable

Ubicació: `apps/web`, Next.js, React i TypeScript. Idioma inicial implementat: català. El castellà queda pendent; no es mostra un selector que simuli una traducció inexistent.

Pantalles:

1. Resum amb projectes, estat de les entregues i dates de l’espai.
2. Projectes amb cerca per nom, descripció, àmbit o equip i filtre per espai.
3. Espais docents: creació amb títol, assignatura i data orientativa.
4. Fitxa del projecte: equip, descripció, historial d’entregues i feedback de cada versió.
5. Nova entrega amb comentari i fitxers locals; descàrrega dels fitxers desats.
6. Avaluació del professor amb rúbrica ponderada, comentari i nota orientativa sobre 10.
7. Ajuda, exportació de fitxes/revisions i restabliment de dades de mostra.

El selector de professor/alumne només permet provar els dos recorreguts: no és un mecanisme d’autenticació ni d’autorització. Les persones i els projectes inicials són ficticis. Les fitxes i revisions es guarden a localStorage, i els fitxers a IndexedDB del mateix navegador; no es comparteixen amb altres dispositius ni comptes. L’exportació JSON no conté els binaris adjunts. No és un entorn per custodiar treballs reals o confidencials.

Els codis d’espai són demostratius i no creen invitacions ni membresies. La guia de projecte conté preguntes editorials; no hi ha un model d’IA connectat ni un servei de resum de documents. Tampoc hi ha aparador públic ni publicació de projectes.

## Regles implementades i comprovades

- Una entrega nova crea una altra versió i conserva el feedback de les versions anteriors.
- El projecte torna a pendent de revisió quan hi ha una versió nova sense avaluar.
- La rúbrica inicial pesa 30%, 30%, 25% i 15%; tots els criteris han de tenir una puntuació de 0 a 10.
- La nota ponderada és orientativa i la posa el professor, no una IA.
- Els errors de lectura o escriptura locals es mostren a la interfície.
- Fins a cinc fitxers de 10 MB per entrega en el prototip.

## Pas següent: MVP compartit

1. Autenticació real amb comptes personals, sense exigir un domini universitari.
2. API amb autorització per membresia d’espai/equip i PostgreSQL, seguint el model de dades.
3. Invitacions amb caducitat, tokens desats com a hash i acceptació explícita.
4. Documents en Azure Blob privat, permisos temporals i validació del contingut.
5. Rúbriques configurables per espai i registre auditable de publicacions/revisions.
6. Proves de separació de dades entre equips i espais abans del pilot.
7. Castellà i validació del flux amb professors i alumnes reals.

L’aparador voluntari, la IA sobre documents autoritzats i les connexions amb empreses són fases posteriors. Allotjar un projecte no autoritza per si mateix a publicar-lo ni a entrenar models amb el seu contingut.

## Mesures del pilot

Temps fins a crear un projecte i presentar la primera versió; percentatge d’entregues amb feedback; temps del professor dedicat a revisar; percentatge d’equips que presenta una versió millorada; interès a continuar després de l’assignatura. No s’inclouen analítica ni seguiment d’usuaris al prototip.

## Infraestructura

Es conserva Azure/Terraform i France Central. Aquesta fase no aplica la base Container Apps/ACR pendent ni crea recursos nous. El prototip no té una URL Azure publicada.

## Increment de backend

S’ha afegit una API FastAPI amb migracions i permisos per espai/equip a `apps/api`. La interfície continua utilitzant dades locals fins que connectem el login i l’API. Les invitacions reals existeixen a l’API, però els codis del prototip continuen sent demostratius. Les entregues de l’API són textuals; la càrrega de fitxers al servidor resta pendent.

La secció Projectes incubats presenta BeFirst amb nom i domini facilitats pel promotor. És una fitxa curada, no una entrega acadèmica ni una importació del seu codi privat.
