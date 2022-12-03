default: install

install:
	helm dep up ./charts/argocd
	helm upgrade --install -n argocd argocd ./charts/argocd --create-namespace
