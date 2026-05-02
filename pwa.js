(function () {
  const installButtons = Array.from(document.querySelectorAll("[data-install-app]"));
  let deferredPrompt = null;
  const userAgent = window.navigator.userAgent;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isAndroid = /android/i.test(userAgent);
  const isMobile = isIos || isAndroid;
  const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
  const isSecureHost =
    window.isSecureContext ||
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  function getInstallLabel() {
    if (isIos && isSafari) {
      return "Install on iPhone";
    }

    if (isMobile) {
      return "Install on Phone";
    }

    return "Install on Desktop";
  }

  function setButtons(options) {
    const hidden = Boolean(options.hidden);
    const label = options.label || getInstallLabel();

    installButtons.forEach((button) => {
      button.hidden = hidden;
      button.textContent = label;
      button.setAttribute("aria-hidden", hidden ? "true" : "false");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator) || !isSecureHost) {
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed:", error);
      });
    });
  }

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch (error) {
        console.warn("Install prompt did not complete:", error);
      }
      deferredPrompt = null;
      setButtons({ hidden: true });
      return;
    }

    if (isIos && isSafari && !isStandalone) {
      window.alert('To install this app on iPhone or iPad, tap Share and choose "Add to Home Screen".');
      return;
    }

    if (!isSecureHost) {
      window.alert("Install support needs HTTPS or localhost. Open this app from a secure site or localhost first, then use the install button again.");
      return;
    }

    if (isMobile) {
      window.alert('Open your browser menu and choose "Install app" or "Add to Home screen" if the install prompt does not appear automatically.');
      return;
    }

    window.alert('Open your browser menu and choose "Install app", or use the install icon in the address bar if your browser shows one.');
  }

  installButtons.forEach((button) => {
    button.addEventListener("click", handleInstallClick);
  });

  registerServiceWorker();

  if (isStandalone) {
    setButtons({ hidden: true });
    return;
  }

  setButtons({ hidden: false, label: getInstallLabel() });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    setButtons({ hidden: false, label: getInstallLabel() });
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    setButtons({ hidden: true });
  });
})();
