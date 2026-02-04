# HouseForge Economics Documentation

## Overview

HouseForge implements a low-barrier, high-participation economic model designed for mass adoption on BSC. All prices are denominated in BNB.

## Configuration

Economics are defined in `config/economics.yaml`:

```yaml
version: 3
economics:
  # Owner wallet (hardcoded in contracts)
  owner_wallet: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"
  treasury_address: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"

  genesis:
    allowlist_price_bnb: 0.01
    public_price_bnb: 0.01
    per_wallet_limit: 4
    special_wallet: "0x1e87e1d1f317e8c647380ce1e1233e1edd265607"
    special_wallet_limit: 16  # Owner wallet can mint 16

  fusion_fees_bnb:
    # Tiered base fee by offspring generation (exponential growth)
    base_by_generation:
      gen_1: 0.01    # Parents are Gen 0
      gen_2: 0.04
      gen_3: 0.08
      gen_4_plus: 0.16
    rare_surcharge: 0.002
    mythic_attempt_surcharge: 0.003

  vault:
    free_snapshots_per_agent: 10
    pro_snapshots_per_agent: 200
    pro_pass_price_bnb: 0.02

  allowlist:
    enabled: true
    merkle_root: "0x0000..."
    max_per_wallet: 2

  phases:
    allowlist_start: 0
    public_start: 0
    mint_end: 0
```

## Genesis Minting

### Pricing Structure

| Phase | Price (BNB) | USD Equivalent* | Wallet Limit |
|-------|-------------|-----------------|--------------|
| Allowlist | 0.01 | ~$6 | 2 |
| Public | 0.01 | ~$6 | 4 (standard) / 16 (special wallet) |

*USD estimates at BNB = $600

### Special Wallet Privilege

The contract owner can designate a "special wallet" with a higher minting limit (default: 16 tokens). This is intended for:
- Project team reserve
- Marketing/giveaway allocation
- Strategic partnerships

Configure via: `setSpecialWallet(address wallet, uint256 limit)`

### Supply Distribution

Total Genesis Supply: **2,100 agents**

| House | Supply | Percentage |
|-------|--------|------------|
| CLEAR | 350 | 16.67% |
| MONSOON | 300 | 14.29% |
| THUNDER | 300 | 14.29% |
| FROST | 300 | 14.29% |
| AURORA | 300 | 14.29% |
| SAND | 300 | 14.29% |
| ECLIPSE | 250 | 11.90% |

### Rarity Distribution

| Rarity | Percentage | Expected Count |
|--------|------------|----------------|
| Common | 62% | 1,302 |
| Uncommon | 23% | 483 |
| Rare | 10% | 210 |
| Epic | 4% | 84 |
| Legendary | 0.9% | ~19 |
| Mythic | 0.1% | ~2 |

### Revenue Projections

Assuming full sellout:

| Scenario | Allowlist (420) | Public (1680) | Total Revenue |
|----------|-----------------|---------------|---------------|
| Min (all allowlist) | 420 × 0.01 = 4.2 | 0 | 4.2 BNB |
| Max (all public) | 0 | 2100 × 0.01 = 21 | 21 BNB |
| Realistic (20/80) | 420 × 0.01 = 4.2 | 1680 × 0.01 = 16.8 | 21 BNB |

## Fusion Economics

### Fee Structure

Fusion fees use a **tiered staircase model** based on offspring generation, plus surcharges for rarity and mythic eligibility:

#### Base Fee by Offspring Generation

| Offspring Generation | Base Fee (BNB) | USD Equivalent* | Rationale |
|---------------------|----------------|-----------------|-----------|
| Gen 1 (parents are Gen 0) | 0.01 | ~$6 | Entry-level breeding |
| Gen 2 | 0.04 | ~$24 | Moderate increase |
| Gen 3 | 0.08 | ~$48 | Higher value offspring |
| Gen 4+ | 0.16 | ~$96 | Premium for deep lineages |

*USD estimates at BNB = $600

#### Surcharges

| Component | Fee (BNB) | Trigger |
|-----------|-----------|---------|
| Rare Surcharge | +0.002 | Either parent is Rare+ |
| Mythic Attempt | +0.003 | House combination eligible for mythic |

### Fee Calculation Examples

**Basic Gen 1 Fusion (Gen 0 Common × Gen 0 Common → Gen 1)**
```
Base (Gen 1): 0.01 BNB
Total: 0.01 BNB (~$6)
```

**Gen 2 Fusion with Rare Parent (Gen 1 Rare × Gen 0 Common → Gen 2)**
```
Base (Gen 2): 0.04 BNB
Rare Surcharge: 0.002 BNB
Total: 0.042 BNB (~$25)
```

**Gen 3 Mythic Attempt (Gen 2 Thunder × Gen 2 Monsoon, both Rare → Gen 3)**
```
Base (Gen 3): 0.08 BNB
Rare Surcharge: 0.002 BNB
Mythic Attempt: 0.003 BNB
Total: 0.085 BNB (~$51)
```

**Deep Lineage Gen 5 (Gen 4 × Gen 3 → Gen 5)**
```
Base (Gen 4+): 0.16 BNB
Total: 0.16 BNB (~$96)
```

### Mythic Eligible Combinations

| Mythic | House A | House B | Base Probability |
|--------|---------|---------|------------------|
| EYE_OF_STORM | THUNDER | MONSOON | 1/200 |
| FROZEN_TIME | FROST | CLEAR | 1/220 |
| BLACK_SUN | ECLIPSE | AURORA | 1/333 |

### Fusion Revenue Model

Assuming 1000 fusions/month with generational distribution:

| Generation | Percentage | Count | Base Fee | Avg Total* | Revenue |
|------------|------------|-------|----------|------------|---------|
| Gen 1 | 40% | 400 | 0.01 | 0.012 | 4.8 BNB |
| Gen 2 | 30% | 300 | 0.04 | 0.044 | 13.2 BNB |
| Gen 3 | 20% | 200 | 0.08 | 0.085 | 17.0 BNB |
| Gen 4+ | 10% | 100 | 0.16 | 0.165 | 16.5 BNB |
| **Monthly Total** | | | | | **51.5 BNB** |

*Avg Total includes estimated rare/mythic surcharges based on higher rarity probability in later generations

## Vault Service (Optional Premium)

### Free Tier

Every agent receives:
- 10 learning snapshots
- Basic vault storage
- Hash verification

### Pro Pass

For power users requiring extensive learning history:

| Feature | Free | Pro |
|---------|------|-----|
| Snapshots | 10 | 200 |
| Price | 0 BNB | 0.02 BNB |
| Duration | Permanent | Per-agent, Permanent |

## Treasury Management

### Fund Flow

```
┌─────────────────┐
│   User Wallet   │
└────────┬────────┘
         │ Mint/Fusion Payment
         ▼
┌─────────────────┐
│ Smart Contract  │
│ (No Storage)    │
└────────┬────────┘
         │ Immediate Forward
         ▼
┌─────────────────┐
│    Treasury     │
│ (Multisig Rec.) │
└─────────────────┘
```

### Treasury Recommendations

1. **Multisig Wallet**: Use Gnosis Safe with 2-of-3 or 3-of-5 signers
2. **Separate Concerns**: Operations wallet vs. long-term holdings
3. **Transparent Reporting**: Publish treasury balances periodically
4. **Reserve Allocation**:
   - 40% Development & Operations
   - 30% Marketing & Growth
   - 20% Community Rewards
   - 10% Emergency Reserve

## Price Stability Considerations

### BNB Volatility Buffer

- Prices set conservatively low
- Revenue targets achievable even with 50% BNB price drop
- No USD-pegged mechanisms to avoid complexity

### Market Comparison

| Project | Mint Price | Chain |
|---------|------------|-------|
| HouseForge | 0.01 BNB (~$6) | BSC |
| Typical PFP | 0.05-0.1 ETH ($100-200) | Ethereum |
| Ordinals | Variable sats | Bitcoin |

HouseForge targets the **accessible gaming collectibles** segment, not luxury digital art.

## Economic Sustainability

### Break-Even Analysis

Fixed Costs (estimated monthly):
- Server hosting: $50
- RPC endpoints: $100
- Domain/SSL: $10
- **Total: ~$160/month ≈ 0.27 BNB**

Break-even requires:
- 90 basic fusions/month, OR
- 9 public mints, OR
- 14 pro passes

### Growth Incentives

1. **Referral Allowlist**: Active community members get allowlist spots
2. **Fusion Bonuses**: Seasonal events with reduced fees
3. **Rare Breeding Programs**: Community-coordinated mythic attempts
4. **Lineage Rewards**: Long lineage chains earn recognition

## Fee Adjustment Governance

### Initial Period (Months 1-3)

- Fees fixed as specified
- Data collection on usage patterns
- Community feedback gathering

### Adjustment Criteria

Fee changes may be proposed if:
- Fusion volume < 100/month for 3 consecutive months
- BNB price changes > 100% sustained
- Community vote requests change

### Change Process

1. Propose new fee structure
2. 7-day community discussion
3. Snapshot vote (if token governance implemented)
4. Contract owner executes change
5. 48-hour notice before activation

## Appendix: Fee Calculation Code

```solidity
// Owner wallet (hardcoded)
address public constant OWNER_WALLET = 0x1e87e1d1f317e8c647380ce1e1233e1edd265607;

// Base fees stored as array: [Gen1, Gen2, Gen3, Gen4+]
uint256[4] public baseFeeByTier; // [0.01, 0.04, 0.08, 0.16 ether]

function getFusionFee(uint256 parentA, uint256 parentB) public view returns (
    uint256 totalFee,
    uint256 baseAmount,
    uint256 rareAmount,
    uint256 mythicAmount
) {
    // Calculate offspring generation to determine fee tier
    uint256 genA = agentContract.getGeneration(parentA);
    uint256 genB = agentContract.getGeneration(parentB);
    uint256 offspringGen = (genA > genB ? genA : genB) + 1;

    // Map generation to tier (0-3): Gen1→0, Gen2→1, Gen3→2, Gen4+→3
    uint256 tier = offspringGen >= 4 ? 3 : offspringGen - 1;
    baseAmount = baseFeeByTier[tier];

    // Rare surcharge if either parent is Rare (tier 2) or higher
    uint8 rarityA = agentContract.getRarityTier(parentA);
    uint8 rarityB = agentContract.getRarityTier(parentB);
    if (rarityA >= 2 || rarityB >= 2) {
        rareAmount = rareSurcharge; // 0.002 BNB
    }

    // Mythic attempt surcharge based on house combination + generation
    if (_isMythicAttemptEligible(parentA, parentB)) {
        mythicAmount = mythicAttemptSurcharge; // 0.003 BNB
    }

    totalFee = baseAmount + rareAmount + mythicAmount;
}
```

### Admin Functions for Fee Management

```solidity
// Set all fees at once
function setFees(
    uint256[4] calldata _baseFeeByTier,  // [Gen1, Gen2, Gen3, Gen4+]
    uint256 _rareSurcharge,
    uint256 _mythicAttemptSurcharge
) external onlyAdmin;

// Set individual tier fee
function setBaseFeeForTier(uint8 tier, uint256 fee) external onlyAdmin;

// Set treasury address
function setTreasury(address _treasury) external onlyAdmin;
```

## Summary

HouseForge's economic model prioritizes:
- **Accessibility**: Low entry price (0.01 BNB)
- **Sustainability**: Recurring fusion fees fund ongoing development
- **Transparency**: All fees calculated on-chain, immediately forwarded
- **Fairness**: Tiered fees based on value received (rare parents, mythic chances)
