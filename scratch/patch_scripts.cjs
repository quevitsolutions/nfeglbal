const fs = require('fs');
const path = require('path');

const scriptsDir = 'hardhat/scripts';
const files = fs.readdirSync(scriptsDir);

files.forEach(file => {
    if (!file.endsWith('.js') && !file.endsWith('.cjs')) return;
    const filePath = path.join(scriptsDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    if (content.includes('getContractFactory("nfeglobal"') || content.includes("getContractFactory('nfeglobal'")) {
        if (content.includes('setMigrationHelper')) {
            console.log(`Skipping ${file}: already has setMigrationHelper`);
            return;
        }
        
        console.log(`Patching ${file}...`);
        
        // Find await core.waitForDeployment();
        const searchStr = 'await core.waitForDeployment();';
        if (content.includes(searchStr)) {
            const replacement = `${searchStr}\n  \n  // Deploy and link MigrationHelper\n  const HelperFactory = await (typeof hre !== 'undefined' ? hre.ethers : ethers).getContractFactory("MigrationHelper");\n  const helper = await HelperFactory.deploy();\n  await helper.waitForDeployment();\n  await core.setMigrationHelper(await helper.getAddress());\n`;
            content = content.replace(searchStr, replacement);
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Successfully patched ${file}`);
        } else {
            console.warn(`Could not find waitForDeployment in ${file}`);
        }
    }
});
