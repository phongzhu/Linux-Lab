import { fireEvent, render, screen } from '@testing-library/react';
import DeploymentWorkspace from './DeploymentWorkspace';

test('scale workspace exposes inspect then compare controls', () => {
  const onAction = jest.fn();
  const attempt = { state: { deployment: { scaling: { desired: 4, running: 3, partnerRateCeiling: 120, taskFamily: 'api-sim', namingConvention: 'REQ-TYYMMDD-NN', inspected: false } } }, commands: [] };
  render(<DeploymentWorkspace lesson={{ lessonNumber: 2 }} attempt={attempt} busy={false} requestError="" onAction={onAction}/>);

  expect(screen.getByRole('button', { name: 'Compare sent, arrived, and successful requests' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Inspect ECS setup' }));
  expect(onAction).toHaveBeenCalledWith('scale inspect');
});
