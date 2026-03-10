(function authEngineModule(globalScope) {
  const VENDOR_PASSWORDS = {
    rodrigo: "rodrigo26",
    edmundo: "edmundoagro26"
  };

  const MASTER_PASSWORD = "fazendeiro26";

  function createAuthEngine({ vendedores, toast, promptPassword }) {
    function validateSelection({ id, master, restore }) {
      if (restore) {
        return { ok: true };
      }

      if (master) {
        const password = promptPassword("Digite a senha do gestor:");
        if (password !== MASTER_PASSWORD) {
          toast("Senha incorreta!", true);
          return { ok: false };
        }
        return { ok: true };
      }

      const vendedor = vendedores().find(item => item.id === id);
      if (!vendedor) {
        toast("Vendedor não encontrado.", true);
        return { ok: false };
      }

      const shortName = vendedor.nome.toLowerCase().split(" ")[0];
      const vendorPassword = VENDOR_PASSWORDS[shortName];
      if (!vendorPassword) {
        return { ok: true };
      }

      const password = promptPassword(`Digite a senha de ${vendedor.nome}:`);
      if (password !== vendorPassword) {
        toast("Senha incorreta!", true);
        return { ok: false };
      }

      return { ok: true };
    }

    return { validateSelection };
  }

  globalScope.ControlAgroAuthEngine = {
    createAuthEngine
  };
})(window);
