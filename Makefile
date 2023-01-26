default: install

install:
	helm dep up ./charts/argocd
	helm upgrade --install -n argocd argocd ./charts/argocd --create-namespace
	helm dep up ./charts/argocd-apps
	helm upgrade --install -n argocd argocd-apps ./charts/argocd-apps --create-namespace

argo-password:
	@kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo

grafana-password:
	@kubectl -n monitoring get secret prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d; echo

generate-trust-anchor:
	@test -f "trust.key" && echo "using exsisting key" || \
	  step-cli certificate create root.linkerd.cluster.local trust.crt trust.key \
	  --profile root-ca \
	  --no-password \
	  --not-after 43800h \
	  --insecure
	@kubectl -n linkerd create secret tls linkerd-trust-anchor \
	  --cert trust.crt \
	  --key trust.key \
	  --dry-run=client -oyaml | \
	kubeseal --controller-name=sealed-secrets -oyaml - | \
	kubectl patch -f - \
	  -p '{"spec": {"template": {"type":"kubernetes.io/tls", "metadata": {"labels": {"linkerd.io/control-plane-component":"identity", "linkerd.io/control-plane-ns":"linkerd"}, "annotations": {"linkerd.io/created-by":"linkerd/cli stable-2.12.0"}}}}}' \
	  --dry-run=client \
	  --type=merge \
	  --local -oyaml > charts/linkerd-bootstrap/templates/trust-anchor.yaml
	@yq eval -i '.linkerd-control-plane.identityTrustAnchorsPEM = "'"$$(< trust.crt)"'"' charts/linkerd/values.yaml

set-drone-creds:
	@read -p 'Github Client ID: ' githubid && \
	read -sp 'Github Client Secret: ' githubsecret && \
	read -sp 'Drone RPC Secret: ' rpcsecrete && \
	kubectl -n drone create secret generic drone-creds \
          --from-literal=DRONE_RPC_SECRET=$${rpcsecrete} \
          --from-literal=DRONE_GITHUB_CLIENT_ID=$${githubid} \
          --from-literal=DRONE_GITHUB_CLIENT_SECRET=$${githubsecret} \
	  --dry-run=client -oyaml | \
	kubeseal --controller-name=sealed-secrets -oyaml - > charts/drone/templates/credentials.yaml

