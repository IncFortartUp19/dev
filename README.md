# IncForStartUp — dev

Base de desenvolupament d’IncForStartUp. El repositori comença amb infraestructura de col·laboració i validació; encara no conté una aplicació ni un desplegament.

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
| `infra/` | Configuració d’entorns i desplegament |
| `scripts/` | Automatització del repositori |
| `docs/` | Decisions i documentació tècnica |
| `.github/workflows/` | Comprovacions automàtiques |

## Flux de treball

Crea una branca, executa les comprovacions i obre una pull request cap a `main`. GitHub Actions executa les mateixes comprovacions en cada push i pull request. La protecció de branques no està configurada per aquests fitxers.

Consulta [CONTRIBUTING.md](CONTRIBUTING.md) i [l’estat de la infraestructura](docs/infrastructure.md).
