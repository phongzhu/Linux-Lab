import { fireEvent, render, screen } from '@testing-library/react';
import MonitoringWorkspace from './MonitoringWorkspace';

const monitoring = {
  scopeOptions: { account: 'linuxlab-training', role: 'MetricsReadOnly', region: 'training-west-1', timezone: 'UTC' },
  scope: null,
  dashboards: [
    { id: 'fleet', name: 'Training Fleet Overview', source: 'Training metrics fixture', freshness: '2026-11-22T09:00:00Z' },
    { id: 'traffic', name: 'Training Request Signals', source: 'Training gateway fixture', freshness: '2026-11-22T09:00:00Z' },
    { id: 'history', name: 'Training Host Memory (fictional)', source: 'training-agent custom metric fixture', freshness: '2026-11-22T09:00:00Z' },
  ],
  openedDashboards: [],
  selection: { resource: 'WEB-1', window: 'current-5m', timezone: 'UTC' },
  metrics: {
    CPUUtilization: { unit: '%', statistic: 'Average', period: '5m', values: { 'WEB-1': 42 }, source: 'Training host telemetry fixture' },
    NetworkPacketsIn: { unit: 'packets', statistic: 'Sum', period: '5m', values: { 'WEB-1': 12840 }, source: 'Training network counter fixture' },
    NetworkPacketsOut: { unit: 'packets', statistic: 'Sum', period: '5m', values: { 'WEB-1': 9420 }, source: 'Training network counter fixture' },
    MemoryUsed: { unit: 'MiB', statistic: 'Average', period: '5m', values: { 'WEB-1': 6144 }, source: 'training-agent custom metric fixture; not a default host metric' },
  },
};

test('monitoring lesson uses dashboard controls and submits simulated actions, not shell commands', () => {
  const onAction = jest.fn();
  render(<MonitoringWorkspace lesson={{ lessonNumber: 1 }} attempt={{ state: { monitoring }, commands: [] }} busy={false} requestError="" onAction={onAction}/>);

  expect(screen.getByText('Fictional training data · read-only workspace')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply scope' }));
  expect(onAction).toHaveBeenCalledWith('dashboard scope account=linuxlab-training role=MetricsReadOnly region=training-west-1 timezone=UTC');
  fireEvent.click(screen.getByRole('button', { name: /Training Request Signals/ }));
  expect(onAction).toHaveBeenCalledWith('dashboard open traffic');
  fireEvent.click(screen.getAllByRole('button', { name: 'Inspect metric' })[0]);
  expect(onAction).toHaveBeenCalledWith('dashboard metric CPUUtilization resource=WEB-1 statistic=Average period=5m');
});

test('transaction workspace presents per-host values only after a same-window comparison', () => {
  const comparison = {
    window: 'monday-09', timezone: 'UTC',
    resources: [{ resource: 'WEB-1', attempts: 1000, successes: 900, failures: 100, logSamples: 1000 }],
    totals: { attempts: 1000, successes: 900, failures: 100, successRate: 90, failureRate: 10 },
  };
  render(<MonitoringWorkspace lesson={{ lessonNumber: 2 }} attempt={{ state: { monitoring: { ...monitoring, comparison } }, commands: [] }} busy={false} requestError="" onAction={jest.fn()}/>);
  expect(screen.getByRole('columnheader', { name: 'Attempts' })).toBeInTheDocument();
  expect(screen.getAllByRole('cell', { name: '1,000' }).length).toBeGreaterThan(0);
  expect(screen.getByText('Success rate')).toBeInTheDocument();
  expect(screen.getByText('90.00%')).toBeInTheDocument();
});
