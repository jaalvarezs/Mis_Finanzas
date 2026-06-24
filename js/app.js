if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }

function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    if (navigator.onLine) {
        badge.innerText = 'ONLINE - SINCRONIZADO'; badge.style.color = 'var(--color-blue)';
    } else {
        badge.innerText = 'OFFLINE - SIN CONEXIÓN'; badge.style.color = 'var(--color-red)';
    }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

// CONTROL DE BOTTOM NAV
function mostrarSeccion(id, btn) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if(btn) btn.classList.add("active");
}

function formatoPesos(valor) { return Number(valor || 0).toLocaleString('es-CO'); }

// ICONOS VISUALES (Basados en tu imagen)
function getIconUI(cat, tipo) {
    const t = cat.toLowerCase();
    if(tipo === 'Ingreso') return { i: '📈', c: 'bg-g', tc: 'text-g' };
    if(tipo === 'Ahorro') return { i: '🐷', c: 'bg-b', tc: 'text-b' };
    if(t.includes('gemini') || t.includes('suscripción')) return { i: '📄', c: 'bg-r', tc: 'text-r' };
    if(t.includes('tarjeta') || t.includes('deuda') || t.includes('crédito')) return { i: '💳', c: 'bg-r', tc: 'text-r' };
    if(t.includes('moto') || t.includes('transporte') || t.includes('gasolina')) return { i: '🏍️', c: 'bg-r', tc: 'text-r' };
    if(t.includes('educación')) return { i: '🎓', c: 'bg-r', tc: 'text-r' };
    if(t.includes('hogar') || t.includes('servicios') || t.includes('claro')) return { i: '🏠', c: 'bg-r', tc: 'text-r' };
    if(t.includes('mercado') || t.includes('alimentación') || t.includes('canasta')) return { i: '🛒', c: 'bg-r', tc: 'text-r' };
    if(t.includes('entretenimiento') || t.includes('juego')) return { i: '🎮', c: 'bg-r', tc: 'text-r' };
    return { i: '📝', c: 'bg-r', tc: 'text-r' };
}

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
    const cached = localStorage.getItem("finanzas_cache_v15");
    if (cached) { estadoApp = JSON.parse(cached); refrescarUI(); }
    const data = await enviarDatosAPI("obtenerDashboard", {});
    if (!data.error) { localStorage.setItem("finanzas_cache_v15", JSON.stringify(data)); estadoApp = data; refrescarUI(); }
}

function refrescarUI() {
    pintarDashboard(); llenarSelectMeses(); cambiarMesDashboard(); pintarModuloCreditos(); pintarHistorial();
}

// DASHBOARD
function pintarDashboard() {
    const m = estadoApp.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="dash-balance-box">
            <div class="label" style="text-align: center;">Balance del Mes</div>
            <div class="dash-balance">$ ${formatoPesos(m.balance)}</div>
        </div>
        <div class="dash-grid">
            <div class="dash-box" style="flex-direction: column; gap: 8px;">
                <div style="display:flex; justify-content:space-between; width:100%;"><span class="label" style="margin:0;">Ingresos</span><span class="dash-box-icon bg-g" style="width:24px; height:24px; font-size:12px;">📈</span></div>
                <div class="dash-box-val text-g" style="width:100%; text-align:left;">$ ${formatoPesos(m.ingresos)}</div>
            </div>
            <div class="dash-box" style="flex-direction: column; gap: 8px;">
                <div style="display:flex; justify-content:space-between; width:100%;"><span class="label" style="margin:0;">Gastos</span><span class="dash-box-icon bg-r" style="width:24px; height:24px; font-size:12px;">📉</span></div>
                <div class="dash-box-val text-r" style="width:100%; text-align:left;">$ ${formatoPesos(m.gastos)}</div>
            </div>
            <div class="dash-box" style="grid-column: span 2; justify-content: space-between;">
                <div><div class="label" style="margin:0;">Ahorro</div><div class="dash-box-val text-b">$ ${formatoPesos(m.ahorro)}</div></div>
                <div class="dash-box-icon bg-b">🐷</div>
            </div>
        </div>
    `;
}

function llenarSelectMeses() {
    const s = document.getElementById("filtroMes"); s.innerHTML = "";
    if (estadoApp.comparativoMensual.length === 0) return;
    estadoApp.comparativoMensual.forEach(i => { const o = document.createElement("option"); o.value = i.mes; o.textContent = i.mes; s.appendChild(o); });
    s.selectedIndex = s.options.length - 1;
}

function cambiarMesDashboard() {
    pintarDistribucion("categoriasGastosUI", estadoApp.categoriasGastos, "var(--color-red)");
    pintarDistribucion("categoriasAhorrosUI", estadoApp.categoriasAhorro, "var(--color-blue)");
    pintarMetaAhorro(); 
}

function pintarDistribucion(id, lista, color) {
    const c = document.getElementById(id); c.innerHTML = "";
    if (!lista || lista.length === 0) { c.innerHTML = '<div class="empty">Sin datos</div>'; return;}
    
    const top = lista.slice(0, 7);
    const total = top.reduce((a, b) => a + Number(b.valor || 0), 0);
    
    top.forEach(i => {
        const p = total > 0 ? Math.round((Number(i.valor || 0) / total) * 100) : 0;
        const icon = getIconUI(i.categoria, color.includes('red') ? 'Gasto' : 'Ahorro').i;
        c.innerHTML += `
            <div class="progress-item">
                <div class="progress-head">
                    <span style="display:flex; align-items:center; gap:8px;">${icon} ${i.categoria} <span style="font-size:11px; color:var(--text-dark);">(${p}%)</span></span>
                    <span>$ ${formatoPesos(i.valor)}</span>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:${p}%; background:${color}"></div></div>
            </div>`;
    });
}

// META 5% (CON DONUT CHART SVG VECTORIAL)
function generarDonut(p) {
    const stroke = 283; // 2 * pi * r (r=45)
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
                <div style="font-size:24px;">🏆</div>
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

// HISTORIAL AGRUPADO POR FECHA EXACTO A IMAGEN
function pintarHistorial() {
    const c = document.getElementById("listaMovimientos"); c.innerHTML = "";
    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) { c.innerHTML = `<div class="empty">No hay movimientos.</div>`; return; }
    
    let html = ""; let currentGrp = "";
    estadoApp.ultimosMovimientos.forEach(m => {
        if(m.fechaTexto !== currentGrp) {
            html += `<div class="hist-date">🗓️ ${m.fechaTexto}</div>`;
            currentGrp = m.fechaTexto;
        }

        let ui = getIconUI(m.categoria, m.tipo);
        let s = m.tipo === "Ingreso" ? "+" : "-";
        
        html += `
        <div class="hist-item">
            <div class="hist-icon ${ui.c}">${ui.i}</div>
            <div class="hist-info">
                <div class="hist-title">${m.concepto}</div>
                <div class="hist-cat">${m.categoria}</div>
            </div>
            <div class="hist-right">
                <div class="hist-val ${ui.tc}">${s} $ ${formatoPesos(m.valor)}</div>
                <div class="hist-badge">${m.tipo}</div>
            </div>
        </div>`;
    });
    c.innerHTML = html;
}

function pintarModuloCreditos() {
    const c = document.getElementById("listaDeudasVigentes"); c.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { c.innerHTML = `<div class="empty">No tienes obligaciones activas.</div>`; return; }
    
    estadoApp.creditos.forEach(d => {
        c.innerHTML += `
        <div class="card" style="padding:20px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:15px; border-bottom: 1px solid var(--border); padding-bottom: 15px;">
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-box-icon bg-r" style="width:36px; height:36px;">🏦</div><div><div class="label" style="margin:0;">${d.entidad}</div><div style="font-weight:700; font-size:15px;">${d.nombre}</div></div></div>
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
                <div style="display:flex; gap:10px; align-items:center;"><div class="dash-box-icon bg-b" style="width:36px; height:36px;">💳</div><div><div class="label" style="margin:0;">Tarjeta de Crédito</div><div style="font-weight:700; font-size:15px;">${t.nombre}</div></div></div>
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

    btn.disabled = true; btn.innerText = "Guardando...";
    const res = await enviarDatosAPI("registrarMovimiento", data);
    btn.disabled = false; btn.innerText = "Añadir Transacción";
    mostrarMensaje("mensajeRegistro", res.mensaje);
    if (!res.error) { document.getElementById("conceptoRegistro").value = ""; teclaC(); document.getElementById("notaRegistro").value = ""; cargarDatos(); }
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
});
