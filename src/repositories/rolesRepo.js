'use strict';
const { query } = require('../db/pool');

async function list() {
  const result = await query(`
    SELECT enumlabel AS name, enumlabel AS value, enumsortorder AS sort_order
    FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'account_role'
    ORDER BY enumsortorder
  `);
  return result.rows;
}

module.exports = { list };
