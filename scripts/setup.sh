#!/usr/bin/env bash
# Cortex — macOS/Linux Setup Script
# Run: bash scripts/setup.sh

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║     Cortex Local AI — Setup           ║${NC}"
echo -e "${CYAN}  ║     Privacy-first, 100% offline       ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════╝${NC}"
echo ""

# ─── Check prerequisites ────────────────────────────────────────────────────

check_cmd() { command -v "$1" &>/dev/null; }

echo -e "${YELLOW}Checking prerequisites...${NC}"

missing=()
check_cmd node   || missing+=("Node.js 20+ — https://nodejs.org")
check_cmd pnpm   || missing+=("pnpm — npm install -g pnpm")
check_cmd rustc  || missing+=("Rust — https://rustup.rs")
check_cmd python3 || missing+=("Python 3.11+ — https://python.org")

if [[ ${#missing[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}Missing prerequisites:${NC}"
    for m in "${missing[@]}"; do echo "  • $m"; done
    echo ""
    echo -e "${YELLOW}Please install them and re-run this script.${NC}"
    exit 1
fi

echo -e "  ${GREEN}✓ Node.js $(node --version)${NC}"
echo -e "  ${GREEN}✓ pnpm $(pnpm --version)${NC}"
echo -e "  ${GREEN}✓ Rust $(rustc --version | cut -d' ' -f2)${NC}"
echo -e "  ${GREEN}✓ Python $(python3 --version | cut -d' ' -f2)${NC}"

# macOS: check for Xcode Command Line Tools
if [[ "$OSTYPE" == "darwin"* ]]; then
    if ! xcode-select -p &>/dev/null; then
        echo -e "${YELLOW}Installing Xcode Command Line Tools...${NC}"
        xcode-select --install
    fi
fi

# ─── Install Ollama ─────────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Checking Ollama...${NC}"

if ! check_cmd ollama; then
    echo -e "${CYAN}Installing Ollama...${NC}"
    curl -fsSL https://ollama.ai/install.sh | sh
    echo -e "  ${GREEN}✓ Ollama installed${NC}"
else
    echo -e "  ${GREEN}✓ Ollama $(ollama --version 2>/dev/null || echo 'installed')${NC}"
fi

# ─── Install Node dependencies ───────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Installing Node.js dependencies...${NC}"
pnpm install
echo -e "  ${GREEN}✓ Node dependencies installed${NC}"

# ─── Setup Python services ────────────────────────────────────────────────────

echo ""
echo -e "${YELLOW}Setting up Python microservices...${NC}"

for svc in embeddings whisper rag; do
    echo -e "  ${CYAN}Setting up $svc service...${NC}"
    pushd "services/$svc" > /dev/null
    python3 -m venv .venv
    .venv/bin/pip install --quiet --upgrade pip
    .venv/bin/pip install --quiet -r requirements.txt
    popd > /dev/null
    echo -e "  ${GREEN}✓ $svc service ready${NC}"
done

# ─── Pull default Ollama model ────────────────────────────────────────────────

echo ""
read -rp "$(echo -e "${YELLOW}Download default model llama3:8b (~4.7 GB)? [y/N]${NC} ")" response

if [[ "$response" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Starting Ollama and pulling llama3:8b...${NC}"
    ollama serve &>/dev/null &
    sleep 2
    ollama pull llama3:8b
    echo -e "  ${GREEN}✓ llama3:8b downloaded${NC}"
fi

# ─── Create data directory ────────────────────────────────────────────────────

DATA_DIR="$HOME/.cortex"
mkdir -p "$DATA_DIR"
echo -e "  ${GREEN}✓ Data directory: $DATA_DIR${NC}"

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}  ✓ Cortex setup complete!${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Run the development server:  pnpm tauri:dev"
echo "  2. Build for production:        pnpm tauri:build"
echo "  3. Start Python services:       bash scripts/services.sh"
echo ""
