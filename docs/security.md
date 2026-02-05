# KinForge Security Documentation

## Overview

This document outlines the security architecture, threat model, and mitigation strategies for KinForge NFT contracts and services.

## Smart Contract Security

### Access Control

| Function | Access Level | Protection |
|----------|--------------|------------|
| `mintGenesisPublic` | Public | Payment validation, wallet limits, phase checks |
| `mintGenesisAllowlist` | Allowlist | Merkle proof verification |
| `mintOffspring` | FusionCore only | `onlyFusionCore` modifier |
| `updateLearning` | Token owner | `onlyTokenOwner` modifier |
| `executeAction` | Token owner | `onlyTokenOwner` + Active status |
| `pause/unpause/terminate` | Token owner | `onlyTokenOwner` modifier |
| `setLogicAddress` | Token owner | `onlyTokenOwner` modifier |
| `setAllowlistRoot` | Contract owner | `onlyOwner` modifier |
| `setPhases` | Contract owner | `onlyOwner` modifier |
| `withdrawStuckTokens` | Contract owner | `onlyOwner` modifier |

### Reentrancy Protection

All state-changing functions follow the checks-effects-interactions pattern:

```solidity
function mintGenesisPublic(uint256 count, ...) external payable nonReentrant {
    // 1. CHECKS
    require(msg.value >= price * count, "Insufficient payment");
    require(_mintCounts[msg.sender] + count <= perWalletLimit, "Wallet limit");

    // 2. EFFECTS
    _mintCounts[msg.sender] += count;

    // 3. INTERACTIONS
    (bool sent, ) = treasury.call{value: msg.value}("");
    require(sent, "Treasury transfer failed");
    _mint(msg.sender, tokenId);
}
```

### Integer Overflow Protection

- Solidity 0.8.24 provides built-in overflow checks
- All arithmetic operations revert on overflow
- No unchecked blocks used for sensitive calculations

### Gas Limits

- `executeAction` capped at 500,000 gas to prevent griefing
- Batch operations (e.g., `incrementMultiple`) limited to 100 iterations

### Commit-Reveal Scheme

The fusion system uses commit-reveal to prevent front-running:

```solidity
// Commit Phase (Block N)
commitHash = keccak256(parentA, parentB, salt, block.number, msg.sender, mode)

// Reveal Phase (Block N+1 to N+256)
// - Must wait at least 1 block
// - commitBlockHash is only available for 256 blocks
// - Deterministic seed from block hash prevents manipulation
```

**Security Properties:**
1. **Unpredictable**: Block hash unknown at commit time
2. **Verifiable**: Anyone can verify the reveal matches commit
3. **Time-bounded**: 256 block window prevents indefinite delays
4. **Front-run resistant**: Attackers can't predict outcomes

### Merkle Allowlist

Allowlist verification uses OpenZeppelin's MerkleProof:

```solidity
bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(msg.sender, amount))));
require(MerkleProof.verify(proof, allowlistRoot, leaf), "Invalid proof");
```

**Security Properties:**
- Double-hashing prevents second preimage attacks
- Standard implementation from audited library
- Root can only be set by contract owner

## Fee Security

### Treasury Forwarding

All fees are forwarded directly to treasury, never stored in contracts:

```solidity
// In KinForgeAgent
(bool sent, ) = treasury.call{value: msg.value}("");
require(sent, "Treasury transfer failed");

// In FusionCore
uint256 excess = msg.value - totalFee;
if (excess > 0) {
    (bool refunded, ) = payable(msg.sender).call{value: excess}("");
    require(refunded, "Refund failed");
}
(bool sent, ) = treasury.call{value: totalFee}("");
require(sent, "Treasury transfer failed");
```

### Fee Calculation

Fusion fees are tiered based on verifiable on-chain data:

```solidity
function getFusionFee(uint256 parentA, uint256 parentB) public view returns (
    uint256 totalFee,
    uint256 baseAmount,
    uint256 rareAmount,
    uint256 mythicAmount
) {
    baseAmount = baseFee;

    // Rare surcharge if either parent is Rare+
    uint8 rarityA = agentContract.getRarityTier(parentA);
    uint8 rarityB = agentContract.getRarityTier(parentB);
    if (rarityA >= 3 || rarityB >= 3) {
        rareAmount = rareSurcharge;
    }

    // Mythic attempt surcharge based on house combination
    uint8 houseA = agentContract.getHouseId(parentA);
    uint8 houseB = agentContract.getHouseId(parentB);
    if (mythicEligibleHouses[houseA][houseB]) {
        mythicAmount = mythicAttemptSurcharge;
    }

    totalFee = baseAmount + rareAmount + mythicAmount;
}
```

## Vault Service Security

### Hash Integrity

Vault data integrity is cryptographically verified:

```typescript
// Deterministic serialization
const stable = stableStringify(vaultJson);

// Hash computation
const vaultHash = keccak256(toUtf8Bytes(stable));
const learningRoot = keccak256(concat([vaultHash, keccak256(summary)]));
```

**Properties:**
- `stableStringify` ensures consistent key ordering
- Any tampering changes the hash
- On-chain hash can verify off-chain data

### Database Security

SQLite vault storage:
- Parameterized queries prevent SQL injection
- Database file permissions restrict access
- Regular backup recommendations in deployment

### API Security

Recommended production configurations:
- Rate limiting on all endpoints
- CORS restricted to known origins
- HTTPS enforcement
- Request size limits
- Input validation on all parameters

## Threat Model

### Threat: Front-Running Fusion

**Attack Vector:** Attacker observes pending fusion transaction and submits their own to steal favorable outcome.

**Mitigation:** Commit-reveal scheme. Attacker cannot predict block hash at commit time, making outcome unpredictable.

### Threat: Merkle Proof Forgery

**Attack Vector:** Attacker generates fake merkle proof to bypass allowlist.

**Mitigation:** Cryptographic security of Merkle trees. Forging a proof requires finding a preimage, which is computationally infeasible.

### Threat: Vault Data Tampering

**Attack Vector:** Malicious actor modifies off-chain vault data.

**Mitigation:** On-chain vaultHash allows anyone to verify data integrity. Tampering is detectable.

### Threat: Reentrancy Attack

**Attack Vector:** Malicious contract re-enters during external call to manipulate state.

**Mitigation:** Checks-effects-interactions pattern. State changes complete before external calls.

### Threat: Gas Griefing via executeAction

**Attack Vector:** Attacker configures logic contract that consumes excessive gas.

**Mitigation:** 500,000 gas cap on delegated calls. Attacker's own gas is consumed.

### Threat: Oracle Manipulation

**Attack Vector:** Not applicable - KinForge doesn't use external oracles for pricing or randomness.

**Mitigation:** Block hash provides sufficient randomness for trait generation. No price oracles used.

### Threat: Flash Loan Attack

**Attack Vector:** Not applicable - No collateral or lending mechanics.

**Mitigation:** None needed.

## Audit Recommendations

Before mainnet deployment:

1. **Professional Audit**: Engage a reputable firm (e.g., OpenZeppelin, Trail of Bits)
2. **Bug Bounty**: Establish program with competitive rewards
3. **Formal Verification**: Consider for critical functions
4. **Testnet Period**: Extended testing on BSC testnet
5. **Gradual Rollout**: Start with limited supply, expand after verification

## Emergency Procedures

### Contract Pause

If critical vulnerability discovered:

1. Contract owner can pause minting via phase configuration
2. FusionCore can be disconnected by deploying new instance
3. Individual agents can be paused by owners

### Upgrade Path

KinForge uses non-upgradeable contracts for immutability. If upgrade needed:

1. Deploy new contract version
2. Snapshot existing state
3. Enable migration to new contract
4. Deprecate old contract

### Stuck Funds Recovery

Only for truly stuck tokens (sent by mistake):

```solidity
function withdrawStuckTokens(address token, uint256 amount) external onlyOwner {
    // Cannot withdraw native BNB to prevent treasury theft
    require(token != address(0), "Use treasury for BNB");
    IERC20(token).transfer(treasury, amount);
}
```

## Security Checklist

### Pre-Deployment

- [ ] All tests passing
- [ ] No compiler warnings
- [ ] Static analysis clean (Slither)
- [ ] Gas optimization review
- [ ] Access control audit
- [ ] Reentrancy review
- [ ] Integer overflow review

### Deployment

- [ ] Verify contract source on BSCScan
- [ ] Confirm treasury address
- [ ] Set correct phase timestamps
- [ ] Verify merkle root
- [ ] Test mint flow on mainnet with small amount

### Post-Deployment

- [ ] Monitor contract events
- [ ] Set up alerting for unusual activity
- [ ] Document admin procedures
- [ ] Establish incident response plan
