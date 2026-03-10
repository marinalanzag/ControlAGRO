(function bootstrapStateModule(globalScope) {
  const STORAGE_KEY = "controlagro_bootstrap_state";

  function getState() {
    try {
      return JSON.parse(globalScope.localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
      return null;
    }
  }

  function setState(state) {
    globalScope.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function clearState() {
    globalScope.localStorage.removeItem(STORAGE_KEY);
  }

  function formatStatus(state) {
    if (!state?.seeded) {
      return "Conecte o app uma vez com internet para baixar a base inicial.";
    }

    const syncedAt = state.lastSuccessfulSyncAt
      ? new Date(state.lastSuccessfulSyncAt).toLocaleString("pt-BR")
      : "sem data";

    const counts = [];
    if (typeof state.vendedores === "number") counts.push(`${state.vendedores} vendedores`);
    if (typeof state.clientes === "number") counts.push(`${state.clientes} clientes`);
    if (typeof state.visitas === "number") counts.push(`${state.visitas} visitas`);
    if (typeof state.plantios === "number") counts.push(`${state.plantios} plantios`);
    if (typeof state.contatos === "number") counts.push(`${state.contatos} contatos`);

    return `Base local atualizada em ${syncedAt}${counts.length ? " • " + counts.join(" • ") : ""}`;
  }

  globalScope.ControlAgroBootstrapState = {
    getState,
    setState,
    clearState,
    formatStatus
  };
})(window);
