default: install

install:
	helm dep up ./charts/argocd
	helm upgrade --install -n argocd argocd ./charts/argocd --create-namespace

argo-password:
	kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo

trust-anchor:
	step-cli certificate create root.linkerd.cluster.local trust.crt trust.key \
          --profile root-ca \
          --no-password \
          --not-after 43800h \
          --insecure
	kubectl -n linkerd create secret tls linkerd-trust-anchor \
	  --cert trust.crt \
          --key trust.key 
