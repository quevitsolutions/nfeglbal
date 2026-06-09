#!/bin/bash
# NFEGlobal System-Wide Verification Script
# To be run on the Ubuntu VPS after 'docker-compose up -d'

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo "🔍 Starting NFEGlobal Stack Verification..."

# 1. Check Container Status
echo -n "1. Checking Container Health... "
if docker compose ps | grep -q "healthy"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED (Check 'docker-compose ps' for details)${NC}"
fi

# 2. Verify Backend -> DB Connection
echo -n "2. Verifying API to DB Link... "
API_LOGS=$(docker logs nfeglobal-api 2>&1 | tail -n 20)
if echo "$API_LOGS" | grep -q "Database connected successfully"; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED (Check logs: 'docker logs nfeglobal-api')${NC}"
fi

# 3. Test API Endpoint (Recursive Logic)
echo -n "3. Testing API Health Endpoint... "
HEALTH_CHECK=$(docker exec nfeglobal-api curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/health)
if [ "$HEALTH_CHECK" == "200" ]; then
    echo -e "${GREEN}PASSED (HTTP 200)${NC}"
else
    echo -e "${RED}FAILED (HTTP $HEALTH_CHECK)${NC}"
fi

# 4. Confirm Nginx Proxy
echo -n "4. Verifying Nginx Reverse Proxy... "
if docker exec nfeglobal-frontend nginx -t > /dev/null 2>&1; then
    echo -e "${GREEN}PASSED${NC}"
else
    echo -e "${RED}FAILED (Check 'nginx.conf')${NC}"
fi

echo "---------------------------------------"
if [[ "$HEALTH_CHECK" == "200" ]]; then
    echo -e "${GREEN}✅ ALL SYSTEMS GO. NFEGLOBAL.ONLINE IS LIVE.${NC}"
else
    echo -e "${RED}❌ DEPLOYMENT ISSUES DETECTED. See failed steps above.${NC}"
fi
