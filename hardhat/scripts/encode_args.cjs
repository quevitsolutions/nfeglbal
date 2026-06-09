const { ethers } = require("hardhat");

async function main() {
  const engine = "0x538Fe309506a1E42773765dBcB2c372d922Ea6A5";
  const owner = "0x3125B4d0d4250132140d91F0800521905A4580fa";
  const genesisNodeId = 55555;
  const encoder = new ethers.AbiCoder();
  const encoded = encoder.encode(
    ["address", "address", "uint256"],
    [engine, owner, genesisNodeId]
  );
  console.log("Encoded constructor arguments:");
  console.log(encoded.slice(2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
