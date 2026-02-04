// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IHouseForgeAgent
 * @notice Interface for the HouseForge Agent NFT contract
 */
interface IHouseForgeAgent {
    // Enums
    enum Status {
        Active,
        Paused,
        Terminated
    }

    // Structs
    struct State {
        uint256 balance;
        Status status;
        address owner;
        address logicAddress;
        uint256 lastActionTimestamp;
    }

    struct AgentMetadata {
        string persona;           // JSON string containing persona vector
        string experience;        // Experience/generation info string
        string voiceHash;         // Optional voice hash
        string animationURI;      // Optional animation URI
        string vaultURI;          // URI to off-chain vault
        bytes32 vaultHash;        // Hash of vault contents
    }

    struct Lineage {
        uint256 parent1;          // Token ID of first parent (0 for genesis)
        uint256 parent2;          // Token ID of second parent (0 for genesis)
        uint256 generation;       // Generation number (0 for genesis)
        uint8 houseId;            // House ID (1-7)
        bool isSealed;            // Whether this agent is sealed (cannot be used in fusion)
    }

    // Events
    event GenesisMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint8 houseId,
        bytes32 traitsHash
    );

    event OffspringMinted(
        uint256 indexed tokenId,
        address indexed to,
        uint256 indexed parent1,
        uint256 parent2,
        uint8 houseId,
        uint256 generation
    );

    event LearningUpdated(
        uint256 indexed tokenId,
        bytes32 newLearningRoot,
        uint256 newVersion
    );

    event Sealed(uint256 indexed tokenId);

    event Burned(uint256 indexed tokenId);

    event StatusChanged(uint256 indexed tokenId, Status newStatus);

    event ActionExecuted(uint256 indexed tokenId, bytes result);
    event LogicUpgraded(uint256 indexed tokenId, address oldLogic, address newLogic);
    event AgentFunded(uint256 indexed tokenId, address indexed funder, uint256 amount);
    event MetadataUpdated(uint256 indexed tokenId, string metadataURI);

    event VaultUpdated(
        uint256 indexed tokenId,
        string newVaultURI,
        bytes32 newVaultHash
    );

    // View functions
    function getMetadata(uint256 tokenId) external view returns (AgentMetadata memory);
    function getLineage(uint256 tokenId) external view returns (Lineage memory);
    function isSealed(uint256 tokenId) external view returns (bool);
    function getGeneration(uint256 tokenId) external view returns (uint256);
    function getHouseId(uint256 tokenId) external view returns (uint8);
    function getRarityTier(uint256 tokenId) external view returns (uint8);

    // Minting functions
    function mintGenesis(
        address to,
        uint8 houseId,
        string calldata persona,
        string calldata experience,
        string calldata vaultURI,
        bytes32 vaultHash,
        bytes32 learningRoot,
        bytes32 traitsHash,
        uint8 rarityTier
    ) external returns (uint256);

    function mintOffspring(
        address to,
        uint256 parent1,
        uint256 parent2,
        uint8 houseId,
        string calldata persona,
        string calldata experience,
        string calldata vaultURI,
        bytes32 vaultHash,
        bytes32 learningRoot,
        bytes32 traitsHash,
        uint8 rarityTier
    ) external returns (uint256);

    // Update functions
    function updateLearning(
        uint256 tokenId,
        string calldata newVaultURI,
        bytes32 newVaultHash,
        bytes32 newLearningRoot,
        uint256 newVersion
    ) external;

    // Fusion-related functions
    function seal(uint256 tokenId) external;
    function burn(uint256 tokenId) external;
}
