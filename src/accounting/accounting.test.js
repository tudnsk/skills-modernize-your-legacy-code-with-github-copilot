'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const accounting = require('./index.js');
const applicationPath = require('node:path').join(__dirname, 'index.js');

function createOperations(initialBalance = accounting.INITIAL_BALANCE_CENTS) {
  return accounting.createOperations(accounting.createDataStore(initialBalance));
}

function runApplication(input) {
  return spawnSync(process.execPath, [applicationPath], {
    input,
    encoding: 'utf8'
  });
}

test('TC-001: starts with the default account balance', () => {
  const result = runApplication('1\n4\n');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Current balance: 001000\.00/);
});

test('TC-002: displays the menu repeatedly after an operation', () => {
  const result = runApplication('1\n4\n');

  assert.equal(result.status, 0);
  assert.equal((result.stdout.match(/Account Management System/g) || []).length, 2);
});

test('TC-003: total returns the current unchanged balance', () => {
  const operations = createOperations();

  assert.deepEqual(operations.total(), {
    message: 'Current balance: 001000.00',
    balance: 100000
  });
});

test('TC-004: credits a valid amount and persists the new balance', () => {
  const operations = createOperations();

  assert.equal(operations.credit(accounting.parseAmount('50.00')).message, 'Amount credited. New balance: 001050.00');
  assert.equal(operations.total().balance, 105000);
});

test('TC-005: preserves decimal credit precision', () => {
  const operations = createOperations();

  assert.equal(operations.credit(accounting.parseAmount('12.34')).balance, 101234);
  assert.equal(operations.total().message, 'Current balance: 001012.34');
});

test('TC-006: rejects a zero credit', () => {
  const operations = createOperations();

  assert.equal(operations.credit(accounting.parseAmount('0.00')).message, 'Invalid credit amount. Enter a positive amount.');
  assert.equal(operations.total().balance, accounting.INITIAL_BALANCE_CENTS);
});

test('TC-007: rejects a negative credit', () => {
  const operations = createOperations();

  assert.equal(accounting.parseAmount('-10.00'), null);
  assert.equal(operations.credit(null).message, 'Invalid credit amount. Enter a positive amount.');
  assert.equal(operations.total().balance, accounting.INITIAL_BALANCE_CENTS);
});

test('TC-008: debits a valid amount when funds are sufficient', () => {
  const operations = createOperations();

  assert.equal(operations.debit(accounting.parseAmount('250.00')).message, 'Amount debited. New balance: 000750.00');
  assert.equal(operations.total().balance, 75000);
});

test('TC-009: accepts a debit equal to the available balance', () => {
  const operations = createOperations();

  assert.equal(operations.debit(accounting.parseAmount('1000.00')).balance, 0);
  assert.equal(operations.total().message, 'Current balance: 000000.00');
});

test('TC-010: rejects a debit greater than the available balance', () => {
  const operations = createOperations();

  assert.equal(operations.debit(accounting.parseAmount('1000.01')).message, 'Insufficient funds for this debit.');
  assert.equal(operations.total().balance, accounting.INITIAL_BALANCE_CENTS);
});

test('TC-011: rejects a zero debit', () => {
  const operations = createOperations();

  assert.equal(operations.debit(accounting.parseAmount('0.00')).message, 'Invalid debit amount. Enter a positive amount.');
  assert.equal(operations.total().balance, accounting.INITIAL_BALANCE_CENTS);
});

test('TC-012: rejects a negative debit', () => {
  const operations = createOperations();

  assert.equal(accounting.parseAmount('-10.00'), null);
  assert.equal(operations.debit(null).message, 'Invalid debit amount. Enter a positive amount.');
  assert.equal(operations.total().balance, accounting.INITIAL_BALANCE_CENTS);
});

test('TC-013: rejects an invalid menu selection and continues', () => {
  const result = runApplication('5\n4\n');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Invalid choice, please select 1-4\./);
  assert.equal((result.stdout.match(/Account Management System/g) || []).length, 2);
});

test('TC-014: exits normally with the COBOL goodbye message', () => {
  const result = runApplication('4\n');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Exiting the program\. Goodbye!/);
});

test('TC-015: preserves multiple transactions in one session', () => {
  const result = runApplication('2\n100.00\n3\n25.00\n2\n10.50\n1\n4\n');

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Current balance: 001085\.50/);
});

test('TC-016: initializes a new process with the default balance', () => {
  const firstRun = runApplication('2\n50.00\n4\n');
  const secondRun = runApplication('1\n4\n');

  assert.equal(firstRun.status, 0);
  assert.equal(secondRun.status, 0);
  assert.match(secondRun.stdout, /Current balance: 001000\.00/);
});

test('TC-017: accepts a transaction at the maximum supported balance', () => {
  const operations = createOperations(accounting.MAX_BALANCE_CENTS - 100);

  assert.equal(operations.credit(accounting.parseAmount('1.00')).balance, accounting.MAX_BALANCE_CENTS);
  assert.equal(operations.total().message, 'Current balance: 999999.99');
});

test('TC-018: rejects a transaction that exceeds the maximum balance', () => {
  const operations = createOperations(accounting.MAX_BALANCE_CENTS - 100);

  assert.equal(operations.credit(accounting.parseAmount('1.01')).message, 'Credit would exceed the maximum account balance.');
  assert.equal(operations.total().balance, accounting.MAX_BALANCE_CENTS - 100);
});