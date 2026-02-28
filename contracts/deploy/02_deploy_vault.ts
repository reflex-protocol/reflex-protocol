import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// The canonical Somnia Reactivity Precompile address — same on all Somnia networks.
const SOMNIA_PRECOMPILE = "0x0000000000000000000000000000000000000100";

// Deterministic topic hash — keccak256("PriceUpdated(address,uint256,uint256)").
// Same value the MockPriceOracle exposes as PRICE_UPDATED_TOPIC.
const PRICE_UPDATE_TOPIC = ethers.id("PriceUpdated(address,uint256,uint256)");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, get } = deployments;
  const { deployer } = await getNamedAccounts();

  let oracleAddress: string;

  // Prefer the env var if set; otherwise use the deployed MockPriceOracle artifact.
  if (process.env.PRICE_ORACLE_ADDRESS) {
    oracleAddress = process.env.PRICE_ORACLE_ADDRESS;
  } else {
    const mockOracle = await get("MockPriceOracle");
    oracleAddress = mockOracle.address;
  }

  const priceUpdateTopic = PRICE_UPDATE_TOPIC;

  const result = await deploy("REFLEXVault", {
    from: deployer,
    args: [oracleAddress, priceUpdateTopic, SOMNIA_PRECOMPILE],
    log: true,
    waitConfirmations: network.name === "hardhat" ? 0 : 2,
  });

  console.log(`REFLEXVault deployed to:    ${result.address}`);
  console.log(`  Oracle:                   ${oracleAddress}`);
  console.log(`  Price topic:              ${priceUpdateTopic}`);
  console.log(`  Reactivity precompile:    ${SOMNIA_PRECOMPILE}`);
};

export default func;
func.tags = ["vault", "core"];
func.dependencies = ["oracle"]; // ensures mock oracle is deployed first on local nets
