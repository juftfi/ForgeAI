// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HouseForgeAgent.sol";
import "../src/FusionCore.sol";
import "../src/logic/DemoLogic.sol";

contract HouseForgeAgentTest is Test {
    HouseForgeAgent public agent;
    FusionCore public fusion;
    DemoLogic public demoLogic;

    address public treasury = address(100);
    address public admin = address(1);
    address public user1 = address(2);
    address public user2 = address(3);

    function setUp() public {
        vm.startPrank(admin);
        agent = new HouseForgeAgent(admin, treasury);
        fusion = new FusionCore(address(agent), admin, treasury);
        demoLogic = new DemoLogic();
        agent.setFusionCore(address(fusion));
        vm.stopPrank();
    }

    // =============================================================
    //                      GENESIS MINTING
    // =============================================================

    function test_mintGenesis() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1, // House CLEAR
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1 // Common
        );

        assertEq(tokenId, 1);
        assertEq(agent.ownerOf(tokenId), user1);
        assertEq(agent.getGeneration(tokenId), 0);
        assertEq(agent.getHouseId(tokenId), 1);
        assertFalse(agent.isSealed(tokenId));
    }

    function test_mintGenesis_invalidHouse() public {
        vm.prank(admin);
        vm.expectRevert("Invalid house");
        agent.mintGenesis(
            user1,
            0, // Invalid house
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );
    }

    function test_mintGenesis_onlyMinter() public {
        vm.prank(user1);
        vm.expectRevert("Not minter");
        agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );
    }

    // =============================================================
    //                         TRANSFERS
    // =============================================================

    function test_transfer() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(user1);
        agent.transferFrom(user1, user2, tokenId);

        assertEq(agent.ownerOf(tokenId), user2);
    }

    function test_transfer_sealed_reverts() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        // Seal the token
        vm.prank(address(fusion));
        agent.seal(tokenId);

        // Try to transfer
        vm.prank(user1);
        vm.expectRevert("Token is sealed");
        agent.transferFrom(user1, user2, tokenId);
    }

    // =============================================================
    //                      LEARNING UPDATES
    // =============================================================

    function test_updateLearning() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        bytes32 newRoot = bytes32(uint256(100));
        bytes32 newVaultHash = bytes32(uint256(101));

        // Admin is learning updater
        vm.prank(admin);
        agent.updateLearning(tokenId, "ipfs://vault/1-v2", newVaultHash, newRoot, 2);

        assertEq(agent.getLearningRoot(tokenId), newRoot);
        assertEq(agent.getLearningVersion(tokenId), 2);
    }

    // =============================================================
    //                      BAP-578: STATE MANAGEMENT
    // =============================================================

    function test_pause() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(user1);
        agent.pause(tokenId);

        IHouseForgeAgent.State memory state = agent.getState(tokenId);
        assertEq(uint(state.status), uint(IHouseForgeAgent.Status.Paused));
    }

    function test_unpause() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.startPrank(user1);
        agent.pause(tokenId);
        agent.unpause(tokenId);
        vm.stopPrank();

        IHouseForgeAgent.State memory state = agent.getState(tokenId);
        assertEq(uint(state.status), uint(IHouseForgeAgent.Status.Active));
    }

    function test_terminate() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(user1);
        agent.terminate(tokenId);

        IHouseForgeAgent.State memory state = agent.getState(tokenId);
        assertEq(uint(state.status), uint(IHouseForgeAgent.Status.Terminated));
    }

    // =============================================================
    //                BAP-578: EXECUTE ACTION
    // =============================================================

    function test_executeAction() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        // Set logic address
        vm.prank(user1);
        agent.setLogicAddress(tokenId, address(demoLogic));

        // Execute action
        bytes memory callData = abi.encodeWithSelector(
            DemoLogic.incrementCounter.selector,
            tokenId
        );

        vm.prank(user1);
        bytes memory result = agent.executeAction(tokenId, callData);

        // Decode result
        uint256 newValue = abi.decode(result, (uint256));
        assertEq(newValue, 1);

        // Verify counter in demo logic
        assertEq(demoLogic.getCounter(tokenId), 1);
    }

    function test_executeAction_noLogicAddress() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        bytes memory callData = abi.encodeWithSelector(
            DemoLogic.incrementCounter.selector,
            tokenId
        );

        vm.prank(user1);
        vm.expectRevert("No logic address set");
        agent.executeAction(tokenId, callData);
    }

    // =============================================================
    //                 BAP-578: FUND AGENT
    // =============================================================

    function test_fundAgent() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.deal(user2, 1 ether);
        vm.prank(user2);
        agent.fundAgent{value: 0.1 ether}(tokenId);

        IHouseForgeAgent.State memory state = agent.getState(tokenId);
        assertEq(state.balance, 0.1 ether);
    }

    // =============================================================
    //                         SEALING
    // =============================================================

    function test_seal() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        assertFalse(agent.isSealed(tokenId));

        vm.prank(address(fusion));
        agent.seal(tokenId);

        assertTrue(agent.isSealed(tokenId));
    }

    function test_seal_onlyFusionCore() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(user1);
        vm.expectRevert("Not fusion core");
        agent.seal(tokenId);
    }

    // =============================================================
    //                         BURNING
    // =============================================================

    function test_burn() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(address(fusion));
        agent.burn(tokenId);

        vm.expectRevert("Token does not exist");
        agent.ownerOf(tokenId);
    }

    // =============================================================
    //                      RARITY TIERS
    // =============================================================

    function test_rarityTiers() public {
        vm.startPrank(admin);

        // Mint with different rarities
        uint256 common = agent.mintGenesis(user1, 1, '{}', "Gen0", "", bytes32(0), bytes32(0), bytes32(0), 1);
        uint256 uncommon = agent.mintGenesis(user1, 1, '{}', "Gen0", "", bytes32(0), bytes32(0), bytes32(0), 2);
        uint256 rare = agent.mintGenesis(user1, 1, '{}', "Gen0", "", bytes32(0), bytes32(0), bytes32(0), 3);

        vm.stopPrank();

        assertEq(agent.getRarityTier(common), 1);
        assertEq(agent.getRarityTier(uncommon), 2);
        assertEq(agent.getRarityTier(rare), 3);
    }

    // =============================================================
    //                     GET STATE VIEW
    // =============================================================

    function test_getState() public {
        vm.prank(admin);
        uint256 tokenId = agent.mintGenesis(
            user1,
            1,
            '{"calm":0.85}',
            "Gen0",
            "ipfs://vault/1",
            bytes32(uint256(1)),
            bytes32(uint256(2)),
            bytes32(uint256(3)),
            1
        );

        vm.prank(user1);
        agent.setLogicAddress(tokenId, address(demoLogic));

        vm.deal(user2, 1 ether);
        vm.prank(user2);
        agent.fundAgent{value: 0.1 ether}(tokenId);

        IHouseForgeAgent.State memory state = agent.getState(tokenId);

        assertEq(state.balance, 0.1 ether);
        assertEq(uint(state.status), uint(IHouseForgeAgent.Status.Active));
        assertEq(state.owner, user1);
        assertEq(state.logicAddress, address(demoLogic));
    }
}
