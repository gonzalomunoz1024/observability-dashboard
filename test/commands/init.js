const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

async function initCommand(name) {
  console.log(`\nInitializing test suite: ${name}\n`);

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'appId',
      message: 'Enter App ID:',
      validate: (input) => input.trim() !== '' || 'App ID is required'
    },
    {
      type: 'input',
      name: 'imageName',
      message: 'Enter Image Name:',
      validate: (input) => input.trim() !== '' || 'Image Name is required'
    },
    {
      type: 'list',
      name: 'selection',
      message: 'Select a number (1-6):',
      choices: [
        { name: '1 - Option One', value: 1 },
        { name: '2 - Option Two', value: 2 },
        { name: '3 - Option Three', value: 3 },
        { name: '4 - Option Four', value: 4 },
        { name: '5 - Option Five', value: 5 },
        { name: '6 - Option Six', value: 6 }
      ]
    },
    {
      type: 'input',
      name: 'playbookUrl',
      message: 'Enter Playbook URL:',
      validate: (input) => input.trim() !== '' || 'Playbook URL is required'
    },
    {
      type: 'input',
      name: 'branch',
      message: 'Enter Branch:',
      default: 'main'
    },
    {
      type: 'input',
      name: 'fileName',
      message: 'Enter File Name:',
      validate: (input) => input.trim() !== '' || 'File Name is required'
    }
  ]);

  // OpenShift login placeholder (skipped for now)
  console.log('\n[Skipping OpenShift login...]\n');

  // Create directory
  const dirPath = path.resolve(process.cwd(), name);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  // Generate catalog.yaml
  const catalogData = {
    apiVersion: 'v1',
    kind: 'Catalog',
    metadata: {
      name: name,
      appId: answers.appId
    },
    spec: {
      image: answers.imageName,
      selection: answers.selection,
      playbook: {
        url: answers.playbookUrl,
        branch: answers.branch,
        fileName: answers.fileName
      }
    }
  };

  // Generate spec.yaml
  const specData = {
    apiVersion: 'v1',
    kind: 'Spec',
    metadata: {
      name: name,
      createdAt: new Date().toISOString()
    },
    configuration: {
      appId: answers.appId,
      image: answers.imageName,
      level: answers.selection
    },
    source: {
      repository: answers.playbookUrl,
      branch: answers.branch,
      entrypoint: answers.fileName
    }
  };

  // Write files
  const catalogPath = path.join(dirPath, 'catalog.yaml');
  const specPath = path.join(dirPath, 'spec.yaml');

  fs.writeFileSync(catalogPath, yaml.dump(catalogData), 'utf8');
  fs.writeFileSync(specPath, yaml.dump(specData), 'utf8');

  console.log(`Created directory: ${dirPath}`);
  console.log(`  - catalog.yaml`);
  console.log(`  - spec.yaml`);
  console.log('\nTest suite initialized successfully!');
}

module.exports = initCommand;
