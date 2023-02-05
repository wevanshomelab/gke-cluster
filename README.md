# Description
This is a project for getting a small personal K8s cluster set up in Google Cloud Services. It is intended to host a few personal projects and act as a sandbox environment for trying out new tools.

# On Boarding 
### Access to cluster services
Get added to the github org `WevansHomeLab` for OAuth access to cluster services

### Create a new project
Create a pull request to add a new project for your self under [user-projects](https://github.com/wevanshomelab/gke-cluster/blob/main/manifests/user-projects/values.yaml) 

Example:
```
projects:
  - name: wevans
    source:
      path: manifests/wevans
      repoURL: https://github.com/wevanshomelab/gke-cluster.git
      targetRevision: HEAD
```
This will create a new ArgoCd project, a K8s namespace for your project, and an ArgoCD application utilizing the source that you specify. It is recommended to utilize a separate gitops repo as your source.

### View the results of applying your projects state
Once your PR is merged, your project will auto sync and the resources specified will be created. ArgoCD will continuously deploy changes that you make to your gitops repo.
You can see the result of your projects apply by visting http://argocd.gke.wevans.io and searching for applications under your project name.

### Shipping updates
It is recommended that you set up a CI pipeline to build your projects artifacts, and to update your gitops repo. You can utilize a third party CI service such as: circleCI, semaphoreCI, github actions, etc.. 
You may also utilize the installation of drone running on this cluster. You can visit https://drone.gke.wevans.io to setup drone OAuth to github and setup your project.

### Advanced project support / configuration
Contact admin@wevans.io for support of the following advanced features. Better support and documentation is coming in the future.
- Working with private git repos, docker image repos, or other artifact stores.
- Secrets management
- Database operators 

# Cluster Installation and Administration
You will need a fork of this repo for your own homelab. You will be modifying configuration such as cluster base domain, and generating your own sealed secrets.

## Dependencies
- git
- kubectl
- argocd-cli
- linkerd-cli
- step-cli
- kubeseal
- go-yq (yq v4)
- pulumi
- gcloud-cli

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

Then visit https://argocd.gke.wevans.io

You should also login to the cli by running

```
argocd login argocd.gke.wevans.io
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

Then visit http://grafana.gke.wevans.io

## Sealed-Secrets
sealed-secrets is installed to handle asymetric encryption of secrets that need to be committed into source control. This is a Development use case, and it is not recommended to utilize this method in a production environment.

## Vault
vault is installed to handle storage of secrets that may not need to be committed into source control. 

