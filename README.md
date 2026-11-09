# IncForStartUp — dev

Base de desenvolupament d’IncForStartUp, amb infraestructura Azure definida en Terraform. El bootstrap, el grup dev i la identitat OIDC ja estan desplegats; l’aplicació encara està pendent.

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
