// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/HouseForgeAgent.sol";
import "../src/FusionCore.sol";

/**
 * @title Deploy
 * @notice Deployment script for HouseForge contracts
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy HouseForgeAgent (admin only - treasury is hardcoded to OWNER_WALLET)
        HouseForgeAgent agent = new HouseForgeAgent(deployer);
        console.log("HouseForgeAgent deployed at:", address(agent));

        // Deploy FusionCore (agentContract, admin - treasury is hardcoded to OWNER_WALLET)
        FusionCore fusion = new FusionCore(address(agent), deployer);
        console.log("FusionCore deployed at:", address(fusion));

        // Set FusionCore as authorized
        agent.setFusionCore(address(fusion));
        console.log("FusionCore authorized on HouseForgeAgent");

        vm.stopBroadcast();

        // Output for .env
        console.log("\n=== Add to .env ===");
        console.log("HOUSEFORGE_AGENT_ADDRESS=", address(agent));
        console.log("FUSION_CORE_ADDRESS=", address(fusion));
    }
}
