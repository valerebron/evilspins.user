# Variables GitHub
APP_NAME="${GITHUB_REPOSITORY##*/}"
BRANCH_NAME=$GITHUB_REF_NAME

# Configuration pour les branches non-principales
if [ "$BRANCH_NAME" != "main" ] && [ "$BRANCH_NAME" != "master" ]; then
  DOMAIN="$BRANCH_NAME.$DOMAIN"
  APP_NAME="${BRANCH_NAME}.${APP_NAME}"
  APP_NAME_SAFE="${BRANCH_NAME}-${APP_NAME}"
  PORT=$(bash /var/docker-web/src/cli.sh ALLOCATE_PORT)
  sed -i "s|${GITHUB_REPOSITORY##*/}|$APP_NAME_SAFE|g" docker-compose.yml
  sed -i '/depends_on:/,/evilspins-db/d; /evilspins-db:/,/postgres_data:/d; /^volumes:$/,/^$/d' docker-compose.yml
fi
