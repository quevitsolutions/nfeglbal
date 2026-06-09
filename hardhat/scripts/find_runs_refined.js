const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TARGET_LENGTH = 28992;
const RUNS_TO_TRY = [4500, 4200, 4800, 4100, 4300, 4400, 4600, 4700, 4900];

async function main() {
  const configPath = path.join(__dirname, "../hardhat.config.js");
  const artifactPath = path.join(__dirname, "../artifacts/contracts/RewardPool.sol/RewardPool.json");

  const originalConfig = fs.readFileSync(configPath, "utf8");

  for (const runs of RUNS_TO_TRY) {
    console.log(`\n========================================`);
    console.log(`Trying runs: ${runs}...`);

    const newConfig = originalConfig.replace(
      /runs: \d+/,
      `runs: ${runs}`
    );
    fs.writeFileSync(configPath, newConfig);

    try {
      console.log("Compiling...");
      execSync("npx.cmd hardhat compile", { stdio: "ignore" });

      if (fs.existsSync(artifactPath)) {
        const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
        const len = artifact.deployedBytecode.length;
        console.log(`Result: Deployed bytecode length (hex) is ${len} for runs=${runs}`);
        
        if (len === TARGET_LENGTH) {
          console.log(`\n🎉 SUCCESS! Found matching runs: ${runs}`);
          return;
        }
      }
    } catch (e) {
      console.error(`Compilation failed for runs=${runs}:`, e.message);
    }
  }

  // Restore original config
  fs.writeFileSync(configPath, originalConfig);
  console.log("\nFinished. No exact match found in list.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
