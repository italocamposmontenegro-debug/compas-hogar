import assert from 'node:assert/strict';
import {
  canAccessControlModule,
  dedupeControlRoles,
  getDefaultControlModule,
  getControlCapabilities,
  getPrimaryControlRole,
} from '../shared/control.ts';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

run('dedupeControlRoles keeps deterministic precedence', () => {
  assert.deepEqual(
    dedupeControlRoles(['SUPPORT', 'BREAK_GLASS', 'SUPPORT', 'CEO']),
    ['BREAK_GLASS', 'SUPPORT', 'CEO'],
  );
  assert.equal(getPrimaryControlRole(['SUPPORT', 'OPS_ADMIN']), 'OPS_ADMIN');
});

run('CEO gets broad read access without break glass capabilities', () => {
  assert.equal(canAccessControlModule(['CEO'], 'executive'), true);
  assert.equal(canAccessControlModule(['CEO'], 'billing'), true);
  assert.equal(canAccessControlModule(['CEO'], 'growth'), true);
  assert.equal(getControlCapabilities(['CEO']).has('break_glass.use'), false);
});

run('SUPPORT stays limited to customer, operations and risk visibility', () => {
  assert.equal(canAccessControlModule(['SUPPORT'], 'customers'), true);
  assert.equal(canAccessControlModule(['SUPPORT'], 'operations'), true);
  assert.equal(canAccessControlModule(['SUPPORT'], 'risk'), true);
  assert.equal(canAccessControlModule(['SUPPORT'], 'billing'), false);
  assert.equal(canAccessControlModule(['SUPPORT'], 'growth'), false);
  assert.equal(getDefaultControlModule(['SUPPORT']), 'customers');
});

run('BREAK_GLASS can access all modules', () => {
  for (const module of ['executive', 'billing', 'customers', 'operations', 'risk', 'growth'] as const) {
    assert.equal(canAccessControlModule(['BREAK_GLASS'], module), true);
  }
  assert.equal(getDefaultControlModule(['BREAK_GLASS']), 'executive');
});

console.log('All master control role tests passed.');
