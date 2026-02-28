import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

// Deploys MockReactivityPrecompile at a regular address on local networks
// so that REFLEXVault and REFLEXInsurance constructor calls to `subscribe()`
// actually succeed without needing a real Somnia precompile.
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  const result = await deploy("MockReactivityPrecompile", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`MockReactivityPrecompile deployed to: ${result.address}`);
};

export default func;
func.tags = ["mock", "precompile"];
func.skip = async (hre: HardhatRuntimeEnvironment) =>
  !["hardhat", "localhost"].includes(hre.network.name);
