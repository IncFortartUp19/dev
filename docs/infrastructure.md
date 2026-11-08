# Azure i Terraform

## Què es crea

`infra/terraform/bootstrap` crea un grup de recursos, un Storage Account Standard LRS i els contenidors privats `tfstate` (bootstrap i identitat) i `tfstate-dev` (desenvolupament). L’estat utilitza autenticació Entra ID, sense claus compartides; té versionat, retenció de 30 dies i protecció Terraform contra destrucció de l’emmagatzematge i el contenidor. El backend Azure proporciona bloqueig de l’estat mitjançant leases.

`infra/terraform/environments/dev` crea un grup de recursos, Log Analytics amb retenció de 30 dies i límit diari d’ingesta d’1 GB, i Key Vault amb RBAC, protecció de purga i accés públic desactivat. La quota de logs no és un límit global de despesa d’Azure. Encara no hi ha fonts de logs connectades.

La regió acordada és `westeurope`. La rèplica i la recuperació de desastres es decidiran més endavant. Aquests recursos poden generar costos. La base no crea aplicacions, bases de dades, usuaris ni credencials i manté `developer` sense canvis.

## Requisits

- Terraform 1.13.5 i Azure CLI per al desplegament local.
- Subscripció i tenant Azure correctes.
- Permisos per crear els recursos: habitualment Contributor a l’abast de treball.
- Storage Blob Data Contributor per a l’operador, heretat a la subscripció o al grup de bootstrap, abans de crear el contenidor. Contributor per si sol no dona accés a les dades dels blobs. Un administrador pot assignar aquest rol a l’object ID existent; no cal crear ni substituir l’usuari `developer`.
- Proveïdors `Microsoft.Storage`, `Microsoft.OperationalInsights` i `Microsoft.KeyVault` registrats a la subscripció. La configuració desactiva el registre automàtic de proveïdors.

La identitat i els permisos s’han de configurar a Azure; aquestes comprovacions no acrediten accés a una subscripció real.

## Validació sense accés a Azure

Des de cadascun dels dos directoris Terraform:

```bash
terraform fmt -check -recursive
terraform init -backend=false -input=false -lockfile=readonly
terraform validate
```

A `infra/terraform/environments/dev`, executa també `terraform test`. Les proves utilitzen un proveïdor simulat: comproven les propietats de seguretat i la validació d’entrades sense crear recursos. No substitueixen un pla contra Azure.

GitHub Actions executa aquestes comprovacions i no necessita secrets Azure. No hi ha `apply` automàtic. La [identitat OIDC](github-azure.md) es configura separadament.

## 1. Inicialitzar l’estat remot

Des de l’arrel del repositori, autentica’t i selecciona explícitament la subscripció:

```bash
az login
az account set --subscription <subscription-id>
```

A `infra/terraform/bootstrap`:

```bash
cp terraform.tfvars.example terraform.tfvars
```

Edita `terraform.tfvars`: introdueix la subscripció i un nom de Storage Account únic globalment, de 3–24 caràcters en minúscules i dígits. Després:

```bash
terraform init
terraform plan -out=bootstrap.tfplan
terraform apply bootstrap.tfplan
terraform output backend_config
```

El bootstrap comença amb estat local. Conserva’l protegit fins a migrar-lo: no l’esborris ni el pugis a Git. Si Azure acaba d’assignar permisos RBAC, pot caldre esperar que es propaguin abans de repetir l’operació.

## 2. Migrar també l’estat del bootstrap

Copia els valors de `backend_config` a un fitxer local `backend.hcl` dins de `bootstrap`, però utilitza `container_name = "tfstate"` i `key = "bootstrap/terraform.tfstate"`. Afegeix un fitxer `backend.tf` amb aquest contingut:

```hcl
terraform {
  backend "azurerm" {}
}
```

Executa:

```bash
terraform init -migrate-state -backend-config=backend.hcl
terraform plan
```

Confirma la migració quan Terraform ho demani, comprova que el pla no proposa canvis i versiona `backend.tf`. `backend.hcl` i els estats locals queden fora de Git. No eliminis el Storage Account que conté el seu propi estat.

## 3. Preparar desenvolupament

A `infra/terraform/environments/dev`:

```bash
cp backend.hcl.example backend.hcl
cp terraform.tfvars.example terraform.tfvars
```

Edita els fitxers amb els valors reals del bootstrap, la subscripció i un nom de Key Vault únic globalment. Utilitza el contenidor `tfstate-dev` i la clau d’estat `dev/terraform.tfstate`, separats del bootstrap. Si el bootstrap ja s’havia desplegat abans d’afegir aquest contenidor, aplica primer l’actualització del bootstrap. Si dev ja tenia estat al contenidor antic, migra’l amb `terraform init -migrate-state -backend-config=backend.hcl`; no inicialitzis un estat buit sobre recursos existents.

```bash
terraform init -backend-config=backend.hcl
terraform plan -out=dev.tfplan
terraform apply dev.tfplan
```

Revisa el pla abans d’executar apply. El Key Vault té accés públic desactivat; la següent fase afegirà connectivitat privada i rols de dades per a les identitats que realment en necessitin accés.

## Passos següents

1. Confirmar subscripció, tenant, regió i pressupost.
2. Validar el pla amb la identitat Azure existent.
3. Decidir hosting de Next.js/FastAPI i PostgreSQL, amb xarxa i accés privat.
4. Configurar federació OIDC de GitHub a Azure amb permisos limitats i entorn protegit, abans d’automatitzar desplegaments.

No es guarden contrasenyes ni secrets en `.tfvars`, workflows o arguments de backend. Els plans i els estats poden contenir dades sensibles, encara que les sortides estiguin marcades com a sensibles.
