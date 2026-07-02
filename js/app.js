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

// MODO DÍA / NOCHE
function aplicarTema(tema) {
    document.documentElement.setAttribute('data-theme', tema);
    localStorage.setItem('finanzas_tema', tema);
    const meta = document.getElementById('metaThemeColor');
    if (meta) meta.setAttribute('content', tema === 'light' ? '#f1f4f9' : '#0b1120');
    const icono = document.getElementById('iconoTema');
    if (icono) icono.className = tema === 'dark' ? 'ti ti-sun icon' : 'ti ti-moon icon';
}
function alternarTema() {
    const actual = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    aplicarTema(actual === 'light' ? 'dark' : 'light');
}

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
    "Ahorro": ["Ahorro personal", "Fondo de emergencia", "Pensión Eliana"]
};

// LÓGICA DEL TECLADO NATIVO
let valorTeclado = "";
function actualizarPantallaValor() { document.getElementById("pantallaValor").innerText = valorTeclado === "" ? "0" : Number(valorTeclado).toLocaleString('es-CO'); }
function tecla(n) { if(valorTeclado.length < 9) { valorTeclado += n; actualizarPantallaValor(); } }
function teclaDel() { valorTeclado = valorTeclado.slice(0, -1); actualizarPantallaValor(); }
function teclaC() { valorTeclado = ""; actualizarPantallaValor(); }

function seleccionarTipo(tipo, btn) {
    document.querySelectorAll('.type-btn').forEach(b => { if (b.closest('#tipoSelectorUI')) b.classList.remove('active'); });
    btn.classList.add('active');
    tipoActualReg = tipo;
    
    const selectCat = document.getElementById("categoriaRegistro");
    if (tipo === "Ingreso" || tipo === "Gasto" || tipo === "Ahorro") {
        document.getElementById("grupoCategoria").style.display = "block";
        document.getElementById("grupoDeudas").style.display = "none";
        document.getElementById("grupoDireccionCredito").style.display = "none";
        selectCat.innerHTML = "";
        categoriasMenu[tipo].forEach(cat => { const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; selectCat.appendChild(opt); });
    } else {
        document.getElementById("grupoCategoria").style.display = "none";
        document.getElementById("grupoDeudas").style.display = "block";
        document.getElementById("grupoDireccionCredito").style.display = "block";
        const sd = document.getElementById("deudaSeleccionada"); sd.innerHTML = "";
        estadoApp.creditos.forEach(i => { const o = document.createElement("option"); o.value = i.idCredito; o.dataset.tipoDeuda = 'credito'; o.textContent = `${i.nombre} (Crédito) · $${formatoPesos(i.saldoActual)}`; sd.appendChild(o); });
        estadoApp.tarjetas.forEach(i => { const o = document.createElement("option"); o.value = i.idTarjeta; o.dataset.tipoDeuda = 'tarjeta'; o.textContent = `${i.nombre} (Tarjeta) · $${formatoPesos(i.saldoActual)}`; sd.appendChild(o); });
    }
}

let direccionCreditoActual = 'abono';
function seleccionarDireccionCredito(dir, btn) {
    document.querySelectorAll('#direccionCreditoUI .type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    direccionCreditoActual = dir;
}

async function cargarDatos() {
    const cached = localStorage.getItem("finanzas_cache_v28");
    if (cached) { try { estadoApp = JSON.parse(cached); refrescarUI(); } catch (e) { /* caché corrupto, se ignora */ } }

    const data = await enviarDatosAPI("obtenerDashboard", {});

    if (!data.error) {
        localStorage.setItem("finanzas_cache_v28", JSON.stringify(data));
        estadoApp = data;
        refrescarUI();
    } else if (!cached) {
        // No hay nada guardado que mostrar y la carga falló: antes esto se quedaba
        // pegado en "Cargando..." para siempre sin explicar nada.
        document.getElementById('dashboard-content').innerHTML = `
            <div style="text-align:center; padding:20px;">
                <div style="color:var(--color-red); font-weight:700; margin-bottom:8px;">${iconTag('ti-alert-triangle')} No se pudo conectar con el servidor</div>
                <div style="font-size:13px; color:var(--text-muted); margin-bottom:16px;">${data.mensaje || 'Error desconocido.'}</div>
                <div style="display:inline-block; padding:10px 20px; border-radius:12px; background:var(--color-blue); color:white; font-weight:700; cursor:pointer;" onclick="cargarDatos()">Reintentar</div>
            </div>`;
        mostrarToast(data.mensaje || 'No se pudo cargar la información.', 'error');
    } else {
        mostrarToast('No se pudo actualizar: ' + (data.mensaje || 'error de red') + '. Mostrando la última información guardada.', 'warn');
    }
}

function refrescarUI() {
    pintarDashboard(); pintarProximosPagos(); llenarSelectMeses(); cambiarMesDashboard(); pintarModuloCreditos(); llenarFiltrosHistorial(); pintarHistorial();
}

// --- DASHBOARD (SOLUCIÓN DEL DESCUADRE CON FLEX-WRAP) ---
function pintarDashboard() {
    const m = estadoApp.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="dash-balance-box">
            <div class="label" style="text-align: center;">Balance del mes</div>
            <div class="dash-balance">${m.balance < 0 ? '-' : ''}$ ${formatoPesos(Math.abs(m.balance))}</div>
            <div class="sparkline-wrap">${generarSparkline()}</div>
            ${generarDeltaMensual()}
        </div>

        <div class="quick-actions">
            <div class="quick-action" onclick="irARegistrar('Ingreso')">${iconTag('ti-trending-up', 'font-size:18px;')}<span>Ingreso</span></div>
            <div class="quick-action" onclick="irARegistrar('Gasto')">${iconTag('ti-trending-down', 'font-size:18px;')}<span>Gasto</span></div>
            <div class="quick-action" onclick="irARegistrar('Ahorro')">${iconTag('ti-pig', 'font-size:18px;')}<span>Ahorro</span></div>
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

        ${generarAlertaPresupuesto(m)}
    `;
}

// El "presupuesto" del mes es el salario/ingresos del mes: alerta si los gastos ya lo superaron
function generarAlertaPresupuesto(m) {
    if (!m || !m.gastos || !m.ingresos || m.gastos <= m.ingresos) return '';
    const exceso = m.gastos - m.ingresos;
    return `
    <div class="alert-banner">
        ${iconTag('ti-alert-triangle', 'font-size:20px; flex-shrink:0; margin-top:2px;')}
        <div>
            <div class="alert-title">Estás por encima de tu presupuesto</div>
            <div class="alert-sub">Tus gastos superan tus ingresos del mes en $ ${formatoPesos(exceso)}.</div>
        </div>
    </div>`;
}

function irARegistrar(tipo) {
    mostrarSeccion('registro', null);
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('#tipoSelectorUI .type-btn')).find(b => b.getAttribute('onclick').includes(`'${tipo}'`));
    if (btn) btn.click();
}

// Compara el balance del mes actual contra el mes anterior usando datos ya cargados
function generarDeltaMensual() {
    const meses = estadoApp.comparativoMensual || [];
    if (meses.length < 2) return '';
    const calc = m => (m.ingresos || 0) - (m.gastos || 0) - (m.ahorro || 0);
    const actual = calc(meses[meses.length - 1]);
    const anterior = calc(meses[meses.length - 2]);
    const delta = actual - anterior;
    if (delta === 0) return `<div class="delta-pill">${iconTag('ti-minus', 'font-size:12px;')} Igual que el mes anterior</div>`;
    const subio = delta > 0;
    return `<div class="delta-pill ${subio ? 'up' : 'down'}">${iconTag(subio ? 'ti-arrow-up-right' : 'ti-arrow-down-right', 'font-size:12px;')} $ ${formatoPesos(Math.abs(delta))} vs. mes anterior</div>`;
}

// --- PRÓXIMOS PAGOS (créditos y tarjetas con día de pago próximo) ---
function pintarProximosPagos() {
    const card = document.getElementById('cardProximosPagos');
    const cont = document.getElementById('proximosPagosUI');
    const hoy = new Date();
    const diaHoy = hoy.getDate();

    const obligaciones = [
        ...estadoApp.creditos.filter(c => c.diaPago && Number(c.saldoActual) > 0).map(c => ({ nombre: c.nombre, monto: c.cuotaActual || c.saldoActual, diaPago: Number(c.diaPago), icono: 'ti-building-bank' })),
        ...estadoApp.tarjetas.filter(t => t.diaPago && Number(t.saldoActual) > 0).map(t => ({ nombre: t.nombre, monto: t.saldoActual, diaPago: Number(t.diaPago), icono: 'ti-credit-card' }))
    ];

    if (obligaciones.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    obligaciones.forEach(o => {
        o.diasFaltantes = o.diaPago >= diaHoy ? (o.diaPago - diaHoy) : (o.diaPago - diaHoy + 30);
    });
    obligaciones.sort((a, b) => a.diasFaltantes - b.diasFaltantes);

    cont.innerHTML = obligaciones.slice(0, 3).map(o => {
        const etiqueta = o.diasFaltantes === 0 ? 'Hoy' : o.diasFaltantes === 1 ? 'Mañana' : `En ${o.diasFaltantes} días`;
        const urgente = o.diasFaltantes <= 3;
        return `
        <div class="dash-box" style="margin-bottom:10px; justify-content:space-between;">
            <div style="display:flex; align-items:center; gap:12px;">
                <div class="dash-summary-icon ${urgente ? 'bg-a' : 'bg-b'}">${iconTag(o.icono)}</div>
                <div>
                    <div style="font-weight:700; font-size:14px;">${o.nombre}</div>
                    <div class="label" style="margin:0; ${urgente ? 'color:var(--color-amber);' : ''}">${etiqueta} · día ${o.diaPago}</div>
                </div>
            </div>
            <div style="font-weight:700; font-size:14px;">$ ${formatoPesos(o.monto)}</div>
        </div>`;
    }).join('');
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
    document.getElementById('barrasMensualesUI').innerHTML = generarBarrasMensuales(estadoApp.comparativoMensual);
    pintarPieChartGastos(estadoApp.categoriasGastos);
    pintarDistribucionAhorros("categoriasAhorrosUI", estadoApp.categoriasAhorro, "var(--color-blue)");
    pintarMetaAhorro(); 
}

// Comparativo Ingresos vs Gastos de los últimos meses (SVG dibujado a mano, sin librerías)
function generarBarrasMensuales(meses) {
    const datos = (meses || []).slice(-6);
    if (datos.length === 0) return '<div class="empty">Aún no hay suficiente historial.</div>';

    const max = Math.max(1, ...datos.map(m => Math.max(m.ingresos || 0, m.gastos || 0)));
    const w = 320, hBars = 105, baseY = 125;
    const slot = w / datos.length;
    const barW = Math.min(18, slot / 3.2);

    let bars = '', labels = '';
    datos.forEach((m, i) => {
        const cx = slot * i + slot / 2;
        const hIng = (Number(m.ingresos || 0) / max) * hBars;
        const hGas = (Number(m.gastos || 0) / max) * hBars;
        const retraso = (i * 0.06).toFixed(2);
        bars += `<rect class="bar-animada" x="${(cx - barW - 2).toFixed(1)}" y="${(baseY - hIng).toFixed(1)}" width="${barW.toFixed(1)}" height="${hIng.toFixed(1)}" rx="3" fill="var(--color-green)" style="animation-delay:${retraso}s;"></rect>`;
        bars += `<rect class="bar-animada" x="${(cx + 2).toFixed(1)}" y="${(baseY - hGas).toFixed(1)}" width="${barW.toFixed(1)}" height="${hGas.toFixed(1)}" rx="3" fill="var(--color-red)" style="animation-delay:${retraso}s;"></rect>`;
        labels += `<text x="${cx.toFixed(1)}" y="${baseY + 16}" text-anchor="middle" class="chart-axis-label">${(m.mes || '').split(' ')[0].slice(0, 3)}</text>`;
    });

    return `
    <div class="chart-wrap">
        <div class="chart-legend-inline">
            <span><i class="dot" style="background:var(--color-green);"></i>Ingresos</span>
            <span><i class="dot" style="background:var(--color-red);"></i>Gastos</span>
        </div>
        <svg viewBox="0 0 ${w} 145" class="bar-chart-svg" role="img" aria-label="Ingresos y gastos de los últimos meses">
            <line x1="0" y1="${baseY}" x2="${w}" y2="${baseY}" class="chart-axis-line"></line>
            ${bars}
            ${labels}
        </svg>
    </div>`;
}

// --- DESGLOSE DE GASTOS: DONUT SVG (dibujado a mano, evita el descuadre del conic-gradient original) ---
function pintarPieChartGastos(lista) {
    const cont = document.getElementById("pieChartGastosUI");
    if (!lista || lista.length === 0) { cont.innerHTML = '<div class="empty">Sin gastos registrados.</div>'; return; }

    const top = lista.slice(0, 5);
    const totalTop = top.reduce((a, b) => a + Number(b.valor || 0), 0);
    if(totalTop === 0) { cont.innerHTML = '<div class="empty">Sin gastos.</div>'; return; }

    const colores = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    let legendHTML = "";

    cont.innerHTML = `
        ${generarDonutSegmentado(top, colores, 'ti-chart-pie')}
        <div class="pie-legend">
            ${top.map((item, index) => `
                <div class="legend-item">
                    <div class="legend-left">
                        <span class="legend-color" style="background:${colores[index % colores.length]};"></span>
                        <span>${item.categoria}</span>
                    </div>
                    <span class="legend-val">$ ${formatoPesos(item.valor)}</span>
                </div>
            `).join('')}
        </div>
    `;
}

// Donut multi-segmento genérico: cada segmento es un <circle> con stroke-dasharray/offset propio
function generarDonutSegmentado(segmentos, colores, iconoCentral) {
    const total = segmentos.reduce((a, b) => a + Number(b.valor || 0), 0);
    if (total <= 0) return '';
    const r = 52, c = 2 * Math.PI * r;
    let acumulado = 0;
    const circles = segmentos.map((s, i) => {
        const segLen = (Number(s.valor || 0) / total) * c;
        const offset = -acumulado;
        acumulado += segLen;
        return `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${colores[i % colores.length]}" stroke-width="16" stroke-dasharray="${segLen.toFixed(2)} ${(c - segLen).toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>`;
    }).join('');

    return `
    <div class="donut-chart-wrap">
        <svg viewBox="0 0 140 140" role="img" aria-label="Desglose por categoría">
            <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bg-input)" stroke-width="16"></circle>
            ${circles}
        </svg>
        <div class="donut-text">${iconTag(iconoCentral || 'ti-chart-pie')}</div>
    </div>`;
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
        <circle class="donut-fill" cx="50" cy="50" r="45" style="stroke-dasharray: ${stroke}; --arco-inicio: ${stroke}; --arco-fin: ${offset};"></circle>
    </svg>`;
}

// Evolución del ahorro real vs. la meta ideal (5%) en los últimos meses — SVG a mano, sin librerías
function generarEvolucionAhorro(meses) {
    const datos = (meses || []).slice(-6);
    if (datos.length < 2) return '';

    const real = datos.map(m => Number(m.ahorro) || 0);
    const meta = datos.map(m => (Number(m.ingresos) || 0) * 0.05);
    const max = Math.max(1, ...real, ...meta);
    const w = 300, h = 130, pad = 10, padB = 22;
    const plotW = w - pad * 2, plotH = h - pad - padB;
    const x = i => pad + (datos.length === 1 ? 0 : (i / (datos.length - 1)) * plotW);
    const y = v => pad + plotH - (v / max) * plotH;

    const ptsReal = real.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const ptsMeta = meta.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    let longitudReal = 0;
    for (let i = 1; i < real.length; i++) {
        longitudReal += Math.hypot(x(i) - x(i - 1), y(real[i]) - y(real[i - 1]));
    }
    const dotsReal = real.map((v, i) => `<circle class="punto-animado" cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3" fill="var(--color-green)" style="animation-delay:${(0.15 + i * 0.15).toFixed(2)}s;"></circle>`).join('');
    const labels = datos.map((m, i) => `<text x="${x(i).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="chart-axis-label">${(m.mes || '').split(' ')[0].slice(0, 3)}</text>`).join('');

    return `
    <div class="chart-wrap">
        <div class="chart-legend-inline">
            <span><i class="dot" style="background:var(--color-green);"></i>Ahorro real</span>
            <span><i class="dot" style="background:var(--color-blue); opacity:0.6;"></i>Meta ideal (5%)</span>
        </div>
        <svg viewBox="0 0 ${w} ${h}" class="bar-chart-svg" role="img" aria-label="Evolución del ahorro real frente a la meta del 5% en los últimos meses">
            <polyline class="linea-discontinua-animada" points="${ptsMeta}" fill="none" stroke="var(--color-blue)" stroke-width="2" stroke-dasharray="5 4" stroke-linecap="round" stroke-linejoin="round"></polyline>
            <polyline class="linea-animada" points="${ptsReal}" fill="none" stroke="var(--color-green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke-dasharray:${longitudReal.toFixed(1)}; stroke-dashoffset:${longitudReal.toFixed(1)};"></polyline>
            ${dotsReal}
            ${labels}
        </svg>
    </div>`;
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

        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 5px;">Tus ahorros de este mes</h4>
        <div id="ahorrosDelMesUI"></div>

        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 5px; margin-top: 30px;">Evolución del ahorro (últimos meses)</h4>
        ${generarEvolucionAhorro(estadoApp.comparativoMensual) || '<div class="empty" style="margin-top:10px;">Necesitas al menos 2 meses de historial para ver la evolución.</div>'}

        <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; margin-top: 30px;">Resumen Histórico</h4>
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
    pintarAhorrosDelMes();
}

// Lista editable de los movimientos de Ahorro del mes calendario actual (toca uno para editar/eliminar)
function pintarAhorrosDelMes() {
    const cont = document.getElementById('ahorrosDelMesUI');
    if (!cont) return;

    let ahorros = estadoApp.ahorrosMesActual;
    if (!ahorros) {
        // Compatibilidad con un caché local viejo (antes de que el backend calculara esto aparte);
        // se refresca solo apenas llegue la próxima respuesta del servidor.
        const hoy = new Date();
        ahorros = (estadoApp.ultimosMovimientos || []).filter(m => {
            if (m.tipo !== 'Ahorro' || !m.fecha) return false;
            const f = new Date(m.fecha + 'T00:00:00');
            return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
        });
    }

    if (ahorros.length === 0) { cont.innerHTML = '<div class="empty" style="margin-top:0;">Aún no registras ahorros este mes.</div>'; return; }

    cont.innerHTML = ahorros.map(m => `
        <div class="hist-item" ${m.id ? `onclick="abrirAccionesMovimiento('${m.id}')"` : ''}>
            <div class="hist-icon bg-b">${iconTag(getIconUI(m.categoria, 'Ahorro').i)}</div>
            <div class="hist-info">
                <div class="hist-title">${m.concepto}</div>
                <div class="hist-cat">${m.categoria}</div>
            </div>
            <div class="hist-right">
                <div class="hist-val text-b">$ ${formatoPesos(m.valor)}</div>
            </div>
            ${m.id ? iconTag('ti-dots-vertical', 'margin-left:4px;') : ''}
        </div>
    `).join('');
}

// Llena los selects de filtro del historial con los valores realmente presentes en los datos cargados
function llenarFiltrosHistorial() {
    const movs = estadoApp.ultimosMovimientos || [];

    const selMes = document.getElementById('histFiltroMes');
    const mesActual = selMes.value;
    const meses = [...new Set(movs.map(m => (m.fecha || '').slice(0, 7)).filter(Boolean))].sort().reverse();
    selMes.innerHTML = '<option value="">Todos los meses</option>' + meses.map(key => {
        const [y, mo] = key.split('-');
        const nombre = new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
        return `<option value="${key}">${nombre.charAt(0).toUpperCase() + nombre.slice(1)}</option>`;
    }).join('');
    if (meses.includes(mesActual)) selMes.value = mesActual;

    const selCat = document.getElementById('histFiltroCategoria');
    const catActual = selCat.value;
    const categorias = [...new Set(movs.map(m => m.categoria).filter(Boolean))].sort();
    selCat.innerHTML = '<option value="">Toda categoría</option>' + categorias.map(c => `<option value="${c}">${c}</option>`).join('');
    if (categorias.includes(catActual)) selCat.value = catActual;
}

// HISTORIAL AGRUPADO POR FECHA, con búsqueda + filtros de tipo/categoría/mes
function pintarHistorial() {
    const c = document.getElementById("listaMovimientos"); c.innerHTML = "";
    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) { c.innerHTML = `<div class="empty">No hay movimientos.</div>`; return; }

    const texto = (document.getElementById('histBusqueda')?.value || '').trim().toLowerCase();
    const fTipo = document.getElementById('histFiltroTipo')?.value || '';
    const fCategoria = document.getElementById('histFiltroCategoria')?.value || '';
    const fMes = document.getElementById('histFiltroMes')?.value || '';

    const filtrados = estadoApp.ultimosMovimientos.filter(m => {
        if (fTipo && m.tipo !== fTipo) return false;
        if (fCategoria && m.categoria !== fCategoria) return false;
        if (fMes && (m.fecha || '').slice(0, 7) !== fMes) return false;
        if (texto && !`${m.concepto || ''} ${m.categoria || ''} ${m.nota || ''}`.toLowerCase().includes(texto)) return false;
        return true;
    });

    if (filtrados.length === 0) { c.innerHTML = `<div class="empty">No hay movimientos que coincidan con el filtro.</div>`; return; }

    let html = ""; let currentGrp = "";
    filtrados.forEach(m => {
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
                ${m.nota ? `<div class="hist-nota">${m.nota}</div>` : ''}
            </div>
            <div class="hist-right">
                ${m.hora ? `<div class="hist-hora">${m.hora}</div>` : ''}
                <div class="hist-val ${ui.tc}">${s} $ ${formatoPesos(m.valor)}</div>
                <div class="hist-badge">${m.tipo}</div>
            </div>
            ${m.id ? iconTag('ti-dots-vertical', 'margin-left:4px;') : ''}
        </div>`;
    });
    c.innerHTML = html;
}
function aplicarFiltrosHistorial() { pintarHistorial(); }

let movimientoEditandoId = null;

function abrirAccionesMovimiento(id) {
    const m = (estadoApp.ultimosMovimientos || []).find(x => String(x.id) === String(id))
        || (estadoApp.ahorrosMesActual || []).find(x => String(x.id) === String(id));
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

    const btnTipo = Array.from(document.querySelectorAll('#tipoSelectorUI .type-btn')).find(b => b.getAttribute('onclick').includes(`'${m.tipo}'`));
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

// AVISO FLOTANTE VISIBLE DESDE CUALQUIER PESTAÑA (a diferencia de #mensajeRegistro, que solo
// se ve en la sección Registrar — antes, eliminar un movimiento desde Historial mostraba su
// confirmación en un elemento oculto que nunca llegabas a ver).
function mostrarToast(mensaje, tipo) {
    document.getElementById('toastFinanzas')?.remove();
    const t = document.createElement('div');
    t.id = 'toastFinanzas';
    t.className = 'toast toast-' + (tipo || 'info');
    t.innerText = mensaje;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('visible'));
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 4000);
}

// Muestra siempre feedback explícito, incluyendo el caso "queued" (petición diferida porque el
// servidor no respondió) — antes ese caso quedaba en silencio y parecía que "no pasaba nada".
function avisarResultado(res, mensajeExito) {
    if (res.error) { mostrarToast(res.mensaje || 'Ocurrió un error.', 'error'); }
    else if (res.queued) { mostrarToast(res.mensaje || 'No se pudo confirmar con el servidor. Se reintentará automáticamente.', 'warn'); }
    else { mostrarToast(mensajeExito || res.mensaje || 'Listo.', 'success'); }
    actualizarEstadoRed();
}

async function eliminarMovimiento(id) {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;
    const res = await enviarDatosAPI('eliminarMovimiento', { id });
    avisarResultado(res, 'Movimiento eliminado.');
    if (!res.error) cargarDatos();
}

function pintarModuloCreditos() {
    const c = document.getElementById("listaDeudasVigentes"); c.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { c.innerHTML = `<div class="empty">No tienes obligaciones activas.</div>`; return; }
    
    estadoApp.creditos.forEach(d => {
        c.innerHTML += `
        <div class="card" style="padding:20px; cursor:pointer;" onclick="abrirAccionesObligacion('credito', '${d.idCredito}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-summary-icon bg-r">${iconTag('ti-building-bank')}</div><div><div class="label" style="margin:0;">${d.entidad}</div><div style="font-weight:700; font-size:15px;">${d.nombre}</div></div></div>
                <div style="display:flex; align-items:center; gap:8px;"><div class="text-r" style="font-weight:800; font-size:16px;">$ ${formatoPesos(d.saldoActual)}</div>${iconTag('ti-dots-vertical')}</div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted);">
                <span>Cuota: <strong style="color:var(--text-main);">$ ${formatoPesos(d.cuotaActual)}</strong></span>
            </div>
        </div>`;
    });
    estadoApp.tarjetas.forEach(t => {
        c.innerHTML += `
        <div class="card" style="padding:20px; cursor:pointer;" onclick="abrirAccionesObligacion('tarjeta', '${t.idTarjeta}')">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-summary-icon bg-b">${iconTag('ti-credit-card')}</div><div><div class="label" style="margin:0;">Tarjeta de Crédito</div><div style="font-weight:700; font-size:15px;">${t.nombre}</div></div></div>
                <div style="display:flex; align-items:center; gap:8px;"><div class="text-r" style="font-weight:800; font-size:16px;">$ ${formatoPesos(t.saldoActual)}</div>${iconTag('ti-dots-vertical')}</div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--text-muted);">
                <span>Cupo: $ ${formatoPesos(t.cupoTotal)}</span>
                <span>Disp: <strong class="text-g">$ ${formatoPesos(t.disponible)}</strong></span>
            </div>
        </div>`;
    });
}

function abrirAccionesObligacion(tipo, id) {
    const lista = tipo === 'credito' ? estadoApp.creditos : estadoApp.tarjetas;
    const idKey = tipo === 'credito' ? 'idCredito' : 'idTarjeta';
    const item = lista.find(x => String(x[idKey]) === String(id));
    if (!item) return;
    mostrarActionSheet(item.nombre, [
        { label: 'Editar obligación', icon: 'ti-pencil', onClick: () => abrirEdicionObligacion(tipo, item) },
        { label: 'Eliminar obligación', icon: 'ti-trash', danger: true, onClick: () => eliminarObligacion(tipo, id) }
    ]);
}

async function procesarRegistro() {
    const btn = document.getElementById("btnGuardarRegistro");
    const data = { fecha: document.getElementById("fechaRegistro").value, tipo: tipoActualReg, concepto: document.getElementById("conceptoRegistro").value, valor: valorTeclado, nota: document.getElementById("notaRegistro").value, categoria: document.getElementById("categoriaRegistro").value || "Deudas" };
    if (!data.fecha || !data.concepto || data.valor === "") { mostrarMensaje("mensajeRegistro", "Por favor completa todos los campos."); return; }

    const editando = !!movimientoEditandoId;
    if (editando) data.id = movimientoEditandoId;

    if (tipoActualReg === 'PagoCredito' && !editando) {
        const sel = document.getElementById('deudaSeleccionada');
        const opt = sel.options[sel.selectedIndex];
        if (!opt) { mostrarMensaje("mensajeRegistro", "Primero crea un crédito o tarjeta en la sección Créditos."); return; }
        data.idDeuda = sel.value;
        data.tipoDeuda = opt.dataset.tipoDeuda;
        data.direccion = direccionCreditoActual;
    }

    btn.disabled = true; btn.innerText = editando ? "Guardando cambios..." : "Guardando...";
    const res = await enviarDatosAPI(editando ? "editarMovimiento" : "registrarMovimiento", data);
    btn.disabled = false;
    avisarResultado(res, editando ? 'Movimiento actualizado.' : 'Movimiento guardado.');
    if (!res.error) {
        document.getElementById("conceptoRegistro").value = ""; teclaC(); document.getElementById("notaRegistro").value = "";
        if (editando) { movimientoEditandoId = null; mostrarBannerEdicion(false); }
        else { btn.innerText = "Añadir Transacción"; }
        cargarDatos();
    } else {
        btn.innerText = editando ? "Guardar cambios" : "Añadir Transacción";
    }
}

let obligacionEditando = null; // { tipo, id } o null si es creación

function actualizarCamposObligacion() {
    const esTarjeta = document.getElementById("tipoNuevaDeuda").value === 'tarjeta';
    document.getElementById("grupoCupoTarjeta").style.display = esTarjeta ? 'block' : 'none';
    document.getElementById("grupoCuotaCredito").style.display = esTarjeta ? 'none' : 'block';
    document.getElementById("labelSaldoNuevaDeuda").innerText = esTarjeta ? 'Deuda actual en la tarjeta' : 'Saldo Actual';
    document.getElementById("labelBancoNuevaDeuda").innerText = esTarjeta ? 'Banco' : 'Entidad';
}

function abrirNuevaObligacion() {
    obligacionEditando = null;
    document.getElementById('tituloFormCredito').innerText = 'Nueva Obligación';
    document.getElementById('btnGuardarObligacion').innerText = 'Crear Obligación';
    document.getElementById('btnEliminarObligacion').style.display = 'none';
    document.getElementById('tipoNuevaDeuda').value = 'credito';
    document.getElementById('tipoNuevaDeuda').disabled = false;
    ['bancoNuevaDeuda', 'nombreNuevaDeuda', 'saldoNuevaDeuda', 'cupoNuevaDeuda', 'cuotaNuevaDeuda', 'diaPagoNuevaDeuda'].forEach(id => document.getElementById(id).value = '');
    actualizarCamposObligacion();
    mostrarSeccion('formCredito', document.getElementById('nav-creditos'));
}

function abrirEdicionObligacion(tipo, item) {
    obligacionEditando = { tipo, id: tipo === 'credito' ? item.idCredito : item.idTarjeta };
    document.getElementById('tituloFormCredito').innerText = 'Editar Obligación';
    document.getElementById('btnGuardarObligacion').innerText = 'Guardar cambios';
    document.getElementById('btnEliminarObligacion').style.display = 'block';
    document.getElementById('tipoNuevaDeuda').value = tipo;
    document.getElementById('tipoNuevaDeuda').disabled = true; // no cambiamos el tipo de una obligación existente
    document.getElementById('bancoNuevaDeuda').value = tipo === 'credito' ? (item.entidad || '') : (item.banco || item.entidad || '');
    document.getElementById('nombreNuevaDeuda').value = item.nombre || '';
    document.getElementById('saldoNuevaDeuda').value = item.saldoActual || 0;
    document.getElementById('cupoNuevaDeuda').value = item.cupoTotal || 0;
    document.getElementById('cuotaNuevaDeuda').value = item.cuotaActual || 0;
    document.getElementById('diaPagoNuevaDeuda').value = item.diaPago || '';
    actualizarCamposObligacion();
    mostrarSeccion('formCredito', document.getElementById('nav-creditos'));
}

async function guardarObligacion() {
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const banco = document.getElementById("bancoNuevaDeuda").value;
    const nombre = document.getElementById("nombreNuevaDeuda").value;
    const saldo = document.getElementById("saldoNuevaDeuda").value;
    const cupo = document.getElementById("cupoNuevaDeuda").value;
    const cuota = document.getElementById("cuotaNuevaDeuda").value;
    const dia = document.getElementById("diaPagoNuevaDeuda").value;
    if (!banco || !nombre || saldo === "") return;

    const editando = !!obligacionEditando;
    let action, payload;
    if (tipo === "credito") {
        action = editando ? 'editarCredito' : 'registrarCredito';
        payload = { nombre, entidad: banco, tipoCredito: "Otro", saldoActual: saldo, saldoInicial: saldo, cuotaActual: cuota, diaPago: dia };
    } else {
        action = editando ? 'editarTarjeta' : 'registrarTarjeta';
        payload = { nombre, banco, cupoTotal: cupo, saldoActual: saldo, diaPago: dia };
    }
    if (editando) payload.id = obligacionEditando.id;

    const res = await enviarDatosAPI(action, payload);
    avisarResultado(res, editando ? 'Obligación actualizada.' : 'Obligación creada.');
    if (res.error) return;
    obligacionEditando = null;
    cargarDatos(); mostrarSeccion('creditos', document.getElementById('nav-creditos'));
}

async function eliminarObligacion(tipo, id) {
    if (!confirm('¿Eliminar esta obligación? El historial de movimientos asociados no se borra.')) return;
    const action = tipo === 'credito' ? 'eliminarCredito' : 'eliminarTarjeta';
    const res = await enviarDatosAPI(action, { id });
    avisarResultado(res, 'Obligación eliminada.');
    if (!res.error) cargarDatos();
}

function eliminarObligacionActual() {
    if (!obligacionEditando) return;
    eliminarObligacion(obligacionEditando.tipo, obligacionEditando.id);
}

function mostrarMensaje(id, texto) { const m = document.getElementById(id); m.innerText = texto; m.style.display = "block"; setTimeout(() => m.style.display = "none", 4000); }

document.addEventListener('DOMContentLoaded', () => {
    aplicarTema(localStorage.getItem('finanzas_tema') || 'dark');
    actualizarEstadoRed(); document.getElementById("fechaRegistro").valueAsDate = new Date();
    document.querySelector('#tipoSelectorUI .type-btn.active').click(); cargarDatos();
    if (navigator.onLine) sincronizarPendientes().then(() => { actualizarEstadoRed(); });
});
