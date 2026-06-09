const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TARGET_LENGTH = 28992;
const RUNS_TO_TRY = [200, 500, 1000, 2000, 3000, 4000, 5000, 10000, 20000, 50000, 100000];

async function main() {
  const configPath = path.join(__dirname, "../hardhat.config.js");
  const artifactPath = path.join(__dirname, "../artifacts/contracts/RewardPool.sol/RewardPool.json");

  const originalConfig = fs.readFileSync(configPath, "utf8");

  for (const runs of RUNS_TO_TRY) {
    console.log(`\n========================================`);
    console.log(`Trying runs: ${runs}...`);

    // Write temporary config
    const newConfig = originalConfig.replace(
      /runs: \d+/,
      `runs: ${runs}`
    );
    fs.writeFileSync(configPath, newConfig);

    try {
      // Clean and compile RewardPool contract only to speed it up (or do hardhat compile)
      console.log("Compiling...");
      execSync("npx.cmd hardhat compile", { stdio: "ignore" });

      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        const len = artifact.deployedBytecode.length;
        console.log(`Result: Deployed bytecode length (hex) is ${len} for runs=${runs}`);
        
        if (len === TARGET_LENGTH) {
          console.log(`\n🎉 SUCCESS! Found matching runs: ${runs}`);
          // Restore original config structure (but with matching runs)
          return;
        }
      } else {
        console.error("Artifact not found after compilation.");
      }
    } catch (e) {
      console.error(`Compilation failed for runs=${runs}:`, e.message);
    }
  }

  // Restore original config if nothing found
  fs.writeFileSync(configPath, originalConfig);
  console.log("\nFinished. No exact match found in list.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
