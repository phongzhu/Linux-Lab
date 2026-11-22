import { fireEvent, render, screen } from '@testing-library/react';
import IncidentWorkspace from './IncidentWorkspace';

const incident = {
  alarm: {
    name: 'WEB-3-CPU-high', metric: 'CPUUtilization', statistic: 'Average', periodSeconds: 300,
    threshold: 70, datapointsToAlarm: 2, evaluationPeriods: 3, missingDataTreatment: 'notBreaching',
    points: [
      { time: '2026-11-22T09:00:00Z', value: 71 },
      { time: '2026-11-22T09:05:00Z', value: null },
      { time: '2026-11-22T09:10:00Z', value: 74 },
    ],
  },
};

test('alarm workspace requires inspection before evaluation and submits only simulated actions', () => {
  const onAction = jest.fn();
  render(<IncidentWorkspace lesson={{ lessonNumber: 1 }} attempt={{ state: { incident }, commands: [] }} busy={false} requestError="" onAction={onAction}/>);

  const evaluate = screen.getByRole('button', { name: 'Evaluate supplied datapoints' });
  expect(evaluate).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect full alarm settings' }));
  expect(onAction).toHaveBeenCalledWith('incident inspect-alarm');
});
