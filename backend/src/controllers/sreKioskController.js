import { requireString } from '../middleware/validate.middleware.js';
import { dispatch, exportWorkbook, loadAttempt, present } from '../simulation/sreKioskService.js';

export async function workspace(req, res) {
  const state = await loadAttempt(req.user.id, req.accessToken);
  res.json({ workspace: present(state) });
}

export async function action(req, res) {
  const current = await loadAttempt(req.user.id, req.accessToken);
  const state = await dispatch(req.user.id, req.accessToken, current, req.body || {});
  res.json({ workspace: present(state) });
}

export async function workbook(req, res) {
  const state = await loadAttempt(req.user.id, req.accessToken);
  const buffer = await exportWorkbook(state);
  const slug = String(state.scenario || 'incident').replace(/[^a-z0-9-]/gi, '-');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="linuxlab-${slug}-incident.xlsx"`);
  res.send(buffer);
}
