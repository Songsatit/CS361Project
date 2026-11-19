#!/usr/bin/env bash
# CS361 deploy helper for AWS Academy Learner Lab. Run it in AWS CloudShell (us-east-1)
# from the repository root:   bash scripts/deploy-learnerlab.sh <command>
#
#   infra [mode]    create/update VPC + RDS. mode = none | instance (default) | gateway  (outbound internet for Lambda)
#   nat <mode>      change the outbound mode without touching the database
#   backend         test, build and deploy the API (SAM)
#   dbinit          create DB, import the SQL dump, apply migrations 015-018, create the app user
#   outputs         print the values you need for Amplify and the report
#   teardown        delete the app stack, then the infra stack (RDS keeps a final snapshot)
#
# Secrets are typed at a hidden prompt or read from environment variables. They are never written to git.
set -euo pipefail

REGION=us-east-1
INFRA_STACK=${INFRA_STACK:-cs361-infra}
APP_STACK=${APP_STACK:-cs361-app}

out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$1" \
  --query "Stacks[0].Outputs[?OutputKey=='$2'].OutputValue" --output text; }

secret() { # secret VAR_NAME "prompt"  -> uses $VAR_NAME if already exported
  local name=$1 prompt=$2 value
  value=${!name:-}
  if [ -z "$value" ]; then read -r -s -p "$prompt: " value; echo >&2; fi
  printf '%s' "$value"
}

need_region() {
  export AWS_REGION=$REGION AWS_DEFAULT_REGION=$REGION
  aws sts get-caller-identity --query Arn --output text
}

check_mode() {
  case "${1:-}" in none|instance|gateway) ;; *) echo "mode must be none, instance or gateway" >&2; exit 1;; esac
}

cmd_infra() {
  need_region >/dev/null
  local mode=${1:-${NAT_MODE:-instance}}
  check_mode "$mode"
  local pw; pw=$(secret DB_MASTER_PASSWORD "RDS master password (12+ chars, letters and digits only)")
  aws cloudformation deploy --region "$REGION" --stack-name "$INFRA_STACK" \
    --template-file infra/network-db.yaml \
    --parameter-overrides "DbMasterPassword=$pw" "NatMode=$mode" \
    --tags Project=cs361 --no-fail-on-empty-changeset
  cmd_outputs
}

cmd_nat() {
  need_region >/dev/null
  local mode=${1:-}
  check_mode "$mode"
  aws cloudformation update-stack --region "$REGION" --stack-name "$INFRA_STACK" --use-previous-template \
    --parameters ParameterKey=DbMasterPassword,UsePreviousValue=true \
                 ParameterKey=DbMasterUsername,UsePreviousValue=true \
                 ParameterKey=DbInstanceClass,UsePreviousValue=true \
                 ParameterKey=DbEngineVersion,UsePreviousValue=true \
                 ParameterKey=DbAllocatedStorageGb,UsePreviousValue=true \
                 ParameterKey=NatInstanceType,UsePreviousValue=true \
                 ParameterKey=NatInstanceAmiParameter,UsePreviousValue=true \
                 "ParameterKey=NatMode,ParameterValue=$mode"
  aws cloudformation wait stack-update-complete --region "$REGION" --stack-name "$INFRA_STACK"
  echo "NatMode is now: $mode"
}

cmd_backend() {
  need_region >/dev/null
  : "${FRONTEND_ORIGIN:?export FRONTEND_ORIGIN=https://main.<appid>.amplifyapp.com first (no trailing slash)}"
  local labrole app_pw tu_key jwt
  labrole=$(aws iam get-role --role-name LabRole --query Role.Arn --output text)
  app_pw=$(secret DB_APP_PASSWORD "App DB password (12+ chars, letters and digits only)")
  tu_key=$(secret TU_APPLICATION_KEY "TU Application-Key")
  jwt=${JWT_SECRET:-}
  if [ -z "$jwt" ]; then
    # keep one JWT secret across deploys, otherwise every deploy logs everybody out
    [ -f "$HOME/.cs361-jwt" ] || { umask 077; openssl rand -hex 32 > "$HOME/.cs361-jwt"; }
    jwt=$(cat "$HOME/.cs361-jwt")
  fi

  ( cd backend && npm ci && { [ "${SKIP_TESTS:-}" = 1 ] || npm test; } && npm run typecheck \
    && sam validate --lint --template-file template.yaml \
    && sam build --template-file template.yaml )

  local params=(
    "DbHost=$(out "$INFRA_STACK" DbHost)"
    "DbName=curriculum" "DbUser=cs361_app" "DbPassword=$app_pw"
    "VpcSubnetIds=$(out "$INFRA_STACK" PrivateSubnetIds)"
    "LambdaSecurityGroupId=$(out "$INFRA_STACK" LambdaSecurityGroupId)"
    "LambdaExecutionRoleArn=$labrole"
    "TuApplicationKey=$tu_key" "JwtSecret=$jwt"
    "FrontendOrigin=$FRONTEND_ORIGIN"
    "UseProxy=${USE_PROXY:-false}"
  )
  if [ "${USE_PROXY:-false}" = true ]; then
    params+=( "DbInstanceIdentifier=$(out "$INFRA_STACK" DbInstanceIdentifier)"
              "RdsProxySecurityGroupId=$(out "$INFRA_STACK" RdsProxySecurityGroupId)"
              "RdsProxyRoleArn=$labrole" )
  fi
  # extra tuning knobs for V6, e.g. EXTRA_PARAMS="FunctionMemoryMb=512 ApiThrottleRate=200"
  # shellcheck disable=SC2206
  [ -n "${EXTRA_PARAMS:-}" ] && params+=( $EXTRA_PARAMS )

  ( cd backend && sam deploy --template-file .aws-sam/build/template.yaml \
      --stack-name "$APP_STACK" --region "$REGION" --resolve-s3 \
      --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
      --no-confirm-changeset --no-fail-on-empty-changeset \
      --tags Project=cs361 --parameter-overrides "${params[@]}" )
  cmd_outputs
}

cmd_dbinit() {
  need_region >/dev/null
  local m_pw a_pw payload
  m_pw=$(secret DB_MASTER_PASSWORD "RDS master password")
  a_pw=$(secret DB_APP_PASSWORD "App DB password (same as in backend step)")
  # GRANT_ROLES="b65xxxxxxx:staff,someone:curriculum_admin" (optional) gives TU accounts a role in role_allowlist
  payload=$(M="$m_pw" A="$a_pw" G="${GRANT_ROLES:-}" python3 -c '
import json, os
grants = [dict(zip(("username", "role"), item.split(":", 1))) for item in os.environ["G"].split(",") if item]
print(json.dumps({"masterUser": "admin", "masterPassword": os.environ["M"], "appUser": "cs361_app",
                  "appPassword": os.environ["A"], "grantRoles": grants}))')
  # the import can take longer than the CLI default 60 s read timeout, which would make the CLI retry and run it twice
  aws lambda invoke --region "$REGION" --function-name "${APP_STACK}-dbinit" \
    --cli-read-timeout 0 --cli-connect-timeout 60 \
    --cli-binary-format raw-in-base64-out --payload "$payload" /tmp/dbinit-out.json >/dev/null
  cat /tmp/dbinit-out.json; echo
  rm -f /tmp/dbinit-out.json
}

cmd_outputs() {
  echo "--- infra"; aws cloudformation describe-stacks --region "$REGION" --stack-name "$INFRA_STACK" \
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output text 2>/dev/null || true
  echo "--- app"; aws cloudformation describe-stacks --region "$REGION" --stack-name "$APP_STACK" \
    --query "Stacks[0].Outputs[].[OutputKey,OutputValue]" --output text 2>/dev/null || true
}

cmd_teardown() {
  need_region >/dev/null
  read -r -p "Delete $APP_STACK and $INFRA_STACK in $REGION? Type yes: " ok; [ "$ok" = yes ] || exit 1
  aws cloudformation delete-stack --region "$REGION" --stack-name "$APP_STACK"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$APP_STACK"
  aws cloudformation delete-stack --region "$REGION" --stack-name "$INFRA_STACK"
  aws cloudformation wait stack-delete-complete --region "$REGION" --stack-name "$INFRA_STACK"
  echo "Done. RDS left a final snapshot, see RDS > Snapshots."
}

case "${1:-}" in
  infra) shift; cmd_infra "$@";;
  nat) shift; cmd_nat "$@";;
  backend) cmd_backend;;
  dbinit) cmd_dbinit;;
  outputs) cmd_outputs;;
  teardown) cmd_teardown;;
  *) sed -n '2,13p' "$0"; exit 1;;
esac
