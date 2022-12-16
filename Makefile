default: install

install:
	helm dep up ./charts/argocd
	helm upgrade --install -n argocd argocd ./charts/argocd --create-namespace

password:
	kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
