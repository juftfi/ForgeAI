// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/logic/DemoLogic.sol";

contract DeployDemoLogic is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        DemoLogic logic = new DemoLogic();
        console.log("DemoLogic deployed at:", address(logic));

        vm.stopBroadcast();
    }
}