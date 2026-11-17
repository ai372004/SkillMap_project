// CSV that Excel opens correctly with Arabic text: UTF-8 with a BOM, CRLF line endings.
// Cells that start with = + - @ are prefixed with ' so Excel never runs them as formulas.
function cell(value) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows) {
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
