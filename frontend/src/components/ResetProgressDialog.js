import Icon from './Icon';

export default function ResetProgressDialog({ onCancel, onConfirm }) {
  return <div className="modal-backdrop">
    <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title">
      <div className="reset-icon"><Icon name="reset" size={22}/></div>
      <h2 id="reset-title">Start fresh?</h2>
      <p>This clears your completed lessons, XP, and streak on this device.</p>
      <div><button className="text-button" onClick={onCancel}>Keep learning</button><button className="danger-button" onClick={onConfirm}>Reset progress</button></div>
    </section>
  </div>;
}
