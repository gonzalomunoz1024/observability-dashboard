const fs = require('fs');
const path = require('path');

function buildCommand(directory) {
  const dirPath = path.resolve(process.cwd(), directory);

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    console.error(`Error: Directory "${directory}" does not exist.`);
    process.exit(1);
  }

  // Check if it's a directory
  if (!fs.statSync(dirPath).isDirectory()) {
    console.error(`Error: "${directory}" is not a directory.`);
    process.exit(1);
  }

  const catalogPath = path.join(dirPath, 'catalog.yaml');
  const specPath = path.join(dirPath, 'spec.yaml');

  console.log(`\n=== Building: ${directory} ===\n`);

  // Read and print catalog.yaml
  if (fs.existsSync(catalogPath)) {
    console.log('--- catalog.yaml ---');
    console.log(fs.readFileSync(catalogPath, 'utf8'));
  } else {
    console.log('Warning: catalog.yaml not found');
  }

  // Read and print spec.yaml
  if (fs.existsSync(specPath)) {
    console.log('--- spec.yaml ---');
    console.log(fs.readFileSync(specPath, 'utf8'));
  } else {
    console.log('Warning: spec.yaml not found');
  }

  console.log('=== Build complete ===\n');
}

module.exports = buildCommand;
