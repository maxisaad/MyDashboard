#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# setup.sh — Déploiement complet MyDashboard sur un nouveau serveur
# Usage: ./setup.sh <domaine>
# Exemple: ./setup.sh planetaurora.dedyn.io
# ============================================================

DOMAIN="${1:?Usage: $0 <domaine>}"

echo "==> [1/4] Génération des certificats..."
chmod +x "$(dirname "$0")/init-certs.sh"
"$(dirname "$0")/init-certs.sh" "$DOMAIN"

echo ""
echo "==> [2/4] Vérification du fichier .env..."
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    cp .env.example .env
    echo "    ⚠️  .env créé depuis .env.example — pensez à le remplir !"
    echo "    Variables requises : STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET"
  else
    echo "    ❌ Pas de .env.example trouvé. Créez un fichier .env manuellement."
  fi
else
  echo "    ✅ .env existe déjà"
fi

echo ""
echo "==> [3/4] Création du dossier data/..."
mkdir -p data
echo "    ✅ data/ prêt"

echo ""
echo "==> [4/4] Lancement des services..."
docker compose up -d --build

echo ""
echo "============================================"
echo "  MyDashboard déployé !"
echo "============================================"
echo ""
echo "  Dashboard : https://$DOMAIN"
echo ""
echo "  ⚠️  N'oubliez pas :"
echo "    1. Configurer le DNS de $DOMAIN → $(hostname -I | awk '{print $1}')"
echo "    2. Installer certs/client.p12 sur vos appareils"
echo "    3. Remplir le fichier .env avec vos clés Strava"
echo "============================================"
