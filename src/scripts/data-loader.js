(function bootstrapDataLoader(globalScope) {
  const TEMP_PREFIX = "TEMP_";

  function isPendingRecord(record) {
    return String(record?.id || "").startsWith(TEMP_PREFIX) || record?.syncStatus === "pending_sync";
  }

  function mergePendingRecords(remoteRecords, localRecords) {
    const pendingLocalRecords = localRecords.filter(isPendingRecord);
    return pendingLocalRecords.length > 0
      ? [...remoteRecords, ...pendingLocalRecords]
      : remoteRecords;
  }

  function sortByName(records) {
    return records.sort((a, b) => (a?.nome || "").localeCompare(b?.nome || ""));
  }

  function sortByDateDesc(records, fieldName) {
    return records.sort((a, b) => new Date(b?.[fieldName] || 0) - new Date(a?.[fieldName] || 0));
  }

  function createDataLoaders({ db, offlineDB, isOnline }) {
    return {
      async loadVendedores() {
        try {
          if (isOnline()) {
            const { data, error } = await db.from("vendedores").select("*").eq("ativo", true).order("nome");
            if (!error && data?.length) {
              await offlineDB.clear("vendedores");
              for (const vendedor of data) {
                await offlineDB.put("vendedores", vendedor);
              }
              return sortByName(data);
            }
            if (error) {
              console.error("Erro ao carregar vendedores do Supabase:", error);
            }
          }

          return sortByName(await offlineDB.getAll("vendedores"));
        } catch (error) {
          console.error("Erro fatal ao carregar vendedores:", error);
          return [];
        }
      },

      async loadClientes() {
        if (isOnline()) {
          const { data, error } = await db.from("clientes").select("*").eq("ativo", true).order("nome");
          if (!error && data) {
            const localRecords = await offlineDB.getAll("clientes");
            const mergedRecords = sortByName(mergePendingRecords(data, localRecords));
            await offlineDB.clear("clientes");
            for (const cliente of mergedRecords) {
              await offlineDB.put("clientes", cliente);
            }
            return mergedRecords;
          }
        }

        return sortByName(await offlineDB.getAll("clientes"));
      },

      async loadVisitas() {
        if (isOnline()) {
          const { data, error } = await db
            .from("visitas")
            .select("*,clientes(nome,propriedade_nome,cidade),vendedores(nome)")
            .order("data_hora", { ascending: false });

          if (!error && data) {
            const localRecords = await offlineDB.getAll("visitas");
            const mergedRecords = sortByDateDesc(mergePendingRecords(data, localRecords), "data_hora");
            await offlineDB.clear("visitas");
            for (const visita of mergedRecords) {
              await offlineDB.put("visitas", visita);
            }
            return mergedRecords;
          }
        }

        return sortByDateDesc(await offlineDB.getAll("visitas"), "data_hora");
      },

      async loadPlantios() {
        if (isOnline()) {
          const { data, error } = await db.from("plantios").select("*").eq("ativo", true);
          if (!error && data) {
            const localRecords = await offlineDB.getAll("plantios");
            const mergedRecords = mergePendingRecords(data, localRecords).filter(record => record?.ativo !== false);
            await offlineDB.clear("plantios");
            for (const plantio of mergedRecords) {
              await offlineDB.put("plantios", plantio);
            }
            return mergedRecords;
          }
        }

        return (await offlineDB.getAll("plantios")).filter(record => record?.ativo !== false);
      },

      async loadContatos() {
        if (isOnline()) {
          const { data, error } = await db
            .from("contatos")
            .select("*,clientes(nome),vendedores(nome)")
            .order("data_hora", { ascending: false });

          if (!error && data) {
            const localRecords = await offlineDB.getAll("contatos");
            const mergedRecords = sortByDateDesc(mergePendingRecords(data, localRecords), "data_hora");
            await offlineDB.clear("contatos");
            for (const contato of mergedRecords) {
              await offlineDB.put("contatos", contato);
            }
            return mergedRecords;
          }
        }

        return sortByDateDesc(await offlineDB.getAll("contatos"), "data_hora");
      },

      async loadRelatorioVendedores() {
        try {
          if (isOnline()) {
            const { data, error } = await db
              .from("relatorio_vendedores")
              .select("*")
              .order("total_visitas", { ascending: false });

            if (!error && data?.length) {
              await offlineDB.clear("relatorio_vendedores");
              for (const item of data) {
                await offlineDB.put("relatorio_vendedores", item);
              }
              return data;
            }
            if (error) {
              console.error("Erro ao carregar relatório de vendedores do Supabase:", error);
            }
          }

          return await offlineDB.getAll("relatorio_vendedores");
        } catch (error) {
          console.error("Erro fatal ao carregar relatório de vendedores:", error);
          return [];
        }
      },

      async loadPlantiosCriticos() {
        try {
          if (isOnline()) {
            const { data, error } = await db
              .from("plantios_criticos")
              .select("*")
              .order("critico", { ascending: false })
              .order("dias_plantio", { ascending: false });

            if (!error && data?.length) {
              await offlineDB.clear("plantios_criticos");
              for (const item of data) {
                await offlineDB.put("plantios_criticos", item);
              }
              return data;
            }
            if (error) {
              console.error("Erro ao carregar plantios críticos do Supabase:", error);
            }
          }

          return await offlineDB.getAll("plantios_criticos");
        } catch (error) {
          console.error("Erro fatal ao carregar plantios críticos:", error);
          return [];
        }
      }
    };
  }

  globalScope.ControlAgroDataLoader = {
    createDataLoaders
  };
})(window);
