import { ethers } from "hardhat";

async function main() {
  const counterFactory = await ethers.getContractFactory("Counter");
  const counter = await counterFactory.deploy();
  await counter.waitForDeployment();

  console.log(`Counter deployed to: ${await counter.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
