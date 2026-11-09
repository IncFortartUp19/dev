# Xarxa privada de desenvolupament

La base dev inclou la definició d’una VNet `10.20.0.0/16`, amb la subxarxa `10.20.0.0/24` dedicada als endpoints privats. No s’hi ha configurat peering, VPN ni accés a xarxes corporatives. Abans de connectar-hi altres xarxes caldrà comprovar solapaments d’adreces.

L’endpoint del Key Vault utilitza el subrecurs `vault`. El seu grup DNS gestiona el registre dins de `privatelink.vaultcore.azure.net`, vinculada a la VNet sense auto-registre de màquines virtuals. L’accés públic al Key Vault continua desactivat i RBAC controla els permisos sobre secrets.

Aquesta fase no incorpora encara cap workload dins de la VNet ni cap rol de dades per als secrets. L’endpoint no dona accés automàtic a un usuari o a GitHub Actions: els consumidors necessitaran tant connectivitat i resolució DNS privada com permisos RBAC. Els runners públics de GitHub poden gestionar aquests recursos via Resource Manager, però no llegir secrets del vault privat.

El pla inicial hauria de crear cinc recursos: VNet, subxarxa, zona DNS privada, vincle DNS i endpoint privat. No es creen màquines virtuals, NAT Gateway ni VPN Gateway. Azure Private Link i Private DNS poden generar costos.

Abans de l’apply, un operador de la subscripció ha de confirmar que `Microsoft.Network` està registrat. La identitat GitHub no pot registrar proveïdors de subscripció.

L’usuari ha autoritzat el desplegament del pla de cinc creacions. La comprovació de l’apply permet aquestes cinc adreces de recursos i bloqueja qualsevol actualització, destrucció o altra creació.

La comprovació real de connectivitat i DNS es farà quan hi hagi una aplicació o executor dins de la xarxa. Un pla correcte no demostra encara accés als secrets.
