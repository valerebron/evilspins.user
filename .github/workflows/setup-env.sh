#!/bin/bash

set -a && source .env && set +a

changeEnvVar() {
  local var_name="$1"
  local new_value="$2"
  local env_file=".env"
  
  if grep -q "^${var_name}=" "$env_file"; then
    sed -i "s|${var_name}=.*|${var_name}=${new_value}|" "$env_file"
  else
    echo "${var_name}=${new_value}" >> "$env_file"
  fi
}

# Variables GitHub
APP_NAME="${GITHUB_REPOSITORY##*/}"
APP_DIR="/var/docker-web/apps/$APP_NAME"

changeEnvVar "DOMAIN" $DOMAIN
changeEnvVar "APP_NAME" $APP_NAME
changeEnvVar "PORT" $PORT
changeEnvVar "APP_DIR" $APP_DIR
