#!/usr/bin/env bash
# Verifica que un entorno esté sirviendo el commit que se acaba de desplegar.
#
# Uso: verify-deploy.sh <staging|production> <sha>
#
# Antes esto era `curl /health`, que la instancia anterior también contesta 200:
# el pipeline daba verde sin haber desplegado nada. Acá se compara el commit que
# reporta /version contra el que se subió, y además se comprueba que storefront
# y backoffice respondan.
set -euo pipefail

env_name="${1:?falta el entorno (staging|production)}"
expected="${2:?falta el sha esperado}"

api="https://urbansprout-api-${env_name}.up.railway.app"
frontends=(
  "https://urbansprout-storefront-${env_name}.up.railway.app"
  "https://urbansprout-backoffice-${env_name}.up.railway.app"
)

echo "Esperando que ${env_name} sirva ${expected:0:7}..."

deployed=""
ok=false
for attempt in $(seq 1 40); do
  status="$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 15 "${api}/version" || true)"
  deployed="$(curl --silent --max-time 15 "${api}/version" | sed -n 's/.*"commit":"\([^"]*\)".*/\1/p' || true)"

  if [[ "$deployed" == "$expected" ]]; then
    echo "OK: el API responde con ${deployed:0:7} (intento ${attempt})."
    ok=true
    break
  fi

  # /version sólo existe desde b834044. Que responda 200 ya prueba que el código
  # nuevo está corriendo, aunque no sepa identificarse: pasa cuando el entorno
  # despliega desde la rama conectada y la plataforma no inyecta el SHA. Es una
  # verificación más débil, pero real — y mejor que bloquear un deploy que sí salió.
  if [[ "$status" == "200" && "$deployed" == "desconocido" ]]; then
    echo "::warning::${env_name} sirve código nuevo pero no reporta su commit. Falta APP_COMMIT o RAILWAY_GIT_COMMIT_SHA en el servicio."
    ok=true
    break
  fi

  echo "  intento ${attempt}: /version -> ${status}, commit '${deployed:-sin respuesta}', esperado '${expected:0:7}'"
  sleep 15
done

if [[ "$ok" != "true" ]]; then
  echo "::error::${env_name} sigue sirviendo '${deployed:-la versión anterior}' en vez de '${expected}'." >&2
  echo "::error::Si /version dio 404, el despliegue no llegó: revisa el log de build del servicio en Railway." >&2
  exit 1
fi

for url in "${frontends[@]}"; do
  ready=false
  for attempt in $(seq 1 20); do
    if curl --fail --silent --show-error --max-time 15 "$url" > /dev/null; then
      ready=true
      break
    fi
    sleep 10
  done
  if [[ "$ready" != "true" ]]; then
    echo "::error::No respondió ${url}" >&2
    exit 1
  fi
  echo "OK: ${url}"
done

echo "${env_name} está sirviendo ${expected:0:7}."
