#!/bin/bash

# Couleurs pour les logs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Déploiement de IceNode...${NC}"

# 1. Build du frontend
echo -e "${BLUE}📦 Build du frontend...${NC}"
cd dashboard
npm run build

# 2. Build du backend
echo -e "${BLUE}📦 Build du backend...${NC}"
cd ..
npm install
npm run build

# 3. Démarrer les services avec PM2
echo -e "${BLUE}🔄 Démarrage des services...${NC}"
pm2 delete all || true
pm2 start ecosystem.config.js

echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo -e "${BLUE}📊 Dashboard: http://localhost:3000${NC}"
echo -e "${BLUE}🔌 API: http://localhost:3001${NC}"
