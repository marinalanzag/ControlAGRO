(function authSessionModule(globalScope) {
  const STORAGE_KEY = "controlagro_user";

  function getSession() {
    try {
      return JSON.parse(globalScope.localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setSession(session) {
    globalScope.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    globalScope.localStorage.removeItem(STORAGE_KEY);
  }

  function canUseOffline(session, bootstrapState) {
    return Boolean(session && bootstrapState?.seeded);
  }

  globalScope.ControlAgroAuthSession = {
    getSession,
    setSession,
    clearSession,
    canUseOffline
  };
})(window);
