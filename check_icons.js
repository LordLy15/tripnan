const fs = require('fs');
const code = fs.readFileSync('app.jsx', 'utf8');
const regex = /<Icon\s+name=["']([a-zA-Z0-9-]+)["']/g;
let match;
const names = new Set();
while ((match = regex.exec(code)) !== null) {
  names.add(match[1]);
}

const iconCode = code.match(/const icons = {([\s\S]*?)};/)[1];
const definedRegex = /['"]?([a-zA-Z0-9-]+)['"]?\s*:/g;
const definedNames = new Set();
while ((match = definedRegex.exec(iconCode)) !== null) {
  definedNames.add(match[1]);
}

const missing = [...names].filter(n => !definedNames.has(n));
console.log('Missing Icons:', missing);
