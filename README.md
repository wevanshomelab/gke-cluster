# Description
This is a project for getting a homelab K8s cluster set up in Google Cloud Services. 

# Dependencies
- git
- kubectl
- argocd-cli
- linkerd-cli
- step-cli
- kubeseal
- go-yq (yq v4)
- pulumi
- gcloud-cli

# Installation
You will need a fork of this repo for your own homelab.

## Create the GCP GKE Cluster and other resources
From the infra dir
```
gcloud login
pulumi up
```

## Set up your kubectl 
Pulumi will write a kube.config file for you to use or merge into your existing file at kubeconfig.

## Argocd
Once you have the k8s cluster up and running, and have kubectl / helm pointed to it:

run `make install` from the root dir

This will run an initial helm install of argocd and set it up to self manage and automatically sync, and will also go ahead and install critical cluster services.

To access argocd once installed, get the admin user password from the k8s secret `make argocd-password`

Then visit https://argocd.<cluster-base-domain>

You should also login to the cli by running

```
argocd login argocd.<cluster-base-domain>
```

## Linkerd
The linkerd service is split into four applications; linkerd-crds, linkerd-bootstrap, linkerd, and linkerd viz.

The CRDs are automatically installed, however we will need to use the clusters sealed secrets service to manage a new trust anchor root CA for linkerd.

Generate your new root CA and seal with kubeseal.
```
make generate-trust-anchor
```

Validate that the trust anchor sealed secret and public cert are updated and then commit in your new sealed trust anchor.

Finally, we will need to sync all of the linkerd applications in order.
```
# Set the sealed secret with our trush anchor and use it to create our issuer certificate
argocd app sync linkerd-bootstrap

# Make sure to wait for certificate from bootstrap to be finsihed being issued by cert-manager
argocd app sync linkerd

# Finally, enable the linkerd-viz plugin if you want it running
argocd app sync linkerd-viz

# Validate your deployment
linkerd check
linkerd viz dashboard
```

# Cluster services
## Ingress
For cluster ingress, this homelab utilized the ingress-nginx controller. The default cluster ingress className is `nginx`.

## Cert-Manager
cert-manager is installed to handle automatic issue and rotation of certificates. You will need to annotate your ingress to let it know which issuer to use.

The default is to use the letsencrypt issuer.
```
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
```

## Prometheus
This homelab utilizes kube-prom-stack for observability. This stack is not automatically created, so it will need to be synced from the argocd ui or cli.
```
argocd app sync prometheus
```

To access the grafana dashboard, get the admin user secret
```
make grafana-password
```

Then visit http://grafana.<cluster-base-domain>

## Sealed-Secrets
sealed-secrets is installed to handle asymetric encryption of secrets that need to be committed into source control. This is a Development use case, and it is not recommended to utilize this method in a production environment.

## Vault
vault is installed to handle storage of secrets that may not need to be committed into source control. 

