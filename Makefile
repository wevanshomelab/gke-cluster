default: install

install:
	helm dep up ./charts/argocd
	helm upgrade --install -n argocd argocd ./charts/argocd --create-namespace

argo-password:
	kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo

generate-trust-anchor:
	step-cli certificate create root.linkerd.cluster.local trust.crt trust.key \
          --profile root-ca \
          --no-password \
          --not-after 43800h \
          --insecure
	
	kubectl -n linkerd create secret tls linkerd-trust-anchor \
	  --cert trust.crt \
          --key trust.key \
	  --dry-run=client -oyaml | \
        kubeseal --controller-name=sealed-secrets -oyaml - | \
        kubectl patch -f - \
          -p '{"spec": {"template": {"type":"kubernetes.io/tls", "metadata": {"labels": {"linkerd.io/control-plane-component":"identity", "linkerd.io/control-plane-ns":"linkerd"}, "annotations": {"linkerd.io/created-by":"linkerd/cli stable-2.12.0"}}}}}' \
          --dry-run=client \
          --type=merge \
          --local -oyaml > charts/linkerd-bootstrap/templates/trust-anchor.yaml
