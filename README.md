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

# Adding cluster services
Cluster services should be added to the cluster manifests templates. You most likely want to enable the automatic syncing policy for critical services.

# Adding application
To install local applications, you can add an application to the apps manifest templates.
