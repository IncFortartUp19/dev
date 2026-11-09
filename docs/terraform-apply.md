# Terraform apply dev

El workflow manual **Terraform apply dev** només s’executa des de `main`, amb l’entorn protegit `dev`, autenticació OIDC i la concurrència `terraform-dev` compartida amb el workflow de plan.

Genera un pla nou i mostra el seu resum. La comprovació prèvia permet les cinc creacions de xarxa privada revisades: VNet, subxarxa, zona DNS privada, vincle DNS i endpoint privat del Key Vault. Els recursos de la fase anterior han de continuar sense canvis. També permet un pla sense canvis. Qualsevol actualització, destrucció, substitució o creació d’un altre recurs atura el job. Les ampliacions futures requeriran revisar aquesta comprovació juntament amb el nou abast.

Aplica exactament el pla desat dins del mateix job i verifica després que un nou pla no mostri canvis. No publica plans ni estats com a artifacts. Aquest workflow sí que crea recursos facturables.

No registra proveïdors de subscripció: si Azure indica `MissingSubscriptionRegistration`, un operador de la subscripció ha de registrar `Microsoft.Network` (xarxa), `Microsoft.KeyVault` i `Microsoft.OperationalInsights` abans de repetir l’execució. La identitat GitHub conserva els permisos limitats existents.
