import { useEffect, useMemo, useState } from 'react';
import Icon from '../components/Icon';
import './KioskPage.css';

const BILL_DENOMINATIONS = [20, 50, 100, 500, 1000];
const MAX_AMOUNT = 10000;

function formatPeso(value) {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(value || 0);
}

function canMakeExactAmount(amount) {
  if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_AMOUNT) return false;
  const reachable = new Uint8Array(amount + 1);
  reachable[0] = 1;
  for (let current = 1; current <= amount; current += 1) {
    reachable[current] = BILL_DENOMINATIONS.some((bill) => current >= bill && reachable[current - bill]);
  }
  return Boolean(reachable[amount]);
}

function maskReference(value) {
  if (value.length <= 4) return '•'.repeat(value.length);
  return `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
}

const serviceDetails = {
  cashIn: { label: 'Cash In', field: 'Account number', hint: 'Enter the account number to receive your cash-in.', icon: 'arrow' },
  bill: { label: 'Pay a Bill', field: 'Bill reference number', hint: 'Enter the reference number printed on your sample bill.', icon: 'file' },
};

export default function KioskPage() {
  const [step, setStep] = useState('welcome');
  const [service, setService] = useState(null);
  const [reference, setReference] = useState('');
  const [amount, setAmount] = useState('');
  const [activeField, setActiveField] = useState('reference');
  const [inserted, setInserted] = useState(0);
  const [cancelPrompt, setCancelPrompt] = useState(false);
  const [error, setError] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const amountValue = Number(amount);
  const validAmount = useMemo(() => canMakeExactAmount(amountValue), [amountValue]);
  const details = service ? serviceDetails[service] : null;

  useEffect(() => {
    if (step !== 'processing') return undefined;
    const timer = window.setTimeout(() => {
      setTransactionId(`PP-${Date.now().toString().slice(-8)}`);
      setStep('success');
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [step]);

  const resetTransaction = () => {
    setStep('welcome');
    setService(null);
    setReference('');
    setAmount('');
    setActiveField('reference');
    setInserted(0);
    setCancelPrompt(false);
    setError('');
    setTransactionId('');
  };

  const startService = (nextService) => {
    setService(nextService);
    setStep('details');
    setError('');
  };

  const back = () => {
    setError('');
    if (step === 'services') setStep('welcome');
    else if (step === 'details') setStep('services');
    else if (step === 'confirm') setStep('details');
    else if (step === 'cash') setStep('confirm');
  };

  const appendKey = (key) => {
    setError('');
    if (activeField === 'reference') {
      if (reference.length < 16) setReference((current) => `${current}${key}`);
      return;
    }
    if (key === '00' && !amount) return;
    if (amount.length < 6) setAmount((current) => `${current}${key}`);
  };

  const handleKey = (key) => {
    if (key === 'clear') {
      if (activeField === 'reference') setReference('');
      else setAmount('');
      setError('');
      return;
    }
    if (key === 'delete') {
      if (activeField === 'reference') setReference((current) => current.slice(0, -1));
      else setAmount((current) => current.slice(0, -1));
      setError('');
      return;
    }
    appendKey(key);
  };

  const reviewDetails = () => {
    if (reference.length < 6) {
      setError('Enter at least 6 digits for the reference number.');
      setActiveField('reference');
      return;
    }
    if (!amount || !Number.isInteger(amountValue) || amountValue < 1 || amountValue > MAX_AMOUNT) {
      setError(`Enter a whole peso amount from ₱1 to ₱${MAX_AMOUNT.toLocaleString()}.`);
      setActiveField('amount');
      return;
    }
    if (!validAmount) {
      setError('That amount cannot be paid exactly with the available sample bills. Try ₱20, ₱40, ₱50, or another payable amount.');
      setActiveField('amount');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const insertBill = (bill) => {
    if (step !== 'cash' || inserted + bill > amountValue) return;
    setInserted((current) => current + bill);
    setError('');
  };

  const continuePayment = () => {
    if (inserted !== amountValue) return;
    setStep('processing');
  };

  const renderStep = () => {
    if (step === 'welcome') return <div className="kiosk-welcome">
      <div className="kiosk-hero-symbol" aria-hidden="true">₱</div>
      <p className="kiosk-overline">WELCOME TO PESOPAL</p>
      <h1>Everyday payments,<br/>made easy.</h1>
      <p className="kiosk-copy">Cash in or pay a bill in just a few simple steps.</p>
      <div className="kiosk-service-chips" aria-label="Available services"><span>Cash In</span><i/><span>Pay a Bill</span></div>
      <button className="kiosk-primary kiosk-start" onClick={() => setStep('services')}>Tap to Transact <Icon name="arrow" size={19}/></button>
      <p className="kiosk-demo-note"><span/> Sample transactions · No real payment</p>
    </div>;

    if (step === 'services') return <div className="kiosk-flow">
      <StepHeader step="Choose a service" subtitle="What would you like to do today?" onBack={back} onCancel={() => setCancelPrompt(true)}/>
      <div className="kiosk-service-options">
        <button className="kiosk-service-card" onClick={() => startService('cashIn')}><span className="kiosk-service-icon"><Icon name="arrow" size={23}/></span><strong>Cash In</strong><span>Add money to an account</span><b>Continue <Icon name="arrow" size={16}/></b></button>
        <button className="kiosk-service-card" onClick={() => startService('bill')}><span className="kiosk-service-icon yellow"><Icon name="file" size={23}/></span><strong>Pay a Bill</strong><span>Pay using a sample reference</span><b>Continue <Icon name="arrow" size={16}/></b></button>
      </div>
    </div>;

    if (step === 'details') return <div className="kiosk-flow">
      <StepHeader step={details.label} subtitle={details.hint} onBack={back} onCancel={() => setCancelPrompt(true)}/>
      <button type="button" aria-pressed={activeField === 'reference'} className={`kiosk-field ${activeField === 'reference' ? 'selected' : ''}`} onClick={() => setActiveField('reference')}>
        <span>{details.field}</span><strong>{reference || <i>Use the keypad to enter digits</i>}</strong>
      </button>
      <button type="button" aria-pressed={activeField === 'amount'} className={`kiosk-field kiosk-amount-field ${activeField === 'amount' ? 'selected' : ''}`} onClick={() => setActiveField('amount')}>
        <span>Amount (PHP)</span><strong>{amount ? formatPeso(amountValue) : <i>Enter amount in pesos</i>}</strong>
      </button>
      <NumericKeypad onKey={handleKey}/>
      {error && <p className="kiosk-error" role="alert">{error}</p>}
      <div className="kiosk-actions"><button className="kiosk-secondary" onClick={back}>Back</button><button className="kiosk-primary" onClick={reviewDetails}>Review payment <Icon name="arrow" size={17}/></button></div>
    </div>;

    if (step === 'confirm') return <div className="kiosk-flow kiosk-confirm-flow">
      <StepHeader step="Confirm your details" subtitle="Please check everything before continuing." onBack={back} onCancel={() => setCancelPrompt(true)}/>
      <div className="kiosk-summary"><SummaryRow label="Service" value={details.label}/><SummaryRow label={details.field} value={maskReference(reference)}/><SummaryRow label="Amount due" value={formatPeso(amountValue)} highlight/></div>
      <p className="kiosk-hint">Your sample transaction will only use the amount shown above.</p>
      <div className="kiosk-actions"><button className="kiosk-secondary" onClick={back}>Back</button><button className="kiosk-primary" onClick={() => { setInserted(0); setStep('cash'); }}>Confirm &amp; insert cash <Icon name="arrow" size={17}/></button></div>
    </div>;

    if (step === 'cash') return <div className="kiosk-flow kiosk-cash-flow">
      <StepHeader step="Insert cash" subtitle="Choose sample bills using the acceptor below." onBack={back} onCancel={() => setCancelPrompt(true)}/>
      <div className="kiosk-cash-total"><span>Amount due</span><strong>{formatPeso(amountValue)}</strong><span className={inserted === amountValue ? 'cash-exact' : ''}>Inserted <b>{formatPeso(inserted)}</b></span></div>
      <div className="kiosk-progress-track" aria-label={`${inserted} of ${amountValue} pesos inserted`}><span style={{ width: `${Math.min(100, (inserted / amountValue) * 100)}%` }}/></div>
      <p className="kiosk-hint">Bills that would go over the amount due are disabled.</p>
      {error && <p className="kiosk-error" role="alert">{error}</p>}
      <div className="kiosk-actions"><button className="kiosk-secondary" onClick={back}>Back</button><button className="kiosk-primary" disabled={inserted !== amountValue} onClick={continuePayment}>Continue <Icon name="arrow" size={17}/></button></div>
    </div>;

    if (step === 'processing') return <div className="kiosk-status" role="status" aria-live="polite"><span className="kiosk-processing-ring"/><p className="kiosk-overline">PLEASE WAIT</p><h2>Processing payment</h2><p>Keep this screen open while we complete your sample transaction.</p></div>;

    return <div className="kiosk-flow kiosk-success-flow">
      <div className="kiosk-success-icon"><Icon name="check" size={30}/></div>
      <p className="kiosk-overline">TRANSACTION COMPLETE</p>
      <h2>Payment successful</h2>
      <p className="kiosk-copy">Your sample transaction is complete. Please take your receipt below.</p>
      <div className="kiosk-summary"><SummaryRow label="Service" value={details?.label || ''}/><SummaryRow label="Reference" value={maskReference(reference)}/><SummaryRow label="Amount paid" value={formatPeso(amountValue)} highlight/><SummaryRow label="Transaction ID" value={transactionId}/></div>
      <button className="kiosk-primary kiosk-finish" onClick={resetTransaction}>Finish <Icon name="arrow" size={17}/></button>
    </div>;
  };

  const canInsert = step === 'cash';
  const receiptPrinted = step === 'success';

  return <main className="kiosk-page">
    <section className="kiosk-cabinet" aria-label="PesoPal transaction kiosk">
      <div className="kiosk-cabinet-header"><span className="kiosk-brand-symbol"><Icon name="bolt" size={21}/></span><div><strong>PesoPal</strong><small>PAYMENTS MADE SIMPLE</small></div><span className="kiosk-status-light" aria-label="Kiosk ready"/></div>
      <div className="kiosk-screen-frame"><div className="kiosk-screen" data-step={step}><div className="kiosk-screen-brand"><span><span className="screen-brand-dot"/> PESOPAL</span><small>{step === 'welcome' ? 'YOUR LOCAL PAYMENT POINT' : 'SECURE PAYMENT TERMINAL'}</small></div><div className="kiosk-screen-content" key={step}>{renderStep()}</div></div></div>
      <div className="kiosk-hardware-row">
        <div className="kiosk-receipt-hardware"><span className="hardware-label">RECEIPT</span><div className="receipt-slot"><span/></div>{receiptPrinted && <div className="receipt-paper" aria-label="Printed transaction receipt"><b>PESOPAL</b><span>TRANSACTION RECEIPT</span><i>{details?.label}</i><i>{formatPeso(amountValue)}</i><small>{transactionId}</small><small>THANK YOU!</small></div>}</div>
        <div className={`kiosk-acceptor ${canInsert ? 'acceptor-active' : ''}`}>
          <span className="hardware-label">CASH ACCEPTOR <small>PHP BILLS</small></span><div className="cash-slot"><span className="cash-slot-glow"/></div>
          <div className="bill-choices" aria-label="Choose a sample bill">{BILL_DENOMINATIONS.map((bill) => <button key={bill} disabled={!canInsert || inserted + bill > amountValue} onClick={() => insertBill(bill)} aria-label={`Insert ${formatPeso(bill)} bill`} title={`Insert ${formatPeso(bill)}`}>{bill}</button>)}</div>
          <span className="acceptor-caption">{canInsert ? 'TAP A BILL TO INSERT' : 'INSERT BILL'}</span>
        </div>
        <div className="kiosk-speaker" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div>
      </div>
      <div className="kiosk-cabinet-footer"><span>TRAINING MODEL · PP-01</span><span>● READY</span></div>
      <div className="kiosk-base"><span/></div>
      {cancelPrompt && <div className="kiosk-cancel-overlay" role="presentation"><div className="kiosk-cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-description"><span className="cancel-mark"><Icon name="close" size={22}/></span><h2 id="cancel-title">Cancel this transaction?</h2><p id="cancel-description">Your entered details and any inserted sample cash will be cleared.</p><div><button className="kiosk-secondary" onClick={() => setCancelPrompt(false)}>Keep going</button><button className="kiosk-danger" onClick={resetTransaction}>Yes, cancel</button></div></div></div>}
    </section>
  </main>;
}

function StepHeader({ step, subtitle, onBack, onCancel }) {
  return <div className="kiosk-step-header"><div><p className="kiosk-overline">TRANSACTION STEP</p><h2>{step}</h2><p>{subtitle}</p></div><div className="kiosk-step-buttons"><button className="kiosk-small-button" onClick={onBack}>Back</button><button className="kiosk-cancel-button" onClick={onCancel}>Cancel</button></div></div>;
}

function NumericKeypad({ onKey }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'delete'];
  return <div className="kiosk-keypad" aria-label="On-screen number keypad">{keys.map((key) => <button key={key} className={key === 'clear' || key === 'delete' ? 'keypad-utility' : ''} onClick={() => onKey(key)} aria-label={key === 'clear' ? 'Clear field' : key === 'delete' ? 'Delete last digit' : `Enter ${key}`}>{key === 'clear' ? 'Clear' : key === 'delete' ? '⌫' : key}</button>)}</div>;
}

function SummaryRow({ label, value, highlight }) {
  return <div className={highlight ? 'summary-row summary-highlight' : 'summary-row'}><span>{label}</span><strong>{value}</strong></div>;
}
