# Description
This is a homelab setup for getting a local k8s environment up and running, utilizing argocd and the ingress-nginx controller

# Installation
Assuming that you have a local k8s cluster up and running, and have kubectl / helm pointed to it

run `make install` from the root dir

This will run an initial helm install of argocd and set it up to self manage and automatically sync.
This will also go ahead and install critical cluster services.

To access argo cd once installed, get the admin user password from the k8s secret
```
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath="{.data.password}" | base64 -d; echo
```

Then visit https://argocd.localhost 

Some application that are not configured to auto sync will need to be installed from the UI or argocd cli

# Cluster services
## Ingress
For cluster ingress, this homelab utilized the ingress-nginx controller. For most local k8s installations, this should bind to your localhost port 80 without any additional configuration or resolvers needed.
Services should expose ingress hosts of the form <sub>.localhost 

## Prometheus
This homelab utilizes kube-prom-stack for observability. This stack is not automatically created, so it will need to be synced from the argocd ui or cli.

To access the grafana dashboard, get the admin user secret
```
kubectl -n monitoring get secret prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 -d; echo
```

Then visit http://grafana.localhost


# Applications
## Example nginx service
This homelab create an example nginx service as a hello world application for testing

 
