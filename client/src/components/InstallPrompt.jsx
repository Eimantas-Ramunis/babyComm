// PWA install prompt (mom-facing, Lithuanian). Chromium browsers fire `beforeinstallprompt`,
// which we capture and replay from a button. iOS Safari has no such event, so we show a
// one-time hint for Share → "Add to Home Screen". Hidden entirely when already installed;
// dismissal is remembered so mom is never nagged.

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'bg_install_dismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    function onBeforeInstall(e) {
      e.preventDefault(); // suppress the browser's mini-infobar; we show our own card
      setInstallEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  }

  async function install() {
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setInstallEvent(null); // the event is single-use either way
  }

  if (installed || dismissed) return null;

  // Chromium path: a real install button.
  if (installEvent) {
    return (
      <section className="card subscribe-card install-card">
        <p className="subscribe-card__text">Įsidiek mane į savo telefoną, mama 🥰</p>
        <div className="btn-row btn-row--center">
          <button type="button" className="btn btn--primary" onClick={install}>
            Įdiegti programėlę 🌱
          </button>
          <button type="button" className="btn" onClick={dismiss}>
            Vėliau
          </button>
        </div>
      </section>
    );
  }

  // iOS Safari path: instructions only (no install API exists).
  if (isIos()) {
    return (
      <section className="card subscribe-card install-card">
        <p className="subscribe-card__text">Įsidiek mane į savo telefoną, mama 🥰</p>
        <p className="muted">
          Paspausk <strong>Dalintis</strong> (kvadratėlis su rodykle) ir pasirink{' '}
          <strong>„Pridėti į pradžios ekraną“</strong>.
        </p>
        <div className="btn-row btn-row--center">
          <button type="button" className="btn" onClick={dismiss}>
            Supratau 💛
          </button>
        </div>
      </section>
    );
  }

  return null;
}
