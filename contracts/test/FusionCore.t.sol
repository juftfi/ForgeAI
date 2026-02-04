// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/HouseForgeAgent.sol";
import "../src/FusionCore.sol";

contract FusionCoreTest is Test {
    HouseForgeAgent public agent;
    FusionCore public fusion;

    address public treasury = address(100);
    address public admin = address(1);
    address public user1 = address(2);

    uint256 public parentA;
    uint256 public parentB;

    function setUp() public {
        vm.startPrank(admin);
        agent = new HouseForgeAgent(admin);
        fusion = new FusionCore(address(agent), admin);
        agent.setFusionCore(address(fusion));

        // Mint two genesis tokens for testing
        parentA = agent.mintGenesis(
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

        parentB = agent.mintGenesis(
            user1,
            2, // House MONSOON
            '{"calm":0.40}',
            "Gen0",
            "ipfs://vault/2",
            bytes32(uint256(4)),
            bytes32(uint256(5)),
            bytes32(uint256(6)),
            1 // Common
        );

        vm.stopPrank();
    }

    // =============================================================
    //                      COMMIT TESTS
    // =============================================================

    function test_commitFusion() public {
        bytes32 salt = bytes32(uint256(12345));
        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            block.number,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        assertTrue(fusion.hasActiveCommit(user1, parentA, parentB));

        IFusionCore.Commit memory commit = fusion.getCommit(user1, parentA, parentB);
        assertEq(commit.commitHash, commitHash);
        assertEq(commit.commitBlock, block.number);
        assertFalse(commit.revealed);
    }

    function test_commitFusion_sameParent_reverts() public {
        bytes32 commitHash = bytes32(uint256(1));

        vm.prank(user1);
        vm.expectRevert("Same parent");
        fusion.commitFusion(parentA, parentA, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);
    }

    function test_commitFusion_notOwner_reverts() public {
        bytes32 commitHash = bytes32(uint256(1));

        vm.prank(address(99));
        vm.expectRevert("Not owner of parentA");
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);
    }

    // =============================================================
    //                      REVEAL TESTS
    // =============================================================

    function test_revealFusion_burnMode() public {
        vm.deal(user1, 1 ether);

        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        // Advance blocks
        vm.roll(block.number + 2);

        // Get required fee
        (uint256 totalFee,,,) = fusion.getFusionFee(parentA, parentB);

        vm.prank(user1);
        uint256 offspringId = fusion.revealFusion{value: totalFee}(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1, // House CLEAR
            bytes32(uint256(9)),
            1 // Common
        );

        // Offspring minted
        assertEq(agent.ownerOf(offspringId), user1);
        assertEq(agent.getGeneration(offspringId), 1);

        // Parents burned
        vm.expectRevert("Token does not exist");
        agent.ownerOf(parentA);

        vm.expectRevert("Token does not exist");
        agent.ownerOf(parentB);
    }

    function test_revealFusion_sealMode() public {
        vm.deal(user1, 1 ether);

        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.SEAL
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.SEAL);

        // Advance blocks
        vm.roll(block.number + 2);

        (uint256 totalFee,,,) = fusion.getFusionFee(parentA, parentB);

        vm.prank(user1);
        uint256 offspringId = fusion.revealFusion{value: totalFee}(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            2, // House MONSOON
            bytes32(uint256(9)),
            1
        );

        // Offspring minted
        assertEq(agent.ownerOf(offspringId), user1);

        // Parents sealed but still exist
        assertEq(agent.ownerOf(parentA), user1);
        assertEq(agent.ownerOf(parentB), user1);
        assertTrue(agent.isSealed(parentA));
        assertTrue(agent.isSealed(parentB));
    }

    function test_revealFusion_tooEarly_reverts() public {
        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        // Don't advance blocks - try to reveal immediately
        vm.prank(user1);
        vm.expectRevert("Too early");
        fusion.revealFusion(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1,
            bytes32(uint256(9)),
            1
        );
    }

    function test_revealFusion_invalidHash_reverts() public {
        vm.deal(user1, 1 ether);

        bytes32 salt = bytes32(uint256(12345));
        bytes32 wrongSalt = bytes32(uint256(99999));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        vm.roll(block.number + 2);

        (uint256 totalFee,,,) = fusion.getFusionFee(parentA, parentB);

        vm.prank(user1);
        vm.expectRevert("Invalid reveal");
        fusion.revealFusion{value: totalFee}(
            parentA,
            parentB,
            wrongSalt, // Wrong salt
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1,
            bytes32(uint256(9)),
            1
        );
    }

    // =============================================================
    //                      FEE TESTS
    // =============================================================

    function test_getFusionFee_baseFeeOnly() public view {
        // Both parents are Common (rarity 1), not mythic eligible
        (uint256 totalFee, uint256 baseAmount, uint256 rareAmount, uint256 mythicAmount) =
            fusion.getFusionFee(parentA, parentB);

        assertEq(baseAmount, 0.003 ether);
        assertEq(rareAmount, 0);
        assertEq(mythicAmount, 0);
        assertEq(totalFee, 0.003 ether);
    }

    function test_getFusionFee_withRareSurcharge() public {
        // Mint a Rare parent (rarity tier 3)
        vm.prank(admin);
        uint256 rareParent = agent.mintGenesis(
            user1,
            1, // House CLEAR
            '{"calm":0.9}',
            "Gen0",
            "ipfs://vault/rare",
            bytes32(uint256(100)),
            bytes32(uint256(101)),
            bytes32(uint256(102)),
            3 // Rare
        );

        (uint256 totalFee, uint256 baseAmount, uint256 rareAmount, uint256 mythicAmount) =
            fusion.getFusionFee(rareParent, parentB);

        assertEq(baseAmount, 0.003 ether);
        assertEq(rareAmount, 0.002 ether);
        assertEq(mythicAmount, 0); // Not mythic eligible yet (Gen 0)
        assertEq(totalFee, 0.005 ether);
    }

    function test_getFusionFee_withMythicSurcharge() public {
        // Create Gen1+ parents with mythic-eligible houses
        // THUNDER(3) + MONSOON(2) is mythic eligible

        vm.startPrank(admin);

        // Create Gen1 THUNDER parent
        uint256 thunderParent = agent.mintGenesis(
            user1,
            3, // THUNDER
            '{"energy":0.9}',
            "Gen0",
            "ipfs://vault/thunder",
            bytes32(uint256(200)),
            bytes32(uint256(201)),
            bytes32(uint256(202)),
            1
        );

        // Create Gen1 MONSOON parent
        uint256 monsoonParent = agent.mintGenesis(
            user1,
            2, // MONSOON
            '{"flow":0.8}',
            "Gen0",
            "ipfs://vault/monsoon",
            bytes32(uint256(300)),
            bytes32(uint256(301)),
            bytes32(uint256(302)),
            1
        );

        vm.stopPrank();

        // Do a fusion to create Gen1 parents
        vm.deal(user1, 10 ether);

        // Create Gen1 THUNDER
        bytes32 salt1 = bytes32(uint256(1));
        uint256 commitBlock1 = block.number;
        bytes32 commitHash1 = keccak256(abi.encode(
            parentA, thunderParent, salt1, commitBlock1, user1, IFusionCore.FusionMode.SEAL
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, thunderParent, commitHash1, IFusionCore.FusionMode.SEAL);
        vm.roll(block.number + 2);

        (uint256 fee1,,,) = fusion.getFusionFee(parentA, thunderParent);
        vm.prank(user1);
        uint256 gen1Thunder = fusion.revealFusion{value: fee1}(
            parentA, thunderParent, salt1,
            "ipfs://vault/gen1thunder",
            bytes32(uint256(400)),
            bytes32(uint256(401)),
            '{"energy":0.85}',
            "Gen1",
            3, // THUNDER
            bytes32(uint256(402)),
            1
        );

        // Create Gen1 MONSOON
        bytes32 salt2 = bytes32(uint256(2));
        uint256 commitBlock2 = block.number;
        bytes32 commitHash2 = keccak256(abi.encode(
            parentB, monsoonParent, salt2, commitBlock2, user1, IFusionCore.FusionMode.SEAL
        ));

        vm.prank(user1);
        fusion.commitFusion(parentB, monsoonParent, commitHash2, IFusionCore.FusionMode.SEAL);
        vm.roll(block.number + 2);

        (uint256 fee2,,,) = fusion.getFusionFee(parentB, monsoonParent);
        vm.prank(user1);
        uint256 gen1Monsoon = fusion.revealFusion{value: fee2}(
            parentB, monsoonParent, salt2,
            "ipfs://vault/gen1monsoon",
            bytes32(uint256(500)),
            bytes32(uint256(501)),
            '{"flow":0.75}',
            "Gen1",
            2, // MONSOON
            bytes32(uint256(502)),
            1
        );

        // Now check fee for Gen1 THUNDER + Gen1 MONSOON (mythic eligible)
        (uint256 totalFee, uint256 baseAmount, uint256 rareAmount, uint256 mythicAmount) =
            fusion.getFusionFee(gen1Thunder, gen1Monsoon);

        assertEq(baseAmount, 0.003 ether);
        assertEq(rareAmount, 0); // Both common
        assertEq(mythicAmount, 0.003 ether); // Mythic eligible!
        assertEq(totalFee, 0.006 ether);
    }

    function test_revealFusion_insufficientFee() public {
        vm.deal(user1, 1 ether);

        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        vm.roll(block.number + 2);

        // Try with insufficient fee
        vm.prank(user1);
        vm.expectRevert("Insufficient fee");
        fusion.revealFusion{value: 0.001 ether}(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1,
            bytes32(uint256(9)),
            1
        );
    }

    function test_revealFusion_feeForwarded() public {
        vm.deal(user1, 1 ether);

        uint256 treasuryBefore = treasury.balance;

        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        vm.roll(block.number + 2);

        (uint256 totalFee,,,) = fusion.getFusionFee(parentA, parentB);

        vm.prank(user1);
        fusion.revealFusion{value: totalFee}(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1,
            bytes32(uint256(9)),
            1
        );

        // Treasury should have received the fee
        assertEq(treasury.balance, treasuryBefore + totalFee);
    }

    function test_revealFusion_excessRefunded() public {
        vm.deal(user1, 1 ether);

        bytes32 salt = bytes32(uint256(12345));
        uint256 commitBlock = block.number;

        bytes32 commitHash = keccak256(abi.encode(
            parentA,
            parentB,
            salt,
            commitBlock,
            user1,
            IFusionCore.FusionMode.BURN_TO_MINT
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        vm.roll(block.number + 2);

        (uint256 totalFee,,,) = fusion.getFusionFee(parentA, parentB);

        uint256 userBalanceBefore = user1.balance;
        uint256 excessAmount = 0.1 ether;

        vm.prank(user1);
        fusion.revealFusion{value: totalFee + excessAmount}(
            parentA,
            parentB,
            salt,
            "ipfs://vault/3",
            bytes32(uint256(7)),
            bytes32(uint256(8)),
            '{"calm":0.6}',
            "Gen1",
            1,
            bytes32(uint256(9)),
            1
        );

        // User should have been refunded the excess
        assertEq(user1.balance, userBalanceBefore - totalFee);
    }

    // =============================================================
    //                      CANCEL TESTS
    // =============================================================

    function test_cancelFusion() public {
        bytes32 commitHash = bytes32(uint256(1));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        // Advance past MAX_COMMIT_AGE
        vm.roll(block.number + 257);

        vm.prank(user1);
        fusion.cancelFusion(parentA, parentB);

        assertFalse(fusion.hasActiveCommit(user1, parentA, parentB));
    }

    function test_cancelFusion_notExpired_reverts() public {
        bytes32 commitHash = bytes32(uint256(1));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);

        // Only advance a little
        vm.roll(block.number + 10);

        vm.prank(user1);
        vm.expectRevert("Not expired");
        fusion.cancelFusion(parentA, parentB);
    }

    // =============================================================
    //                   GENERATION TESTS
    // =============================================================

    function test_generation_calculation() public {
        vm.deal(user1, 10 ether);

        // Create offspring from two Gen0 parents
        bytes32 salt = bytes32(uint256(1));
        uint256 commitBlock = block.number;
        bytes32 commitHash = keccak256(abi.encode(
            parentA, parentB, salt, commitBlock, user1, IFusionCore.FusionMode.SEAL
        ));

        vm.prank(user1);
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.SEAL);
        vm.roll(block.number + 2);

        (uint256 fee,,,) = fusion.getFusionFee(parentA, parentB);
        vm.prank(user1);
        uint256 gen1Child = fusion.revealFusion{value: fee}(
            parentA, parentB, salt,
            "ipfs://vault/3", bytes32(uint256(7)), bytes32(uint256(8)),
            '{"calm":0.6}', "Gen1", 1, bytes32(uint256(9)), 1
        );

        assertEq(agent.getGeneration(gen1Child), 1);

        // Create another Gen0 parent
        vm.prank(admin);
        uint256 parentC = agent.mintGenesis(
            user1, 3, '{"calm":0.35}', "Gen0",
            "ipfs://vault/4", bytes32(uint256(10)), bytes32(uint256(11)), bytes32(uint256(12)), 1
        );

        // Fuse Gen1 with Gen0 -> should be Gen2
        salt = bytes32(uint256(2));
        commitBlock = block.number;
        commitHash = keccak256(abi.encode(
            gen1Child, parentC, salt, commitBlock, user1, IFusionCore.FusionMode.SEAL
        ));

        vm.prank(user1);
        fusion.commitFusion(gen1Child, parentC, commitHash, IFusionCore.FusionMode.SEAL);
        vm.roll(block.number + 2);

        (fee,,,) = fusion.getFusionFee(gen1Child, parentC);
        vm.prank(user1);
        uint256 gen2Child = fusion.revealFusion{value: fee}(
            gen1Child, parentC, salt,
            "ipfs://vault/5", bytes32(uint256(13)), bytes32(uint256(14)),
            '{"calm":0.5}', "Gen2", 1, bytes32(uint256(15)), 1
        );

        assertEq(agent.getGeneration(gen2Child), 2);
    }

    // =============================================================
    //                   ADMIN TESTS
    // =============================================================

    function test_setFees() public {
        uint256[4] memory newFees = [uint256(0.005 ether), 0.02 ether, 0.04 ether, 0.08 ether];
        vm.prank(admin);
        fusion.setFees(newFees, 0.003 ether, 0.004 ether);

        assertEq(fusion.getBaseFeeForTier(0), 0.005 ether);
        assertEq(fusion.rareSurcharge(), 0.003 ether);
        assertEq(fusion.mythicAttemptSurcharge(), 0.004 ether);
    }

    function test_setFees_onlyAdmin() public {
        uint256[4] memory newFees = [uint256(0.005 ether), 0.02 ether, 0.04 ether, 0.08 ether];
        vm.prank(user1);
        vm.expectRevert("Not admin");
        fusion.setFees(newFees, 0.003 ether, 0.004 ether);
    }

    function test_setTreasury() public {
        address newTreasury = address(999);

        vm.prank(admin);
        fusion.setTreasury(newTreasury);

        assertEq(fusion.treasury(), newTreasury);
    }

    function test_setPaused() public {
        vm.prank(admin);
        fusion.setPaused(true);

        assertTrue(fusion.paused());

        // Try to commit while paused
        bytes32 commitHash = bytes32(uint256(1));
        vm.prank(user1);
        vm.expectRevert("Contract paused");
        fusion.commitFusion(parentA, parentB, commitHash, IFusionCore.FusionMode.BURN_TO_MINT);
    }

    function test_mythicEligibleHouses() public view {
        // THUNDER(3) + MONSOON(2) should be eligible
        assertTrue(fusion.mythicEligibleHouses(2, 3));

        // FROST(4) + CLEAR(1) should be eligible
        assertTrue(fusion.mythicEligibleHouses(1, 4));

        // ECLIPSE(7) + AURORA(5) should be eligible
        assertTrue(fusion.mythicEligibleHouses(5, 7));

        // CLEAR(1) + MONSOON(2) should NOT be eligible
        assertFalse(fusion.mythicEligibleHouses(1, 2));
    }
}
