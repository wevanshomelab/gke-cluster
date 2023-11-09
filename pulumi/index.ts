import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Get some provider-namespaced configuration values
const providerCfg = new pulumi.Config("gcp");
const gcpProject = providerCfg.require("project");
const gcpRegion = providerCfg.get("region") || "us-central1";
// Get some other configuration values or use defaults
const cfg = new pulumi.Config();
const nodesPerZone = cfg.getNumber("nodesPerZone") || 1;

// Create a new network
const gkeNetwork = new gcp.compute.Network("gke-network", {
    autoCreateSubnetworks: false,
    description: "A virtual network for your GKE cluster(s)",
});

// Create a new subnet in the network created above
const gkeSubnet = new gcp.compute.Subnetwork("gke-subnet", {
    ipCidrRange: "10.128.0.0/12",
    network: gkeNetwork.id,
    privateIpGoogleAccess: true,
});

const gkeRouter = new gcp.compute.Router("gke-router", {
    region: gkeSubnet.region,
    network: gkeNetwork.id,
    bgp: {
        asn: 64514,
    },
});

const gkeNat = new gcp.compute.RouterNat("gke-nat", {
    router: gkeRouter.name,
    region: gkeRouter.region,
    natIpAllocateOption: "AUTO_ONLY",
    sourceSubnetworkIpRangesToNat: "ALL_SUBNETWORKS_ALL_IP_RANGES",
    logConfig: {
        enable: true,
        filter: "ERRORS_ONLY",
    },
});

// Create the Required Firewall Rules
const linkerdFirewall = new gcp.compute.Firewall("gke-linkerd-firewall", {
    network: gkeNetwork.name,
    allows: [
        {
            protocol: "tcp",
            ports: [
                "8443",
                "8089",
                "9443",
            ],
        },
    ],
    description: "Allow traffic on ports 8443, 8089, 9443 for linkerd control-plane components",
    sourceRanges: ["10.100.0.0/28"],
});

const sealedSecretsFirewall = new gcp.compute.Firewall("gke-sealed-secrets-firewall", {
    network: gkeNetwork.name,
    allows: [
        {
            protocol: "tcp",
            ports: [
                "8080",
            ],
        },
    ],
    description: "Allow traffic on ports 8080 for cluster sealed secrets",
    sourceRanges: ["10.100.0.0/28"],
});


// Create a new GKE cluster
const gkeCluster = new gcp.container.Cluster("gke-cluster", {
    addonsConfig: {
        dnsCacheConfig: {
            enabled: true,
        },
    },
    binaryAuthorization: {
        evaluationMode: "PROJECT_SINGLETON_POLICY_ENFORCE",
    },
    datapathProvider: "ADVANCED_DATAPATH",
    description: "A GKE cluster",
    initialNodeCount: 1,
    ipAllocationPolicy: {
        clusterIpv4CidrBlock: "/14",
        servicesIpv4CidrBlock: "/20",
    },
    location: gcpRegion,
    masterAuthorizedNetworksConfig: {
        cidrBlocks: [{
            cidrBlock: "0.0.0.0/0",
            displayName: "All networks",
        }],
    },
    network: gkeNetwork.name,
    networkingMode: "VPC_NATIVE",
    privateClusterConfig: {
        enablePrivateNodes: true,
        enablePrivateEndpoint: false,
        masterIpv4CidrBlock: "10.100.0.0/28",
    },
    removeDefaultNodePool: true,
    releaseChannel: {
        channel: "STABLE",
    },
    subnetwork: gkeSubnet.name,
    workloadIdentityConfig: {
        workloadPool: `${gcpProject}.svc.id.goog`,
    },
});

// Create a service account for the node pool
const gkeNodepoolSa = new gcp.serviceaccount.Account("gke-nodepool-sa", {
    accountId: pulumi.interpolate `${gkeCluster.name}-np-1-sa`,
    displayName: "Nodepool 1 Service Account",
});

// Create a nodepool for the GKE cluster
const gkeNodepool = new gcp.container.NodePool("gke-nodepool", {
    cluster: gkeCluster.id,
    nodeCount: nodesPerZone,
    nodeConfig: {
        preemptible: true,
        machineType: "n1-standard-1",
        oauthScopes: ["https://www.googleapis.com/auth/cloud-platform"],
        serviceAccount: gkeNodepoolSa.email,
    },
});

// Build a Kubeconfig for accessing the cluster
const clusterKubeconfig = pulumi.interpolate `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${gkeCluster.masterAuth.clusterCaCertificate}
    server: https://${gkeCluster.endpoint}
  name: ${gkeCluster.name}
contexts:
- context:
    cluster: ${gkeCluster.name}
    user: ${gkeCluster.name}
  name: ${gkeCluster.name}
current-context: ${gkeCluster.name}
kind: Config
preferences: {}
users:
- name: ${gkeCluster.name}
  user:
    exec:
      apiVersion: client.authentication.k8s.io/v1beta1
      command: gke-gcloud-auth-plugin
      installHint: Install gke-gcloud-auth-plugin for use with kubectl by following
        https://cloud.google.com/blog/products/containers-kubernetes/kubectl-auth-changes-in-gke
      provideClusterInfo: true
`;

// Setup Vault KMS Resources
const VaultServiceAccount = new gcp.serviceaccount.Account("VaultServiceAccount", {
    accountId: "vault-gcpkms",
    displayName: "Vault KMS for auto-unseal",
});

const VaultKeyRing = new gcp.kms.KeyRing("vault-keyring", {location: "global"});
const VaultKey = new gcp.kms.CryptoKey("vault-key", {
    keyRing: VaultKeyRing.id,
    rotationPeriod: "100000s",
});

const VaultKeyRingIAMBinding = new gcp.kms.KeyRingIAMBinding("vault-keyring-binding", {
    keyRingId: VaultKeyRing.id,
    role: "roles/owner",
    members: [ pulumi.interpolate `serviceAccount:${VaultServiceAccount.email}`]
});

const VaultWorkLoadIdentityIAMBinding = new gcp.serviceaccount.IAMBinding("vault-workload-binding", {
    serviceAccountId: VaultServiceAccount.name,
    role: "roles/iam.workloadIdentityUser",
    members: [ pulumi.interpolate `serviceAccount:${gcpProject}.svc.id.goog[vault/vault]` ]
});

const VaultBucket = new gcp.storage.Bucket('vault-bucket', {
  location: gcpRegion
});

const VaultBucketBinding = new gcp.storage.BucketIAMBinding("vault-bucket-binding", {
  bucket: VaultBucket.name,
  role: "roles/storage.admin",
  members: [ pulumi.interpolate `serviceAccount:${VaultServiceAccount.email}`]
});

// Export some values for use elsewhere
export const networkName = gkeNetwork.name;
export const networkId = gkeNetwork.id;
export const clusterName = gkeCluster.name;
export const clusterId = gkeCluster.id;
export const kubeconfig = clusterKubeconfig;
export const vaultSa = VaultServiceAccount.email

