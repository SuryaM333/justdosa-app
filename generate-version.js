import fs from 'fs';

const version = Date.now().toString();

// Write public/version.json for the server
fs.writeFileSync('./public/version.json', JSON.stringify({ version }, null, 2));

// Write src/version.ts for the client code to import
fs.writeFileSync('./src/version.ts', `export const APP_VERSION = '${version}';\n`);

console.log(`Generated version file with ID: ${version}`);
