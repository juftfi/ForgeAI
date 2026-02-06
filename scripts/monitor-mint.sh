#!/bin/bash
# KinForge Genesis Mint Monitor
# Monitors totalSupply and auto-closes minting at target cap

CONTRACT="0x713Be3D43c5DdfE145215Cd366c553c75A06Ce7f"
RPC="https://bsc-dataseed1.binance.org"
CAP=2100
INTERVAL=30  # seconds

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  KinForge Genesis Mint Monitor${NC}"
echo -e "${CYAN}  Target: ${CAP} | Interval: ${INTERVAL}s${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

PREV=0

while true; do
    SUPPLY=$(cast call $CONTRACT "totalSupply()(uint256)" --rpc-url $RPC 2>/dev/null)

    if [ -z "$SUPPLY" ]; then
        echo -e "${RED}[$(date '+%H:%M:%S')] RPC error, retrying...${NC}"
        sleep 5
        continue
    fi

    # Pure bash arithmetic (multiply first to avoid losing precision)
    PCT_10=$((SUPPLY * 1000 / CAP))
    PCT_INT=$((PCT_10 / 10))
    PCT_DEC=$((PCT_10 % 10))

    # Progress bar (30 chars)
    BAR_LEN=30
    FILLED=$((SUPPLY * BAR_LEN / CAP))
    BAR=""
    for ((i=0; i<FILLED; i++)); do BAR="${BAR}#"; done
    for ((i=FILLED; i<BAR_LEN; i++)); do BAR="${BAR}-"; done

    # Delta since last check
    DELTA=$((SUPPLY - PREV))
    DELTA_STR=""
    if [ $PREV -gt 0 ] && [ $DELTA -gt 0 ]; then
        DELTA_STR=" (+${DELTA})"
    fi

    # Color based on progress
    if [ $SUPPLY -ge $CAP ]; then
        COLOR=$RED
    elif [ $SUPPLY -ge $((CAP * 90 / 100)) ]; then
        COLOR=$YELLOW
    else
        COLOR=$GREEN
    fi

    echo -e "${COLOR}[$(date '+%H:%M:%S')] [${BAR}] ${SUPPLY}/${CAP} (${PCT_INT}.${PCT_DEC}%)${DELTA_STR}${NC}"

    PREV=$SUPPLY

    # Auto-close at cap
    if [ $SUPPLY -ge $CAP ]; then
        echo ""
        echo -e "${RED}========================================${NC}"
        echo -e "${RED}  CAP REACHED! Closing public mint...${NC}"
        echo -e "${RED}========================================${NC}"

        if [ -n "$PRIVATE_KEY" ]; then
            echo -e "${YELLOW}Sending setPublicMintActive(false)...${NC}"
            cast send $CONTRACT "setPublicMintActive(bool)" false \
                --rpc-url $RPC \
                --private-key $PRIVATE_KEY

            if [ $? -eq 0 ]; then
                echo -e "${GREEN}Public mint closed successfully!${NC}"
            else
                echo -e "${RED}Failed! Close manually:${NC}"
                echo "cast send $CONTRACT \"setPublicMintActive(bool)\" false --rpc-url $RPC --private-key YOUR_KEY"
            fi
        else
            echo -e "${YELLOW}No PRIVATE_KEY set. Close manually:${NC}"
            echo "cast send $CONTRACT \"setPublicMintActive(bool)\" false --rpc-url $RPC --private-key YOUR_KEY"
        fi

        exit 0
    fi

    sleep $INTERVAL
done
