import { ethers, run, deployments, network } from "hardhat";

const EXPLORER_URL = "https://shannon-explorer.somnia.network";

async function main(): Promise<void> {
  const contracts = [
    {
      name: "REFLEXVault",
      getArgs: async () => {
        const vault = await deployments.get("REFLEXVault");
        // Re-read the constructor args from the saved deployment artifact.
        return vault.args ?? [];
      },
    },
    {
      name: "REFLEXInsurance",
      getArgs: async () => {
        const insurance = await deployments.get("REFLEXInsurance");
        return insurance.args ?? [];
      },
    },
  ];

  // Only attempt MockPriceOracle verification on local-ish testnets.
  if (!["hardhat", "localhost"].includes(network.name)) {
    contracts.unshift({
      name: "MockPriceOracle",
      getArgs: async () => [],
    });
  }

  for (const { name, getArgs } of contracts) {
    let address: string;
    try {
      const artifact = await deployments.get(name);
      address = artifact.address;
    } catch {
      console.warn(`  [SKIP] ${name} — no deployment artifact found`);
      continue;
    }

    const args = await getArgs();

    console.log(`\nVerifying ${name}...`);
    console.log(`  Address: ${address}`);
    console.log(`  Explorer: ${EXPLORER_URL}/address/${address}`);

    try {
      await run("verify:verify", {
        address,
        constructorArguments: args,
      });
      console.log(`  ✓ Verified`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.toLowerCase().includes("already verified")) {
        console.log(`  ✓ Already verified`);
      } else {
        console.error(`  ✗ Verification failed: ${message}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
