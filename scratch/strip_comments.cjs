// Strips all single-line (//) and multi-line (/* */) comments from .sol files
// NOTE: Preserves SPDX and pragma lines, preserves string literals
const fs = require('fs');
const path = require('path');

function stripComments(src) {
  let result = '';
  let i = 0;
  while (i < src.length) {
    // String literal — skip entire string unchanged
    if (src[i] === '"' || src[i] === "'") {
      const quote = src[i];
      result += src[i++];
      while (i < src.length) {
        if (src[i] === '\\') { result += src[i++]; result += src[i++]; continue; }
        if (src[i] === quote) { result += src[i++]; break; }
        result += src[i++];
      }
      continue;
    }
    // Single-line comment
    if (src[i] === '/' && src[i+1] === '/') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    // Multi-line comment
    if (src[i] === '/' && src[i+1] === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i+1] === '/')) {
        if (src[i] === '\n') result += '\n'; // preserve newlines for line numbers
        i++;
      }
      i += 2; // skip */
      continue;
    }
    result += src[i++];
  }
  // Collapse 3+ blank lines into 2
  return result.replace(/\n{3,}/g, '\n\n');
}

const targets = [
  'contracts/nfeglobal.sol',
  'hardhat/contracts/nfeglobal.sol',
];

const base = 'E:/NFEGLOBAL';
for (const rel of targets) {
  const p = path.join(base, rel);
  const before = fs.readFileSync(p, 'utf8');
  const after = stripComments(before);
  fs.writeFileSync(p, after, 'utf8');
  const saved = before.length - after.length;
  console.log(`✅ ${rel}  — removed ${saved.toLocaleString()} chars (${before.length.toLocaleString()} → ${after.length.toLocaleString()})`);
}
