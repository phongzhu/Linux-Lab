import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { createSreAttempt, exportWorkbook, getSreAlarmTime, present, runSreTerminalCommand } from './sreKioskService.js';

test('seeded fleet shares WEB-2 between the two East kiosks and the alarm starts at 09:15 Manila', () => {
  const state = createSreAttempt();
  assert.equal(state.fleet.find((item) => item.id === 'KIOSK-LAB-017').backend, 'WEB-2');
  assert.equal(state.fleet.find((item) => item.id === 'KIOSK-LAB-018').backend, 'WEB-2');
  const firstHot = state.samples['WEB-2'].find((item) => item.cpu >= 85);
  assert.equal(firstHot.cpu, 94);
  assert.equal(getSreAlarmTime(state.samples), state.samples['WEB-2'][5].end);
  assert.equal(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(getSreAlarmTime(state.samples))), '09:15');
});

test('network sums preserve bytes and convert to the expected MiB per five-minute period', () => {
  const state = createSreAttempt();
  const point = state.samples['WEB-2'][4];
  assert.equal(point.networkInBytes, 180 * 1048576);
  assert.equal(point.networkOutBytes, 160 * 1048576);
});

test('virtual SSH enforces VPN routes and command actions remain scoped to the connected host', () => {
  const state = createSreAttempt('vpn-access');
  assert.equal(state.vpn.selectedProfile, 'Admin-Lab');
  const blocked = runSreTerminalCommand(state, 'ssh KIOSK-LAB-017');
  assert.match(blocked.output, /No route to host/);
  state.vpn.selectedProfile = 'Operations-East';
  const connected = runSreTerminalCommand(state, 'ssh KIOSK-LAB-017');
  assert.match(connected.output, /Connected/);
  assert.equal(state.terminal.currentHost, 'kiosk-017');
  const restarted = runSreTerminalCommand(state, 'systemctl restart retry-worker');
  assert.match(restarted.output, /configuration is still unsafe/);
  assert.equal(state.repaired, false);
});

test('monitoring remains visible when the selected private route is wrong', () => {
  const state = createSreAttempt('vpn-access');
  const view = present(state);
  assert.equal(view.resources[1].health, 'Healthy');
  assert.equal(view.vpn.reachable, false);
  assert.equal(view.resources[1].samples.length, 7);
});

test('export is a real XLSX with the required incident worksheets', async () => {
  const state = createSreAttempt();
  const buffer = await exportWorkbook(state);
  assert.equal(buffer.subarray(0, 2).toString('hex'), '504b');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Incident Log', 'Timeline', 'Metric Evidence', 'Asset Map']);
});
