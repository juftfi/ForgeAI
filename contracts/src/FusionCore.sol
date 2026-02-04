// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IFusionCore.sol";
import "./interfaces/IHouseForgeAgent.sol";

/**
 * @title FusionCore
 * @notice Handles the commit-reveal fusion mechanism for breeding HouseForge Agents
 * @dev Uses commit-reveal to ensure fair, deterministic, and reproducible trait generation
 *      Implements tiered fee structure based on rarity and mythic attempt eligibility
 */
contract FusionCore is IFusionCore {
    // =============================================================
    //                           CONSTANTS
    // =============================================================

    /// @notice Minimum blocks between commit and reveal (prevents same-block manipulation)
    uint256 public constant MIN_REVEAL_DELAY = 1;

    /// @notice Maximum blocks to wait before commit expires (allows cancellation)
    uint256 public constant MAX_COMMIT_AGE = 256; // ~1 hour on BSC

    /// @notice Rarity tier threshold for rare surcharge (Rare = 2)
    uint8 public constant RARE_THRESHOLD = 2;

    /// @notice Minimum generation for mythic eligibility
    uint256 public constant MYTHIC_MIN_GENERATION = 2;

    // =============================================================
    //                            STORAGE
    // =============================================================

    /// @notice Reference to the HouseForge Agent NFT contract
    IHouseForgeAgent public agentContract;

    /// @notice Admin address
    address public admin;

    /// @notice Treasury address for fee collection
    address public treasury;

    /// @notice Base fusion fee in wei
    uint256 public baseFee;

    /// @notice Additional fee for rare+ parents
    uint256 public rareSurcharge;

    /// @notice Additional fee for mythic attempt eligibility
    uint256 public mythicAttemptSurcharge;

    /// @notice Mapping of (owner, parentA, parentB) -> Commit
    mapping(bytes32 => Commit) private _commits;

    /// @notice House combinations that enable mythic attempts
    /// @dev houseA (sorted) -> houseB -> enabled
    mapping(uint8 => mapping(uint8 => bool)) public mythicEligibleHouses;

    /// @notice Whether the contract is paused
    bool public paused;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event FeesCollected(
        address indexed from,
        uint256 baseFee,
        uint256 rareSurcharge,
        uint256 mythicSurcharge,
        uint256 totalFee
    );

    event FeeConfigUpdated(
        uint256 baseFee,
        uint256 rareSurcharge,
        uint256 mythicAttemptSurcharge
    );

    // =============================================================
    //                           MODIFIERS
    // =============================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier notPaused() {
        require(!paused, "Contract paused");
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _agentContract, address _admin, address _treasury) {
        agentContract = IHouseForgeAgent(_agentContract);
        admin = _admin;
        treasury = _treasury != address(0) ? _treasury : _admin;

        // Default fees (from economics.yaml)
        baseFee = 0.003 ether;
        rareSurcharge = 0.002 ether;
        mythicAttemptSurcharge = 0.003 ether;

        // Initialize mythic-eligible house combinations
        // EYE_OF_STORM: THUNDER(3) + THUNDER(3) or THUNDER(3) + MONSOON(2)
        _setMythicHouses(3, 3, true);
        _setMythicHouses(2, 3, true);

        // FROZEN_TIME: FROST(4) + FROST(4) or FROST(4) + CLEAR(1)
        _setMythicHouses(4, 4, true);
        _setMythicHouses(1, 4, true);

        // BLACK_SUN: ECLIPSE(7) + ECLIPSE(7) or ECLIPSE(7) + AURORA(5)
        _setMythicHouses(7, 7, true);
        _setMythicHouses(5, 7, true);
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function setAgentContract(address _agentContract) external onlyAdmin {
        agentContract = IHouseForgeAgent(_agentContract);
    }

    function setTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function setFees(
        uint256 _baseFee,
        uint256 _rareSurcharge,
        uint256 _mythicAttemptSurcharge
    ) external onlyAdmin {
        baseFee = _baseFee;
        rareSurcharge = _rareSurcharge;
        mythicAttemptSurcharge = _mythicAttemptSurcharge;
        emit FeeConfigUpdated(_baseFee, _rareSurcharge, _mythicAttemptSurcharge);
    }

    function setMythicEligibleHouses(
        uint8 houseA,
        uint8 houseB,
        bool eligible
    ) external onlyAdmin {
        _setMythicHouses(houseA, houseB, eligible);
    }

    function setPaused(bool _paused) external onlyAdmin {
        paused = _paused;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        admin = newAdmin;
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================

    function getCommit(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (Commit memory) {
        bytes32 key = _getCommitKey(owner, parentA, parentB);
        return _commits[key];
    }

    function hasActiveCommit(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (bool) {
        bytes32 key = _getCommitKey(owner, parentA, parentB);
        Commit storage commit = _commits[key];
        return commit.commitBlock > 0 && !commit.revealed;
    }

    function getCommitBlockHash(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (bytes32) {
        bytes32 key = _getCommitKey(owner, parentA, parentB);
        Commit storage commit = _commits[key];
        require(commit.commitBlock > 0, "No commit");

        uint256 targetBlock = commit.commitBlock + 1;

        if (block.number - targetBlock > 256) {
            revert("Commit too old");
        }

        return blockhash(targetBlock);
    }

    /**
     * @notice Calculate the fusion fee for two parents
     * @param parentA First parent token ID
     * @param parentB Second parent token ID
     * @return totalFee Total fee required
     * @return baseAmount Base fee portion
     * @return rareAmount Rare surcharge portion
     * @return mythicAmount Mythic attempt surcharge portion
     */
    function getFusionFee(
        uint256 parentA,
        uint256 parentB
    ) public view returns (
        uint256 totalFee,
        uint256 baseAmount,
        uint256 rareAmount,
        uint256 mythicAmount
    ) {
        baseAmount = baseFee;
        totalFee = baseAmount;

        // Check rarity surcharge
        uint8 rarityA = agentContract.getRarityTier(parentA);
        uint8 rarityB = agentContract.getRarityTier(parentB);

        if (rarityA >= RARE_THRESHOLD || rarityB >= RARE_THRESHOLD) {
            rareAmount = rareSurcharge;
            totalFee += rareAmount;
        }

        // Check mythic attempt eligibility
        if (_isMythicAttemptEligible(parentA, parentB)) {
            mythicAmount = mythicAttemptSurcharge;
            totalFee += mythicAmount;
        }

        return (totalFee, baseAmount, rareAmount, mythicAmount);
    }

    /**
     * @notice Check if a fusion qualifies as a mythic attempt
     * @param parentA First parent token ID
     * @param parentB Second parent token ID
     * @return eligible Whether mythic conditions are potentially met
     */
    function isMythicAttemptEligible(
        uint256 parentA,
        uint256 parentB
    ) external view returns (bool) {
        return _isMythicAttemptEligible(parentA, parentB);
    }

    // =============================================================
    //                      COMMIT FUNCTION
    // =============================================================

    /**
     * @notice Commit to a fusion operation
     * @dev commitHash = keccak256(abi.encode(parentA, parentB, salt, commitBlock, msg.sender, mode))
     */
    function commitFusion(
        uint256 parentA,
        uint256 parentB,
        bytes32 commitHash,
        FusionMode mode
    ) external notPaused {
        require(parentA != parentB, "Same parent");

        // Verify ownership
        address ownerA = _getTokenOwner(parentA);
        address ownerB = _getTokenOwner(parentB);
        require(ownerA == msg.sender, "Not owner of parentA");
        require(ownerB == msg.sender, "Not owner of parentB");

        // Verify parents are not sealed
        require(!agentContract.isSealed(parentA), "ParentA is sealed");
        require(!agentContract.isSealed(parentB), "ParentB is sealed");

        // Check for existing commit
        bytes32 key = _getCommitKey(msg.sender, parentA, parentB);
        Commit storage commit = _commits[key];
        require(commit.commitBlock == 0 || commit.revealed, "Active commit exists");

        // Store commit
        _commits[key] = Commit({
            commitHash: commitHash,
            commitBlock: block.number,
            revealed: false,
            mode: mode
        });

        emit FusionCommitted(msg.sender, parentA, parentB, commitHash, mode);
    }

    // =============================================================
    //                      REVEAL FUNCTION
    // =============================================================

    /**
     * @notice Reveal a committed fusion and mint the offspring
     * @dev Requires payment of fusion fees based on parent rarity and mythic eligibility
     */
    function revealFusion(
        uint256 parentA,
        uint256 parentB,
        bytes32 salt,
        string calldata vaultURI,
        bytes32 vaultHash,
        bytes32 learningRoot,
        string calldata offspringPersona,
        string calldata offspringExperience,
        uint8 offspringHouseId,
        bytes32 offspringTraitsHash,
        uint8 offspringRarityTier
    ) external payable notPaused returns (uint256) {
        bytes32 key = _getCommitKey(msg.sender, parentA, parentB);
        Commit storage commit = _commits[key];

        // Validate commit
        require(commit.commitBlock > 0, "No commit");
        require(!commit.revealed, "Already revealed");
        require(block.number > commit.commitBlock + MIN_REVEAL_DELAY, "Too early");
        require(block.number <= commit.commitBlock + MAX_COMMIT_AGE, "Commit expired");

        // Verify commit hash
        bytes32 expectedHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commit.commitBlock,
            msg.sender,
            commit.mode
        ));
        require(commit.commitHash == expectedHash, "Invalid reveal");

        // Re-verify ownership
        address ownerA = _getTokenOwner(parentA);
        address ownerB = _getTokenOwner(parentB);
        require(ownerA == msg.sender, "Not owner of parentA");
        require(ownerB == msg.sender, "Not owner of parentB");

        // Re-verify not sealed
        require(!agentContract.isSealed(parentA), "ParentA is sealed");
        require(!agentContract.isSealed(parentB), "ParentB is sealed");

        // Collect fees
        (uint256 totalFee, uint256 baseAmount, uint256 rareAmount, uint256 mythicAmount) =
            getFusionFee(parentA, parentB);

        require(msg.value >= totalFee, "Insufficient fee");

        // Forward fees to treasury
        if (totalFee > 0) {
            (bool success, ) = treasury.call{value: totalFee}("");
            require(success, "Fee transfer failed");
            emit FeesCollected(msg.sender, baseAmount, rareAmount, mythicAmount, totalFee);
        }

        // Refund excess
        if (msg.value > totalFee) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - totalFee}("");
            require(refundSuccess, "Refund failed");
        }

        // Mark as revealed
        commit.revealed = true;

        // Mint offspring BEFORE burn/seal (because mintOffspring checks parent existence)
        uint256 offspringId = agentContract.mintOffspring(
            msg.sender,
            parentA,
            parentB,
            offspringHouseId,
            offspringPersona,
            offspringExperience,
            vaultURI,
            vaultHash,
            learningRoot,
            offspringTraitsHash,
            offspringRarityTier
        );

        // Handle parents based on mode (after offspring is minted)
        if (commit.mode == FusionMode.BURN_TO_MINT) {
            agentContract.burn(parentA);
            agentContract.burn(parentB);
        } else {
            agentContract.seal(parentA);
            agentContract.seal(parentB);
        }

        emit FusionRevealed(msg.sender, parentA, parentB, offspringId, commit.mode);

        return offspringId;
    }

    // =============================================================
    //                      CANCEL FUNCTION
    // =============================================================

    function cancelFusion(
        uint256 parentA,
        uint256 parentB
    ) external {
        bytes32 key = _getCommitKey(msg.sender, parentA, parentB);
        Commit storage commit = _commits[key];

        require(commit.commitBlock > 0, "No commit");
        require(!commit.revealed, "Already revealed");
        require(block.number > commit.commitBlock + MAX_COMMIT_AGE, "Not expired");

        delete _commits[key];

        emit FusionCancelled(msg.sender, parentA, parentB);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    function _getCommitKey(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) internal pure returns (bytes32) {
        if (parentA > parentB) {
            (parentA, parentB) = (parentB, parentA);
        }
        return keccak256(abi.encode(owner, parentA, parentB));
    }

    function _getTokenOwner(uint256 tokenId) internal view returns (address) {
        (bool success, bytes memory data) = address(agentContract).staticcall(
            abi.encodeWithSignature("ownerOf(uint256)", tokenId)
        );
        require(success && data.length >= 32, "Token query failed");
        return abi.decode(data, (address));
    }

    function _setMythicHouses(uint8 houseA, uint8 houseB, bool eligible) internal {
        // Normalize order
        if (houseA > houseB) {
            (houseA, houseB) = (houseB, houseA);
        }
        mythicEligibleHouses[houseA][houseB] = eligible;
    }

    function _isMythicAttemptEligible(
        uint256 parentA,
        uint256 parentB
    ) internal view returns (bool) {
        // Check generation requirement
        uint256 genA = agentContract.getGeneration(parentA);
        uint256 genB = agentContract.getGeneration(parentB);
        uint256 offspringGen = (genA > genB ? genA : genB) + 1;

        if (offspringGen < MYTHIC_MIN_GENERATION) {
            return false;
        }

        // Check house combination
        uint8 houseA = agentContract.getHouseId(parentA);
        uint8 houseB = agentContract.getHouseId(parentB);

        // Normalize order
        if (houseA > houseB) {
            (houseA, houseB) = (houseB, houseA);
        }

        return mythicEligibleHouses[houseA][houseB];
    }
}
