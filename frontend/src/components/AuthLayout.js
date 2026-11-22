import styles from './AuthLayout.module.css';
import AnimatedHeadline from './AnimatedHeadline';
import TerminalPreview from './TerminalPreview';

export default function AuthLayout({ children }) {
  return <main className={styles.layout}>
    <section className={styles.brandPanel} aria-label="Learn Linux with LinuxLab">
      <svg className={styles.curve} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path className={styles.curveFill} d="M0 0H91C96 0 99 7 98 15C97 25 81 35 76 47C70 61 91 69 84 83C80 91 71 100 64 100H0Z"/>
        <path className={styles.curveEdge} d="M91 0C96 0 99 7 98 15C97 25 81 35 76 47C70 61 91 69 84 83C80 91 71 100 64 100"/>
      </svg>
      <div className={styles.gridLayer} aria-hidden="true"/>
      <div className={styles.ambientMotion} aria-hidden="true"><span/><span/><span/></div>
      <div className={styles.brandContent}>
        <div className={styles.brand}><img src="/logo-page.png" alt=""/><span>linux<span>lab</span></span></div>
        <div className={styles.learningShowcase}>
          <AnimatedHeadline/>
          <TerminalPreview/>
        </div>
      </div>
    </section>
    <section className={styles.formPanel} aria-label="Account sign in">
      <div className={styles.cornerMotion} aria-hidden="true"><span/><span/><span/><span/><span/><span/></div>
      {children}
    </section>
  </main>;
}
