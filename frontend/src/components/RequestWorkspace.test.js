import { fireEvent, render, screen } from '@testing-library/react';
import RequestWorkspace from './RequestWorkspace';

test('routing workspace exposes the simulated behavior controls', () => {
  const onAction = jest.fn();
  const requestLab = {
    routingInspected: true,
    routing: { behaviors: [
      { pattern: '/invoice/*', origin: 'invoice-general.training.test', forwardHeaders: ['Host'], forwardQuery: false, cachePolicy: 'cache-invoice-5m' },
      { pattern: '/invoice/21/*', origin: 'invoice-client-21.training.test', forwardHeaders: ['Host', 'X-Client-Code'], forwardQuery: true, cachePolicy: 'no-cache' },
    ], fixedOrder: false, tests: {} },
  };
  render(<RequestWorkspace lesson={{ lessonNumber: 2 }} attempt={{ state: { requestLab }, commands: [] }} busy={false} requestError="" onAction={onAction}/>);

  expect(screen.getByText('/invoice/*')).toBeInTheDocument();
  expect(screen.getByText('/invoice/21/*')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Move specific paths first' }));
  expect(onAction).toHaveBeenCalledWith('routing fix-order');
});
