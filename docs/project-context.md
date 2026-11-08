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

Backend remot de Terraform, grup de recursos de desenvolupament, Log Analytics i Key Vault. La regió provisional és `westeurope` i es pot configurar.

Encara no es provisionen l’aplicació, PostgreSQL, serveis d’IA, xarxa privada ni identitats de desplegament. El Key Vault no té accés públic: caldrà afegir endpoint privat i connectivitat abans de llegir o escriure secrets. Cap secret es crea amb Terraform.
