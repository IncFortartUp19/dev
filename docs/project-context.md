# Context d’IncForStartUp

## Decisions confirmades per l’usuari

- Plataforma per connectar persones de diferents disciplines, idees i projectes, amb suport d’IA i espais de col·laboració.
- Mercat inicial: Espanya; públic obert a tothom; ambició internacional.
- Finançament: recursos propis i posterior inversió.
- Infraestructura: Azure, definida amb Terraform.
- Repositori: `IncFortartUp19/dev`. Mantenir l’usuari `developer` sense canvis.

## Propostes del pla anterior, encara per concretar

- Web responsive abans d’una aplicació mòbil.
- Next.js/React, Python/FastAPI i PostgreSQL amb pgvector.
- Perfils, Idea Hub, matching, espais de projecte, assistent IA i missatgeria.
- Model freemium i plans de pagament; preus i objectius pendents de validació.

Les dades de mercat, imports i terminis del pla original són hipòtesis de planificació; aquest repositori no els considera resultats verificats.

## Abast d’aquesta primera base d’infraestructura

Backend remot de Terraform, grup de recursos de desenvolupament, Log Analytics i Key Vault. La regió acordada és `francecentral`. París és la regió principal de llançament. La rèplica i recuperació de desastres es definiran més endavant; encara no es configuren.

Encara no es provisionen l’aplicació, PostgreSQL, serveis d’IA ni xarxa privada. La identitat OIDC de GitHub es defineix separadament i encara s’ha d’activar a Azure. El Key Vault no té accés públic: caldrà afegir endpoint privat i connectivitat abans de llegir o escriure secrets. Cap secret es crea amb Terraform.

## Reorientació acordada: Campus

L’usuari ha prioritzat l’adopció directa per professors i alumnes. La fase inicial és gestionar projectes universitaris, entregues i avaluacions; les pimes, grans empreses/inversió i l’expansió geogràfica són fases posteriors. Els contactes universitaris poden ajudar a reclutar participants, sense condicionar el producte a una venda institucional.

S’ha començat un prototip Next.js a `apps/web`, amb dades de mostra i persistència local. No es publica encara a Azure ni es connecta IA. L’allotjament Container Apps/ACR continua pendent de desplegament. Consulta `docs/product/campus-mvp.md` i `docs/product/data-model.md` per a l’abast i el model compartit.

## Campus i BeFirst en paral·lel

L’usuari ha creat `hello@incforstartup.es` i ha demanat aparcar el correu per centrar-se en codi i GitHub. També ha confirmat incorporar BeFirst (`befirst90.com`) mitjançant una fitxa i mantenir-ne el codi privat. La fitxa va a Projectes incubats i no comparteix dades amb l’espai docent.

La primera API Campus és a `apps/api`; el frontend encara és una demostració local. No es creen recursos Azure ni es desplega BeFirst amb aquests canvis.

## Connexió entre frontend i API

S’ha afegit login OIDC configurable, proxy BFF amb cookies HttpOnly i el mode Campus connectat. Es manté `/demo` separat. El recorregut entre professor i alumne s’ha preparat per provar amb dues sessions independents: el professor convida i avalua amb el seu compte, i l’alumne presenta amb el seu; els permisos depenen de cada espai. Encara cal configurar el proveïdor real abans del pilot. No es modifiquen Azure, els dominis, el correu ni les dades de BeFirst.
