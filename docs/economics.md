# HouseForge Economics Documentation

## Overview

HouseForge implements a low-barrier, high-participation economic model designed for mass adoption on BSC. All prices are denominated in BNB.

## Configuration

Economics are defined in `config/economics.yaml`:

```yaml
version: 1
economics:
  treasury_address: "SET_IN_ENV_OR_DEPLOY"

  genesis:
    allowlist_price_bnb: 0.005
    public_price_bnb: 0.01
    per_wallet_limit: 3

  fusion_fees_bnb:
    base: 0.003
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
| Allowlist | 0.005 | ~$3 | 2 |
| Public | 0.01 | ~$6 | 3 |

*USD estimates at BNB = $600

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
| Min (all allowlist) | 420 × 0.005 = 2.1 | 0 | 2.1 BNB |
| Max (all public) | 0 | 2100 × 0.01 = 21 | 21 BNB |
| Realistic (20/80) | 420 × 0.005 = 2.1 | 1680 × 0.01 = 16.8 | 18.9 BNB |

## Fusion Economics

### Fee Structure

Fusion fees are tiered based on parent rarity and mythic eligibility:

| Component | Fee (BNB) | Trigger |
|-----------|-----------|---------|
| Base Fee | 0.003 | Always |
| Rare Surcharge | 0.002 | Either parent is Rare+ |
| Mythic Attempt | 0.003 | House combination eligible for mythic |

### Fee Calculation Examples

**Basic Fusion (Common × Common)**
```
Base: 0.003 BNB
Total: 0.003 BNB
```

**Rare Parent Fusion (Rare × Common)**
```
Base: 0.003 BNB
Rare Surcharge: 0.002 BNB
Total: 0.005 BNB
```

**Mythic Attempt (Thunder × Frost, both Rare)**
```
Base: 0.003 BNB
Rare Surcharge: 0.002 BNB
Mythic Attempt: 0.003 BNB
Total: 0.008 BNB
```

### Mythic Eligible Combinations

| Mythic | House A | House B | Base Probability |
|--------|---------|---------|------------------|
| EYE_OF_STORM | THUNDER | MONSOON | 1/200 |
| FROZEN_TIME | FROST | CLEAR | 1/220 |
| BLACK_SUN | ECLIPSE | AURORA | 1/333 |

### Fusion Revenue Model

Assuming 1000 fusions/month with distribution:

| Type | Percentage | Count | Fee | Revenue |
|------|------------|-------|-----|---------|
| Basic | 60% | 600 | 0.003 | 1.8 BNB |
| Rare Parent | 30% | 300 | 0.005 | 1.5 BNB |
| Mythic Attempt | 10% | 100 | 0.008 | 0.8 BNB |
| **Monthly Total** | | | | **4.1 BNB** |

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
function getFusionFee(uint256 parentA, uint256 parentB) public view returns (
    uint256 totalFee,
    uint256 baseAmount,
    uint256 rareAmount,
    uint256 mythicAmount
) {
    baseAmount = baseFee; // 0.003 BNB

    // Rare surcharge if either parent is Rare (tier 3) or higher
    uint8 rarityA = agentContract.getRarityTier(parentA);
    uint8 rarityB = agentContract.getRarityTier(parentB);
    if (rarityA >= 3 || rarityB >= 3) {
        rareAmount = rareSurcharge; // 0.002 BNB
    }

    // Mythic attempt surcharge based on house combination
    uint8 houseA = agentContract.getHouseId(parentA);
    uint8 houseB = agentContract.getHouseId(parentB);
    if (mythicEligibleHouses[houseA][houseB]) {
        mythicAmount = mythicAttemptSurcharge; // 0.003 BNB
    }

    totalFee = baseAmount + rareAmount + mythicAmount;
}
```

## Summary

HouseForge's economic model prioritizes:
- **Accessibility**: Low entry price (0.005-0.01 BNB)
- **Sustainability**: Recurring fusion fees fund ongoing development
- **Transparency**: All fees calculated on-chain, immediately forwarded
- **Fairness**: Tiered fees based on value received (rare parents, mythic chances)
