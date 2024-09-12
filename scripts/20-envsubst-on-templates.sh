#!/bin/sh

export CONFIG_DIR=${CONFIG_DIR:-"/gdt/pgnotify-rabbitmq"}
export PGHOST=${PGHOST:-"postgresql"}
export PGPORT=${PGPORT:-5432}
export PGDATABASE=${PGDATABASE:-"postgres"}
export PGUSER=${PGUSER:-"postgres"}
export PGPASSWORD=${PGPASSWORD:-"postgres"}
export PGSSLMODE=${PGSSLMODE:-"false"}
export NOTIFY_NAME=${NOTIFY_NAME:-"rabbitmq"}
export NOTIFY_DEBUG=${NOTIFY_DEBUG:-true}
export NOTIFY_JSON=${NOTIFY_JSON:-false}
export RABBITMQ_TOPIC=${RABBITMQ_TOPIC:-"amq.fanout"}
export RABBITMQ_ROUTING_KEY=${RABBITMQ_ROUTING_KEY:-"job.status"}
export RABBITMQ_EXCHANGE=${RABBITMQ_EXCHANGE:-app}
export RABBITMQ_URI=${RABBITMQ_URI:-"amqp://rabbit:rabbit@rabbitmq/TEST?heartbeat=30"}
export RABBITMQ_MAIL_QUEUE_NAME=${RABBITMQ_MAIL_QUEUE_NAME:-"app.mail"}
export RABBITMQ_MAIL_ROUTINGKEY=${RABBITMQ_MAIL_ROUTINGKEY:-"app.mail"}
export RABBITMQ_SQL_QUEUE_NAME=${RABBITMQ_SQL_QUEUE_NAME:-"app.sql"}
export RABBITMQ_SQL_ROUTINGKEY=${RABBITMQ_SQL_ROUTINGKEY:-"app.sql"}
# export USE_TEMPLATE=${USE_TEMPLATE:-false}
export FCM_CLIENTE_MAIL=${FCM_CLIENTE_MAIL:-""}
export FCM_PROJECT_ID=${FCM_PROJECT_ID:-""}
export FCM_PRIVATE_KEY=${FCM_PRIVATE_KEY:-""}

set -e

ME=$(basename "$0")

entrypoint_log() {
    if [ -z "${ENTRYPOINT_QUIET_LOGS:-}" ]; then
        echo "$@"
    fi
}

auto_envsubst() {
  local template_dir="${ENVSUBST_TEMPLATE_DIR:-$CONFIG_DIR/templates}"
  local suffix="${ENVSUBST_TEMPLATE_SUFFIX:-.template}"
  local output_dir="${ENVSUBST_OUTPUT_DIR:-$CONFIG_DIR}"
  local filter="${ENVSUBST_FILTER:-}"

  local template defined_envs relative_path output_path subdir
  defined_envs=$(printf '${%s} ' $(awk "END { for (name in ENVIRON) { print ( name ~ /${filter}/ ) ? name : \"\" } }" < /dev/null ))
  [ -d "$template_dir" ] || return 0
  if [ ! -w "$output_dir" ]; then
    entrypoint_log "$ME: ERROR: $template_dir exists, but $output_dir is not writable"
    return 0
  fi
  find "$template_dir" -follow -type f -name "*$suffix" -print | while read -r template; do
    relative_path="${template#"$template_dir/"}"
    output_path="$output_dir/${relative_path%"$suffix"}"
    subdir=$(dirname "$relative_path")
    # create a subdirectory where the template file exists
    mkdir -p "$output_dir/$subdir"
    entrypoint_log "$ME: Running envsubst on $template to $output_path"
    envsubst "$defined_envs" < "$template" > "$output_path"
  done
}

if [ -n "${USE_TEMPLATE}" ]; then
  echo "Using environment variables..."
  auto_envsubst
else
  echo "Skipping environment variables..."
fi

exit 0
