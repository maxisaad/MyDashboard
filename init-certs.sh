#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# init-certs.sh — Génère une PKI complète pour MyDashboard
# Usage: ./init-certs.sh <domaine>
# Exemple: ./init-certs.sh planetaurora.dedyn.io
# ============================================================

DOMAIN="${1:?Usage: $0 <domaine>}"
CERTS_DIR="$(dirname "$0")/certs"
CA_DAYS=3650       # CA valide 10 ans
SERVER_DAYS=825    # Cert serveur valide ~2 ans (limite Apple)
CLIENT_DAYS=825

mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

echo "==> Génération de la CA..."
openssl req -x509 -new -newkey rsa:4096 -nodes \
  -keyout ca.key -out ca.crt \
  -days "$CA_DAYS" \
  -subj "/CN=MyDashboard Personal CA"

echo "==> Génération du certificat serveur pour $DOMAIN..."
openssl req -new -newkey rsa:2048 -nodes \
  -keyout server.key -out server.csr \
  -subj "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN"

SAN_EXT=$(mktemp)
echo "subjectAltName=DNS:$DOMAIN" > "$SAN_EXT"
openssl x509 -req -in server.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out server.crt -days "$SERVER_DAYS" \
  -extfile "$SAN_EXT"
rm -f "$SAN_EXT" server.csr

echo "==> Génération du certificat client..."
openssl req -new -newkey rsa:2048 -nodes \
  -keyout client.key -out client.csr \
  -subj "/CN=MyDashboard Client"

openssl x509 -req -in client.csr \
  -CA ca.crt -CAkey ca.key -CAcreateserial \
  -out client.crt -days "$CLIENT_DAYS"
rm -f client.csr

echo "==> Création du bundle .p12 (mot de passe vide)..."
openssl pkcs12 -export \
  -in client.crt -inkey client.key \
  -certfile ca.crt \
  -out client.p12 \
  -passout pass:

# Nettoyage des fichiers intermédiaires
rm -f ca.srl

echo ""
echo "============================================"
echo "  PKI générée dans $CERTS_DIR/"
echo "============================================"
echo ""
echo "  Fichiers :"
echo "    ca.crt       — Certificat CA (à installer comme CA de confiance)"
echo "    ca.key       — Clé privée CA (⚠️  garder secret)"
echo "    server.crt   — Certificat serveur (signé par la CA)"
echo "    server.key   — Clé privée serveur"
echo "    client.crt   — Certificat client"
echo "    client.key   — Clé privée client"
echo "    client.p12   — Bundle PKCS#12 (à installer sur vos appareils)"
echo ""
echo "  Prochaines étapes :"
echo "    1. Installer client.p12 sur vos appareils (navigateur / iOS / Android)"
echo "    2. Installer ca.crt comme CA de confiance sur vos appareils"
echo "    3. docker compose up -d --build"
echo "============================================"
