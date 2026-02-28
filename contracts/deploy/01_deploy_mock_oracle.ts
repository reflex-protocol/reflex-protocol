import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// Only runs on local networks — live networks should use a real price oracle.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy, execute } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("MockPriceOracle", {
    from: deployer,
    args: [],
    log: true,
    waitConfirmations: ["hardhat", "localhost"].includes(hre.network.name) ? 0 : 2,
  });

  // Seed an initial price with 18-decimal precision.
  // 1e18 = 1.0 (unit price, both collateral and debt denominated in STT).
  // The vault's ratio formula: (collateral × price × 100) / (debt × 1e18)
  const initialPrice = ethers.parseEther("1"); // 1.0 — parity
  await execute(
    "MockPriceOracle",
    { from: deployer, log: true },
    "updatePrice",
    ethers.ZeroAddress, // use zero address as the "STT" asset sentinel
    initialPrice
  );

  console.log(`MockPriceOracle deployed to: ${result.address}`);
};

export default func;
func.tags = ["mock", "oracle"];
// Only execute on local networks — skip for any live deployment.
// Deploy on all networks — for the hackathon the MockPriceOracle IS our oracle.
// func.skip = async (hre: HardhatRuntimeEnvironment) =>
//   !["hardhat", "localhost"].includes(hre.network.name);
