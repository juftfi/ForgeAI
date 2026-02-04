// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DemoLogic
 * @notice A demonstration logic contract for BAP-578 executeAction functionality
 * @dev This contract shows how agent logic can be delegated to external contracts
 *      It implements a simple counter that can be incremented via executeAction
 */
contract DemoLogic {
    // =============================================================
    //                            STORAGE
    // =============================================================

    /// @notice Counter per agent (tokenId -> counter value)
    mapping(uint256 => uint256) public counters;

    /// @notice Last action timestamp per agent
    mapping(uint256 => uint256) public lastActions;

    /// @notice Message log per agent (most recent only)
    mapping(uint256 => string) public lastMessages;

    // =============================================================
    //                           EVENTS
    // =============================================================

    event CounterIncremented(uint256 indexed tokenId, uint256 newValue);
    event MessageLogged(uint256 indexed tokenId, string message);
    event ActionPerformed(uint256 indexed tokenId, bytes4 selector, bytes data);

    // =============================================================
    //                     ACTION FUNCTIONS
    // =============================================================

    /**
     * @notice Increment the counter for an agent
     * @param tokenId The agent's token ID
     * @return newValue The new counter value
     */
    function incrementCounter(uint256 tokenId) external returns (uint256 newValue) {
        counters[tokenId]++;
        lastActions[tokenId] = block.timestamp;
        newValue = counters[tokenId];

        emit CounterIncremented(tokenId, newValue);
        emit ActionPerformed(tokenId, this.incrementCounter.selector, abi.encode(tokenId));

        return newValue;
    }

    /**
     * @notice Log a message for an agent
     * @param tokenId The agent's token ID
     * @param message The message to log
     */
    function logMessage(uint256 tokenId, string calldata message) external {
        lastMessages[tokenId] = message;
        lastActions[tokenId] = block.timestamp;

        emit MessageLogged(tokenId, message);
        emit ActionPerformed(tokenId, this.logMessage.selector, abi.encode(tokenId, message));
    }

    /**
     * @notice Perform multiple increments atomically
     * @param tokenId The agent's token ID
     * @param times Number of times to increment
     * @return newValue The final counter value
     */
    function incrementMultiple(uint256 tokenId, uint256 times) external returns (uint256 newValue) {
        require(times > 0 && times <= 100, "Invalid increment count");

        counters[tokenId] += times;
        lastActions[tokenId] = block.timestamp;
        newValue = counters[tokenId];

        emit CounterIncremented(tokenId, newValue);
        emit ActionPerformed(tokenId, this.incrementMultiple.selector, abi.encode(tokenId, times));

        return newValue;
    }

    /**
     * @notice Reset the counter for an agent
     * @param tokenId The agent's token ID
     */
    function resetCounter(uint256 tokenId) external {
        counters[tokenId] = 0;
        lastActions[tokenId] = block.timestamp;

        emit CounterIncremented(tokenId, 0);
        emit ActionPerformed(tokenId, this.resetCounter.selector, abi.encode(tokenId));
    }

    // =============================================================
    //                     VIEW FUNCTIONS
    // =============================================================

    /**
     * @notice Get the current counter value for an agent
     * @param tokenId The agent's token ID
     * @return Current counter value
     */
    function getCounter(uint256 tokenId) external view returns (uint256) {
        return counters[tokenId];
    }

    /**
     * @notice Get the last action timestamp for an agent
     * @param tokenId The agent's token ID
     * @return Timestamp of last action
     */
    function getLastAction(uint256 tokenId) external view returns (uint256) {
        return lastActions[tokenId];
    }

    /**
     * @notice Get the last message logged by an agent
     * @param tokenId The agent's token ID
     * @return Last message string
     */
    function getLastMessage(uint256 tokenId) external view returns (string memory) {
        return lastMessages[tokenId];
    }

    /**
     * @notice Get agent statistics
     * @param tokenId The agent's token ID
     * @return counter Current counter value
     * @return lastAction Last action timestamp
     * @return message Last message
     */
    function getStats(uint256 tokenId) external view returns (
        uint256 counter,
        uint256 lastAction,
        string memory message
    ) {
        return (counters[tokenId], lastActions[tokenId], lastMessages[tokenId]);
    }
}
