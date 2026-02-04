// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IHouseForgeAgent.sol";

/**
 * @title HouseForgeAgent
 * @notice ERC-721 NFT contract for HouseForge Agents
 * @dev Implements tradable agents with on-chain lineage and learning
 */
contract HouseForgeAgent is IHouseForgeAgent {
    // =============================================================
    //                           CONSTANTS
    // =============================================================

    string public constant name = "HouseForge Agent";
    string public constant symbol = "HFAGENT";
    uint8 public constant MIN_HOUSE_ID = 1;
    uint8 public constant MAX_HOUSE_ID = 7;
    uint256 public constant MAX_GAS_FOR_ACTION = 500_000;

    // =============================================================
    //                            STORAGE
    // =============================================================

    // Token counter
    uint256 private _tokenIdCounter;

    // Owner -> token count
    mapping(address => uint256) private _balances;

    // Token ID -> owner
    mapping(uint256 => address) private _owners;

    // Token ID -> approved address
    mapping(uint256 => address) private _tokenApprovals;

    // Owner -> operator -> approved
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    // BAP-578: Token ID -> Agent state
    mapping(uint256 => uint256) private _agentBalances;
    mapping(uint256 => Status) private _agentStatus;
    mapping(uint256 => address) private _logicAddresses;
    mapping(uint256 => uint256) private _lastActionTimestamps;

    // BAP-578: Token ID -> Agent metadata
    mapping(uint256 => AgentMetadata) private _agentMetadata;

    // BAP-578: Token ID -> Learning state
    mapping(uint256 => bytes32) private _learningRoots;
    mapping(uint256 => uint256) private _learningVersions;
    mapping(uint256 => uint256) private _lastLearningUpdates;
    mapping(uint256 => bool) private _learningEnabled;

    // Token ID -> lineage
    mapping(uint256 => Lineage) private _lineage;

    // Token ID -> rarity tier (0=Common, 1=Uncommon, 2=Rare, 3=Epic, 4=Mythic)
    mapping(uint256 => uint8) private _rarityTiers;

    // Token ID -> traits hash
    mapping(uint256 => bytes32) private _traitsHashes;

    // Role addresses
    address public minter;
    address public fusionCore;
    address public learningUpdater;
    address public admin;
    address public treasury;

    // Base URI for token metadata
    string private _baseTokenURI;

    // Mint configuration
    uint256 public allowlistPrice;
    uint256 public publicPrice;
    uint256 public perWalletLimit;
    bytes32 public allowlistMerkleRoot;
    bool public allowlistActive;
    bool public publicMintActive;

    // Wallet mint counts
    mapping(address => uint256) private _mintCounts;

    // =============================================================
    //                           MODIFIERS
    // =============================================================

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyMinter() {
        require(msg.sender == minter || msg.sender == admin, "Not minter");
        _;
    }

    modifier onlyFusionCore() {
        require(msg.sender == fusionCore, "Not fusion core");
        _;
    }

    modifier onlyLearningUpdater() {
        require(msg.sender == learningUpdater || msg.sender == admin, "Not learning updater");
        _;
    }

    modifier tokenExists(uint256 tokenId) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        _;
    }

    modifier onlyTokenOwnerOrApproved(uint256 tokenId) {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _;
    }

    modifier whenActive(uint256 tokenId) {
        require(_agentStatus[tokenId] == Status.Active, "Agent not active");
        _;
    }

    modifier whenNotTerminated(uint256 tokenId) {
        require(_agentStatus[tokenId] != Status.Terminated, "Agent terminated");
        _;
    }

    // =============================================================
    //                         CONSTRUCTOR
    // =============================================================

    constructor(address _admin, address _treasury) {
        admin = _admin;
        minter = _admin;
        learningUpdater = _admin;
        treasury = _treasury != address(0) ? _treasury : _admin;

        // Default prices (can be updated)
        allowlistPrice = 0.005 ether;
        publicPrice = 0.01 ether;
        perWalletLimit = 3;
    }

    // =============================================================
    //                      ADMIN FUNCTIONS
    // =============================================================

    function setMinter(address _minter) external onlyAdmin {
        minter = _minter;
    }

    function setFusionCore(address _fusionCore) external onlyAdmin {
        fusionCore = _fusionCore;
    }

    function setLearningUpdater(address _learningUpdater) external onlyAdmin {
        learningUpdater = _learningUpdater;
    }

    function setTreasury(address _treasury) external onlyAdmin {
        require(_treasury != address(0), "Zero address");
        treasury = _treasury;
    }

    function setBaseURI(string calldata baseURI) external onlyAdmin {
        _baseTokenURI = baseURI;
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Zero address");
        admin = newAdmin;
    }

    function setMintConfig(
        uint256 _allowlistPrice,
        uint256 _publicPrice,
        uint256 _perWalletLimit,
        bytes32 _merkleRoot
    ) external onlyAdmin {
        allowlistPrice = _allowlistPrice;
        publicPrice = _publicPrice;
        perWalletLimit = _perWalletLimit;
        allowlistMerkleRoot = _merkleRoot;
    }

    function setAllowlistActive(bool active) external onlyAdmin {
        allowlistActive = active;
    }

    function setPublicMintActive(bool active) external onlyAdmin {
        publicMintActive = active;
    }

    // =============================================================
    //                  BAP-578 CORE FUNCTIONS
    // =============================================================

    /**
     * @notice Implements BAP-578 core function
     */
    function executeAction(uint256 tokenId, bytes calldata data)
        external
        tokenExists(tokenId)
        whenActive(tokenId)
        returns (bytes memory result)
    {
        address logic = _logicAddresses[tokenId];
        require(logic != address(0), "No logic address set");

        // Call logic contract with gas limit
        (bool success, bytes memory returnData) = logic.call{gas: MAX_GAS_FOR_ACTION}(data);
        require(success, "Action execution failed");

        _lastActionTimestamps[tokenId] = block.timestamp;

        emit ActionExecuted(tokenId, returnData);
        return returnData;
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function setLogicAddress(uint256 tokenId, address newLogic)
        external
        tokenExists(tokenId)
        onlyTokenOwnerOrApproved(tokenId)
        whenNotTerminated(tokenId)
    {
        address oldLogic = _logicAddresses[tokenId];
        _logicAddresses[tokenId] = newLogic;
        emit LogicUpgraded(tokenId, oldLogic, newLogic);
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function fundAgent(uint256 tokenId) external payable tokenExists(tokenId) {
        require(msg.value > 0, "No value sent");
        _agentBalances[tokenId] += msg.value;
        emit AgentFunded(tokenId, msg.sender, msg.value);
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function pause(uint256 tokenId)
        external
        tokenExists(tokenId)
        onlyTokenOwnerOrApproved(tokenId)
    {
        require(_agentStatus[tokenId] == Status.Active, "Not active");
        _agentStatus[tokenId] = Status.Paused;
        emit StatusChanged(tokenId, Status.Paused);
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function unpause(uint256 tokenId)
        external
        tokenExists(tokenId)
        onlyTokenOwnerOrApproved(tokenId)
    {
        require(_agentStatus[tokenId] == Status.Paused, "Not paused");
        _agentStatus[tokenId] = Status.Active;
        emit StatusChanged(tokenId, Status.Active);
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function terminate(uint256 tokenId)
        external
        tokenExists(tokenId)
        onlyTokenOwnerOrApproved(tokenId)
    {
        require(_agentStatus[tokenId] != Status.Terminated, "Already terminated");
        _agentStatus[tokenId] = Status.Terminated;
        emit StatusChanged(tokenId, Status.Terminated);
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function getState(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (State memory state)
    {
        return State({
            balance: _agentBalances[tokenId],
            status: _agentStatus[tokenId],
            owner: _owners[tokenId],
            logicAddress: _logicAddresses[tokenId],
            lastActionTimestamp: _lastActionTimestamps[tokenId]
        });
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function getAgentMetadata(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (AgentMetadata memory metadata)
    {
        return _agentMetadata[tokenId];
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function updateAgentMetadata(uint256 tokenId, AgentMetadata calldata metadata)
        external
        tokenExists(tokenId)
        onlyTokenOwnerOrApproved(tokenId)
        whenNotTerminated(tokenId)
    {
        _agentMetadata[tokenId] = metadata;
        emit MetadataUpdated(tokenId, metadata.vaultURI);
    }

    // =============================================================
    //                  LEARNING FUNCTIONS
    // =============================================================

    /**
     * @notice Implements BAP-578 core function
     */
    function getLearningRoot(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (bytes32)
    {
        return _learningRoots[tokenId];
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function isLearningEnabled(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (bool)
    {
        return _learningEnabled[tokenId];
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function getLearningVersion(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (uint256)
    {
        return _learningVersions[tokenId];
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function getLastLearningUpdate(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (uint256)
    {
        return _lastLearningUpdates[tokenId];
    }

    /**
     * @notice Implements BAP-578 core function
     */
    function updateLearning(
        uint256 tokenId,
        string calldata newVaultURI,
        bytes32 newVaultHash,
        bytes32 newLearningRoot,
        uint256 newVersion
    )
        external
        onlyLearningUpdater
        tokenExists(tokenId)
        whenNotTerminated(tokenId)
    {
        require(newVersion > _learningVersions[tokenId], "Version must increase");
        require(_learningEnabled[tokenId], "Learning not enabled");

        bytes32 oldRoot = _learningRoots[tokenId];

        _agentMetadata[tokenId].vaultURI = newVaultURI;
        _agentMetadata[tokenId].vaultHash = newVaultHash;
        _learningRoots[tokenId] = newLearningRoot;
        _learningVersions[tokenId] = newVersion;
        _lastLearningUpdates[tokenId] = block.timestamp;

        emit LearningUpdated(tokenId, newLearningRoot, newVersion);
    }

    // =============================================================
    //                       VIEW FUNCTIONS
    // =============================================================

    function getMetadata(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (AgentMetadata memory)
    {
        return _agentMetadata[tokenId];
    }

    function getLineage(uint256 tokenId)
        external
        view
        tokenExists(tokenId)
        returns (Lineage memory)
    {
        return _lineage[tokenId];
    }

    function isSealed(uint256 tokenId) external view tokenExists(tokenId) returns (bool) {
        return _lineage[tokenId].isSealed;
    }

    function getGeneration(uint256 tokenId) external view tokenExists(tokenId) returns (uint256) {
        return _lineage[tokenId].generation;
    }

    function getHouseId(uint256 tokenId) external view tokenExists(tokenId) returns (uint8) {
        return _lineage[tokenId].houseId;
    }

    function getRarityTier(uint256 tokenId) external view tokenExists(tokenId) returns (uint8) {
        return _rarityTiers[tokenId];
    }

    function getTraitsHash(uint256 tokenId) external view tokenExists(tokenId) returns (bytes32) {
        return _traitsHashes[tokenId];
    }

    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function getMintCount(address wallet) external view returns (uint256) {
        return _mintCounts[wallet];
    }

    // =============================================================
    //                      ERC-721 FUNCTIONS
    // =============================================================

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function tokenURI(uint256 tokenId) external view tokenExists(tokenId) returns (string memory) {
        string memory baseURI = _baseTokenURI;
        if (bytes(baseURI).length > 0) {
            return string(abi.encodePacked(baseURI, _toString(tokenId), ".json"));
        }
        return _agentMetadata[tokenId].vaultURI;
    }

    function approve(address to, uint256 tokenId) external {
        address owner = ownerOf(tokenId);
        require(to != owner, "Approval to owner");
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view tokenExists(tokenId) returns (address) {
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) external {
        require(operator != msg.sender, "Approve to self");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(!_lineage[tokenId].isSealed, "Token is sealed");
        // Allow transfer even if paused (per BAP-578)
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) external {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        require(!_lineage[tokenId].isSealed, "Token is sealed");
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "Non-ERC721Receiver");
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 // ERC165
            || interfaceId == 0x80ac58cd // ERC721
            || interfaceId == 0x5b5e139f; // ERC721Metadata
    }

    // =============================================================
    //                      MINTING FUNCTIONS
    // =============================================================

    /**
     * @notice Public mint for genesis tokens with payment
     */
    function mintGenesisPublic(
        uint8 houseId,
        string calldata persona,
        string calldata experience,
        string calldata vaultURI,
        bytes32 vaultHash,
        bytes32 learningRoot,
        bytes32 traitsHash,
        uint8 rarityTier,
        bytes32[] calldata merkleProof
    ) external payable returns (uint256) {
        require(houseId >= MIN_HOUSE_ID && houseId <= MAX_HOUSE_ID, "Invalid house");
        require(_mintCounts[msg.sender] < perWalletLimit, "Wallet limit reached");

        uint256 price;
        if (allowlistActive && merkleProof.length > 0) {
            require(_verifyAllowlist(msg.sender, merkleProof), "Not on allowlist");
            price = allowlistPrice;
        } else {
            require(publicMintActive, "Public mint not active");
            price = publicPrice;
        }

        require(msg.value >= price, "Insufficient payment");

        // Forward funds to treasury
        _forwardToTreasury(msg.value);

        _mintCounts[msg.sender]++;

        return _mintGenesisInternal(
            msg.sender,
            houseId,
            persona,
            experience,
            vaultURI,
            vaultHash,
            learningRoot,
            traitsHash,
            rarityTier
        );
    }

    /**
     * @notice Admin mint for genesis tokens (no payment required)
     */
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
    ) external onlyMinter returns (uint256) {
        return _mintGenesisInternal(
            to,
            houseId,
            persona,
            experience,
            vaultURI,
            vaultHash,
            learningRoot,
            traitsHash,
            rarityTier
        );
    }

    function _mintGenesisInternal(
        address to,
        uint8 houseId,
        string calldata persona,
        string calldata experience,
        string calldata vaultURI,
        bytes32 vaultHash,
        bytes32 learningRoot,
        bytes32 traitsHash,
        uint8 rarityTier
    ) internal returns (uint256) {
        require(to != address(0), "Zero address");
        require(houseId >= MIN_HOUSE_ID && houseId <= MAX_HOUSE_ID, "Invalid house");

        uint256 tokenId = ++_tokenIdCounter;

        _mint(to, tokenId);

        // Initialize BAP-578 state
        _agentStatus[tokenId] = Status.Active;
        _agentMetadata[tokenId] = AgentMetadata({
            persona: persona,
            experience: experience,
            voiceHash: "",
            animationURI: "",
            vaultURI: vaultURI,
            vaultHash: vaultHash
        });

        // Initialize learning state
        _learningRoots[tokenId] = learningRoot;
        _learningVersions[tokenId] = 1;
        _lastLearningUpdates[tokenId] = block.timestamp;
        _learningEnabled[tokenId] = true;

        // Initialize lineage
        _lineage[tokenId] = Lineage({
            parent1: 0,
            parent2: 0,
            generation: 0,
            houseId: houseId,
            isSealed: false
        });

        // Store rarity and traits
        _rarityTiers[tokenId] = rarityTier;
        _traitsHashes[tokenId] = traitsHash;

        emit GenesisMinted(tokenId, to, houseId, traitsHash);

        return tokenId;
    }

    /**
     * @notice Mint offspring through fusion
     */
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
    ) external onlyFusionCore returns (uint256) {
        require(to != address(0), "Zero address");
        require(houseId >= MIN_HOUSE_ID && houseId <= MAX_HOUSE_ID, "Invalid house");
        require(_owners[parent1] != address(0), "Parent1 does not exist");
        require(_owners[parent2] != address(0), "Parent2 does not exist");

        uint256 tokenId = ++_tokenIdCounter;
        uint256 gen1 = _lineage[parent1].generation;
        uint256 gen2 = _lineage[parent2].generation;
        uint256 newGeneration = (gen1 > gen2 ? gen1 : gen2) + 1;

        _mint(to, tokenId);

        // Initialize BAP-578 state
        _agentStatus[tokenId] = Status.Active;
        _agentMetadata[tokenId] = AgentMetadata({
            persona: persona,
            experience: experience,
            voiceHash: "",
            animationURI: "",
            vaultURI: vaultURI,
            vaultHash: vaultHash
        });

        // Initialize learning state
        _learningRoots[tokenId] = learningRoot;
        _learningVersions[tokenId] = 1;
        _lastLearningUpdates[tokenId] = block.timestamp;
        _learningEnabled[tokenId] = true;

        // Initialize lineage
        _lineage[tokenId] = Lineage({
            parent1: parent1,
            parent2: parent2,
            generation: newGeneration,
            houseId: houseId,
            isSealed: false
        });

        // Store rarity and traits
        _rarityTiers[tokenId] = rarityTier;
        _traitsHashes[tokenId] = traitsHash;

        emit OffspringMinted(tokenId, to, parent1, parent2, houseId, newGeneration);

        return tokenId;
    }

    // =============================================================
    //                    FUSION FUNCTIONS
    // =============================================================

    function seal(uint256 tokenId) external onlyFusionCore tokenExists(tokenId) {
        require(!_lineage[tokenId].isSealed, "Already sealed");
        require(_agentStatus[tokenId] == Status.Active, "Not active");
        _lineage[tokenId].isSealed = true;
        emit Sealed(tokenId);
    }

    function burn(uint256 tokenId) external onlyFusionCore tokenExists(tokenId) {
        require(_agentStatus[tokenId] == Status.Active, "Not active");

        address owner = _owners[tokenId];

        // Clear approvals
        delete _tokenApprovals[tokenId];

        _balances[owner]--;
        delete _owners[tokenId];
        delete _agentMetadata[tokenId];
        delete _lineage[tokenId];
        delete _agentStatus[tokenId];
        delete _learningRoots[tokenId];
        delete _learningVersions[tokenId];
        delete _learningEnabled[tokenId];
        delete _rarityTiers[tokenId];
        delete _traitsHashes[tokenId];

        emit Burned(tokenId);
        emit Transfer(owner, address(0), tokenId);
    }

    // =============================================================
    //                    INTERNAL FUNCTIONS
    // =============================================================

    function _mint(address to, uint256 tokenId) internal {
        _balances[to]++;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Not owner");
        require(to != address(0), "Zero address");

        delete _tokenApprovals[tokenId];

        _balances[from]--;
        _balances[to]++;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return (spender == owner || getApproved(tokenId) == spender || isApprovedForAll(owner, spender));
    }

    function _checkOnERC721Received(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) private returns (bool) {
        if (to.code.length == 0) {
            return true;
        }
        try IERC721Receiver(to).onERC721Received(msg.sender, from, tokenId, data) returns (bytes4 retval) {
            return retval == IERC721Receiver.onERC721Received.selector;
        } catch {
            return false;
        }
    }

    function _verifyAllowlist(address account, bytes32[] calldata proof) internal view returns (bool) {
        bytes32 leaf = keccak256(abi.encodePacked(account));
        return _verifyMerkleProof(proof, allowlistMerkleRoot, leaf);
    }

    function _verifyMerkleProof(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 computedHash = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 proofElement = proof[i];
            if (computedHash <= proofElement) {
                computedHash = keccak256(abi.encodePacked(computedHash, proofElement));
            } else {
                computedHash = keccak256(abi.encodePacked(proofElement, computedHash));
            }
        }
        return computedHash == root;
    }

    function _forwardToTreasury(uint256 amount) internal {
        (bool success, ) = treasury.call{value: amount}("");
        require(success, "Treasury transfer failed");
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    // =============================================================
    //                          EVENTS
    // =============================================================

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
}

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}
