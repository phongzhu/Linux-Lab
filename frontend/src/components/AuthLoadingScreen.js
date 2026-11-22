import styles from './AuthLoadingScreen.module.css';

export default function AuthLoadingScreen() {
  return <main className={styles.screen} role="status" aria-live="polite" aria-label="Preparing your LinuxLab workspace">
    <div className={styles.orbit} aria-hidden="true"><span/><span/><span/></div>
    <section className={styles.loader}>
      <div className={styles.brand}><img src="/logo-page.png" alt=""/><span>linux<span>lab</span></span></div>
      <svg className={styles.illustration} viewBox="0 0 300 190" aria-hidden="true">
        <ellipse cx="150" cy="171" rx="105" ry="9" fill="#c8dbd7" opacity=".5"/>
        <rect x="37" y="22" width="226" height="139" rx="15" fill="#102a34" stroke="#6e928c" strokeWidth="2"/>
        <path d="M52 22h196a15 15 0 0 1 15 15v17H37V37a15 15 0 0 1 15-15Z" fill="#244653"/>
        <circle cx="56" cy="39" r="4" fill="#d58f7a"/><circle cx="70" cy="39" r="4" fill="#d4b875"/><circle cx="84" cy="39" r="4" fill="#8bb59d"/>
        <text x="150" y="42" textAnchor="middle" fill="#acc0bb" fontFamily="monospace" fontSize="9">linuxlab · workspace</text>
        <text x="57" y="82" fill="#a8cfb3" fontFamily="monospace" fontSize="12">$</text>
        <rect className={styles.lineOne} x="73" y="72" width="104" height="8" rx="4" fill="#dce9e4" opacity=".82"/>
        <rect className={styles.lineTwo} x="57" y="96" width="165" height="7" rx="3.5" fill="#82a99b" opacity=".7"/>
        <rect className={styles.lineThree} x="57" y="113" width="128" height="7" rx="3.5" fill="#82a99b" opacity=".45"/>
        <rect x="57" y="137" width="8" height="13" rx="1" fill="#c8dbd7" className={styles.cursor}/>
        <path d="m125 161-10 11h70l-10-11" fill="#294954" stroke="#6e928c" strokeWidth="2" strokeLinejoin="round"/>
      </svg>
      <h1>Getting your workspace ready</h1>
      <p>Connecting to your LinuxLab account</p>
      <div className={styles.progressTrack} aria-hidden="true"><span/></div>
      <div className={styles.srOnly}>Please wait while we check your sign-in.</div>
    </section>
  </main>;
}
