# Coneixement privat aprovat

L’API reutilitza la identitat OIDC, el context privat i les membresies dels vaults.
El propietari incorpora una síntesi amb POST /v1/vaults/{vault}/knowledge,
amb title, body i source_reference. La font queda en draft i el servidor calcula
el SHA-256 del text. La ruta /{source}/state accepta approved o withdrawn,
registra el revisor autenticat i afegeix un esdeveniment d’auditoria.

POST /answer accepta question i retorna fins a cinc fragments literals aprovats
que contenen la frase cercada. El filtratge pel projecte i per aprovació precedeix
el límit. La resposta inclou una cita interna i el hash. GET /{source} comprova
de nou la membresia i l’aprovació. La referència externa queda fora de la resposta,
perquè els permisos de GitHub poden diferir dels del projecte.

La ingesta és exclusiva del propietari. El contingut és immutable; una correcció
requereix retirar l’entrada i aprovar-ne una altra. Les polítiques PostgreSQL
forcen RLS; el compte d’execució necessita SELECT, INSERT i UPDATE a knowledge_sources.
La migració 0005 s’aplica amb la identitat de migracions.

La implementació és extractiva i utilitza cerca literal. La integració amb un model,
la cerca semàntica i la interfície de conversa resten pendents. Les proves locals
utilitzen comptes i evidència sintètics. Els aprenentatges reals de BF continuen
al seu repositori privat fins a disposar del vault DEV i identitat configurats.

Validació local: 71 proves superades, quatre proves específiques de PostgreSQL
omeses per manca de base efímera PostgreSQL en aquesta sessió.
