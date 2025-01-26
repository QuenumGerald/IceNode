const chalk = require('chalk');

function displayBanner() {
    console.log(chalk.cyan(`
 _____ _____ _____ _   _ _____ ____  _____ 
|_   _|     |   __| \ | |     |    \|   __|
  | | |-   -|   __|  \| |  |  |  |  |   __|
  |_| |_____|_____|_|\__|_____|____/|_____|
`));
    console.log(chalk.white('Avalanche Blockchain Indexer'));
    console.log(chalk.gray('Version 1.0.0\n'));
}

module.exports = displayBanner;
