# IncForStartUp — dev

Base de desenvolupament d’IncForStartUp, amb infraestructura Azure definida en Terraform. El bootstrap, el grup dev i la identitat OIDC ja estan desplegats; la primera interfície Campus està a `apps/web`, encara sense publicar a Azure.

## Començar

Requisits: Git i Python 3.11 o superior. No cal instal·lar dependències.

```bash
git clone https://github.com/IncFortartUp19/dev.git
cd dev
python3 scripts/check_repo.py
```

Si tens Make, també pots executar `make check`.

## Estructura

| Directori | Propòsit |
| --- | --- |
| `src/` | Codi de l’aplicació quan es defineixi la tecnologia |
| `tests/` | Proves de l’aplicació |
| `infra/` | Terraform: bootstrap de l’estat i entorn Azure de desenvolupament |
| `scripts/` | Automatització del repositori |
| `docs/` | Decisions i documentació tècnica |
| `.github/workflows/` | Comprovacions automàtiques |

## Flux de treball

Crea una branca, executa les comprovacions i obre una pull request cap a `main`. GitHub Actions executa les mateixes comprovacions en cada push i pull request. La protecció de branques no està configurada per aquests fitxers.

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) i [l’estat de la infraestructura](docs/infrastructure.md).

## Azure i Terraform

Consulta el [procediment d’infraestructura](docs/infrastructure.md) i el [context del projecte](docs/project-context.md). Les validacions Terraform utilitzen la versió 1.13.5; GitHub Actions comprova format, configuració i proves simulades sense credencials Azure.

La [vinculació GitHub–Azure amb OIDC](docs/github-azure.md) utilitza una identitat administrada i un entorn GitHub `dev`, sense secrets de client.

El [workflow Terraform plan dev](docs/terraform-plan.md) calcula manualment el pla complet des de GitHub amb OIDC, sense executar apply.

La [xarxa privada de dev](docs/private-network.md) prepara l’accés privat al Key Vault; consulta el pla abans de desplegar-la.

La [base d’allotjament Container Apps](docs/application-hosting.md) prepara l’entorn d’execució i el registre d’imatges per a la futura web i API.

## IncForStartUp Campus

El [prototip universitari](apps/web/README.md) permet provar espais docents, projectes, entregues i feedback amb rúbrica. Utilitza dades de mostra i emmagatzematge local; no té autenticació real ni IA connectada. Consulta [l’abast del MVP](docs/product/campus-mvp.md) i el [model de dades proposat](docs/product/data-model.md).

## API i projectes vinculats

La [Campus API](apps/api/README.md) afegeix persistència, identitat OIDC i permisos d’espai/equip, amb migracions i proves SQLite/PostgreSQL. El mode `/campus` de la web ja consumeix l’API amb sessió OIDC; cal configurar el proveïdor real. Encara no està desplegada a Azure.

[BeFirst](docs/projects/be-first.md) és el primer projecte vinculat a la secció Projectes incubats. La fitxa no inclou el seu codi privat ni dades internes.

El [Campus connectat](docs/product/connected-campus.md) cobreix el recorregut entre dos comptes independents: professor convida, alumne presenta i professor avalua. Les proves de GitHub arrenquen un proveïdor OIDC local aïllat per validar-lo sense credencials reals.

La proposta de continuïtat de Campus cap a validació i acompanyament és a [la ruta de producte](docs/product/incforstartup-roadmap.md). El laboratori `/lab` permet preparar experiments i exportar/recuperar esborranys locals.
