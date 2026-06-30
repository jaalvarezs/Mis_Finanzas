if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }

function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    const pendientes = typeof contarPendientesSync === 'function' ? contarPendientesSync() : 0;
    badge.classList.remove('pending', 'offline');
    if (!navigator.onLine) {
        badge.innerText = pendientes > 0 ? `Sin conexión · ${pendientes} por sincronizar` : 'Sin conexión';
        badge.classList.add('offline');
    } else if (pendientes > 0) {
        badge.innerText = `Sincronizando ${pendientes} cambio${pendientes > 1 ? 's' : ''}...`;
        badge.classList.add('pending');
    } else {
        badge.innerText = 'Sincronizado';
    }
}
window.addEventListener('online', () => { actualizarEstadoRed(); sincronizarPendientes().then(() => { actualizarEstadoRed(); cargarDatos(); }); });
window.addEventListener('offline', actualizarEstadoRed);

// CONTROL DE BOTTOM NAV
function mostrarSeccion(id, btn) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if(btn) btn.classList.add("active");
}

function formatoPesos(valor) { return Number(valor || 0).toLocaleString('es-CO'); }

// ICONOS VISUALES (Tabler icon classes — se cargan vía CDN en index.html)
function getIconUI(cat, tipo) {
    const t = (cat || "").toLowerCase();
    if(tipo === 'Ingreso') return { i: 'ti-trending-up', c: 'bg-g', tc: 'text-g' };
    if(tipo === 'Ahorro') return { i: 'ti-pig', c: 'bg-b', tc: 'text-b' };
    if(t.includes('gemini') || t.includes('suscripción') || t.includes('ai')) return { i: 'ti-robot', c: 'bg-r', tc: 'text-r' };
    if(t.includes('tarjeta') || t.includes('deuda') || t.includes('crédito')) return { i: 'ti-credit-card', c: 'bg-r', tc: 'text-r' };
    if(t.includes('moto') || t.includes('transporte') || t.includes('gasolina') || t.includes('combustible')) return { i: 'ti-car', c: 'bg-r', tc: 'text-r' };
    if(t.includes('educación')) return { i: 'ti-school', c: 'bg-r', tc: 'text-r' };
    if(t.includes('hogar') || t.includes('servicios') || t.includes('claro') || t.includes('agua') || t.includes('vivienda')) return { i: 'ti-home', c: 'bg-r', tc: 'text-r' };
    if(t.includes('mercado') || t.includes('alimentación') || t.includes('canasta')) return { i: 'ti-shopping-cart', c: 'bg-r', tc: 'text-r' };
    if(t.includes('entretenimiento') || t.includes('juego')) return { i: 'ti-device-gamepad-2', c: 'bg-r', tc: 'text-r' };
    if(t.includes('salud')) return { i: 'ti-heart-rate-monitor', c: 'bg-r', tc: 'text-r' };
    return { i: 'ti-receipt-2', c: 'bg-r', tc: 'text-r' };
}
function iconTag(name, extraStyle) { return `<i class="ti ${name} icon" style="${extraStyle||''}" aria-hidden="true"></i>`; }

let estadoApp = { creditos: [], tarjetas: [], comparativoMensual: [], categoriasGastos: [], categoriasAhorro: [], ultimosMovimientos: [] };
let tipoActualReg = "Gasto";

const categoriasMenu = {
    "Ingreso": ["Salario", "Pago proveedores", "Regalo", "Venta", "Otro ingreso"],
    "Gasto": ["Servicios públicos", "Canasta familiar", "Deudas", "Transporte", "Combustible", "Vivienda", "Salud", "Educación", "Entretenimiento", "Otro gasto"],
    "Ahorro": ["Ahorro personal", "Fondo de emergencia"]
};

// LÓGICA DEL TECLADO NATIVO
let valorTeclado = "";
function actualizarPantallaValor() { document.getElementById("pantallaValor").innerText = valorTeclado === "" ? "0" : Number(valorTeclado).toLocaleString('es-CO'); }
function tecla(n) { if(valorTeclado.length < 9) { valorTeclado += n; actualizarPantallaValor(); } }
function teclaDel() { valorTeclado = valorTeclado.slice(0, -1); actualizarPantallaValor(); }
function teclaC() { valorTeclado = ""; actualizarPantallaValor(); }

function seleccionarTipo(tipo, btn) {
    document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tipoActualReg = tipo;
    
    const selectCat = document.getElementById("categoriaRegistro");
    if (tipo === "Ingreso" || tipo === "Gasto" || tipo === "Ahorro") {
        document.getElementById("grupoCategoria").style.display = "block"; document.getElementById("grupoDeudas").style.display = "none";
        selectCat.innerHTML = "";
        categoriasMenu[tipo].forEach(cat => { const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; selectCat.appendChild(opt); });
    } else {
        document.getElementById("grupoCategoria").style.display = "none"; document.getElementById("grupoDeudas").style.display = "block";
        const sd = document.getElementById("deudaSeleccionada"); sd.innerHTML = "";
        const lista = tipo === "PagoCredito" ? estadoApp.creditos : estadoApp.tarjetas;
        lista.forEach(i => { const o = document.createElement("option"); o.value = tipo === "PagoCredito" ? i.idCredito : i.idTarjeta; o.textContent = `${i.nombre} - $${formatoPesos(i.saldoActual)}`; sd.appendChild(o); });
    }
}

async function cargarDatos() {
    const cached = localStorage.getItem("finanzas_cache_v18");
    if (cached) { estadoApp = JSON.parse(cached); refrescarUI(); }
    const data = await enviarDatosAPI("obtenerDashboard", {});
    if (!data.error) { localStorage.setItem("finanzas_cache_v18", JSON.stringify(data)); estadoApp = data; refrescarUI(); }
}

function refrescarUI() {
    pintarDashboard(); llenarSelectMeses(); cambiarMesDashboard(); pintarModuloCreditos(); pintarHistorial();
}

// --- DASHBOARD (SOLUCIÓN DEL DESCUADRE CON FLEX-WRAP) ---
function pintarDashboard() {
    const m = estadoApp.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="dash-balance-box">
            <div class="label" style="text-align: center;">Balance del mes</div>
            <div class="dash-balance">${m.balance < 0 ? '-' : ''}$ ${formatoPesos(Math.abs(m.balance))}</div>
            <div class="sparkline-wrap">${generarSparkline()}</div>
        </div>
        
        <div class="dash-summary-row">
            <div class="dash-summary-item">
                <div class="dash-summary-icon bg-g">${iconTag('ti-cash')}</div>
                <div>
                    <div class="label" style="margin:0;">Ingresos</div>
                    <div class="dash-summary-val text-g">$ ${formatoPesos(m.ingresos)}</div>
                </div>
            </div>
            <div class="dash-summary-item">
                <div class="dash-summary-icon bg-r">${iconTag('ti-credit-card')}</div>
                <div>
                    <div class="label" style="margin:0;">Gastos</div>
                    <div class="dash-summary-val text-r">$ ${formatoPesos(m.gastos)}</div>
                </div>
            </div>
            <div class="dash-summary-item full">
                <div class="dash-summary-icon bg-b">${iconTag('ti-pig')}</div>
                <div>
                    <div class="label" style="margin:0;">Ahorro</div>
                    <div class="dash-summary-val text-b">$ ${formatoPesos(m.ahorro)}</div>
                </div>
            </div>
        </div>
    `;
}

// Mini tendencia de balance de los últimos meses disponibles (usa datos ya cargados, sin pedir nada extra al backend)
function generarSparkline() {
    const meses = (estadoApp.comparativoMensual || []).slice(-6);
    if (meses.length < 2) return '';
    const valores = meses.map(m => (m.ingreso || m.ingresos || 0) - (m.egreso || m.gastos || 0));
    const min = Math.min(...valores), max = Math.max(...valores);
    const w = 130, h = 28, pad = 3;
    const pts = valores.map((v, idx) => {
        const x = pad + (idx / (valores.length - 1)) * (w - pad * 2);
        const y = max === min ? h / 2 : h - pad - ((v - min) / (max - min)) * (h - pad * 2);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--color-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function llenarSelectMeses() {
    const s = document.getElementById("filtroMes"); s.innerHTML = "";
    if (estadoApp.comparativoMensual.length === 0) return;
    estadoApp.comparativoMensual.forEach(i => { const o = document.createElement("option"); o.value = i.mes; o.textContent = i.mes; s.appendChild(o); });
    s.selectedIndex = s.options.length - 1;
}

function cambiarMesDashboard() {
    pintarPieChartGastos(estadoApp.categoriasGastos);
    pintarDistribucionAhorros("categoriasAhorrosUI", estadoApp.categoriasAhorro, "var(--color-blue)");
    pintarMetaAhorro(); 
}

// --- DESGLOSE DE GASTOS: BARRA APILADA ---
function pintarPieChartGastos(lista) {
    const cont = document.getElementById("pieChartGastosUI");
    if (!lista || lista.length === 0) { cont.innerHTML = '<div class="empty">Sin gastos registrados.</div>'; return; }

    const top = lista.slice(0, 5);
    const totalTop = top.reduce((a, b) => a + Number(b.valor || 0), 0);
    if(totalTop === 0) { cont.innerHTML = '<div class="empty">Sin gastos.</div>'; return; }

    const colores = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    let barHTML = "";
    let legendHTML = "";

    top.forEach((item, index) => {
        const p = (Number(item.valor) / totalTop) * 100;
        const color = colores[index % colores.length];

        barHTML += `<div style="width:${p}%; background:${color};"></div>`;
        legendHTML += `
            <div class="legend-item">
                <div class="legend-left">
                    <span class="legend-color" style="background:${color};"></span>
                    <span>${item.categoria}</span>
                </div>
                <span class="legend-val">$ ${formatoPesos(item.valor)}</span>
            </div>
        `;
    });

    cont.innerHTML = `
        <div class="breakdown-bar">${barHTML}</div>
        <div class="pie-legend">
            ${legendHTML}
        </div>
    `;
}

function pintarDistribucionAhorros(id, lista, color) {
    const c = document.getElementById(id); c.innerHTML = "";
    if (!lista || lista.length === 0) { c.innerHTML = '<div class="empty">Sin datos</div>'; return;}
    
    const top = lista.slice(0, 4);
    const total = top.reduce((a, b) => a + Number(b.valor || 0), 0);
    
    top.forEach(i => {
        const p = total > 0 ? Math.round((Number(i.valor || 0) / total) * 100) : 0;
        const icon = getIconUI(i.categoria, 'Ahorro').i;
        c.innerHTML += `
            <div class="progress-item">
                <div class="progress-head">
                    <span style="display:flex; align-items:center; gap:8px;">${iconTag(icon, 'font-size:16px;')} ${i.categoria} <span style="font-size:11px; color:var(--text-muted);">(${p}%)</span></span>
                    <span class="text-b">$ ${formatoPesos(i.valor)}</span>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${p}%; background:${color}"></div></div>
            </div>`;
    });
}

// META 5% (CON DONUT CHART SVG VECTORIAL)
function generarDonut(p) {
    const stroke = 283; 
    const offset = stroke - (stroke * (Math.min(p, 100) / 100));
    return `
    <svg class="donut-svg" viewBox="0 0 100 100">
        <circle class="donut-bg" cx="50" cy="50" r="45"></circle>
        <circle class="donut-fill" cx="50" cy="50" r="45" style="stroke-dasharray: ${stroke}; stroke-dashoffset: ${offset};"></circle>
    </svg>`;
}

function pintarMetaAhorro() {
    const c = document.getElementById("moduloAhorro5");
    const mSel = document.getElementById("filtroMes")?.value;
    const dMes = estadoApp.comparativoMensual.find(m => m.mes === mSel) || { ingresos: 0, ahorro: 0 };

    const iMes = dMes.ingresos || 0; const aMes = dMes.ahorro || 0;
    const mMes = iMes * 0.05; const pMes = mMes > 0 ? Math.round((aMes / mMes) * 100) : 0;

    let tIng = 0; let tAho = 0;
    estadoApp.comparativoMensual.forEach(m => { tIng += (m.ingresos || 0); tAho += (m.ahorro || 0); });
    const mTot = tIng * 0.05;

    c.innerHTML = `
        <div class="dash-grid">
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div class="label" style="margin:0;">Ingresos Mes</div><div class="text-g" style="font-weight:700; font-size:16px;">$ ${formatoPesos(iMes)}</div>
            </div>
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div class="label" style="margin:0;">Meta Ideal (5%)</div><div class="text-b" style="font-weight:700; font-size:16px;">$ ${formatoPesos(mMes)}</div>
            </div>
        </div>

        <div class="donut-wrapper">
            ${generarDonut(pMes)}
            <div class="donut-text">
                <div style="font-size:24px;">${iconTag('ti-trophy')}</div>
                <div style="font-size:32px; font-weight:800; color:var(--text-main); margin:-5px 0;">${pMes}%</div>
                <div style="font-size:10px; color:var(--text-muted); text-transform:uppercase; font-weight:700;">De la meta</div>
            </div>
        </div>

        <div style="text-align: center; margin-bottom: 30px;">
            <div class="label">Ahorro este mes</div>
            <div style="font-size:36px; font-weight:800; color:var(--color-green); margin-bottom: 10px;">$ ${formatoPesos(aMes)}</div>
            ${aMes >= mMes && mMes > 0 ? `<div style="display:inline-block; padding:8px 16px; border-radius:12px; font-size:12px; font-weight:700; color:var(--color-green); background:rgba(16,185,129,0.1); border:1px solid var(--color-green);">¡Meta superada por $ ${formatoPesos(aMes - mMes)}! 💪</div>` : ''}
        </div>

        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px;">Resumen Histórico</h4>
        <div class="dash-grid">
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div class="label" style="margin:0;">Ingresos Totales</div><div style="font-weight:700; font-size:16px;">$ ${formatoPesos(tIng)}</div>
            </div>
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px;">
                <div class="label" style="margin:0;">Meta (5%)</div><div class="text-b" style="font-weight:700; font-size:16px;">$ ${formatoPesos(mTot)}</div>
            </div>
            <div class="dash-box" style="grid-column: span 2; display:flex; justify-content:space-between; flex-direction:row;">
                <div><div class="label" style="margin:0;">Ahorro Real</div><div class="text-g" style="font-weight:700; font-size:18px;">$ ${formatoPesos(tAho)}</div></div>
                <div style="text-align:right;"><div class="label" style="margin:0;">Estado</div><div class="text-g" style="font-weight:700;">A favor</div></div>
            </div>
        </div>
    `;
}

// HISTORIAL AGRUPADO POR FECHA
function pintarHistorial() {
    const c = document.getElementById("listaMovimientos"); c.innerHTML = "";
    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) { c.innerHTML = `<div class="empty">No hay movimientos.</div>`; return; }
    
    let html = ""; let currentGrp = "";
    estadoApp.ultimosMovimientos.forEach(m => {
        if(m.fechaTexto !== currentGrp) {
            html += `<div class="hist-date">${iconTag('ti-calendar', 'font-size:13px; vertical-align:-2px; margin-right:4px;')} ${m.fechaTexto}</div>`;
            currentGrp = m.fechaTexto;
        }

        let ui = getIconUI(m.categoria, m.tipo);
        let s = m.tipo === "Ingreso" ? "+" : "-";
        
        html += `
        <div class="hist-item" ${m.id ? `onclick="abrirAccionesMovimiento('${m.id}')"` : ''}>
            <div class="hist-icon ${ui.c}">${iconTag(ui.i)}</div>
            <div class="hist-info">
                <div class="hist-title">${m.concepto}</div>
                <div class="hist-cat">${m.categoria}</div>
            </div>
            <div class="hist-right">
                <div class="hist-val ${ui.tc}">${s} $ ${formatoPesos(m.valor)}</div>
                <div class="hist-badge">${m.tipo}</div>
            </div>
            ${m.id ? iconTag('ti-dots-vertical', 'margin-left:4px;') : ''}
        </div>`;
    });
    c.innerHTML = html;
}

let movimientoEditandoId = null;

function abrirAccionesMovimiento(id) {
    const m = (estadoApp.ultimosMovimientos || []).find(x => String(x.id) === String(id));
    if (!m) return;
    mostrarActionSheet(`${m.concepto} · $ ${formatoPesos(m.valor)}`, [
        { label: 'Editar movimiento', icon: 'ti-pencil', onClick: () => cargarMovimientoEnFormulario(m) },
        { label: 'Eliminar movimiento', icon: 'ti-trash', danger: true, onClick: () => eliminarMovimiento(id) }
    ]);
}

// ACTION SHEET GENÉRICO (reemplaza prompts nativos para mantener el look premium)
function mostrarActionSheet(titulo, acciones) {
    cerrarActionSheet();
    const overlay = document.createElement('div');
    overlay.id = 'actionSheetOverlay';
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.55); z-index:200; display:flex; align-items:flex-end; justify-content:center;';
    overlay.onclick = (e) => { if (e.target === overlay) cerrarActionSheet(); };

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card); width:100%; max-width:600px; border-radius:24px 24px 0 0; padding:20px; padding-bottom:34px; border-top:1px solid var(--border);';

    const titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-size:13px; color:var(--text-muted); margin-bottom:16px; text-align:center; font-weight:600;';
    titleEl.innerText = titulo;
    box.appendChild(titleEl);

    acciones.forEach(a => {
        const btn = document.createElement('div');
        btn.style.cssText = `width:100%; padding:16px; border-radius:14px; background:var(--bg-input); border:1px solid var(--border); margin-bottom:10px; font-size:15px; font-weight:600; display:flex; align-items:center; gap:10px; cursor:pointer; color:${a.danger ? 'var(--color-red)' : 'var(--text-main)'};`;
        btn.innerHTML = `${iconTag(a.icon, 'font-size:18px;')} ${a.label}`;
        btn.onclick = () => { cerrarActionSheet(); a.onClick(); };
        box.appendChild(btn);
    });

    overlay.appendChild(box);
    document.body.appendChild(overlay);
}
function cerrarActionSheet() { document.getElementById('actionSheetOverlay')?.remove(); }

function cargarMovimientoEnFormulario(m) {
    movimientoEditandoId = m.id;
    mostrarSeccion('registro', null);
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));

    document.getElementById('fechaRegistro').value = m.fecha || document.getElementById('fechaRegistro').value;
    document.getElementById('conceptoRegistro').value = m.concepto || '';
    document.getElementById('notaRegistro').value = m.nota || '';
    valorTeclado = String(Number(m.valor || 0));
    actualizarPantallaValor();

    const btnTipo = Array.from(document.querySelectorAll('.type-btn')).find(b => b.getAttribute('onclick').includes(`'${m.tipo}'`));
    if (btnTipo) btnTipo.click();
    if (document.getElementById('categoriaRegistro').querySelector(`option[value="${m.categoria}"]`)) {
        document.getElementById('categoriaRegistro').value = m.categoria;
    }

    mostrarBannerEdicion(true);
}

function mostrarBannerEdicion(activo) {
    let banner = document.getElementById('bannerEdicion');
    const btn = document.getElementById('btnGuardarRegistro');
    if (activo) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'bannerEdicion';
            banner.className = 'edit-banner';
            banner.innerHTML = `<span>${iconTag('ti-pencil', 'margin-right:6px;')}Editando movimiento</span><span class="cancelar" onclick="cancelarEdicion()">Cancelar</span>`;
            btn.parentNode.insertBefore(banner, btn.parentNode.firstChild.nextSibling);
        }
        btn.innerText = 'Guardar cambios';
    } else {
        if (banner) banner.remove();
        btn.innerText = 'Añadir Transacción';
    }
}

function cancelarEdicion() {
    movimientoEditandoId = null;
    mostrarBannerEdicion(false);
    document.getElementById('conceptoRegistro').value = '';
    document.getElementById('notaRegistro').value = '';
    teclaC();
}

async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;
    const res = await enviarDatosAPI('eliminarMovimiento', { id });
    mostrarMensaje('mensajeRegistro', res.mensaje || 'Movimiento eliminado.');
    cargarDatos();
}

function pintarModuloCreditos() {
    const c = document.getElementById("listaDeudasVigentes"); c.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { c.innerHTML = `<div class="empty">No tienes obligaciones activas.</div>`; return; }
    
    estadoApp.creditos.forEach(d => {
        c.innerHTML += `
        <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-summary-icon bg-r">${iconTag('ti-building-bank')}</div><div><div class="label" style="margin:0;">${d.entidad}</div><div style="font-weight:700; font-size:15px;">${d.nombre}</div></div></div>
                <div class="text-r" style="font-weight:800; font-size:16px;">$ ${formatoPesos(d.saldoActual)}</div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted);">
                <span>Cuota: <strong style="color:var(--text-main);">$ ${formatoPesos(d.cuotaActual)}</strong></span>
            </div>
        </div>`;
    });
    estadoApp.tarjetas.forEach(t => {
        c.innerHTML += `
        <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-summary-icon bg-b">${iconTag('ti-credit-card')}</div><div><div class="label" style="margin:0;">Tarjeta de Crédito</div><div style="font-weight:700; font-size:15px;">${t.nombre}</div></div></div>
                <div class="text-r" style="font-weight:800; font-size:16px;">$ ${formatoPesos(t.saldoActual)}</div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted);">
                <span>Cupo: $ ${formatoPesos(t.cupoTotal)}</span>
                <span>Disp: <strong class="text-g">$ ${formatoPesos(t.disponible)}</strong></span>
            </div>
        </div>`;
    });
}

async function procesarRegistro() {
    const btn = document.getElementById("btnGuardarRegistro");
    const data = { fecha: document.getElementById("fechaRegistro").value, tipo: tipoActualReg, concepto: document.getElementById("conceptoRegistro").value, valor: valorTeclado, nota: document.getElementById("notaRegistro").value, categoria: document.getElementById("categoriaRegistro").value || "Deudas" };
    if (!data.fecha || !data.concepto || data.valor === "") { mostrarMensaje("mensajeRegistro", "Por favor completa todos los campos."); return; }

    const editando = !!movimientoEditandoId;
    if (editando) data.id = movimientoEditandoId;

    btn.disabled = true; btn.innerText = editando ? "Guardando cambios..." : "Guardando...";
    const res = await enviarDatosAPI(editando ? "editarMovimiento" : "registrarMovimiento", data);
    btn.disabled = false;
    mostrarMensaje("mensajeRegistro", res.mensaje);
    if (!res.error) {
        document.getElementById("conceptoRegistro").value = ""; teclaC(); document.getElementById("notaRegistro").value = "";
        if (editando) { movimientoEditandoId = null; mostrarBannerEdicion(false); }
        else { btn.innerText = "Añadir Transacción"; }
        cargarDatos();
    } else {
        btn.innerText = editando ? "Guardar cambios" : "Añadir Transacción";
    }
}

async function crearNuevaObligacion() {
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const banco = document.getElementById("bancoNuevaDeuda").value;
    const nombre = document.getElementById("nombreNuevaDeuda").value;
    const saldo = document.getElementById("saldoNuevaDeuda").value;
    const dia = document.getElementById("diaPagoNuevaDeuda").value;

    if (!banco || !nombre || !saldo) return;
    let action = tipo === "credito" ? "registrarCredito" : "registrarTarjeta";
    let payload = tipo === "credito" ? { nombre: nombre, entidad: banco, tipoCredito: "Otro", saldoActual: saldo, saldoInicial: saldo, diaPago: dia } : { nombre: nombre, banco: banco, cupoTotal: saldo, saldoActual: 0, diaPago: dia };
    
    await enviarDatosAPI(action, payload);
    document.getElementById("bancoNuevaDeuda").value = ""; document.getElementById("nombreNuevaDeuda").value = ""; document.getElementById("saldoNuevaDeuda").value = "";
    cargarDatos(); mostrarSeccion('creditos', document.getElementById('nav-creditos'));
}

function mostrarMensaje(id, texto) { const m = document.getElementById(id); m.innerText = texto; m.style.display = "block"; setTimeout(() => m.style.display = "none", 4000); }

document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed(); document.getElementById("fechaRegistro").valueAsDate = new Date();
    document.querySelector('.type-btn.active').click(); cargarDatos();
    if (navigator.onLine) sincronizarPendientes().then(() => { actualizarEstadoRed(); });
});
