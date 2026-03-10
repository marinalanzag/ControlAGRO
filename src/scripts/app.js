const runtimeConfig = window.ControlAgroAppConfig.getRuntimeConfig();
        const SUPABASE_URL = runtimeConfig.supabaseUrl;
        const SUPABASE_KEY = runtimeConfig.supabaseAnonKey;
        const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        const offlineDB = window.ControlAgroOfflineDB.createOfflineDb();
        const dataLoaders = window.ControlAgroDataLoader.createDataLoaders({
            db,
            offlineDB,
            isOnline: () => navigator.onLine
        });
        const bootstrapState = window.ControlAgroBootstrapState;
        const authSession = window.ControlAgroAuthSession;

        // Service Worker
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW reg:', reg)).catch(err => console.error('SW err:', err)));
        }

        let geo = { lat: null, lng: null }, vendedores = [], clientes = [], visitas = [], plantios = [], contatos = [], curVend = null, photoFile = null, isMaster = false, masterName = null, editingClientId = null, editingVisitaId = null, contatoClienteId = null, isManualVisita = false, isManualCliente = false, initComplete = false, isSyncing = false;

        // Utilities
        const withTimeout = (p, ms = 8000) => Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), ms))]);
        const fmtDate = d => { const dt = new Date(d); return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '') };
        const fmtCur = v => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
        const fmtCurS = v => v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `R$ ${(v / 1e3).toFixed(0)}k` : fmtCur(v);
        const initials = n => n ? n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() : '--';
        const toast = (m, e = false) => { const t = document.getElementById('toast'); document.getElementById('toastMsg').textContent = m; t.classList.toggle('err', e); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000) };
        const fileToBase64 = file => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve({ data: r.result, name: file.name, type: file.type }); r.onerror = reject; r.readAsDataURL(file); });
        const base64ToBlob = (b64) => { const [meta, data] = b64.split(','); const mime = meta.match(/:(.*?);/)[1]; const bin = atob(data); const arr = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); return new Blob([arr], { type: mime }); };
        const badges = { prospeccao: { c: 'b-pro', t: 'Prospecção' }, analise: { c: 'b-ana', t: 'Análise' }, suporte: { c: 'b-sup', t: 'Suporte' }, posvenda: { c: 'b-pos', t: 'Pós-venda' } };
        const getBadge = m => badges[m] || { c: 'b-pro', t: m };
        const statuses = { 'sem-venda': { c: '', t: 'Sem proposta' }, prospeccao: { c: '', t: 'Prospecção' }, negociacao: { c: 'neg', t: 'Negociação' }, fechado: { c: 'fec', t: 'Fechado' }, perdido: { c: 'per', t: 'Perdido' } };
        const getStat = s => statuses[s] || { c: '', t: s };
        const origens = { indicacao: 'Indicação', visita: 'Visita', marketing: 'Marketing', evento: 'Evento', 'redes-sociais': 'Redes Sociais', outro: 'Outro', porteira: 'Porteira' };
        const getOrig = o => origens[o] || o;
        const authEngine = window.ControlAgroAuthEngine.createAuthEngine({
            vendedores: () => vendedores,
            toast,
            promptPassword: message => window.prompt(message)
        });

        // Geolocation
        function getGeo() {
            const st = document.getElementById('geoSt'), tx = document.getElementById('geoTxt');
            if (!navigator.geolocation) { st.classList.add('err'); tx.textContent = 'Geo não suportada'; return }
            navigator.geolocation.getCurrentPosition(
                p => { geo.lat = p.coords.latitude; geo.lng = p.coords.longitude; st.classList.remove('err'); tx.textContent = `Loc: ${geo.lat.toFixed(4)}, ${geo.lng.toFixed(4)}` },
                () => { st.classList.add('err'); tx.textContent = 'Permita acesso à localização' },
                { enableHighAccuracy: true, timeout: 10000 }
            );
        }

        async function loadVendedores() {
            try {
                vendedores = await dataLoaders.loadVendedores();
                console.log('Vendedores carregados:', vendedores.length);
            } catch (e) {
                console.error('Erro fatal ao carregar vendedores:', e);
                vendedores = [];
            }
        }

        async function loadClientes() {
            clientes = await dataLoaders.loadClientes();
        }

        async function loadVisitas() {
            visitas = await dataLoaders.loadVisitas();
        }

        async function loadPlantios() {
            plantios = await dataLoaders.loadPlantios();
            console.log('Plantios carregados:', plantios.length);
        }

        async function loadContatos() {
            contatos = await dataLoaders.loadContatos();
        }

        function renderBootstrapStatus() {
            const subtitle = document.querySelector('.login-sub');
            if (!subtitle) return;
            subtitle.textContent = bootstrapState.formatStatus(bootstrapState.getState());
        }

        function renderLoginActions() {
            const actions = document.getElementById('loginActions');
            if (!actions) return;

            const canRefresh = navigator.onLine;
            actions.innerHTML = `<button class="btn btn-s" type="button" id="btnRefreshBase" style="padding:10px 14px;font-size:0.8rem" ${canRefresh ? '' : 'disabled'}>Atualizar base</button>`;

            const refreshButton = document.getElementById('btnRefreshBase');
            if (!refreshButton) return;

            refreshButton.addEventListener('click', async () => {
                refreshButton.disabled = true;
                try {
                    await refreshLocalSnapshot('manual_refresh');
                    renderLoginList();
                    toast('Base atualizada para uso offline.');
                } catch (error) {
                    console.error('Falha ao atualizar base:', error);
                    toast('Falha ao atualizar base local.', true);
                } finally {
                    refreshButton.disabled = !navigator.onLine;
                }
            });
        }

        async function refreshLocalSnapshot(reason = 'init') {
            const previousBootstrapState = bootstrapState.getState();

            await Promise.race([
                loadVendedores(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadVendedores')), 10000))
            ]).catch(e => console.error('loadVendedores falhou:', e));

            await Promise.race([
                loadClientes(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadClientes')), 10000))
            ]).catch(e => console.error('loadClientes falhou:', e));

            await Promise.race([
                loadVisitas(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadVisitas')), 10000))
            ]).catch(e => console.error('loadVisitas falhou:', e));

            await Promise.race([
                loadPlantios(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadPlantios')), 10000))
            ]).catch(e => console.error('loadPlantios falhou:', e));

            await Promise.race([
                loadContatos(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadContatos')), 10000))
            ]).catch(e => console.error('loadContatos falhou:', e));

            await Promise.race([
                loadRelatorios(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loadRelatorios')), 10000))
            ]).catch(e => console.error('loadRelatorios falhou:', e));

            bootstrapState.setState({
                seeded: previousBootstrapState?.seeded || vendedores.length > 0 || clientes.length > 0 || visitas.length > 0 || plantios.length > 0 || contatos.length > 0,
                lastSuccessfulSyncAt: navigator.onLine
                    ? new Date().toISOString()
                    : (previousBootstrapState?.lastSuccessfulSyncAt || null),
                reason,
                online: navigator.onLine,
                vendedores: vendedores.length,
                clientes: clientes.length,
                visitas: visitas.length,
                plantios: plantios.length,
                contatos: contatos.length
            });
            renderBootstrapStatus();
        }

        function getContatosCliente(clienteId) {
            return contatos.filter(c => String(c.cliente_id) === String(clienteId));
        }

        function getResultadoLabel(r) {
            const labels = { 'sucesso': 'Contato realizado', 'sem-resposta': 'Sem resposta', 'reagendar': 'Reagendado', 'desistiu': 'Cliente desistiu' };
            return labels[r] || r;
        }

        function getResultadoClass(r) {
            const cls = { 'sucesso': 'resultado-sucesso', 'sem-resposta': 'resultado-semresposta', 'reagendar': 'resultado-reagendar', 'desistiu': 'resultado-desistiu' };
            return cls[r] || '';
        }

        function openModalContato(clienteId) {
            contatoClienteId = clienteId;
            const c = clientes.find(x => String(x.id) === String(clienteId));
            if (!c) return;
            document.getElementById('contatoClienteInfo').innerHTML = '<strong>' + c.nome + '</strong><br><span style="font-size:0.85rem;color:#666">' + (c.propriedade_nome || '') + ' • ' + (c.telefone || '') + '</span>';
            document.getElementById('frmContato').reset();
            document.getElementById('modal-contato').classList.add('act');
            document.body.style.overflow = 'hidden';
        }

        function closeModalContato() {
            document.getElementById('modal-contato').classList.remove('act');
            document.body.style.overflow = '';
            contatoClienteId = null;
        }

        async function saveContato() {
            const btn = document.querySelector('#modal-contato button[onclick="saveContato()"]');
            if (btn) btn.disabled = true;
            try {
                const resultado = document.getElementById('contatoResultado').value;
                const detalhes = document.getElementById('contatoDetalhes').value;
                const proxData = document.getElementById('contatoProxData').value || null;
                if (!resultado || !detalhes) { toast('Preencha resultado e detalhes', true); if (btn) btn.disabled = false; return; }

                const payload = {
                    cliente_id: contatoClienteId,
                    vendedor_id: curVend?.id,
                    resultado,
                    detalhes,
                    data_hora: new Date().toISOString()
                };

                const salvarOffline = async () => {
                    if (!offlineDB.db) { toast('Erro: Armazenamento offline não disponível', true); return false; }
                    payload.id = 'TEMP_' + Date.now();
                    payload.clientes = clientes.find(c => String(c.id) === String(contatoClienteId));
                    payload.vendedores = curVend;
                    await offlineDB.add('sync_queue', { type: 'CONTATO', payload, proxData });
                    await offlineDB.put('contatos', payload);
                    contatos.unshift(payload);
                    return true;
                };

                let salvoOnline = false;
                if (navigator.onLine) {
                    try {
                        const { data, error } = await db.from('contatos').insert(payload).select('*,clientes(nome),vendedores(nome)').single();
                        if (error) throw new Error(error.message);
                        await offlineDB.put('contatos', data);
                        contatos.unshift(data);
                        salvoOnline = true;

                        // Atualizar lembrete do cliente se houver próxima data
                        if (proxData) {
                            await db.from('clientes').update({ lembrete_data: proxData, lembrete_nota: 'Retorno agendado' }).eq('id', contatoClienteId);
                        } else {
                            await db.from('clientes').update({ lembrete_data: null, lembrete_nota: null }).eq('id', contatoClienteId);
                        }
                        await loadClientes();
                    } catch (e) {
                        console.error('Erro online, tentando offline:', e);
                        if (await salvarOffline()) {
                            toast('Conexão fraca. Salvo offline.', false);
                            updatePendingBadge();
                        } else {
                            throw e;
                        }
                    }
                } else {
                    if (await salvarOffline()) {
                        toast('Salvo offline. Sincronizará depois.');
                    }
                }

                closeModalContato();
                renderDash();
                if (salvoOnline) toast('Contato registrado!');
            } catch (e) {
                console.error('Erro ao salvar contato:', e);
                toast('Erro ao salvar: ' + e.message, true);
            } finally {
                if (btn) btn.disabled = false;
            }
        }

        function getPlantiosCliente(clienteId) {
            return plantios.filter(p => p.cliente_id === clienteId && p.ativo !== false);
        }

        function createTempPlantioId() {
            return 'TEMP_PL_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        }

        function buildPlantioSyncPayload(clienteId) {
            return tempPlantios.map(p => ({
                id: p.id || createTempPlantioId(),
                cliente_id: p.cliente_id || clienteId,
                cultura: p.cultura,
                tipo: p.tipo,
                data_plantio: p.data_plantio,
                ativo: p.toRemove ? false : p.ativo !== false,
                isNew: !p.id || !!p.isNew,
                toRemove: !!p.toRemove
            }));
        }

        async function persistOfflinePlantios(clienteId, plantioChanges) {
            for (const plantioChange of plantioChanges) {
                if (plantioChange.toRemove) {
                    const existingPlantio = plantios.find(p => String(p.id) === String(plantioChange.id))
                        || (await offlineDB.getAll('plantios')).find(p => String(p.id) === String(plantioChange.id));
                    if (existingPlantio) {
                        await offlineDB.put('plantios', { ...existingPlantio, ativo: false, syncStatus: 'pending_sync' });
                    }
                    continue;
                }

                await offlineDB.put('plantios', {
                    ...plantioChange,
                    cliente_id: clienteId,
                    ativo: true,
                    syncStatus: 'pending_sync'
                });
            }
        }

        // Plantios UI
        let tempPlantios = []; // Plantios temporários durante edição

        function renderPlantiosList() {
            const list = document.getElementById('plantiosList');
            if (!list) return;

            if (tempPlantios.length === 0) {
                list.innerHTML = '<div class="plantios-empty">Nenhum plantio cadastrado</div>';
                return;
            }

            list.innerHTML = tempPlantios.map((p, idx) => {
                const st = getEstagio(p.cultura, p.data_plantio);
                const faseHtml = st ? `<span class="plantio-fase">Dia ${st.dias} • ${st.fase}</span>` : '';
                const dataFmt = p.data_plantio ? new Date(p.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR') : '';
                return `<div class="plantio-item">
                    <span class="plantio-icon">🌱</span>
                    <div class="plantio-info">
                        <div class="plantio-cultura">${p.cultura} (${p.tipo || 'Safra'})</div>
                        <div class="plantio-meta">Plantio: ${dataFmt} ${faseHtml}</div>
                    </div>
                    <button type="button" class="plantio-rm" onclick="removerPlantio(${idx})">×</button>
                </div>`;
            }).join('');
        }

        function mostrarFormPlantio() {
            document.getElementById('addPlantioForm').style.display = 'block';
            document.getElementById('btnAddPlantio').style.display = 'none';
        }

        function cancelarPlantio() {
            document.getElementById('addPlantioForm').style.display = 'none';
            document.getElementById('btnAddPlantio').style.display = 'block';
            document.getElementById('newPlantioCultura').value = '';
            document.getElementById('newPlantioTipo').value = 'Safra';
            document.getElementById('newPlantioData').value = '';
        }

        function confirmarPlantio() {
            const cultura = document.getElementById('newPlantioCultura').value;
            const tipo = document.getElementById('newPlantioTipo').value;
            const data = document.getElementById('newPlantioData').value;

            if (!cultura || !data) {
                toast('Preencha cultura e data', true);
                return;
            }

            tempPlantios.push({ cultura, tipo, data_plantio: data, isNew: true });
            renderPlantiosList();
            cancelarPlantio();
        }

        function removerPlantio(idx) {
            const p = tempPlantios[idx];
            if (p.id) {
                // Marcar para remoção (já existe no banco)
                p.toRemove = true;
            } else {
                // Remover da lista (ainda não salvo)
                tempPlantios.splice(idx, 1);
            }
            renderPlantiosList();
        }

        async function savePlantios(clienteId) {
            for (const p of tempPlantios) {
                if (p.toRemove && p.id) {
                    // Desativar no banco
                    await db.from('plantios').update({ ativo: false }).eq('id', p.id);
                } else if (p.isNew) {
                    // Criar novo
                    const { data } = await db.from('plantios').insert({
                        cliente_id: clienteId,
                        cultura: p.cultura,
                        tipo: p.tipo,
                        data_plantio: p.data_plantio,
                        ativo: true
                    }).select().single();
                    if (data) plantios.push(data);
                }
            }
            // Recarregar plantios
            await loadPlantios();
        }

        function carregarPlantiosCliente(clienteId) {
            tempPlantios = clienteId
                ? getPlantiosCliente(clienteId).map(p => ({ ...p }))
                : [];
            renderPlantiosList();
        }

        // Login
        function renderLoginList() {
            const list = document.getElementById('loginList');
            let html = '';
            const currentBootstrapState = bootstrapState.getState();
            renderBootstrapStatus();
            renderLoginActions();
            if (!navigator.onLine && !currentBootstrapState?.seeded) {
                list.innerHTML = '<div style="text-align:center;padding:20px;color:#666;font-size:0.9rem;">Primeiro acesso offline bloqueado.<br>Conecte o app uma vez com internet para baixar a base inicial.</div>';
                return;
            }
            if (vendedores.length === 0) {
                html += '<div style="text-align:center;padding:20px;color:#666;font-size:0.9rem;">Nenhum vendedor encontrado.<br>Verifique sua conexao.</div>';
            } else {
                html = vendedores.map(v => `<div class="login-opt" onclick="selectUser('${v.id}',false,null)"><div class="login-av">${initials(v.nome)}</div><div><div class="login-name">${v.nome}</div><div class="login-role">Vendedor</div></div></div>`).join('');
            }
            html += `<div class="login-opt master" onclick="selectUser(null,true,'IVO')"><div class="login-av">IVO</div><div><div class="login-name">IVO</div><div class="login-role">Gestor Master</div></div></div>`;
            html += `<div class="login-opt master" onclick="selectUser(null,true,'GLADSTON')"><div class="login-av">GL</div><div><div class="login-name">GLADSTON</div><div class="login-role">Gestor Master</div></div></div>`;
            list.innerHTML = html;
        }

        function selectUser(id, master, name, restore = false) {
            if (!navigator.onLine && !authSession.canUseOffline({ id, master, name }, bootstrapState.getState())) {
                toast('Primeiro acesso exige internet para baixar a base inicial.', true);
                renderLoginList();
                return;
            }

            const validation = authEngine.validateSelection({ id, master, restore });
            if (!validation.ok) {
                return;
            }

            isMaster = master;
            masterName = name;
            if (master) {
                curVend = { id: null, nome: name };
                document.getElementById('masterBadge').innerHTML = '<span class="master-badge">GESTOR</span>';
            } else {
                curVend = vendedores.find(v => v.id === id);
                document.getElementById('masterBadge').innerHTML = '';
            }
            if (!curVend) {
                // If restore fails (user not found), fallback to login
                console.warn('User restore failed: User not found in list');
                logout();
                return;
            }

            document.getElementById('userAv').textContent = initials(curVend.nome);
            document.getElementById('loginScr').classList.add('hide');
            document.getElementById('appMain').style.display = 'block';

            // Mostrar/ocultar aba Relatórios para gestores
            document.querySelectorAll('.master-only').forEach(el => {
                el.style.display = master ? '' : 'none';
            });

            authSession.setSession({ id, master, name });
            renderAll();
        }

        function logout() {
            authSession.clearSession();
            document.getElementById('loginScr').classList.remove('hide');
            document.getElementById('appMain').style.display = 'none';
            curVend = null; isMaster = false; masterName = null;
            renderLoginList();
        }

        function checkSavedLogin(retryCount = 0) {
            const savedSession = authSession.getSession();
            const currentBootstrapState = bootstrapState.getState();
            if (!navigator.onLine && !authSession.canUseOffline(savedSession, currentBootstrapState)) {
                renderLoginList();
                return;
            }
            if (savedSession) {
                try {
                    const { id, master, name } = savedSession;
                    if (master) { selectUser(null, true, name || 'IVO', true) }
                    else if (id) {
                        // Wait for vendedores to populate if empty
                        if (vendedores.length === 0) {
                            if (retryCount < 10) {
                                setTimeout(() => checkSavedLogin(retryCount + 1), 500);
                                return;
                            }
                            // Offline com vendedores não carregados: restaurar sessão pelo localStorage
                            if (name && !navigator.onLine) {
                                console.warn('Offline sem vendedores - restaurando sessão do localStorage');
                                curVend = { id, nome: name };
                                isMaster = false;
                                document.getElementById('masterBadge').innerHTML = '';
                                document.getElementById('userAv').textContent = initials(name);
                                document.getElementById('loginScr').classList.add('hide');
                                document.getElementById('appMain').style.display = 'block';
                                renderAll(); updatePendingBadge();
                                return;
                            }
                            console.warn('Timeout: vendedores ainda vazios apos 5s');
                            renderLoginList();
                            return;
                        }
                        if (vendedores.find(v => v.id === id)) selectUser(id, false, null, true);
                        else {
                            console.warn('Usuario salvo nao encontrado na lista, mostrando login');
                            renderLoginList();
                        }
                    }
                    else { renderLoginList() }
                } catch (e) {
                    console.error('Erro ao restaurar login:', e);
                    renderLoginList();
                }
            } else { renderLoginList() }
        }

        // Navigation
        function showTab(tab) {
            document.querySelectorAll('.nav-t').forEach(t => t.classList.toggle('act', t.dataset.tab === tab));
            document.querySelectorAll('.scr').forEach(s => s.classList.toggle('act', s.id === `scr-${tab}`));

            // Ocultar FAB em relatórios
            const fab = document.getElementById('fab');
            if (tab === 'relatorios') {
                fab.style.display = 'none';
            } else {
                fab.style.display = '';
                fab.onclick = () => openModal(tab === 'clientes' ? 'cliente' : 'visita');
            }
        }
        document.querySelectorAll('.nav-t').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

        // Modals
        function openModal(m) {
            if (m === 'cliente' && !editingClientId) {
                isManualCliente = false;
                document.getElementById('frmCli').reset();
                document.querySelector('#modal-cliente .modal-t').textContent = 'Novo Cliente';
                document.querySelector('#btnSaveCli').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Cadastrar';
                carregarPlantiosCliente(null); // Limpar plantios para novo cliente
                cancelarPlantio(); // Esconder form de adicionar
                document.getElementById('cliManualBanner').style.display = 'none';
            }
            if (m === 'visita' && !editingVisitaId) {
                document.getElementById('frmVis').reset();
                document.querySelector('#modal-visita .modal-t').textContent = 'Nova Visita Técnica';
                document.querySelector('#btnSaveVis').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Registrar';
                document.getElementById('photoUp').classList.remove('has');
                document.getElementById('photoUp').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><div class="photo-txt">Toque para foto</div><div class="photo-hint">JPG, PNG até 5MB</div>';
            }
            document.getElementById(`modal-${m}`).classList.add('act'); document.body.style.overflow = 'hidden';
            if (m === 'visita') {
                isManualVisita = false;
                document.getElementById('geoSt').style.display = '';
                document.getElementById('manualDateGrp').style.display = 'none';
                popCliSelect(); getGeo();
            }
        }
        function openManualVisita() {
            isManualVisita = true;
            document.getElementById('frmVis').reset();
            document.querySelector('#modal-visita .modal-t').textContent = 'Visita Manual (sem localização)';
            document.querySelector('#btnSaveVis').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>Registrar';
            document.getElementById('photoUp').classList.remove('has');
            document.getElementById('photoUp').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><div class="photo-txt">Toque para foto</div><div class="photo-hint">JPG, PNG até 5MB</div>';
            document.getElementById('geoSt').style.display = 'none';
            document.getElementById('manualDateGrp').style.display = '';
            document.getElementById('visManualDate').value = '';
            document.getElementById('modal-visita').classList.add('act');
            document.body.style.overflow = 'hidden';
            popCliSelect();
        }
        function openManualCliente() {
            isManualCliente = true;
            document.getElementById('frmCli').reset();
            document.querySelector('#modal-cliente .modal-t').textContent = 'Novo Cliente (Offline)';
            document.querySelector('#btnSaveCli').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Cadastrar Offline';
            carregarPlantiosCliente(null);
            cancelarPlantio();
            document.getElementById('cliManualBanner').style.display = '';
            document.getElementById('modal-cliente').classList.add('act');
            document.body.style.overflow = 'hidden';
        }
        function closeModal(m) {
            document.getElementById(`modal-${m}`).classList.remove('act'); document.body.style.overflow = '';
            if (m === 'cliente') { editingClientId = null; tempPlantios = []; isManualCliente = false; }
            if (m === 'visita') { editingVisitaId = null; photoFile = null; isManualVisita = false; }
        }
        function popCliSelect() {
            const sel = document.getElementById('visCliente');
            sel.innerHTML = '<option value="">Selecione</option>' + clientes.map(c => `<option value="${c.id}">${c.nome} - ${c.propriedade_nome}</option>`).join('');
        }
        function editCliente(id) {
            closeDetalhes();
            const c = clientes.find(x => String(x.id) === String(id));
            if (!c) return;
            editingClientId = id;
            document.getElementById('cliNome').value = c.nome;
            document.getElementById('cliDoc').value = c.cpf_cnpj || '';
            document.getElementById('cliProdutorRural').value = c.produtor_rural || '';
            document.getElementById('cliTel').value = c.telefone;
            document.getElementById('cliEmail').value = c.email || '';
            document.getElementById('cliOrigem').value = c.origem;
            document.getElementById('cliProp').value = c.propriedade_nome;
            document.getElementById('cliEnd').value = c.endereco;
            document.getElementById('cliCidade').value = c.cidade;
            document.getElementById('cliArea').value = c.area_hectares || '';
            document.getElementById('cliCult').value = c.culturas_principais || '';

            // Plantios
            carregarPlantiosCliente(id);

            // Lembretes
            document.getElementById('cliLembreteData').value = c.lembrete_data ? c.lembrete_data.split('T')[0] : '';
            document.getElementById('cliLembreteNota').value = c.lembrete_nota || '';

            document.querySelector('#modal-cliente .modal-t').textContent = 'Editar Cliente';
            document.querySelector('#btnSaveCli').innerHTML = 'Salvar Alterações';
            openModal('cliente');
        }
        function editVisita(id) {
            closeDetalhes();
            const v = visitas.find(x => String(x.id) === String(id));
            if (!v) return;
            editingVisitaId = id;
            document.getElementById('visCliente').value = v.cliente_id;
            document.getElementById('visMotivo').value = v.motivo;
            document.getElementById('visDesc').value = v.descricao || '';
            document.getElementById('visStat').value = v.status_venda || 'sem-venda';
            document.getElementById('visValor').value = v.valor_estimado ? v.valor_estimado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
            document.getElementById('visObs').value = v.observacoes || '';
            if (v.foto_url) {
                document.getElementById('photoUp').classList.add('has');
                document.getElementById('photoUp').innerHTML = '<img src="' + v.foto_url + '" style="max-width:100%;max-height:150px;border-radius:8px">';
            }
            document.querySelector('#modal-visita .modal-t').textContent = 'Editar Visita';
            document.querySelector('#btnSaveVis').innerHTML = 'Salvar Alterações';
            openModal('visita');
        }

        // Renders
        function renderVisCard(v, showVend = false) {
            const cli = v.clientes || clientes.find(c => c.id === v.cliente_id) || {};
            const vend = v.vendedores || vendedores.find(x => x.id === v.vendedor_id) || {};
            const b = getBadge(v.motivo), st = getStat(v.status_venda);
            const visto = v.visto_gestor;
            const vistoHtml = `<span class="visto ${visto ? 'sim' : 'nao'}">${visto ? '✓ Visto' : '● Não visto'}</span>`;
            const btnVistoHtml = isMaster ? `<button class="btn-visto ${visto ? 'desmarcar' : 'marcar'}" onclick="event.stopPropagation();toggleVisto('${v.id}',${!visto})">${visto ? 'Desmarcar' : 'Marcar visto'}</button>` : '';
            const fotoHtml = v.foto_url ? `<img src="${v.foto_url}" class="v-foto" onclick="event.stopPropagation();openFoto('${v.foto_url}')" alt="Foto">` : '';
            return `<div class="v-card" data-vid="${v.id}" ${isMaster ? 'onclick="openVisitaDetalhes(this.dataset.vid)"' : ''}><div class="v-hdr"><div><div class="v-cli">${cli.nome || 'Cliente'}${vistoHtml}</div><div class="v-prop"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>${cli.propriedade_nome || ''} - ${cli.cidade || ''}</div></div><span class="v-badge ${b.c}">${b.t}</span></div><div class="v-det"><div class="v-d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${fmtDate(v.data_hora)}</div>${showVend ? `<div class="v-d"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>${vend.nome || ''}</div>` : ''}</div>${fotoHtml}<div class="v-st"><span class="st-i ${st.c}"></span><span class="st-t">${st.t}</span>${btnVistoHtml}${v.valor_estimado > 0 ? `<span class="st-v">${fmtCur(v.valor_estimado)}</span>` : ''}</div></div>`;
        }

        function openFoto(url) { document.getElementById('fotoModalImg').src = url; document.getElementById('fotoModal').classList.add('act') }
        function closeFoto() { document.getElementById('fotoModal').classList.remove('act') }

        async function toggleVisto(id, visto) {
            const { error } = await db.from('visitas').update({ visto_gestor: visto }).eq('id', id);
            if (error) { toast('Erro ao atualizar', true); return }
            await loadVisitas(); renderDash(); renderVisitas(); toast(visto ? 'Marcado como visto' : 'Desmarcado');
        }

        // Logic for Stage Calculation
        function getEstagio(cultura, dataPlantio) {
            if (!cultura || !dataPlantio) return null;
            const diff = Math.floor((new Date() - new Date(dataPlantio)) / (1000 * 60 * 60 * 24));
            if (diff < 0) return { dias: 0, fase: 'Pré-plantio', msg: 'Planejamento', alert: false };

            let fases = [];
            // Rules from User
            if (['Soja', 'Milho', 'Grãos'].includes(cultura)) {
                // 150 days cycle
                if (diff <= 5) return { dias: diff, fase: 'V2', msg: 'Germinação', alert: false };
                if (diff <= 14) return { dias: diff, fase: 'V3-V4', msg: 'Desenv. Inicial', alert: false };
                if (diff <= 28) return { dias: diff, fase: 'V6-V8', msg: 'Vegetativo', alert: false };
                if (diff <= 42) return { dias: diff, fase: 'V9-V10', msg: 'Pré-pendão', alert: false };
                if (diff <= 65) return { dias: diff, fase: 'VT (Pendão)', msg: 'Negociação!', alert: true }; // 56 days is critical
                if (diff <= 150) return { dias: diff, fase: 'R1-R6', msg: 'Reprodutivo', alert: false };
                return { dias: diff, fase: 'Colhido', msg: 'Pós-Safra', alert: true };
            } else if (cultura === 'Silagem') {
                // 120 days cycle
                // Assuming similar early stages
                if (diff <= 5) return { dias: diff, fase: 'V2', msg: 'Germinação', alert: false };
                if (diff <= 45) return { dias: diff, fase: 'Vegetativo', msg: 'Desenvolvimento', alert: false };
                if (diff <= 65) return { dias: diff, fase: 'VT', msg: 'Ponto de Corte?', alert: true };
                if (diff <= 120) return { dias: diff, fase: 'Maturação', msg: 'Colheita', alert: false };
                return { dias: diff, fase: 'Colhido', msg: 'Pós-Safra', alert: true };
            }
            return { dias: diff, fase: 'Ciclo Ativo', msg: 'Acompanhar', alert: false };
        }

        function renderCliCard(c) {
            const vend = vendedores.find(v => v.id === c.vendedor_id) || {};
            const numVis = visitas.filter(v => v.cliente_id === c.id).length;

            // Plantios ativos
            const cliPlantios = getPlantiosCliente(c.id);
            let stageHtml = '';
            cliPlantios.forEach(p => {
                const estagio = getEstagio(p.cultura, p.data_plantio);
                if (estagio) {
                    stageHtml += `<div class="c-stage ${estagio.alert ? 'alert' : ''}">${p.cultura} (${p.tipo || 'Safra'}) • Dia ${estagio.dias}</div>`;
                }
            });

            return `<div class="c-card" data-cid="${c.id}" onclick="openClienteDetalhes(this.dataset.cid)"><div class="c-av">${initials(c.nome)}</div><div class="c-info"><div class="c-name">${c.nome}</div><div class="c-meta">${c.propriedade_nome} • ${c.cidade}</div>${stageHtml}<div class="c-orig">${getOrig(c.origem)}</div></div><div class="c-vis"><span class="c-vc">${numVis} visitas</span><span class="c-lv">${vend.nome || ''}</span></div></div>`;
        }

        function renderVendCard(v) {
            const vis = visitas.filter(x => x.vendedor_id === v.id);
            const clis = clientes.filter(c => c.vendedor_id === v.id);
            const vendas = vis.filter(x => x.status_venda === 'fechado').reduce((a, x) => a + (parseFloat(x.valor_estimado) || 0), 0);
            return `<div class="vd-card"><div class="vd-hdr"><div class="vd-av">${initials(v.nome)}</div><div class="vd-info"><h4>${v.nome}</h4><span>${v.email}</span></div></div><div class="vd-stats"><div class="vd-stat"><div class="vd-stat-v">${vis.length}</div><div class="vd-stat-l">Visitas</div></div><div class="vd-stat"><div class="vd-stat-v">${clis.length}</div><div class="vd-stat-l">Clientes</div></div><div class="vd-stat"><div class="vd-stat-v">${fmtCurS(vendas)}</div><div class="vd-stat-l">Vendas</div></div></div></div>`;
        }

        function renderDash() {
            document.getElementById('curDate').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const myVisitas = getMyVisitas();
            const myClientes = getMyClientes();
            const now = new Date(), visMes = myVisitas.filter(v => { const d = new Date(v.data_hora); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length;
            const negoc = myVisitas.filter(v => v.status_venda === 'negociacao').reduce((a, v) => a + (parseFloat(v.valor_estimado) || 0), 0);
            const fech = myVisitas.filter(v => v.status_venda === 'fechado').length, tot = myVisitas.filter(v => ['fechado', 'perdido'].includes(v.status_venda)).length;
            const taxa = tot > 0 ? Math.round(fech / tot * 100) : 0;
            document.getElementById('stVisitas').textContent = visMes;
            document.getElementById('stClientes').textContent = myClientes.length;
            document.getElementById('stNegoc').textContent = fmtCurS(negoc);
            document.getElementById('stConv').textContent = taxa + '%';
            document.getElementById('recentVis').innerHTML = myVisitas.slice(0, 3).map(v => renderVisCard(v, true)).join('') || '<div class="empty"><p>Nenhuma visita</p></div>';

            renderAgenda();
        }

        function renderAgenda() {
            // Agenda Logic
            const agendaDiv = document.getElementById('agendaList');
            if (!agendaDiv) return; // Add div to HTML first

            const hoje = new Date();
            hoje.setHours(0, 0, 0, 0);

            let tarefas = [];
            const myClientes = getMyClientes();

            // 1. Lembretes e Follow-ups
            myClientes.forEach(c => {
                if (c.lembrete_data) {
                    const dt = new Date(c.lembrete_data); dt.setHours(0, 0, 0, 0);
                    const diff = (dt - hoje) / (1000 * 60 * 60 * 24);

                    if (diff < 0) tarefas.push({ type: 'ATRASADO', date: dt, cli: c, msg: c.lembrete_nota || 'Retomar contato', badge: 'ATRASADO' });
                    else if (diff === 0) tarefas.push({ type: 'HOJE', date: dt, cli: c, msg: c.lembrete_nota || 'Retomar contato', badge: 'HOJE' });
                    else if (diff <= 7) tarefas.push({ type: 'FUTURO', date: dt, cli: c, msg: c.lembrete_nota || 'Retomar contato', badge: fmtDateShort(dt) });
                }
            });

            // 2. TODOS os plantios ativos dos clientes
            myClientes.forEach(c => {
                const cliPlantios = getPlantiosCliente(c.id);
                cliPlantios.forEach(p => {
                    const st = getEstagio(p.cultura, p.data_plantio);
                    if (st) {
                        tarefas.push({
                            type: st.alert ? 'CICLO_ALERTA' : 'CICLO',
                            date: new Date(),
                            cli: c,
                            msg: `${p.cultura} (${p.tipo || 'Safra'}) - ${st.fase}`,
                            badge: `Dia ${st.dias}`,
                            dias: st.dias,
                            fase: st.fase,
                            estagio: st
                        });
                    }
                });
            });

            // Sort: Atrasado -> Hoje -> Ciclo Alerta -> Ciclo -> Futuro
            const order = { 'ATRASADO': 1, 'HOJE': 2, 'CICLO_ALERTA': 3, 'CICLO': 4, 'FUTURO': 5 };
            tarefas.sort((a, b) => order[a.type] - order[b.type]);

            if (tarefas.length === 0) {
                agendaDiv.innerHTML = '<div class="empty"><p>Nenhum cliente com safra ativa ou follow-up agendado</p></div>';
                return;
            }

            agendaDiv.innerHTML = tarefas.map(t => {
                let cls = '', badgeCls = '';
                if (t.type === 'ATRASADO') { cls = 't-red'; badgeCls = 'urgent'; }
                else if (t.type === 'HOJE') { cls = 't-blue'; badgeCls = 'today'; }
                else if (t.type === 'CICLO_ALERTA') { cls = 't-crop'; badgeCls = 'crop'; }
                else if (t.type === 'CICLO') { cls = 't-crop'; badgeCls = 'crop'; }
                else { cls = ''; badgeCls = 'soon'; }

                return `<div class="ag-task ${cls}" onclick="openClienteDetalhes('${t.cli.id}')">
                    <div class="ag-icon">${getAgendaIcon(t.type)}</div>
                    <div class="ag-info">
                        <div class="ag-t">${t.msg}</div>
                        <div class="ag-sub">${t.cli.nome} • ${t.cli.propriedade_nome || ''}</div>
                    </div>
                    <div class="ag-badge ${badgeCls}">${t.badge}</div>
                </div>`;
            }).join('');
        }

        function fmtDateShort(d) {
            return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
        }

        function getPlantioStatusTone(estagio) {
            if (!estagio) return 'neutral';
            if (estagio.alert) return 'alert';
            if (estagio.fase === 'Colhido') return 'done';
            if (estagio.dias <= 14) return 'initial';
            return 'active';
        }

        function getPlantioStatusLabel(estagio) {
            if (!estagio) return 'Sem status';
            if (estagio.fase === 'Colhido') return 'Pós-safra';
            if (estagio.alert) return 'Atenção no ciclo';
            if (estagio.dias <= 14) return 'Plantio recente';
            return 'Ciclo ativo';
        }

        function getAgendaIcon(type) {
            if (type === 'ATRASADO') {
                return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>';
            }
            if (type === 'HOJE' || type === 'FUTURO') {
                return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
            }
            if (type === 'CICLO_ALERTA') {
                return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.2-1 1.8-2.4 1.5-4.4 2.3 1.3 3.5 3 3.5 5.2 0 1.5-.5 2.8-1.5 3.8"/><path d="M8.5 13c-1.6-1-2.5-2.4-2.5-4.2 0-1.1.3-2.2 1-3.3 1.7 1 2.8 2.2 3.2 3.8"/></svg>';
            }
            return '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="M7 20h10"/><path d="M12 20V9"/><path d="M12 9c0-3-2-5-5-6 0 3 1 5 3 6"/><path d="M12 13c0-2 1-4 5-5 0 3-1 5-3 6"/></svg>';
        }

        // Filtrar dados por vendedor (masters veem tudo)
        function getMyVisitas() {
            if (isMaster) return visitas;
            return visitas.filter(v => v.vendedor_id === curVend?.id);
        }

        function getMyClientes() {
            if (isMaster) return clientes;
            return clientes.filter(c => c.vendedor_id === curVend?.id);
        }

        function renderVisitas(filter = 'todas') {
            let list = getMyVisitas();
            if (filter !== 'todas') list = list.filter(v => v.motivo === filter);
            document.getElementById('visList').innerHTML = list.length ? list.map(v => renderVisCard(v, true)).join('') : '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z"/></svg><h3>Nenhuma visita</h3><p>Registre sua primeira visita</p></div>';
        }

        function renderClientes(filter = 'todos') {
            let list = getMyClientes();
            if (filter !== 'todos') list = list.filter(c => c.origem === filter);
            document.getElementById('cliList').innerHTML = list.length ? list.map(c => renderCliCard(c)).join('') : '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><h3>Nenhum cliente</h3><p>Cadastre seu primeiro cliente</p></div>';
        }

        function renderEquipe() {
            // Vendedores só veem a si mesmos na equipe, masters veem todos
            const lista = isMaster ? vendedores : vendedores.filter(v => v.id === curVend?.id);
            document.getElementById('eqList').innerHTML = lista.map(v => renderVendCard(v)).join('') || '<div class="empty"><p>Nenhum vendedor</p></div>';
        }

        // Filters
        document.querySelectorAll('#pillsVis .pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#pillsVis .pill').forEach(x => x.classList.remove('act')); p.classList.add('act'); renderVisitas(p.dataset.f) }));
        document.querySelectorAll('#pillsCli .pill').forEach(p => p.addEventListener('click', () => { document.querySelectorAll('#pillsCli .pill').forEach(x => x.classList.remove('act')); p.classList.add('act'); renderClientes(p.dataset.f) }));

        // Search
        document.getElementById('srcVis').addEventListener('input', e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('#visList .v-card').forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none') });
        document.getElementById('srcCli').addEventListener('input', e => { const q = e.target.value.toLowerCase(); document.querySelectorAll('#cliList .c-card').forEach(c => c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none') });

        // Photo
        document.getElementById('photoIn').addEventListener('change', function (e) {
            const f = e.target.files[0]; if (!f) return; photoFile = f;
            const r = new FileReader();
            r.onload = ev => { const up = document.getElementById('photoUp'); up.classList.add('has'); up.innerHTML = `<img src="${ev.target.result}" class="photo-prev">` };
            r.readAsDataURL(f);
        });

        // Save Visita
        async function saveVisita() {
            const btn = document.getElementById('btnSaveVis'); btn.disabled = true;
            try {
                const cliId = document.getElementById('visCliente').value;
                const motivo = document.getElementById('visMotivo').value;
                const desc = document.getElementById('visDesc').value;
                const stat = document.getElementById('visStat').value;
                const valor = parseFloat(document.getElementById('visValor').value.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
                const obs = document.getElementById('visObs').value;
                const faltando = [];
                if (!cliId) faltando.push('Cliente');
                if (!motivo) faltando.push('Motivo');
                if (!desc) faltando.push('Descrição');
                if (isManualVisita && !document.getElementById('visManualDate').value) faltando.push('Data da visita');
                if (faltando.length > 0) { toast('Faltando: ' + faltando.join(', '), true); btn.disabled = false; return }

                const payload = { cliente_id: cliId, motivo, descricao: desc, status_venda: stat, valor_estimado: valor, observacoes: obs };

                const salvarOffline = async () => {
                    if (!offlineDB.db) { toast('Erro: Armazenamento offline não disponível', true); return false; }
                    if (editingVisitaId) {
                        payload.id = editingVisitaId;
                        const oldVisita = visitas.find(v => String(v.id) === String(editingVisitaId));
                        if (oldVisita) { payload.clientes = oldVisita.clientes; payload.vendedores = oldVisita.vendedores; payload.data_hora = oldVisita.data_hora; payload.latitude = oldVisita.latitude; payload.longitude = oldVisita.longitude; payload.vendedor_id = oldVisita.vendedor_id; }
                        const photoData = photoFile ? await fileToBase64(photoFile) : null;
                        await offlineDB.add('sync_queue', { type: 'VISITA_UPDATE', payload, photo: photoData });
                        await offlineDB.put('visitas', { ...oldVisita, ...payload });
                    } else {
                        payload.id = 'TEMP_' + Date.now();
                        payload.vendedor_id = curVend?.id;
                        payload.latitude = isManualVisita ? null : geo.lat;
                        payload.longitude = isManualVisita ? null : geo.lng;
                        payload.data_hora = isManualVisita ? new Date(document.getElementById('visManualDate').value).toISOString() : new Date().toISOString();
                        payload.clientes = clientes.find(c => String(c.id) === String(cliId)) || {};
                        payload.vendedores = curVend;
                        const photoData = photoFile ? await fileToBase64(photoFile) : null;
                        await offlineDB.add('sync_queue', { type: 'VISITA', payload, photo: photoData });
                        await offlineDB.put('visitas', payload);
                    }
                    await loadVisitas(); renderDash(); renderVisitas();
                    return true;
                };

                if (navigator.onLine) {
                    try {
                        let fotoUrl = null;
                        if (photoFile) {
                            const ext = photoFile.name.split('.').pop();
                            const path = `${Date.now()}.${ext}`;
                            const { data: upData, error: upErr } = await withTimeout(db.storage.from('visitas-fotos').upload(path, photoFile, { cacheControl: '3600', upsert: false }), 15000);
                            if (!upErr) {
                                const { data } = db.storage.from('visitas-fotos').getPublicUrl(path);
                                fotoUrl = data.publicUrl;
                            }
                        }
                        if (photoFile) payload.foto_url = fotoUrl;

                        let data, error;
                        if (editingVisitaId) {
                            const res = await withTimeout(db.from('visitas').update(payload).eq('id', editingVisitaId).select('*,clientes(nome,propriedade_nome,cidade),vendedores(nome)').single());
                            data = res.data; error = res.error;
                        } else {
                            payload.vendedor_id = curVend?.id;
                            payload.latitude = isManualVisita ? null : geo.lat;
                            payload.longitude = isManualVisita ? null : geo.lng;
                            payload.data_hora = isManualVisita ? new Date(document.getElementById('visManualDate').value).toISOString() : new Date().toISOString();
                            const res = await withTimeout(db.from('visitas').insert(payload).select('*,clientes(nome,propriedade_nome,cidade),vendedores(nome)').single());
                            data = res.data; error = res.error;
                        }
                        if (error) throw new Error(error.message);
                        await offlineDB.put('visitas', data);
                        await loadVisitas(); renderDash(); renderVisitas(); toast(editingVisitaId ? 'Visita atualizada!' : 'Visita registrada!');
                    } catch (e) {
                        console.error('Erro online, tentando offline:', e);
                        if (await salvarOffline()) {
                            toast('Conexão fraca. Salvo offline.', false);
                            updatePendingBadge();
                        } else {
                            throw e;
                        }
                    }
                } else {
                    if (await salvarOffline()) {
                        toast('Salvo offline. Sincronizará depois.');
                        updatePendingBadge();
                    }
                }

                closeModal('visita'); document.getElementById('frmVis').reset(); photoFile = null; editingVisitaId = null;
                document.getElementById('photoUp').classList.remove('has'); document.getElementById('photoUp').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg><div class="photo-txt">Toque para foto</div><div class="photo-hint">JPG, PNG até 5MB</div>';
            } catch (e) {
                console.error('Erro ao salvar visita:', e);
                toast('Erro ao salvar: ' + e.message, true);
            } finally {
                btn.disabled = false;
            }
        }

        // Save Cliente
        async function saveCliente() {
            const btn = document.getElementById('btnSaveCli'); btn.disabled = true;
            try {
                const nome = document.getElementById('cliNome').value;
                const doc = document.getElementById('cliDoc').value;
                const produtorRural = document.getElementById('cliProdutorRural').value || null;
                const tel = document.getElementById('cliTel').value;
                const email = document.getElementById('cliEmail').value;
                const origem = document.getElementById('cliOrigem').value;
                const prop = document.getElementById('cliProp').value;
                const end = document.getElementById('cliEnd').value;
                const cidade = document.getElementById('cliCidade').value;
                const area = parseFloat(document.getElementById('cliArea').value) || null;
                const cult = document.getElementById('cliCult').value;

                // Lembretes
                const lembrete_data = document.getElementById('cliLembreteData').value || null;
                const lembrete_nota = document.getElementById('cliLembreteNota').value;

                const faltando = [];
                if (!nome) faltando.push('Nome');
                if (!doc) faltando.push('CPF/CNPJ');
                if (!tel) faltando.push('Telefone');
                if (!origem) faltando.push('Origem');
                if (!prop) faltando.push('Propriedade');
                if (!end) faltando.push('Endereço');
                if (!cidade) faltando.push('Cidade');
                if (faltando.length > 0) { toast('Faltando: ' + faltando.join(', '), true); btn.disabled = false; return }

                const payload = {
                    vendedor_id: curVend?.id, nome, cpf_cnpj: doc, produtor_rural: produtorRural, telefone: tel, email, origem,
                    propriedade_nome: prop, endereco: end, cidade, area_hectares: area, culturas_principais: cult,
                    lembrete_data, lembrete_nota
                };

                let clienteId = editingClientId;

                const salvarOffline = async () => {
                    if (!offlineDB.db) { toast('Erro: Armazenamento offline não disponível', true); return false; }
                    if (editingClientId) {
                        const plantioChanges = buildPlantioSyncPayload(editingClientId);
                        payload.id = editingClientId;
                        await offlineDB.add('sync_queue', { type: 'CLIENTE_UPDATE', payload, plantios: plantioChanges });
                        await offlineDB.put('clientes', { ...payload, syncStatus: 'pending_sync' });
                        await persistOfflinePlantios(editingClientId, plantioChanges);
                    } else {
                        payload.id = 'TEMP_' + Date.now();
                        const novosPlantios = tempPlantios.filter(p => p.isNew && !p.toRemove).map(p => ({ cultura: p.cultura, tipo: p.tipo, data_plantio: p.data_plantio }));
                        await offlineDB.add('sync_queue', { type: 'CLIENTE_INSERT', payload, plantios: novosPlantios });
                        await offlineDB.put('clientes', { ...payload, syncStatus: 'pending_sync' });
                        for (const p of novosPlantios) {
                            await offlineDB.put('plantios', { id: createTempPlantioId(), cliente_id: payload.id, cultura: p.cultura, tipo: p.tipo, data_plantio: p.data_plantio, ativo: true, syncStatus: 'pending_sync' });
                        }
                    }
                    await loadClientes(); await loadPlantios(); renderDash(); renderClientes();
                    return true;
                };

                if (navigator.onLine && !isManualCliente) {
                    try {
                        let error, data;
                        if (editingClientId) {
                            const res = await withTimeout(db.from('clientes').update(payload).eq('id', editingClientId).select().single());
                            error = res.error; data = res.data;
                        } else {
                            const res = await withTimeout(db.from('clientes').insert(payload).select().single());
                            error = res.error; data = res.data;
                            clienteId = data?.id;
                        }

                        if (error) throw new Error(error.message);

                        // Salvar plantios
                        if (clienteId) {
                            await savePlantios(clienteId);
                        }

                        await offlineDB.put('clientes', data);
                        await loadClientes(); await loadPlantios(); renderDash(); renderClientes(); toast(editingClientId ? 'Cliente atualizado!' : 'Cliente cadastrado!');
                    } catch (e) {
                        console.error('Erro online, tentando offline:', e);
                        if (await salvarOffline()) {
                            toast('Conexão fraca. Salvo offline.', false);
                            updatePendingBadge();
                        } else {
                            throw e;
                        }
                    }
                } else {
                    if (await salvarOffline()) {
                        toast(isManualCliente ? 'Cadastrado offline! Sincronizará ao conectar.' : 'Salvo offline. Sincronizará depois.');
                        updatePendingBadge();
                    }
                }

                closeModal('cliente'); document.getElementById('frmCli').reset(); editingClientId = null;
            } catch (e) {
                console.error('Erro ao salvar cliente:', e);
                toast('Erro ao salvar: ' + e.message, true);
            } finally {
                btn.disabled = false;
            }
        }

        // Detalhes
        function openVisitaDetalhes(id) {
            const v = visitas.find(x => String(x.id) === String(id));
            if (!v) { alert('Visita não encontrada'); return; }
            const cli = v.clientes || clientes.find(c => c.id === v.cliente_id) || {};
            const vend = v.vendedores || vendedores.find(x => x.id === v.vendedor_id) || {};
            const b = getBadge(v.motivo), st = getStat(v.status_venda);

            const detModal = document.getElementById('detModal');
            const detTitle = document.getElementById('detTitle');
            const detBody = document.getElementById('detBody');

            detTitle.textContent = 'Detalhes da Visita';
            detBody.innerHTML =
                '<div class="det-section">' +
                '<div class="det-section-title">Vendedor</div>' +
                '<div class="det-row"><span class="det-label">Nome</span><span class="det-value">' + (vend.nome || '-') + '</span></div>' +
                '</div>' +
                '<div class="det-section">' +
                '<div class="det-section-title">Cliente</div>' +
                '<div class="det-row"><span class="det-label">Nome</span><span class="det-value">' + (cli.nome || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Propriedade</span><span class="det-value">' + (cli.propriedade_nome || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Cidade</span><span class="det-value">' + (cli.cidade || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Telefone</span><span class="det-value">' + (cli.telefone || '-') + '</span></div>' +
                '</div>' +
                '<div class="det-section">' +
                '<div class="det-section-title">Visita</div>' +
                '<div class="det-row"><span class="det-label">Data/Hora</span><span class="det-value">' + fmtDate(v.data_hora) + '</span></div>' +
                '<div class="det-row"><span class="det-label">Motivo</span><span class="det-value">' + b.t + '</span></div>' +
                '<div class="det-row"><span class="det-label">Status</span><span class="det-value">' + st.t + '</span></div>' +
                '<div class="det-row"><span class="det-label">Valor</span><span class="det-value">' + fmtCur(v.valor_estimado) + '</span></div>' +
                '<div class="det-row"><span class="det-label">Localização</span><span class="det-value">' + (v.latitude && v.longitude ? v.latitude.toFixed(4) + ', ' + v.longitude.toFixed(4) : '-') + '</span></div>' +
                '</div>' +
                '<div class="det-section">' +
                '<div class="det-section-title">Descrição</div>' +
                '<div class="det-desc">' + (v.descricao || '-') + '</div>' +
                '</div>' +
                (v.observacoes ? '<div class="det-section"><div class="det-section-title">Observações</div><div class="det-desc">' + v.observacoes + '</div></div>' : '') +
                (v.foto_url ? '<div class="det-section"><div class="det-section-title">Foto</div><img src="' + v.foto_url + '" class="det-foto" onclick="openFoto(\'' + v.foto_url + '\')"></div>' : '') +
                (v.vendedor_id === curVend?.id || isMaster ? '<div style="text-align:center;margin-top:20px"><button onclick="editVisita(\'' + v.id + '\')" style="flex:1;background:var(--g6);color:#fff;border:none;padding:12px 24px;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer">Editar Visita</button></div>' : '');

            detModal.classList.add('act');
        }

        function openClienteDetalhes(id) {
            // Permite acesso para vendors também
            const c = clientes.find(x => String(x.id) === String(id));
            if (!c) { alert('Cliente não encontrado'); return; }
            const vend = vendedores.find(v => v.id === c.vendedor_id) || {};
            const cliVisitas = visitas.filter(v => v.cliente_id === c.id);
            const cliContatos = getContatosCliente(id);
            const cliPlantios = getPlantiosCliente(id);

            const detModal = document.getElementById('detModal');
            const detTitle = document.getElementById('detTitle');
            const detBody = document.getElementById('detBody');

            // Histórico de contatos
            let contatosHtml = '';
            if (cliContatos.length > 0) {
                contatosHtml = '<div class="contato-hist"><div class="contato-hist-title">Histórico de Contatos (' + cliContatos.length + ')</div>';
                cliContatos.slice(0, 5).forEach(ct => {
                    const vendNome = ct.vendedores?.nome || vendedores.find(v => v.id === ct.vendedor_id)?.nome || '-';
                    contatosHtml += `<div class="contato-item">
                        <div class="contato-item-header"><span>${vendNome}</span><span>${fmtDate(ct.data_hora)}</span></div>
                        <div class="contato-item-resultado ${getResultadoClass(ct.resultado)}">${getResultadoLabel(ct.resultado)}</div>
                        <div class="contato-item-detalhes">${ct.detalhes}</div>
                    </div>`;
                });
                contatosHtml += '</div>';
            }

            let plantiosHtml = '';
            if (cliPlantios.length > 0) {
                plantiosHtml = '<div class="det-section"><div class="det-section-title">Status dos Plantios</div>';
                cliPlantios.forEach(p => {
                    const estagio = getEstagio(p.cultura, p.data_plantio);
                    const dataFmt = p.data_plantio ? new Date(p.data_plantio + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
                    plantiosHtml += '<div class="det-plantio-card">' +
                        '<div class="det-plantio-main">' +
                        '<div><div class="det-plantio-title">' + (p.cultura || 'Plantio') + ' (' + (p.tipo || 'Safra') + ')</div><div class="det-plantio-date">Plantio em ' + dataFmt + '</div></div>' +
                        '<div class="det-plantio-chips">' +
                        '<span class="det-plantio-chip">Dia ' + (estagio ? estagio.dias : '-') + '</span>' +
                        '<span class="det-plantio-chip tone-' + getPlantioStatusTone(estagio) + '">' + getPlantioStatusLabel(estagio) + '</span>' +
                        '</div>' +
                        '</div>' +
                        '<div class="det-plantio-stage">' + (estagio ? estagio.fase + ' • ' + estagio.msg : 'Status indisponível') + '</div>' +
                        '</div>';
                });
                plantiosHtml += '</div>';
            }

            detTitle.textContent = 'Detalhes do Cliente';
            detBody.innerHTML =
                '<div class="det-section">' +
                '<div class="det-section-title">Dados Pessoais</div>' +
                '<div class="det-row"><span class="det-label">Nome</span><span class="det-value">' + (c.nome || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">CPF/CNPJ</span><span class="det-value">' + (c.cpf_cnpj || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Telefone</span><span class="det-value">' + (c.telefone || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">E-mail</span><span class="det-value">' + (c.email || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Origem</span><span class="det-value">' + getOrig(c.origem) + '</span></div>' +
                '</div>' +
                '<div class="det-section">' +
                '<div class="det-section-title">Propriedade</div>' +
                '<div class="det-row"><span class="det-label">Nome</span><span class="det-value">' + (c.propriedade_nome || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Endereço</span><span class="det-value">' + (c.endereco || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Cidade</span><span class="det-value">' + (c.cidade || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Área</span><span class="det-value">' + (c.area_hectares ? c.area_hectares + ' ha' : '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Culturas</span><span class="det-value">' + (c.culturas_principais || '-') + '</span></div>' +
                '</div>' +
                '<div class="det-section">' +
                '<div class="det-section-title">Responsável</div>' +
                '<div class="det-row"><span class="det-label">Vendedor</span><span class="det-value">' + (vend.nome || '-') + '</span></div>' +
                '<div class="det-row"><span class="det-label">Total Visitas</span><span class="det-value">' + cliVisitas.length + '</span></div>' +
                '</div>' +
                plantiosHtml +
                (c.observacoes ? '<div class="det-section"><div class="det-section-title">Observações</div><div class="det-desc">' + c.observacoes + '</div></div>' : '') +
                contatosHtml +
                '<div style="text-align:center;margin-top:20px;display:flex;gap:10px">' +
                '<button onclick="editCliente(\'' + c.id + '\')" style="flex:1;background:var(--g6);color:#fff;border:none;padding:12px;border-radius:12px;font-weight:600;font-size:0.9rem;cursor:pointer">Editar Dados</button>' +
                '</div>';

            detModal.classList.add('act');
        }

        function closeDetalhes() { document.getElementById('detModal').classList.remove('act') }

        // Relatório de Vendedores
        let relatorioVendedores = [];
        let plantiosCriticos = [];
        let periodoAtual = 'total';

        async function loadRelatorios() {
            relatorioVendedores = await dataLoaders.loadRelatorioVendedores();
            plantiosCriticos = await dataLoaders.loadPlantiosCriticos();
            console.log('Relatório vendedores carregados:', relatorioVendedores.length);
            console.log('Plantios críticos carregados:', plantiosCriticos.length);
        }

        function renderRelatorios() {
            if (!isMaster) {
                document.getElementById('relList').innerHTML = '<div class="empty"><p>Acesso restrito a gestores</p></div>';
                return;
            }

            const periodo = periodoAtual;
            const lista = relatorioVendedores.map(v => {
                let visitas, clientes, vendas, valor;

                switch(periodo) {
                    case 'hoje':
                        visitas = v.visitas_hoje;
                        clientes = 0; // Clientes não têm filtro "hoje"
                        vendas = 0; // Vendas hoje não estão na view
                        valor = 0;
                        break;
                    case 'semana':
                        visitas = v.visitas_semana;
                        clientes = v.clientes_semana;
                        vendas = 0; // Vendas semana não estão na view
                        valor = 0;
                        break;
                    case 'mes':
                        visitas = v.visitas_mes;
                        clientes = v.clientes_mes;
                        vendas = 0; // Vendas mês não estão na view
                        valor = 0;
                        break;
                    default: // total
                        visitas = v.total_visitas;
                        clientes = v.total_clientes;
                        vendas = v.vendas_fechadas;
                        valor = v.valor_fechado;
                }

                return `
                    <div class="rel-card" onclick="abrirDetalhesVendedor('${v.vendedor_id}')">
                        <div class="rel-card-header">
                            <div class="avatar">${initials(v.vendedor_nome)}</div>
                            <div class="rel-card-info">
                                <div class="rel-card-nome">${v.vendedor_nome}</div>
                                <div class="rel-card-contato">${v.email || ''} ${v.telefone ? '• ' + v.telefone : ''}</div>
                            </div>
                        </div>
                        <div class="rel-card-metrics">
                            <div class="rel-metric">
                                <div class="rel-metric-label">Visitas</div>
                                <div class="rel-metric-value">${visitas}</div>
                            </div>
                            <div class="rel-metric">
                                <div class="rel-metric-label">Clientes</div>
                                <div class="rel-metric-value">${clientes}</div>
                            </div>
                            <div class="rel-metric">
                                <div class="rel-metric-label">Vendas</div>
                                <div class="rel-metric-value">${vendas}</div>
                            </div>
                            <div class="rel-metric">
                                <div class="rel-metric-label">Valor</div>
                                <div class="rel-metric-value">${fmtCurS(valor)}</div>
                            </div>
                        </div>
                        ${v.lembretes_atrasados > 0 ? `<div class="rel-alert">⚠ ${v.lembretes_atrasados} lembrete(s) atrasado(s)</div>` : ''}
                    </div>
                `;
            }).join('');

            document.getElementById('relList').innerHTML = lista || '<div class="empty"><p>Nenhum vendedor encontrado</p></div>';
        }

        function abrirDetalhesVendedor(vendedorId) {
            const vendedor = relatorioVendedores.find(v => v.vendedor_id === vendedorId);
            if (!vendedor) return;

            document.getElementById('vendedorDetalheTitulo').textContent = `Detalhes: ${vendedor.vendedor_nome}`;

            // Renderizar aba Resumo
            renderResumoVendedor(vendedor);

            // Abrir modal
            openModal('vendedor-detalhe');
        }

        function renderResumoVendedor(v) {
            const html = `
                <div class="rel-resumo">
                    <div class="rel-section">
                        <h4>Métricas Gerais</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Total de Visitas</div>
                                <div class="rel-stat-value">${v.total_visitas}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Visitas (Mês)</div>
                                <div class="rel-stat-value">${v.visitas_mes}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Visitas (Semana)</div>
                                <div class="rel-stat-value">${v.visitas_semana}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Visitas (Hoje)</div>
                                <div class="rel-stat-value">${v.visitas_hoje}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Clientes</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Total de Clientes</div>
                                <div class="rel-stat-value">${v.total_clientes}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Clientes (Mês)</div>
                                <div class="rel-stat-value">${v.clientes_mes}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Clientes (Semana)</div>
                                <div class="rel-stat-value">${v.clientes_semana}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Com Lembrete</div>
                                <div class="rel-stat-value">${v.clientes_com_lembrete}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Lembretes</h4>
                        <div class="rel-grid">
                            <div class="rel-stat ${v.lembretes_atrasados > 0 ? 'alert' : ''}">
                                <div class="rel-stat-label">Atrasados</div>
                                <div class="rel-stat-value">${v.lembretes_atrasados}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Hoje</div>
                                <div class="rel-stat-value">${v.lembretes_hoje}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Esta Semana</div>
                                <div class="rel-stat-value">${v.lembretes_semana}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Vendas</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Em Negociação</div>
                                <div class="rel-stat-value">${v.vendas_negociacao}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Fechadas</div>
                                <div class="rel-stat-value">${v.vendas_fechadas}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Perdidas</div>
                                <div class="rel-stat-value">${v.vendas_perdidas}</div>
                            </div>
                        </div>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Valor em Negociação</div>
                                <div class="rel-stat-value">${fmtCur(v.valor_negociacao)}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Valor Fechado</div>
                                <div class="rel-stat-value">${fmtCur(v.valor_fechado)}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Plantios</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Plantios Ativos</div>
                                <div class="rel-stat-value">${v.plantios_ativos}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Milho</div>
                                <div class="rel-stat-value">${v.plantios_milho}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Soja</div>
                                <div class="rel-stat-value">${v.plantios_soja}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Grãos</div>
                                <div class="rel-stat-value">${v.plantios_graos}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Tipos de Visita</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Prospecção</div>
                                <div class="rel-stat-value">${v.visitas_prospeccao}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Análise</div>
                                <div class="rel-stat-value">${v.visitas_analise}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Suporte</div>
                                <div class="rel-stat-value">${v.visitas_suporte}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Pós-venda</div>
                                <div class="rel-stat-value">${v.visitas_posvenda}</div>
                            </div>
                        </div>
                    </div>

                    <div class="rel-section">
                        <h4>Contatos</h4>
                        <div class="rel-grid">
                            <div class="rel-stat">
                                <div class="rel-stat-label">Total de Contatos</div>
                                <div class="rel-stat-value">${v.total_contatos}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Sucesso</div>
                                <div class="rel-stat-value">${v.contatos_sucesso}</div>
                            </div>
                            <div class="rel-stat">
                                <div class="rel-stat-label">Sem Resposta</div>
                                <div class="rel-stat-value">${v.contatos_sem_resposta}</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            document.getElementById('vendedorResumo').innerHTML = html;
        }

        function exportarCSV() {
            if (relatorioVendedores.length === 0) {
                toast('Nenhum dado para exportar', true);
                return;
            }

            const escapeCSV = (str) => {
                if (str === null || str === undefined) return '';
                const s = String(str);
                if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
                    return '"' + s.replace(/"/g, '""') + '"';
                }
                return s;
            };

            const headers = [
                'Nome', 'Email', 'Telefone',
                'Total Visitas', 'Visitas Hoje', 'Visitas Semana', 'Visitas Mês',
                'Total Clientes', 'Clientes Mês', 'Clientes Semana',
                'Vendas Negociação', 'Vendas Fechadas', 'Vendas Perdidas',
                'Valor Negociação', 'Valor Fechado',
                'Plantios Ativos', 'Lembretes Atrasados'
            ];

            const rows = relatorioVendedores.map(v => [
                escapeCSV(v.vendedor_nome),
                escapeCSV(v.email),
                escapeCSV(v.telefone),
                v.total_visitas,
                v.visitas_hoje,
                v.visitas_semana,
                v.visitas_mes,
                v.total_clientes,
                v.clientes_mes,
                v.clientes_semana,
                v.vendas_negociacao,
                v.vendas_fechadas,
                v.vendas_perdidas,
                v.valor_negociacao,
                v.valor_fechado,
                v.plantios_ativos,
                v.lembretes_atrasados
            ]);

            const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);

            link.setAttribute('href', url);
            link.setAttribute('download', `relatorio-vendedores-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast('Relatório exportado com sucesso!');
        }

        // Event listeners para filtros de período
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('act'));
                btn.classList.add('act');
                periodoAtual = btn.dataset.periodo;
                renderRelatorios();
            });
        });

        // Event listeners para tabs do modal
        document.querySelectorAll('.rel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.rel-tab').forEach(t => t.classList.remove('act'));
                document.querySelectorAll('.rel-tab-pane').forEach(p => p.classList.remove('act'));
                tab.classList.add('act');
                document.getElementById('rel-tab-' + tab.dataset.relTab).classList.add('act');
            });
        });

        function renderAll() {
            renderDash(); renderVisitas(); renderClientes(); renderEquipe(); renderRelatorios();
        }

        const syncEngine = window.ControlAgroSyncEngine.createSyncEngine({
            db,
            offlineDB,
            withTimeout,
            base64ToBlob,
            onSyncStateChange: active => {
                document.getElementById('syncInd').classList.toggle('show', active);
            },
            onAfterSync: async () => {
                await refreshLocalSnapshot('sync');
                renderAll();
            },
            onPendingBadgeRefresh: updatePendingBadge,
            toast,
            isOnline: () => navigator.onLine,
            isSyncing: () => isSyncing,
            setSyncing: value => { isSyncing = value; }
        });

        // Pendentes de Sync
        async function updatePendingBadge() {
            const queue = await offlineDB.getAll('sync_queue');
            const btn = document.getElementById('pendBtn');
            const count = document.getElementById('pendCount');
            if (!btn) return;
            if (queue.length > 0) {
                count.textContent = queue.length;
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
        }

        function openPendingModal() {
            renderPendingList();
            document.getElementById('modal-pendentes').classList.add('act');
            document.body.style.overflow = 'hidden';
        }

        function closePendingModal() {
            document.getElementById('modal-pendentes').classList.remove('act');
            document.body.style.overflow = '';
        }

        async function syncNow() {
            closePendingModal();
            if (!navigator.onLine) { toast('Sem conexão. Conecte-se à internet para sincronizar.', true); return; }
            await syncData();
        }

        async function renderPendingList() {
            const queue = await offlineDB.getAll('sync_queue');
            const list = document.getElementById('pendList');
            if (queue.length === 0) {
                list.innerHTML = '<div style="text-align:center;padding:32px 0;color:var(--n5)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40" style="margin-bottom:8px;display:block;margin-left:auto;margin-right:auto"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div style="font-weight:600;color:var(--n8)">Tudo sincronizado!</div><div style="font-size:.85rem;margin-top:4px">Nenhum item pendente</div></div>';
                return;
            }
            const typeMap = {
                'CLIENTE_INSERT': ['Novo cliente', 'new'],
                'CLIENTE_UPDATE': ['Atualização de cliente', 'upd'],
                'VISITA': ['Nova visita', 'new'],
                'VISITA_UPDATE': ['Atualização de visita', 'upd'],
                'CONTATO': ['Novo contato', 'new']
            };
            const isOnline = navigator.onLine;
            const header = `<div style="font-size:.8rem;color:var(--n5);margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--n1)">${queue.length} item(s) aguardando${isOnline ? ' — pronto para sincronizar' : ' — sem conexão no momento'}</div>`;
            list.innerHTML = header + queue.map(item => {
                const [label, cls] = typeMap[item.type] || [item.type, 'new'];
                const nome = item.payload?.nome || item.payload?.clientes?.nome || '—';
                const isTemp = String(item.payload?.id || '').startsWith('TEMP_');
                const hasError = item.syncError;
                const attempts = item.syncAttempts || 0;
                const errorLine = hasError
                    ? `<div class="pend-sub" style="color:#dc2626">&#9888; ${item.syncError}${attempts > 1 ? ` (${attempts}x)` : ''}</div>`
                    : (isTemp ? '<div class="pend-sub">ID temporário — aguarda conexão</div>' : '');
                return `<div class="pend-item" style="${hasError ? 'border-left:3px solid #dc2626;padding-left:8px' : ''}">
                    <div style="flex:1">
                        <span class="pend-tag pend-tag-${cls}">${label}</span>
                        <div class="pend-name">${nome}</div>
                        ${errorLine}
                    </div>
                </div>`;
            }).join('');
            document.getElementById('btnSyncNow').disabled = !isOnline;
            document.getElementById('btnSyncNow').style.opacity = isOnline ? '1' : '0.5';
        }

        async function syncData() {
            await syncEngine.syncData();
        }

        function updateOnlineStatus() {
            const isOffline = !navigator.onLine;
            document.getElementById('offBadge').classList.toggle('show', isOffline);
            renderBootstrapStatus();
            if (!isOffline && initComplete) syncData();
        }

        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);

        // Sync when app returns to foreground
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && navigator.onLine && initComplete) syncData();
        });

        // Periodic retry every 60s when there are pending items
        setInterval(async () => {
            if (!navigator.onLine || !initComplete) return;
            const queue = await offlineDB.getAll('sync_queue');
            if (queue.length > 0) syncData();
        }, 60000);

        // Init
        async function init() {
            try {
                document.getElementById('offBadge').classList.toggle('show', !navigator.onLine);
                renderBootstrapStatus();
                await refreshLocalSnapshot('init');
                console.log('Init completo - vendedores:', vendedores.length, 'clientes:', clientes.length, 'plantios:', plantios.length, 'contatos:', contatos.length);
            } catch (e) {
                console.error('Erro na inicializacao:', e);
            }
            // Sempre chamar checkSavedLogin, mesmo com erro
            checkSavedLogin();
            initComplete = true;
            updatePendingBadge();
            if (navigator.onLine) syncData();
        }
        document.addEventListener('DOMContentLoaded', init);
