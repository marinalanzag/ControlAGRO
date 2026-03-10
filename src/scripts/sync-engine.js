(function bootstrapSyncEngine(globalScope) {
  function createSyncEngine(deps) {
    const {
      db,
      offlineDB,
      withTimeout,
      base64ToBlob,
      onSyncStateChange,
      onAfterSync,
      onPendingBadgeRefresh,
      toast,
      isOnline,
      isSyncing,
      setSyncing
    } = deps;

    const tempIdMap = {};

    function sortQueue(queue) {
      const order = {
        CLIENTE_INSERT: 0,
        CLIENTE_UPDATE: 1,
        VISITA: 2,
        VISITA_UPDATE: 3,
        CONTATO: 4
      };

      return queue.sort((a, b) => (order[a.type] || 5) - (order[b.type] || 5));
    }

    async function uploadPhoto(photo) {
      if (!photo) {
        return null;
      }

      const blob = base64ToBlob(photo.data);
      const ext = photo.name.split(".").pop();
      const filePath = `${Date.now()}.${ext}`;
      const { error: uploadError } = await withTimeout(
        db.storage.from("visitas-fotos").upload(filePath, blob, {
          cacheControl: "3600",
          upsert: false
        }),
        20000
      );

      if (uploadError) {
        return null;
      }

      const { data } = db.storage.from("visitas-fotos").getPublicUrl(filePath);
      return data.publicUrl;
    }

    async function markError(item, message, syncErroMsgs) {
      await offlineDB.put("sync_queue", {
        ...item,
        syncError: message,
        syncAttempts: (item.syncAttempts || 0) + 1
      });
      syncErroMsgs.push(message);
    }

    async function handleVisitaInsert(item) {
      const fotoUrl = await uploadPhoto(item.photo);
      const payload = { ...item.payload, foto_url: fotoUrl };
      delete payload.id;
      delete payload.clientes;
      delete payload.vendedores;

      if (payload.cliente_id && tempIdMap[payload.cliente_id]) {
        payload.cliente_id = tempIdMap[payload.cliente_id];
      }

      const { data, error } = await withTimeout(db.from("visitas").insert(payload).select().single());
      if (error || !data) {
        throw new Error("Visita: " + (error ? error.message : "Resposta vazia"));
      }

      await offlineDB.delete("sync_queue", item.id);
      await offlineDB.delete("visitas", item.payload.id);
      await offlineDB.put("visitas", data);
    }

    async function handleClienteInsert(item) {
      const payload = { ...item.payload };
      const tempId = payload.id;
      delete payload.id;

      const { data, error } = await withTimeout(db.from("clientes").insert(payload).select().single());
      if (error || !data) {
        throw new Error("Cliente: " + (error ? error.message : "Resposta vazia"));
      }

      tempIdMap[tempId] = data.id;
      if (item.plantios && item.plantios.length > 0) {
        for (const plantio of item.plantios) {
          await withTimeout(db.from("plantios").insert({
            cliente_id: data.id,
            cultura: plantio.cultura,
            tipo: plantio.tipo,
            data_plantio: plantio.data_plantio,
            ativo: true
          }));
        }

        const allPlantios = await offlineDB.getAll("plantios");
        for (const plantio of allPlantios) {
          if (String(plantio.cliente_id) === String(tempId)) {
            await offlineDB.delete("plantios", plantio.id);
          }
        }
      }

      await offlineDB.delete("sync_queue", item.id);
      await offlineDB.delete("clientes", tempId);
      await offlineDB.put("clientes", data);
    }

    async function handleClienteUpdate(item) {
      const payload = { ...item.payload };
      const id = payload.id;
      const { data, error } = await withTimeout(db.from("clientes").update(payload).eq("id", id).select().single());
      if (error || !data) {
        throw new Error("Atualiz. cliente: " + (error ? error.message : "Resposta vazia"));
      }

      if (item.plantios && item.plantios.length > 0) {
        for (const plantio of item.plantios) {
          if (plantio.toRemove && !String(plantio.id).startsWith("TEMP_")) {
            await withTimeout(db.from("plantios").update({ ativo: false }).eq("id", plantio.id));
          } else if (!plantio.toRemove && (plantio.isNew || String(plantio.id).startsWith("TEMP_"))) {
            await withTimeout(db.from("plantios").insert({
              cliente_id: id,
              cultura: plantio.cultura,
              tipo: plantio.tipo,
              data_plantio: plantio.data_plantio,
              ativo: true
            }));
          }
        }
      }

      await offlineDB.delete("sync_queue", item.id);
      await offlineDB.put("clientes", data);
    }

    async function handleVisitaUpdate(item) {
      const fotoUrl = await uploadPhoto(item.photo);
      const payload = { ...item.payload };
      if (fotoUrl) {
        payload.foto_url = fotoUrl;
      }

      const id = payload.id;
      delete payload.id;
      delete payload.clientes;
      delete payload.vendedores;

      const { data, error } = await withTimeout(db.from("visitas").update(payload).eq("id", id).select().single());
      if (error || !data) {
        throw new Error("Atualiz. visita: " + (error ? error.message : "Resposta vazia"));
      }

      await offlineDB.delete("sync_queue", item.id);
      await offlineDB.put("visitas", data);
    }

    async function handleContatoInsert(item) {
      const payload = { ...item.payload };
      let clienteId = payload.cliente_id;
      delete payload.id;
      delete payload.clientes;
      delete payload.vendedores;

      if (clienteId && tempIdMap[clienteId]) {
        clienteId = tempIdMap[clienteId];
        payload.cliente_id = clienteId;
      }

      const { data, error } = await withTimeout(db.from("contatos").insert(payload).select().single());
      if (error || !data) {
        throw new Error("Contato: " + (error ? error.message : "Resposta vazia"));
      }

      await offlineDB.delete("sync_queue", item.id);
      await offlineDB.delete("contatos", item.payload.id);
      await offlineDB.put("contatos", data);

      if (item.proxData) {
        await withTimeout(db.from("clientes").update({
          lembrete_data: item.proxData,
          lembrete_nota: "Retorno agendado"
        }).eq("id", clienteId));
      } else {
        await withTimeout(db.from("clientes").update({
          lembrete_data: null,
          lembrete_nota: null
        }).eq("id", clienteId));
      }
    }

    async function syncData() {
      if (!isOnline() || isSyncing()) {
        return;
      }

      const queue = await offlineDB.getAll("sync_queue");
      if (queue.length === 0) {
        return;
      }

      setSyncing(true);
      onSyncStateChange(true);

      let syncOk = 0;
      let syncErro = 0;
      const syncErroMsgs = [];

      for (const item of sortQueue(queue)) {
        try {
          if (item.type === "VISITA") {
            await handleVisitaInsert(item);
          } else if (item.type === "CLIENTE_INSERT") {
            await handleClienteInsert(item);
          } else if (item.type === "CLIENTE_UPDATE") {
            await handleClienteUpdate(item);
          } else if (item.type === "VISITA_UPDATE") {
            await handleVisitaUpdate(item);
          } else if (item.type === "CONTATO") {
            await handleContatoInsert(item);
          }
          syncOk++;
        } catch (error) {
          console.error("Sync error for item:", item, error);
          const message = error.message === "Timeout"
            ? `${item.type}: Conexao lenta (timeout)`
            : error.message;
          await markError(item, message, syncErroMsgs);
          syncErro++;
        }
      }

      setSyncing(false);
      onSyncStateChange(false);
      await onAfterSync();
      await onPendingBadgeRefresh();

      if (syncErro > 0) {
        toast(`Sync: ${syncOk} ok, ${syncErro} com erro. ${syncErroMsgs[0]}`, true);
      } else if (syncOk > 0) {
        toast("Sincronização concluída!");
      }
    }

    return { syncData };
  }

  globalScope.ControlAgroSyncEngine = {
    createSyncEngine
  };
})(window);
