// Unit tests for the CSV export helper. No database needed: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv } from '../src/utils/csv.js';

test('starts with a BOM and uses CRLF line endings', () => {
  assert.equal(toCsv([['a', 'b'], [1, 2]]), '﻿a,b\r\n1,2\r\n');
});

test('quotes commas, quotes and new lines', () => {
  assert.equal(toCsv([['x, y', 'say "hi"', 'two\nlines']]), '﻿"x, y","say ""hi""","two\nlines"\r\n');
});

test('Arabic text passes through unchanged', () => {
  assert.equal(toCsv([['سارة أحمد', 'متوسط']]), '﻿سارة أحمد,متوسط\r\n');
});

test('cells that look like formulas are neutralised', () => {
  assert.equal(toCsv([['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']]), '﻿"\'=HYPERLINK(""x"")",\'+1,\'-2,\'@SUM(A1)\r\n');
});

test('empty and missing values become empty cells', () => {
  assert.equal(toCsv([[null, undefined, '', 0]]), '﻿,,,0\r\n');
});
