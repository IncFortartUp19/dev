# Terraform apply dev

El workflow manual **Terraform apply dev** només s’executa des de `main`, amb l’entorn protegit `dev`, autenticació OIDC i la concurrència `terraform-dev` compartida amb el workflow de plan.

Genera un pla nou i mostra el seu resum. La comprovació prèvia només permet crear `azurerm_key_vault.dev` i `azurerm_log_analytics_workspace.dev`, els dos recursos revisats en el primer pla. També permet un pla sense canvis. Qualsevol actualització, destrucció, substitució o creació d’un altre recurs atura el job. Les ampliacions futures requeriran revisar aquesta comprovació juntament amb el nou abast.

Aplica exactament el pla desat dins del mateix job i verifica després que un nou pla no mostri canvis. No publica plans ni estats com a artifacts. Aquest workflow sí que crea recursos facturables.

No registra proveïdors de subscripció: si Azure indica `MissingSubscriptionRegistration`, un operador de la subscripció ha de registrar `Microsoft.KeyVault` i `Microsoft.OperationalInsights` abans de repetir l’execució. La identitat GitHub conserva els permisos limitats existents.
