const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

function loadAllowlist() {
  const filePath = path.join(__dirname, '..', 'data', 'nsb_allowlist.csv');

  if (!fs.existsSync(filePath)) {
    throw new Error(`Allowlist CSV not found at: ${filePath}`);
  }

  const csv = fs.readFileSync(filePath, 'utf8');

  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  return rows.map(r => ({
    epf: String(r.epf ?? '').trim(),
    email: String(r.email ?? '').trim().toLowerCase(),
  }));
}

function isAllowed(epf, email) {
  const epfStr = String(epf ?? '').trim();
  const emailStr = String(email ?? '').trim().toLowerCase();

  if (!epfStr || !emailStr) return false;

  const list = loadAllowlist();
  return list.some(r => r.epf === epfStr && r.email === emailStr);
}

module.exports = { isAllowed };
