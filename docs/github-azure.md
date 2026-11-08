# Vincular GitHub amb Azure sense contrasenyes

## Disseny

Identitat administrada assignada per l’usuari `id-incforstartup-github-dev`, amb federació OIDC:

- Emissor: `https://token.actions.githubusercontent.com`.
- Audiència: `api://AzureADTokenExchange`.
- Subjecte exacte: `repo:IncFortartUp19/dev:environment:dev`.
- Contributor només al grup de recursos `rg-incforstartup-dev`.
- Storage Blob Data Contributor només al contenidor `tfstate-dev`.

La identitat no té Owner ni permisos per assignar rols. L’estat del bootstrap i de la vinculació queda al contenidor `tfstate`, sense accés per a la identitat GitHub. No es creen secrets de client ni es modifica l’usuari `developer`.

## 1. Preparació a Azure

Completa el [bootstrap i l’entorn dev](infrastructure.md) amb la identitat d’operador existent. El bootstrap ha d’incloure `tfstate-dev`. Un administrador ha de registrar també `Microsoft.ManagedIdentity`.

L’operador que crea la vinculació necessita permisos per crear la identitat i les credencials federades al grup dev, assignar els dos rols als abasts indicats i accedir a l’estat remot. Contributor per si sol no pot assignar rols; l’administrador ha de proporcionar, per exemple, Role Based Access Control Administrator als abasts necessaris. No s’assignen aquests permisos administratius al workflow.

A `infra/terraform/github-identity`:

```bash
cp terraform.tfvars.example terraform.tfvars
cp backend.hcl.example backend.hcl
```

Edita la subscripció i el nom real del Storage Account. El backend d’aquest directori utilitza `container_name = "tfstate"` i `key = "github-identity/terraform.tfstate"`.

```bash
az login
az account set --subscription <subscription-id>
terraform init -backend-config=backend.hcl
terraform plan -out=identity.tfplan
terraform apply identity.tfplan
terraform output github_variables
```

Les sortides són identificadors públics de configuració, no secrets. La creació de la identitat pot trigar a propagar-se a Entra ID i els rols també poden necessitar temps abans del primer login.

## 2. Configuració GitHub

Un administrador del repositori ha de crear l’entorn GitHub `dev` a Settings → Environments, restringir les branques de desplegament a **només `main`** i configurar-hi aquestes variables amb les sortides de Terraform:

- `AZURE_CLIENT_ID`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Utilitza Environment variables, no secrets. Si el pla GitHub ho permet, configura també revisors per a futures operacions d’apply. L’entorn és part del subjecte OIDC: una acció sense `environment: dev` no coincideix amb la credencial federada. Qualsevol futur workflow que utilitzi aquest entorn podrà demanar la identitat, de manera que la restricció de branques i el control de canvis als workflows són necessaris.

La comprovació manual del workflow es limita també a `main`. La configuració de l’entorn al servidor GitHub no s’inclou automàticament en un git push.

## 3. Verificar la vinculació

A GitHub → Actions → **Verify Azure connection** → Run workflow, selecciona `main`.

Alternativament:

```bash
gh workflow run azure-connection.yml --repo IncFortartUp19/dev --ref main
gh run list --repo IncFortartUp19/dev --workflow azure-connection.yml
```

El workflow obté un token OIDC, inicia sessió a Azure, comprova l’ID de subscripció i consulta el grup dev. No executa Terraform apply ni crea recursos. Aquesta prova confirma login i lectura del grup; l’accés de dades al backend es comprovarà amb el primer pla Terraform autenticat.

Si retorna AADSTS70021, comprova emissor, audiència i subjecte exactes. Si retorna AuthorizationFailed, revisa l’abast dels rols i la seva propagació. Si falten variables, configura-les a l’entorn `dev`.

## Estat actual

Codi i workflow preparats. La vinculació només estarà activa després de crear la identitat a Azure, configurar l’entorn GitHub i obtenir una execució correcta del workflow. No s’ha configurat cap replica ni site recovery.
