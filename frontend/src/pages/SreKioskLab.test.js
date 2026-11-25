import { render, screen } from '@testing-library/react';
import SreKioskLab from './SreKioskLab';
import { request } from '../services/apiClient';

jest.mock('../services/apiClient', () => ({ request: jest.fn() }));

const sample = { start: '2026-11-27T01:15:00.000Z', end: '2026-11-27T01:20:00.000Z', cpu: 95, networkInBytes: 220 * 1048576, networkOutBytes: 190 * 1048576, memory: 82, disk: 51, requests: 7000, errors: 4.2, latencyMs: 2970 };
const workspace = {
  scenario: 'cpu-network', clockLabel: '11/27/26, 09:20:00', paused: false, range: 'all',
  fleet: [{ id: 'KIOSK-LAB-017', ip: '10.40.6.17', network: 'Operations-East', backend: 'WEB-2', metrics: { disk: 53, heartbeat: true } }],
  resources: [{ id: 'i-0web002', name: 'WEB-2', ip: '10.40.20.12', network: 'Operations-East', region: 'us-east-1', health: 'Degraded', samples: [sample] }],
  selectedResource: 'WEB-2', selectedKiosk: 'KIOSK-LAB-017', alarm: { state: 'ALARM', createdAt: sample.end, threshold: 85, periods: 2 },
  acknowledged: false, vpn: { selectedProfile: 'Operations-East', connected: true, reachable: true, profiles: [{ name: 'Operations-East', route: '10.40.0.0/16', address: '10.40.0.24' }] },
  events: [], logs: [], evidence: [], terminal: { currentHost: 'operator-workstation', history: [], files: {}, services: {} }, configDraft: '',
  workbook: { fields: {}, updates: [] }, recoveredAt: null, completed: false,
};

beforeEach(() => { request.mockResolvedValue({ workspace }); });

test('renders the integrated fictional SRE workspace and exact network units', async () => {
  render(<SreKioskLab/>);
  expect(await screen.findByRole('heading', { name: 'SRE Incident Lab' })).toBeInTheDocument();
  expect(screen.getByText('AWS TRAINING ENVIRONMENT · SIMULATED')).toBeInTheDocument();
  expect(screen.getAllByText(/220.0 MiB/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Network values are byte totals per period/)).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Virtual multi-host terminal' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Incident workbook' })).toBeInTheDocument();
});
