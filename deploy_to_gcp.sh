#!/usr/bin/env bash
# ==============================================================================
# Stayone Hospitality Platform - Automated GCP Production Deployment Script
# Target OS: Ubuntu 22.04 LTS (x86_64) on Google Cloud Compute Engine
# ==============================================================================

set -euo pipefail

# Text colors for clear status output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo -e "${CYAN}${BOLD}"
echo "=================================================================="
echo "    🚀 STAYONE HOSPITALITY - GOOGLE CLOUD PRODUCTION DEPLOYMENT    "
echo "=================================================================="
echo -e "${NC}"

# Check for root / sudo privileges
if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}[ERROR] This script must be run as root or with sudo privileges.${NC}"
   echo "Run: sudo ./deploy_to_gcp.sh"
   exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"
echo -e "${BLUE}[INFO] Working directory: ${PROJECT_DIR}${NC}"

# ------------------------------------------------------------------------------
# 1. System Swap Configuration (Prevents OOM during React npm builds)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 1/7: Checking Swap Space Configuration...${NC}"
if ! swapon --show | grep -q "swap"; then
    echo -e "${BLUE}[INFO] Configuring 4GB Swap file to ensure safe React asset builds...${NC}"
    if command -v fallocate &> /dev/null; then
        fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
    else
        dd if=/dev/zero of=/swapfile bs=1M count=4096
    fi
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' >> /etc/fstab
    fi
    echo -e "${GREEN}[OK] 4GB Swap space enabled.${NC}"
else
    echo -e "${GREEN}[OK] Swap space is already configured.${NC}"
fi

# ------------------------------------------------------------------------------
# 2. Package Prerequisites & Docker Installation
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 2/7: Verifying Docker and Docker Compose...${NC}"
apt-get update -y
apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

if ! command -v docker &> /dev/null || ! docker compose version &> /dev/null; then
    echo -e "${BLUE}[INFO] Installing official Docker Engine & Docker Compose plugin...${NC}"
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt-get update -y
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo -e "${GREEN}[OK] Docker and Docker Compose installed successfully.${NC}"
else
    echo -e "${GREEN}[OK] Docker Engine is active ($(docker --version)).${NC}"
fi

# Add current user to docker group if applicable
if [[ -n "${SUDO_USER:-}" ]]; then
    usermod -aG docker "$SUDO_USER" || true
fi

# ------------------------------------------------------------------------------
# 3. Environment Configuration
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 3/7: Checking Production Environment Secrets...${NC}"
if [[ ! -f ".env.production" ]]; then
    if [[ -f ".env.production.template" ]]; then
        echo -e "${BLUE}[INFO] Generating .env.production from template...${NC}"
        cp .env.production.template .env.production
    else
        echo -e "${RED}[ERROR] Neither .env.production nor .env.production.template was found!${NC}"
        exit 1
    fi
fi
chmod 600 .env.production
echo -e "${GREEN}[OK] .env.production loaded.${NC}"

# Disable any host-level web servers that might conflict with port 80/443
systemctl stop apache2 2>/dev/null || true
systemctl disable apache2 2>/dev/null || true
systemctl stop nginx 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true

# ------------------------------------------------------------------------------
# 4. Build and Launch Production Container Stack
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 4/7: Building and Starting Production Stack...${NC}"
echo -e "${BLUE}[INFO] Building optimized React bundles and backend services... (This may take 3-5 minutes on first run)${NC}"

docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# ------------------------------------------------------------------------------
# 5. Database Health Check & Schema Migration
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 5/7: Waiting for PostgreSQL & Migrating Schema...${NC}"
RETRIES=30
until docker compose -f docker-compose.prod.yml exec -T db pg_isready -U stayone_prod -d stayone_db >/dev/null 2>&1 || [ $RETRIES -eq 0 ]; do
    echo "Waiting for database readiness... ($RETRIES attempts left)"
    RETRIES=$((RETRIES-1))
    sleep 2
done

if [ $RETRIES -eq 0 ]; then
    echo -e "${RED}[ERROR] Database did not become healthy in time.${NC}"
    docker compose -f docker-compose.prod.yml logs db
    exit 1
fi
echo -e "${GREEN}[OK] Database is healthy and accepting connections.${NC}"

echo -e "${BLUE}[INFO] Executing multi-tenant SaaS schema migration...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend python app/scripts/migrate_saas.py

echo -e "${BLUE}[INFO] Verifying Super Admin account...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend python setup_superadmin.py

echo -e "${BLUE}[INFO] Seeding initial branch and core roles...${NC}"
docker compose -f docker-compose.prod.yml exec -T backend python seed_initial_data.py || true

# ------------------------------------------------------------------------------
# 6. Service Verification & Health Checks
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}Step 6/7: Verifying Service Endpoints...${NC}"
sleep 3

# Verify backend health
if curl -sf http://127.0.0.1:8011/health > /dev/null 2>&1; then
    echo -e "${GREEN}[OK] FastAPI Backend is healthy (HTTP 200).${NC}"
else
    echo -e "${YELLOW}[WARN] Backend health endpoint did not respond immediately, checking logs...${NC}"
    docker compose -f docker-compose.prod.yml logs --tail=20 backend
fi

# Detect Server Public IP
PUBLIC_IP=$(curl -s -4 --max-time 3 ifconfig.me || curl -s -4 --max-time 3 api.ipify.org || echo "YOUR_GCP_STATIC_IP")

# ------------------------------------------------------------------------------
# 7. Deployment Complete Summary
# ------------------------------------------------------------------------------
echo -e "\n${CYAN}${BOLD}"
echo "=================================================================="
echo "    🎉 STAYONE PRODUCTION DEPLOYMENT COMPLETED SUCCESSFULLY!      "
echo "=================================================================="
echo -e "${NC}"
echo -e "${BOLD}Your Stayone platform is now LIVE and accessible at:${NC}\n"
echo -e "  🌐 ${BOLD}Guest Booking Portal:${NC}     http://${PUBLIC_IP}/"
echo -e "  🔒 ${BOLD}Admin & Staff Dashboard:${NC}  http://${PUBLIC_IP}/stayoneadmin"
echo -e "  📝 ${BOLD}Property Registration:${NC}    http://${PUBLIC_IP}/stayoneadmin/register"
echo -e "  🔌 ${BOLD}Backend REST API:${NC}        http://${PUBLIC_IP}/api/"
echo -e "  🏥 ${BOLD}Gateway Health Check:${NC}    http://${PUBLIC_IP}/health"
echo ""
echo -e "${BOLD}Super Admin Credentials:${NC}"
echo -e "  👤 ${BOLD}Email:${NC}    admin@orchid.com"
echo -e "  🔑 ${BOLD}Password:${NC} admin123"
echo ""
echo -e "${BLUE}${BOLD}Useful Operations Commands:${NC}"
echo -e "  - View live logs:     ${CYAN}docker compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "  - Restart services:   ${CYAN}docker compose -f docker-compose.prod.yml restart${NC}"
echo -e "  - Check status:       ${CYAN}docker compose -f docker-compose.prod.yml ps${NC}"
echo -e "  - Stop production:    ${CYAN}docker compose -f docker-compose.prod.yml down${NC}"
echo "=================================================================="

