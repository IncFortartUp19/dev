# Terraform plan des de GitHub

El workflow **Terraform plan dev** s’executa manualment des de `main` amb l’entorn GitHub `dev` i la identitat OIDC existent. No executa `apply` ni registra proveïdors Azure.

## Executar

GitHub → Actions → Terraform plan dev → Run workflow → branca `main`.

El workflow comprova les tres variables Azure de l’entorn, inicia sessió amb OIDC, inicialitza el backend `tfstate-dev/dev/terraform.tfstate`, valida Terraform i calcula el pla complet de desenvolupament a `francecentral`.

El Key Vault previst és `kv-incfs-e299e7e6628f`, el mateix del fitxer local utilitzat a Cloud Shell. Els noms del backend són els ja desplegats. El workflow no necessita afegir variables GitHub ni secrets nous.

## Resultat

- El codi de sortida Terraform `0` (sense canvis) i `2` (amb canvis) es consideren correctes.
- Qualsevol error de Terraform fa fallar el job.
- Summary mostra recomptes, adreces i accions dels recursos, sense valors de recursos ni sortides.
- Els logs del pas Plan mostren el pla de text habitual de Terraform, amb els valors sensibles marcats per Terraform ocults.
- No es publiquen plans binaris ni JSON com a artifacts. El pla temporal s’elimina al final i no es pot reutilitzar en un futur apply; caldrà generar un pla nou.
- La concurrència `terraform-dev` serialitza aquestes execucions i el bloqueig del backend protegeix també davant de sessions externes. Un futur workflow d’apply haurà de compartir el mateix grup de concurrència.

El grup dev ja existeix, però Key Vault i Log Analytics encara estan pendents de desplegament: s’espera que el primer pla els proposi. Cal revisar qualsevol destrucció o substitució abans de preparar un desplegament.

Aquest workflow només accepta `main`; les pull requests mantenen les comprovacions sense credencials del workflow Terraform existent. L’entorn GitHub dev ha de continuar limitat a main.
