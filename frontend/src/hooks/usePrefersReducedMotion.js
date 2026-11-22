import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function readPreference() {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

export default function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(readPreference);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(QUERY);
    const update = (event) => setReducedMotion(event.matches);
    setReducedMotion(media.matches);
    if (media.addEventListener) media.addEventListener('change', update);
    else media.addListener(update);
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', update);
      else media.removeListener(update);
    };
  }, []);

  return reducedMotion;
}
