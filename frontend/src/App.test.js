import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import TerminalPreview from './components/TerminalPreview';

const response = (status, payload) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });
const user = { id: 'learner-1', email: 'learner@example.com' };
const unit = {
  number: 1,
  title: 'Explore the terminal',
  subtitle: 'Start with the basics.',
  color: 'mint',
  lessons: [{ id: 'u1l1', title: 'Your first commands', time: '3 min', objectives: [{ id: 'pwd' }] }],
};

function renderApp() {
  return render(<AuthProvider><App /></AuthProvider>);
}

beforeEach(() => {
  let meRequests = 0;
  global.fetch = jest.fn(async (url) => {
    if (url.endsWith('/auth/me')) {
      meRequests += 1;
      return meRequests === 1 ? response(401, {}) : response(200, { user });
    }
    if (url.endsWith('/auth/login')) return response(200, { user });
    if (url.endsWith('/auth/register')) return response(202, { confirmationRequired: true });
    if (url.endsWith('/units')) return response(200, { units: [unit] });
    if (url.endsWith('/progress')) return response(200, { progress: { completedLessons: [], xp: 0, streak: 0, activity: [] } });
    if (url.endsWith('/attempts/active')) return response(200, { attempts: [] });
    return response(404, { error: { message: 'Not found' } });
  });
});

afterEach(() => jest.restoreAllMocks());

test('shows the sign in page when there is no active session', async () => {
  renderApp();
  expect(await screen.findByRole('heading', { name: 'Login Page' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeEnabled();
});

test('signs in and loads the learning dashboard through the API', async () => {
  renderApp();
  await screen.findByRole('heading', { name: 'Login Page' });
  await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'strong-password');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  expect(await screen.findByRole('heading', { name: /ready for your first command/i })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: /explore the terminal/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.objectContaining({ method: 'POST', credentials: 'include' }));
});

test('opens the Album reference and filters the PDF study notes', async () => {
  renderApp();
  await screen.findByRole('heading', { name: 'Login Page' });
  await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'strong-password');
  await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
  await screen.findByRole('heading', { name: /ready for your first command/i });
  await userEvent.click(screen.getByRole('button', { name: 'Album' }));

  expect(await screen.findByRole('textbox', { name: 'Search topics' })).toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Filter by collection' })).toHaveValue('all');
  await userEvent.type(screen.getByRole('textbox', { name: 'Search topics' }), 'sed');
  expect(screen.getByText('Replace text with sed')).toBeInTheDocument();
  expect(screen.queryByText('Navigate directories with cd')).not.toBeInTheDocument();
  await userEvent.click(screen.getByText('Replace text with sed'));
  expect(screen.getByText(/Filters\.pdf, page 6/)).toBeInTheDocument();
});

test('supports keyboard password reveal without leaving the form flow', async () => {
  renderApp();
  await screen.findByRole('heading', { name: 'Login Page' });
  const email = screen.getByLabelText(/email/i);
  const password = screen.getByLabelText(/^password$/i);
  await userEvent.tab();
  expect(email).toHaveFocus();
  await userEvent.tab();
  expect(password).toHaveFocus();
  await userEvent.type(password, 'strong-password');
  await userEvent.tab();
  expect(screen.getByRole('button', { name: 'Show password' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');
  expect(password).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');
});

test('keeps registration and confirmation messaging available', async () => {
  renderApp();
  await screen.findByRole('heading', { name: 'Login Page' });
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('heading', { name: 'Create account' })).toBeInTheDocument();
  await waitFor(() => expect(document.querySelector('[data-phase]')).toHaveAttribute('data-phase', 'idle'));
  await userEvent.type(screen.getByLabelText(/email/i), 'new-learner@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'strong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByRole('status')).toHaveTextContent(/check your inbox/i);
  expect(global.fetch).toHaveBeenCalledWith('/api/v1/auth/register', expect.objectContaining({ method: 'POST', credentials: 'include' }));
});

test('switches forms in both directions while keeping the shared preview mounted', async () => {
  const { container } = renderApp();
  const preview = await screen.findByLabelText('Training preview');
  const formStage = container.querySelector('[data-phase]');

  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
  expect(formStage).toHaveAttribute('data-phase', 'exit');
  expect(formStage).toHaveAttribute('data-direction', 'left');
  const createHeading = await screen.findByRole('heading', { name: 'Create account' });
  expect(formStage).toHaveAttribute('data-phase', 'enter');
  expect(createHeading).toHaveFocus();
  await waitFor(() => expect(formStage).toHaveAttribute('data-phase', 'idle'));
  expect(screen.getByLabelText('Training preview')).toBe(preview);

  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(formStage).toHaveAttribute('data-phase', 'exit');
  expect(formStage).toHaveAttribute('data-direction', 'right');
  const loginHeading = await screen.findByRole('heading', { name: 'Login Page' });
  expect(formStage).toHaveAttribute('data-phase', 'enter');
  expect(loginHeading).toHaveFocus();
  expect(screen.getByLabelText('Training preview')).toBe(preview);
});

test('keeps the command guide mounted through its crumple close transition', async () => {
  renderApp();
  await screen.findByRole('heading', { name: 'Login Page' });
  await userEvent.type(screen.getByLabelText(/email/i), 'learner@example.com');
  await userEvent.type(screen.getByLabelText(/^password$/i), 'strong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await screen.findByRole('heading', { name: /ready for your first command/i });
  await userEvent.click(screen.getByRole('button', { name: 'Command guide' }));
  const guide = await screen.findByRole('dialog', { name: 'Command guide' });
  await userEvent.click(screen.getByRole('button', { name: 'Close command guide' }));
  expect(guide).toHaveClass('is-closing');
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Command guide' })).not.toBeInTheDocument(), { timeout: 1500 });
});

test('shows the complete training preview when reduced motion is requested', async () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = jest.fn().mockReturnValue({
    matches: true,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });
  const { container, unmount } = render(<TerminalPreview/>);
  await waitFor(() => expect(container.querySelectorAll('[class*="commandBlock"]')).toHaveLength(3));
  expect(container).toHaveTextContent('/home/learner');
  expect(container).toHaveTextContent(/app\.log\s+config\.json\s+reports/);
  expect(container).toHaveTextContent('[ERROR] Training service unavailable');
  unmount();
  window.matchMedia = originalMatchMedia;
});
