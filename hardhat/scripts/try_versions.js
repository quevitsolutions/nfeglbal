const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const TARGET_LENGTH = 28992;
const VERSIONS = ["0.8.19", "0.8.21", "0.8.22", "0.8.23", "0.8.24"];
const RUNS_TO_TRY = [200, 4500];

async function main() {
  const configPath = path.join(__dirname, "../hardhat.config.js");
  const artifactPath = path.join(__dirname, "../artifacts/contracts/RewardPool.sol/RewardPool.json");

  const originalConfig = fs.readFileSync(configPath, "utf8");

  for (const version of VERSIONS) {
    for (const runs of RUNS_TO_TRY) {
      console.log(`\n========================================`);
      console.log(`Trying version: ${version} with runs: ${runs}...`);

      // Write temporary config
      let newConfig = originalConfig.replace(
        /version: "[^"]+"/,
        `version: "${version}"`
      );
      newConfig = newConfig.replace(
        /runs: \d+/,
        `runs: ${runs}`
      );
      
      // Let's use EVM version paris for version < 0.8.20 and default/shanghai for >= 0.8.20
      if (version === "0.8.19") {
        newConfig = newConfig.replace(/evmVersion: "[^"]+"/, 'evmVersion: "paris"');
      } else {
        newConfig = newConfig.replace(/evmVersion: "[^"]+"/, 'evmVersion: "paris"'); // test paris first
      }

      fs.writeFileSync(configPath, newConfig);

      try {
        console.log("Compiling...");
        execSync("npx.cmd hardhat compile", { stdio: "ignore" });

        if (fs.existsSync(artifactPath)) {
          const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
          const len = artifact.deployedBytecode.length;
          console.log(`Result: Deployed bytecode length (hex) is ${len} for version=${version}, runs=${runs}`);
          
          if (len === TARGET_LENGTH) {
            console.log(`\n🎉 SUCCESS! Found matching version: ${version} and runs: ${runs}`);
            return;
          }
        }
      } catch (e) {
        console.error(`Compilation failed:`, e.message);
      }
    }
  }

  // Restore original config
  fs.writeFileSync(configPath, originalConfig);
  console.log("\nFinished. No exact match found in version list.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
