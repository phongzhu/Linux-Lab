import { fireEvent, render, screen } from '@testing-library/react';
import SecurityWorkspace from './SecurityWorkspace';

test('sign-in workspace filters the supplied window before grouping events', () => {
  const onAction = jest.fn();
  render(<SecurityWorkspace lesson={{ lessonNumber: 3 }} attempt={{ state: { security: {} }, commands: [] }} busy={false} requestError="" onAction={onAction}/>);

  expect(screen.getByRole('button', { name: 'Group by user, source, endpoint' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Filter time window' }));
  expect(onAction).toHaveBeenCalledWith('security filter-signins window=09:00-10:00Z');
});
