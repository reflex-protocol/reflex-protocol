import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { ethers } from "hardhat";

// The canonical Somnia Reactivity Precompile address — same on all Somnia networks.
const SOMNIA_PRECOMPILE = "0x0000000000000000000000000000000000000100";

// Deterministic topic hash — keccak256("PriceUpdated(address,uint256,uint256)").
// Same value every IPriceOracle implementation exposes as PRICE_UPDATED_TOPIC.
const PRICE_UPDATE_TOPIC = ethers.id("PriceUpdated(address,uint256,uint256)");

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, getOrNull } = deployments;
  const { deployer } = await getNamedAccounts();

  let oracleAddress: string;

  // Priority order for oracle address resolution:
  // 1. Explicit env var (highest priority)
  // 2. PriceOracle deployment (production)
  // 3. ChainlinkPriceOracleAdapter deployment
  // 4. MockPriceOracle deployment (fallback for local/test)
  if (process.env.PRICE_ORACLE_ADDRESS) {
    oracleAddress = process.env.PRICE_ORACLE_ADDRESS;
  } else {
    const prodOracle = await getOrNull("PriceOracle");
    const chainlinkAdapter = await getOrNull("ChainlinkPriceOracleAdapter");
    const mockOracle = await getOrNull("MockPriceOracle");

    if (prodOracle) {
      oracleAddress = prodOracle.address;
    } else if (chainlinkAdapter) {
      oracleAddress = chainlinkAdapter.address;
    } else if (mockOracle) {
      oracleAddress = mockOracle.address;
    } else {
      throw new Error(
        "No oracle deployment found. Deploy an oracle first or set PRICE_ORACLE_ADDRESS."
      );
    }
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
func.dependencies = ["oracle"]; // ensures oracle is deployed first
