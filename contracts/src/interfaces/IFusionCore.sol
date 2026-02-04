// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IFusionCore
 * @notice Interface for the HouseForge Fusion contract
 */
interface IFusionCore {
    // Enums
    enum FusionMode {
        BURN_TO_MINT,  // Burns both parents, mints offspring
        SEAL           // Seals both parents (cannot be used again), mints offspring
    }

    // Structs
    struct Commit {
        bytes32 commitHash;
        uint256 commitBlock;
        bool revealed;
        FusionMode mode;
    }

    // Events
    event FusionCommitted(
        address indexed owner,
        uint256 indexed parentA,
        uint256 indexed parentB,
        bytes32 commitHash,
        FusionMode mode
    );

    event FusionRevealed(
        address indexed owner,
        uint256 indexed parentA,
        uint256 indexed parentB,
        uint256 offspringId,
        FusionMode mode
    );

    event FusionCancelled(
        address indexed owner,
        uint256 indexed parentA,
        uint256 indexed parentB
    );

    // View functions
    function getCommit(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (Commit memory);

    function hasActiveCommit(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (bool);

    function getCommitBlockHash(
        address owner,
        uint256 parentA,
        uint256 parentB
    ) external view returns (bytes32);

    // Commit function
    function commitFusion(
        uint256 parentA,
        uint256 parentB,
        bytes32 commitHash,
        FusionMode mode
    ) external;

    // Reveal function
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
    ) external payable returns (uint256);

    // Cancel function (only before reveal, after timeout)
    function cancelFusion(
        uint256 parentA,
        uint256 parentB
    ) external;
}
