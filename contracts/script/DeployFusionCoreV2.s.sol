// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FusionCore.sol";

/**
 * @title DeployFusionCoreV2
 * @notice Deployment script for upgraded FusionCore contract
 * @dev This script only deploys FusionCore and connects it to existing HouseForgeAgent
 */
contract DeployFusionCoreV2 is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);

        // Existing HouseForgeAgent address
        address agentContract = vm.envAddress("HOUSEFORGE_AGENT_ADDRESS");

        console.log("Deployer:", deployer);
        console.log("Treasury:", treasury);
        console.log("Existing HouseForgeAgent:", agentContract);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new FusionCore (agentContract, admin, treasury)
        FusionCore fusionV2 = new FusionCore(agentContract, deployer, treasury);
        console.log("FusionCore V2 deployed at:", address(fusionV2));

        vm.stopBroadcast();

        // Output for .env and contracts.ts
        console.log("\n=== Update contracts.ts with new address ===");
        console.log("FUSION_CORE_ADDRESS=", address(fusionV2));
        console.log("\nIMPORTANT: After deployment, you need to:");
        console.log("1. Call HouseForgeAgent.setFusionCore(newFusionCoreAddress) to authorize the new contract");
        console.log("2. Update web/config/contracts.ts with the new FusionCore address");
    }
}
