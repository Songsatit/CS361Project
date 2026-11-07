# V5 — Automation / Infrastructure as Code

## Goal and scope

V5 requires important infrastructure and deployment steps to be repeatable through
Automation / Infrastructure as Code (IaC), reducing manual configuration and drift.

The repository already contains `backend/template.yaml`, an AWS SAM / CloudFormation
template that declares the HTTP API, Lambda functions, RDS Proxy, proxy target group,
and environment configuration. V5 builds on that existing IaC rather than replacing
the working V1–V4 architecture.

This implementation adds:

- CI on pull requests and pushes: install, test, type-check, validate SAM, and build.
- An explicitly manual AWS deployment workflow (`workflow_dispatch`).
- AWS authentication through GitHub Actions OIDC (no long-lived AWS access key in Git).
- A repeatable deployment command that uses the existing SAM template.
- Documentation for the external AWS prerequisites and protected configuration.

**Important boundary:** The current SAM template consumes an existing VPC, private
subnets, security groups, IAM roles, and RDS instance. This V5 workflow automates
deployment of the SAM-managed stack; it does not claim to create those pre-existing
network/database/IAM resources. They must be managed by a separately approved IaC
stack or prepared once by an authorized AWS administrator. Do not run deployment
against a shared or production AWS account until the target and change set are reviewed.

## What is in the repository

| Path | Purpose |
| --- | --- |
| `.github/workflows/ci.yml` | Repeatable automated verification for code and SAM template |
| `.github/workflows/deploy-aws.yml` | Manual, authenticated SAM deployment |
| `backend/template.yaml` | Existing SAM / CloudFormation Infrastructure as Code |
| `docs/v5-automation.md` | Architecture, configuration, runbook, and V5 evidence |

## CI flow

```text
Pull Request / Push
        |
        v
Checkout source
        |
        v
npm ci
        |
        +--> npm test
        +--> npm run typecheck
        |
        v
sam validate --lint
        |
        v
sam build
        |
        v
CI result (pass / fail)
```

## AWS deployment flow

```text
Authorized maintainer starts workflow_dispatch
        |
        v
Install dependencies + tests + typecheck
        |
        v
SAM validate + build
        |
        v
GitHub OIDC assumes AWS deployment role
        |
        v
sam deploy (existing SAM/CloudFormation stack)
        |
        v
CloudFormation change set applies resources
        |
        v
Review stack outputs / smoke-test API
```

The workflow does not automatically deploy on every push. This is an intentional
trade-off: CI is frequent and low-risk; AWS deployment is gated by a human decision
and environment-level permissions.

## GitHub Environment configuration

Create a GitHub Environment named `aws-deploy`. Restrict who can deploy to it and,
where appropriate, add required reviewers. Configure the following **Variables**
(non-secret settings):

| Variable | Meaning |
| --- | --- |
| `AWS_REGION` | Region containing the deployed stack |
| `SAM_STACK_NAME` | CloudFormation stack name |
| `DB_HOST` | Existing RDS instance endpoint hostname |
| `DB_INSTANCE_IDENTIFIER` | Existing RDS instance identifier |
| `DB_NAME` | Database/schema name |
| `DB_USER` | Database user name |
| `DB_PORT` | Usually `3306` |
| `VPC_SUBNET_IDS` | Comma-separated private subnet IDs, preferably in different AZs |
| `LAMBDA_SECURITY_GROUP_ID` | Security group assigned to Lambda |
| `RDS_PROXY_SECURITY_GROUP_ID` | Security group assigned to RDS Proxy |
| `LAMBDA_EXECUTION_ROLE_ARN` | Existing Lambda execution role ARN |
| `RDS_PROXY_ROLE_ARN` | Existing RDS Proxy role ARN |
| `TU_AUTH_URL` | TU authentication endpoint |
| `FRONTEND_ORIGIN` | Exact deployed frontend origin |

Configure these **Secrets**:

| Secret | Meaning |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | AWS IAM role trusted for this GitHub repository/environment via OIDC |
| `DB_PASSWORD` | Database password |
| `TU_APPLICATION_KEY` | TU API application key |
| `JWT_SECRET` | Secret used by the API to sign access tokens |

Never put passwords, application keys, or JWT signing material in workflow YAML, repository
variables, committed `.env` files, or logs. `EnableDemoLogin` is explicitly set to `false`
in the deployment workflow. Do not pass demo password hashes unless an approved demo
deployment specifically requires them.

### AWS OIDC role

Create an IAM role with a trust relationship for GitHub's OIDC provider
(`token.actions.githubusercontent.com`). Limit the trust policy to this repository and
the `aws-deploy` environment (or the approved deployment branch/environment subject).
Grant only the permissions needed to deploy this CloudFormation/SAM stack and access
the required deployment artifacts. The exact permissions depend on the resources in the
SAM template and the account's pre-existing roles/network.

Do not use an administrator-wide policy as a permanent deployment permission.
If your AWS Academy lab does not permit configuring OIDC or the required IAM role,
the GitHub deployment workflow cannot be used as written; deploy from an authorized
CloudShell/terminal session using SAM and document that constraint instead.

## Local repeatable verification

From the repository root:

```bash
cd backend
npm ci
npm test
npm run typecheck
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml
```

These commands validate/build locally and do not deploy or alter the AWS account.

## Authorized deployment runbook

1. Confirm the AWS account, region, stack name, environment, and who approved the deployment.
2. Confirm the VPC, private subnet IDs, Lambda/RDS Proxy security groups, IAM roles, and RDS target.
3. Confirm the database migration state and backup/restore plan. This workflow does not run database migrations.
4. Review the SAM template and the CloudFormation change set.
5. Configure the GitHub `aws-deploy` environment variables and secrets.
6. Open **Actions → V5 - Manual AWS Deployment → Run workflow** and choose the intended branch.
7. Review the workflow result and CloudFormation stack events.
8. Record `ApiUrl` and `RdsProxyEndpoint` outputs; run an approved API smoke test.
9. If deployment fails, inspect CloudFormation events and Lambda/CloudWatch logs. Do not rerun blindly if a resource is in a failed or rollback state.

## V5 evidence to capture for the submission

Capture evidence from the actual run (do not use fabricated screenshots):

- A successful GitHub Actions CI run showing tests, typecheck, SAM validation, and build.
- The SAM template in the repository and its CloudFormation-managed resources.
- A successful manual deployment run, if the group has permission to deploy to AWS.
- The CloudFormation stack and outputs, with sensitive values hidden.
- A brief before/after comparison: previously repeated console steps versus the CI/SAM workflow.
- A trade-off statement: existing VPC/RDS/IAM are prerequisites; manual approval avoids accidental deployment;
  OIDC is safer than static credentials but requires IAM setup permissions.

## Requirement mapping

| V5 requirement | Implementation / evidence |
| --- | --- |
| Important infrastructure defined as code | Existing `backend/template.yaml` (SAM/CloudFormation) |
| Repeatable build and checks | `.github/workflows/ci.yml` |
| Repeatable deployment | `.github/workflows/deploy-aws.yml` and manual workflow trigger |
| Reduced manual configuration | Values passed from a single GitHub Environment configuration |
| Reduced secret exposure | GitHub Secrets + OIDC; no committed AWS credentials |
| Acknowledged limits / trade-off | Existing VPC/RDS/IAM are external prerequisites; deploy is approval-gated |
