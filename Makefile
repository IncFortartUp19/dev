.PHONY: check

check:
	python3 scripts/check_repo.py

.PHONY: terraform-check

terraform-check:
	terraform fmt -check -recursive infra/terraform
	terraform -chdir=infra/terraform/bootstrap init -backend=false -input=false -lockfile=readonly
	terraform -chdir=infra/terraform/bootstrap validate
	terraform -chdir=infra/terraform/environments/dev init -backend=false -input=false -lockfile=readonly
	terraform -chdir=infra/terraform/environments/dev validate
	terraform -chdir=infra/terraform/environments/dev test
