// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IBAP578Core
 * @notice Core interface for BAP-578 compliant Non-Fungible Agents
 * @dev Defines the standard structures, events, and methods for NFA implementations
 *
 * BAP-578 specifies a standard for "Non-Fungible Agents" - tradable ERC-721 tokens
 * that represent AI agent identities with:
 * - On-chain state management (Active/Paused/Terminated)
 * - Metadata with vault references for off-chain data
 * - Learning capabilities with verifiable summaries
 * - Optional logic delegation for agent actions
 */
interface IBAP578Core {
    // =============================================================
    //                           ENUMS
    // =============================================================

    /**
     * @notice Agent lifecycle status
     * @dev Active: Normal operation, all functions available
     *      Paused: Fusion and executeAction blocked, transfers allowed
     *      Terminated: Permanently disabled, no recovery
     */
    enum Status {
        Active,
        Paused,
        Terminated
    }

    // =============================================================
    //                          STRUCTS
    // =============================================================

    /**
     * @notice Core state for an agent
     * @param balance Internal funding balance for gas/operations (can be 0)
     * @param status Current lifecycle status
     * @param owner Current owner address (derived from ERC-721)
     * @param logicAddress Address of delegated logic contract (0x0 if none)
     * @param lastActionTimestamp Timestamp of last executeAction call
     */
    struct State {
        uint256 balance;
        Status status;
        address owner;
        address logicAddress;
        uint256 lastActionTimestamp;
    }

    /**
     * @notice Metadata for an agent
     * @param persona JSON-encoded character traits and personality
     * @param experience Short role/purpose summary string
     * @param voiceHash Optional hash for voice/audio identity (empty string ok)
     * @param animationURI Optional URI for animation/avatar (empty ok)
     * @param vaultURI Off-chain vault location URL
     * @param vaultHash Integrity hash of vault contents (keccak256)
     */
    struct AgentMetadata {
        string persona;
        string experience;
        string voiceHash;
        string animationURI;
        string vaultURI;
        bytes32 vaultHash;
    }

    /**
     * @notice Learning state for an agent
     * @param learningRoot Merkle root or hash summary of learning data
     * @param learningVersion Monotonically increasing version number
     * @param lastLearningUpdate Timestamp of last learning update
     * @param learningEnabled Whether learning updates are enabled
     */
    struct LearningState {
        bytes32 learningRoot;
        uint256 learningVersion;
        uint256 lastLearningUpdate;
        bool learningEnabled;
    }

    // =============================================================
    //                          EVENTS
    // =============================================================

    /**
     * @notice Emitted when executeAction is called on an agent
     * @param agent The token ID of the agent
     * @param result The return data from the logic contract call
     */
    event ActionExecuted(uint256 indexed agent, bytes result);

    /**
     * @notice Emitted when an agent's logic address is changed
     * @param agent The token ID of the agent
     * @param oldLogic Previous logic contract address
     * @param newLogic New logic contract address
     */
    event LogicUpgraded(uint256 indexed agent, address oldLogic, address newLogic);

    /**
     * @notice Emitted when an agent receives funding
     * @param agent The token ID of the agent
     * @param funder Address that provided funds
     * @param amount Amount of native currency funded
     */
    event AgentFunded(uint256 indexed agent, address indexed funder, uint256 amount);

    /**
     * @notice Emitted when an agent's status changes
     * @param agent The token ID of the agent
     * @param newStatus The new status
     */
    event StatusChanged(uint256 indexed agent, Status newStatus);

    /**
     * @notice Emitted when agent metadata is updated
     * @param tokenId The token ID
     * @param metadataURI The new metadata URI (if applicable)
     */
    event MetadataUpdated(uint256 indexed tokenId, string metadataURI);

    /**
     * @notice Emitted when learning data is updated
     * @param tokenId The token ID
     * @param oldRoot Previous learning root
     * @param newRoot New learning root
     * @param newVersion New version number
     */
    event LearningUpdated(
        uint256 indexed tokenId,
        bytes32 oldRoot,
        bytes32 newRoot,
        uint256 newVersion
    );

    // =============================================================
    //                     CORE FUNCTIONS
    // =============================================================

    /**
     * @notice Execute an action through the agent's logic contract
     * @dev Requires status == Active and logicAddress != address(0)
     *      Updates lastActionTimestamp and emits ActionExecuted
     * @param tokenId The token ID of the agent
     * @param data Calldata to pass to the logic contract
     * @return result Return data from the logic contract
     */
    function executeAction(uint256 tokenId, bytes calldata data)
        external
        returns (bytes memory result);

    /**
     * @notice Set or update the logic contract address for an agent
     * @dev Only callable by token owner or approved
     *      Emits LogicUpgraded event
     * @param tokenId The token ID
     * @param newLogic New logic contract address (can be address(0) to disable)
     */
    function setLogicAddress(uint256 tokenId, address newLogic) external;

    /**
     * @notice Fund an agent's internal balance
     * @dev Emits AgentFunded event
     * @param tokenId The token ID to fund
     */
    function fundAgent(uint256 tokenId) external payable;

    // =============================================================
    //                    STATUS FUNCTIONS
    // =============================================================

    /**
     * @notice Pause an agent (blocks fusion and executeAction)
     * @dev Only callable by owner or approved
     * @param tokenId The token ID
     */
    function pause(uint256 tokenId) external;

    /**
     * @notice Unpause an agent (restore normal operation)
     * @dev Only callable by owner or approved
     * @param tokenId The token ID
     */
    function unpause(uint256 tokenId) external;

    /**
     * @notice Permanently terminate an agent
     * @dev Only callable by owner or approved. IRREVERSIBLE.
     * @param tokenId The token ID
     */
    function terminate(uint256 tokenId) external;

    // =============================================================
    //                    VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get the full state of an agent
     * @param tokenId The token ID
     * @return state The agent's current state
     */
    function getState(uint256 tokenId) external view returns (State memory state);

    /**
     * @notice Get the metadata of an agent
     * @param tokenId The token ID
     * @return metadata The agent's metadata
     */
    function getAgentMetadata(uint256 tokenId)
        external
        view
        returns (AgentMetadata memory metadata);

    /**
     * @notice Update agent metadata
     * @dev Only callable by owner, approved, or designated updater role
     * @param tokenId The token ID
     * @param metadata New metadata struct
     */
    function updateAgentMetadata(uint256 tokenId, AgentMetadata calldata metadata)
        external;

    // =============================================================
    //                  LEARNING FUNCTIONS
    // =============================================================

    /**
     * @notice Get the current learning root for an agent
     * @param tokenId The token ID
     * @return root The learning root hash
     */
    function getLearningRoot(uint256 tokenId) external view returns (bytes32 root);

    /**
     * @notice Check if learning is enabled for an agent
     * @param tokenId The token ID
     * @return enabled Whether learning updates are allowed
     */
    function isLearningEnabled(uint256 tokenId) external view returns (bool enabled);

    /**
     * @notice Get the learning version for an agent
     * @param tokenId The token ID
     * @return version Current learning version number
     */
    function getLearningVersion(uint256 tokenId) external view returns (uint256 version);

    /**
     * @notice Get the timestamp of the last learning update
     * @param tokenId The token ID
     * @return timestamp Last update timestamp
     */
    function getLastLearningUpdate(uint256 tokenId) external view returns (uint256 timestamp);

    /**
     * @notice Update learning data for an agent
     * @dev Only callable by authorized learning updater
     *      Emits LearningUpdated event
     * @param tokenId The token ID
     * @param newVaultURI New vault URI
     * @param newVaultHash New vault hash
     * @param newLearningRoot New learning root
     * @param newVersion New version number (must be > current)
     */
    function updateLearning(
        uint256 tokenId,
        string calldata newVaultURI,
        bytes32 newVaultHash,
        bytes32 newLearningRoot,
        uint256 newVersion
    ) external;
}
