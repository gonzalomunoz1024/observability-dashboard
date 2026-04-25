#!/usr/bin/env node

const { program } = require('commander');
const initCommand = require('../commands/init');
const buildCommand = require('../commands/build');

program
  .name('mycli')
  .description('CLI tool for generating test suite configurations')
  .version('1.0.0');

program
  .command('init <name>')
  .description('Initialize a new test suite directory with catalog.yaml and spec.yaml')
  .action(initCommand);

program
  .command('build <directory>')
  .description('Build and print contents of the test suite directory')
  .action(buildCommand);

program.parse(process.argv);
