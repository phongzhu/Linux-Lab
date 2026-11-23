import { act, fireEvent, render, screen } from '@testing-library/react';
import KioskPage from './KioskPage';

const click = (label) => fireEvent.click(screen.getByRole('button', { name: label }));

function enterDigits(value) {
  for (const digit of value) click(`Enter ${digit}`);
}

function openBillDetails() {
  click('Tap to Transact');
  click(/Pay a Bill/);
}

test('completes a mock bill payment, prints a receipt, and clears it on finish', () => {
  jest.useFakeTimers();
  render(<KioskPage/>);
  openBillDetails();

  click('Review payment');
  expect(screen.getByRole('alert')).toHaveTextContent('at least 6 digits');
  enterDigits('12345678');
  fireEvent.click(screen.getByText('Amount (PHP)').closest('button'));
  enterDigits('30');
  click('Review payment');
  expect(screen.getByRole('alert')).toHaveTextContent('cannot be paid exactly');

  click('Clear field');
  enterDigits('100');
  click('Review payment');
  expect(screen.getByText('Confirm your details')).toBeInTheDocument();
  expect(screen.getByText('••••5678')).toBeInTheDocument();
  click('Confirm & insert cash');

  expect(screen.getByRole('button', { name: 'Insert ₱500 bill' })).toBeDisabled();
  click('Insert ₱50 bill');
  expect(screen.getByText('₱50', { selector: 'b' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  click('Insert ₱50 bill');
  expect(screen.getByText('₱100', { selector: 'b' })).toBeInTheDocument();
  click('Continue');
  expect(screen.getByText('Processing payment')).toBeInTheDocument();

  act(() => jest.advanceTimersByTime(1100));
  expect(screen.getByText('Payment successful')).toBeInTheDocument();
  expect(screen.getByLabelText('Printed transaction receipt')).toBeInTheDocument();
  click('Finish');
  expect(screen.getByRole('heading', { name: 'Tap to Transact' })).toBeInTheDocument();
  expect(screen.queryByLabelText('Printed transaction receipt')).not.toBeInTheDocument();
  expect(screen.queryByText(/^PP-\d+$/)).not.toBeInTheDocument();
  jest.useRealTimers();
});

test('Back returns to the previous step, and confirmed cancellation resets the kiosk', () => {
  render(<KioskPage/>);
  openBillDetails();
  fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]);
  expect(screen.getByText('Choose a service')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Back' })[0]);
  expect(screen.getByRole('heading', { name: 'Tap to Transact' })).toBeInTheDocument();

  click('Tap to Transact');
  click(/Cash In/);
  enterDigits('123456');
  click('Cancel');
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  click('Yes, cancel');
  expect(screen.getByRole('heading', { name: 'Tap to Transact' })).toBeInTheDocument();
});
