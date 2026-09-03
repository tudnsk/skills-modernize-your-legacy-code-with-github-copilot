'use strict';

const readline = require('node:readline');

const INITIAL_BALANCE_CENTS = 100000;
const MAX_BALANCE_CENTS = 99999999;

function formatMoney(cents) {
  const wholeUnits = Math.floor(cents / 100);
  const fractionalUnits = String(cents % 100).padStart(2, '0');
  return `${String(wholeUnits).padStart(6, '0')}.${fractionalUnits}`;
}

function parseAmount(input) {
  const normalizedInput = input.trim();

  if (!/^\d+(?:\.\d{1,2})?$/.test(normalizedInput)) {
    return null;
  }

  const [wholeUnits, fractionalUnits = ''] = normalizedInput.split('.');
  const amountCents = Number(wholeUnits) * 100 + Number(fractionalUnits.padEnd(2, '0'));

  return Number.isSafeInteger(amountCents) ? amountCents : null;
}

function createDataStore(initialBalance = INITIAL_BALANCE_CENTS) {
  let storageBalance = initialBalance;

  return {
    read() {
      return storageBalance;
    },
    write(balance) {
      storageBalance = balance;
    }
  };
}

function createOperations(dataStore = createDataStore()) {
  function total() {
    return {
      message: `Current balance: ${formatMoney(dataStore.read())}`,
      balance: dataStore.read()
    };
  }

  function credit(amountCents) {
    const currentBalance = dataStore.read();

    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { message: 'Invalid credit amount. Enter a positive amount.', balance: currentBalance };
    }

    if (currentBalance + amountCents > MAX_BALANCE_CENTS) {
      return { message: 'Credit would exceed the maximum account balance.', balance: currentBalance };
    }

    const newBalance = currentBalance + amountCents;
    dataStore.write(newBalance);
    return {
      message: `Amount credited. New balance: ${formatMoney(newBalance)}`,
      balance: newBalance
    };
  }

  function debit(amountCents) {
    const currentBalance = dataStore.read();

    if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
      return { message: 'Invalid debit amount. Enter a positive amount.', balance: currentBalance };
    }

    if (currentBalance < amountCents) {
      return { message: 'Insufficient funds for this debit.', balance: currentBalance };
    }

    const newBalance = currentBalance - amountCents;
    dataStore.write(newBalance);
    return {
      message: `Amount debited. New balance: ${formatMoney(newBalance)}`,
      balance: newBalance
    };
  }

  return { total, credit, debit };
}

function displayMenu() {
  console.log('--------------------------------');
  console.log('Account Management System');
  console.log('1. View Balance');
  console.log('2. Credit Account');
  console.log('3. Debit Account');
  console.log('4. Exit');
  console.log('--------------------------------');
}

async function askQuestion(lineIterator, output, prompt) {
  output.write(prompt);
  const nextLine = await lineIterator.next();
  return nextLine.done ? '4' : nextLine.value;
}

async function run(input = process.stdin, output = process.stdout) {
  const readlineInterface = readline.createInterface({ input, output });
  const lineIterator = readlineInterface[Symbol.asyncIterator]();
  const operations = createOperations();
  let continueRunning = true;

  try {
    while (continueRunning) {
      displayMenu();
      const choice = await askQuestion(lineIterator, output, 'Enter your choice (1-4): ');

      switch (choice.trim()) {
        case '1':
          console.log(operations.total().message);
          break;
        case '2': {
          const amount = await askQuestion(lineIterator, output, 'Enter credit amount: ');
          console.log(operations.credit(parseAmount(amount)).message);
          break;
        }
        case '3': {
          const amount = await askQuestion(lineIterator, output, 'Enter debit amount: ');
          console.log(operations.debit(parseAmount(amount)).message);
          break;
        }
        case '4':
          continueRunning = false;
          break;
        default:
          console.log('Invalid choice, please select 1-4.');
      }
    }
  } finally {
    readlineInterface.close();
  }

  console.log('Exiting the program. Goodbye!');
}

module.exports = {
  INITIAL_BALANCE_CENTS,
  MAX_BALANCE_CENTS,
  createDataStore,
  createOperations,
  formatMoney,
  parseAmount,
  run
};

if (require.main === module) {
  run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}