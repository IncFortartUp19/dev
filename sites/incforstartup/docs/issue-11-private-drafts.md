# Fitxa curta de projecte — issue #11 / #5

## Comportament

- Ruta `/idees`: amb OIDC configurat exigeix sessió i utilitza `/api/private/idea-drafts`; sense OIDC mostra una demo local, sense promeses de sincronització.
- Pregunta obligatòria. Intenció, propera prova i nom provisional opcionals.
- Les idees autenticades es desen a `idea_drafts` amb `visibility = 'private'`; el propietari es deriva exclusivament del token OIDC validat.
- No existeix cap endpoint per canviar la visibilitat o afegir equips. No es publiquen les idees en Campus.
- Un usuari no pot llegir ni actualitzar els esborranys d'un altre. L'API respon 404 per no revelar existència.
- Les dades locals de la demo i les dades autenticades són conjunts separats. **No hi ha migració automàtica** per evitar transferir dades privades silenciosament.

## Protecció

- Validació amb models Pydantic i prohibició d'atributs addicionals; l'API no accepta `owner_id` ni `visibility` del client.
- PostgreSQL: migració Alembic `0005` que activa `ENABLE` i `FORCE ROW LEVEL SECURITY` amb polítiques owner-only per llegir, crear i editar.
- El proxy NextAuth exigeix un access token vàlid i valida origen en mutacions. El backend requereix autenticació i el context privat configurat. En producció, falta de context significa error 503 (fail closed).
- El rol de base de dades ha de tenir privilegis limitats, mai propietat de taules ni BYPASSRLS. La verificació d'arrencada inspecciona també `idea_drafts`.

## Passos de posada en servei (separats del merge)

1. Aplicar la migració amb credencials d'administrador de migracions (`alembic upgrade head`) després de còpia de seguretat.
2. Assegurar que el rol API disposi només de `SELECT, INSERT, UPDATE` sobre `idea_drafts` (la migració actualitza `incfs_api` si existeix).
3. Configurar l'issuer, audience, clients i context privat OIDC; comprovar Conditional Access abans de producció.
4. Executar CI amb SQLite, PostgreSQL i web; després validar amb dos comptes reals que cada usuari només consulta les seves idees i que una recàrrega recupera l'esborrany.
5. No desplegar ni fusionar sense revisió de seguretat i producte.

## Limitacions conegudes

- Sense sincronització entre un esborrany local i un del backend.
- Sense edició simultània optimista ni historial de revisions; abans d'afegir col·laboració, cal definir concurrència i regles de compartició.
- Amb OIDC absent l'experiència continua sent només una demostració local, no apta per a dades sensibles.
