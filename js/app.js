if ('serviceWorker' in navigator) { window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); }); }

function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    if (navigator.onLine) {
        badge.innerText = 'Online • Sincronizado'; badge.style.color = 'var(--color-green)';
    } else {
        badge.innerText = 'Offline • Sin conexión'; badge.style.color = 'var(--color-red)';
    }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

// NAVEGACIÓN BOTTOM BAR
function mostrarSeccion(id, btn) {
    document.querySelectorAll(".section").forEach(s => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach(t => t.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if(btn) btn.classList.add("active");
}

function formatoPesos(valor) { return Number(valor || 0).toLocaleString('es-CO'); }

// DICCIONARIO VISUAL (IMAGEN 1)
function getIconUI(cat, tipo) {
    const t = cat.toLowerCase();
    if(tipo === 'Ingreso') return { i: '🏢', c: 'bg-g', tc: 'text-g' };
    if(tipo === 'Ahorro') return { i: '🐷', c: 'bg-b', tc: 'text-b' };
    if(t.includes('gemini') || t.includes('suscripción')) return { i: '🤖', c: 'bg-r', tc: 'text-r' };
    if(t.includes('tarjeta') || t.includes('deuda')) return { i: '💳', c: 'bg-r', tc: 'text-r' };
    if(t.includes('moto') || t.includes('transporte')) return { i: '🏍️', c: 'bg-r', tc: 'text-r' };
    if(t.includes('educación')) return { i: '🎓', c: 'bg-r', tc: 'text-r' };
    if(t.includes('hogar') || t.includes('claro') || t.includes('servicios')) return { i: '🏠', c: 'bg-r', tc: 'text-r' };
    if(t.includes('seguro') || t.includes('póliza')) return { i: '🛡️', c: 'bg-r', tc: 'text-r' };
    return { i: '📝', c: 'bg-r', tc: 'text-r' };
}

let estadoApp = { creditos: [], tarjetas: [], comparativoMensual: [], categoriasGastos: [], categoriasAhorro: [], ultimosMovimientos: [] };
let tipoActualReg = "Gasto";

const categoriasMenu = {
    "Ingreso": ["Salario", "Pago proveedores", "Regalo", "Venta", "Otro ingreso"],
    "Gasto": ["Servicios públicos", "Canasta familiar", "Deudas", "Transporte", "Educación", "Entretenimiento", "Otro gasto"],
    "Ahorro": ["Ahorro personal", "Fondo de emergencia"]
};

// TECLADO (IMAGEN 6)
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
    const cached = localStorage.getItem("finanzas_cache_v14");
    if (cached) { estadoApp = JSON.parse(cached); refrescarUI(); }
    const data = await enviarDatosAPI("obtenerDashboard", {});
    if (!data.error) { localStorage.setItem("finanzas_cache_v14", JSON.stringify(data)); estadoApp = data; refrescarUI(); }
}

function refrescarUI() {
    pintarDashboard(); llenarSelectMeses(); cambiarMesDashboard(); pintarModuloCreditos(); pintarHistorial();
}

function pintarDashboard() {
    const m = estadoApp.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="dash-balance-box">
            <div class="dash-label">Balance del mes</div>
            <div class="dash-balance">$ ${formatoPesos(m.balance)}</div>
        </div>
        <div class="dash-grid">
            <div class="dash-box"><div class="dash-box-icon bg-g">⬇️</div><div><div class="dash-box-title">Ingresos</div><div class="dash-box-val text-g">$ ${formatoPesos(m.ingresos)}</div></div></div>
            <div class="dash-box"><div class="dash-box-icon bg-r">⬆️</div><div><div class="dash-box-title">Gastos</div><div class="dash-box-val text-r">$ ${formatoPesos(m.gastos)}</div></div></div>
            <div class="dash-box" style="grid-column: span 2;"><div class="dash-box-icon bg-b">🐷</div><div><div class="dash-box-title">Ahorro del mes</div><div class="dash-box-val text-b">$ ${formatoPesos(m.ahorro)}</div></div></div>
        </div>
        ${m.gastos > m.ingresos ? `<div class="alert-box" style="background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.2); margin-top: 10px; padding: 12px;"><div class="alert-icon" style="background: var(--color-red); color: white;">⚠️</div><div><div class="alert-title" style="color: var(--color-red);">Presupuesto excedido</div><div class="alert-sub">Gastos superan ingresos en $ ${formatoPesos(m.gastos - m.ingresos)}</div></div></div>` : ''}
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
    if (!lista || lista.length === 0) return;
    const top = lista.slice(0, 5);
    const max = Math.max(...top.map(x => Number(x.valor || 0)), 1);
    top.forEach(i => {
        const p = Math.round((Number(i.valor || 0) / max) * 100);
        const icon = getIconUI(i.categoria, color.includes('red') ? 'Gasto' : 'Ahorro').i;
        c.innerHTML += `
            <div class="top-item">
                <div class="top-icon">${icon}</div>
                <div class="top-info">
                    <div style="display:flex; justify-content:space-between;"><div class="top-name">${i.categoria}</div><div class="top-val">$ ${formatoPesos(i.valor)}</div></div>
                    <div class="top-bar-bg"><div class="top-bar-fill" style="width:${p}%; background:${color}"></div></div>
                </div>
            </div>`;
    });
}

// META 5% (EXACTA IMAGEN 2 DONUT)
function pintarMetaAhorro() {
    const c = document.getElementById("moduloAhorro5");
    const mSel = document.getElementById("filtroMes")?.value;
    const dMes = estadoApp.comparativoMensual.find(m => m.mes === mSel) || { ingresos: 0, ahorro: 0 };

    const iMes = dMes.ingresos || 0; const aMes = dMes.ahorro || 0;
    const mMes = iMes * 0.05; const pMes = mMes > 0 ? Math.round((aMes / mMes) * 100) : 0;
    const grad = Math.min(pMes, 100);

    let tIng = 0; let tAho = 0;
    estadoApp.comparativoMensual.forEach(m => { tIng += (m.ingresos || 0); tAho += (m.ahorro || 0); });
    const mTot = tIng * 0.05;

    c.innerHTML = `
        <div class="dash-grid" style="margin-bottom: 20px;">
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px;"><div class="dash-box-icon bg-g" style="width: 24px; height: 24px; font-size:12px;">📈</div><div class="dash-box-title">Ingresos mes</div><div class="dash-box-val text-g">$ ${formatoPesos(iMes)}</div></div>
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px;"><div class="dash-box-icon bg-b" style="width: 24px; height: 24px; font-size:12px;">🎯</div><div class="dash-box-title">Meta (5%)</div><div class="dash-box-val text-b">$ ${formatoPesos(mMes)}</div></div>
            <div class="dash-box" style="grid-column: span 2; flex-direction: row; gap: 12px; padding: 12px;"><div class="dash-box-icon bg-g">🐷</div><div><div class="dash-box-title">Ahorro real</div><div class="dash-box-val text-g">$ ${formatoPesos(aMes)}</div></div></div>
        </div>

        <div class="donut-container" style="--p: ${grad}%">
            <div class="donut-ring">
                <div class="donut-inner">
                    <div style="color: #fbbf24; font-size: 16px; margin-bottom: 2px;">🏆</div>
                    <div class="donut-val">${pMes}%</div>
                    <div class="donut-lbl">de la meta</div>
                </div>
            </div>
            <div class="donut-info">
                <div class="d-title">Progreso de la meta</div>
                <div class="d-val">$ ${formatoPesos(aMes)}</div>
                <div class="d-title" style="margin-bottom: 8px;">Ahorro este mes <span style="float:right; color:var(--color-green); font-weight:700;">${pMes}%</span></div>
                <div class="d-bar-bg"><div class="d-bar-fill" style="width: ${grad}%"></div></div>
                <div class="d-meta">Meta: <span style="color:var(--color-blue);">$ ${formatoPesos(mMes)}</span></div>
            </div>
        </div>

        ${aMes >= mMes && mMes > 0 ? `<div class="alert-box"><div class="alert-icon">⭐</div><div><div class="alert-title">¡Meta superada por $ ${formatoPesos(aMes - mMes)}!</div><div class="alert-sub">Excelente trabajo, vas por muy buen camino. 💪</div></div></div>` : ''}

        <h4 style="font-size: 14px; margin: 25px 0 15px;">Resumen histórico acumulado</h4>
        <div class="dash-grid">
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px;"><div class="dash-box-icon bg-g" style="width: 24px; height: 24px; font-size:12px;">📊</div><div class="dash-box-title">Ingresos totales</div><div class="dash-box-val">$ ${formatoPesos(tIng)}</div></div>
            <div class="dash-box" style="flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px;"><div class="dash-box-icon bg-g" style="width: 24px; height: 24px; font-size:12px;">🐷</div><div class="dash-box-title">Ahorro acumulado</div><div class="dash-box-val">$ ${formatoPesos(tAho)}</div></div>
            <div class="dash-box" style="grid-column: span 2; flex-direction: row; gap: 12px; padding: 12px;"><div class="dash-box-icon bg-b">🎯</div><div><div class="dash-box-title">Meta ideal acumulada (5%)</div><div class="dash-box-val">$ ${formatoPesos(mTot)}</div></div></div>
        </div>
    `;
}

// HISTORIAL AGRUPADO POR FECHA (EXACTO IMAGEN 1)
function pintarHistorial() {
    const c = document.getElementById("listaMovimientos");
    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) { c.innerHTML = `<div class="empty">No hay movimientos.</div>`; return; }
    
    document.getElementById("countHistorial").innerText = `Mostrando ${estadoApp.ultimosMovimientos.length} movimientos`;
    
    let html = "";
    let fechaActual = "";
    
    estadoApp.ultimosMovimientos.forEach(m => {
        if (m.fechaTexto !== fechaActual) {
            html += `<div class="date-header">🗓️ ${m.fechaTexto}</div>`;
            fechaActual = m.fechaTexto;
        }

        let ui = getIconUI(m.categoria, m.tipo);
        let s = m.tipo === "Ingreso" ? "+" : "-";
        
        html += `
        <div class="hist-item">
            <div class="hist-icon ${ui.c}">${ui.i}</div>
            <div class="hist-info">
                <div class="hist-title">${m.concepto}</div>
                <div class="hist-cat ${ui.tc}">${m.categoria}</div>
                <div class="hist-desc">🔒 ${m.nota || (m.tipo === "Ahorro" ? "Fondo de emergencia" : "Registro manual")}</div>
            </div>
            <div class="hist-right">
                <div style="font-size:11px; color:var(--text-dark);">${m.fechaTexto.split(" ")[0]}</div>
                <div class="hist-val ${ui.tc}">${s} $ ${formatoPesos(m.valor)}</div>
                <div class="hist-badge" style="color:var(--text-white); border-color:var(--border-light); background:var(--bg-input);">${m.tipo}</div>
            </div>
        </div>`;
    });
    c.innerHTML = html;
}

function pintarModuloCreditos() {
    const c = document.getElementById("listaDeudasVigentes"); c.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { c.innerHTML = `<div class="empty">No hay deudas.</div>`; return; }
    estadoApp.creditos.forEach(d => {
        const p = Math.round((1 - (d.saldoActual / d.saldoInicial)) * 100) || 0;
        c.innerHTML += `<div class="card" style="padding:16px; border-radius:12px;"><div class="top-item" style="margin-bottom:12px;"><div class="top-icon">🏦</div><div class="top-info"><div class="top-name">${d.entidad}</div><div style="font-size:16px; font-weight:700;">${d.nombre}</div></div></div><div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;"><span class="dash-label">Saldo pendiente</span><span class="text-r" style="font-weight:700; font-size:16px;">$ ${formatoPesos(d.saldoActual)}</span></div><div class="top-bar-bg" style="margin-bottom:4px;"><div class="top-bar-fill bg-r" style="width:${100-p}%; background:var(--color-red);"></div></div><div style="font-size:11px; color:var(--text-dark); margin-bottom:12px;">${p}% pagado</div><div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); padding:10px; border-radius:8px; border:1px solid var(--border-light);"><div style="font-size:12px; color:var(--text-gray);">Cuota mensual<br><strong style="color:var(--color-blue); font-size:14px;">$ ${formatoPesos(d.cuotaActual)}</strong></div><div style="text-align:right; font-size:12px; color:var(--text-gray);">Próximo pago<br><strong style="color:var(--text-white); font-size:14px;">Día ${d.diaPago || '--'}</strong></div></div></div>`;
    });
}

async function procesarRegistro() {
    const btn = document.getElementById("btnGuardarRegistro");
    const data = { fecha: document.getElementById("fechaRegistro").value, tipo: tipoActualReg, concepto: document.getElementById("conceptoRegistro").value, valor: valorTeclado, nota: document.getElementById("notaRegistro").value, categoria: document.getElementById("categoriaRegistro").value || "Deudas" };
    if (!data.fecha || !data.concepto || data.valor === "") { mostrarMensaje("mensajeRegistro", "Revisa los campos y el valor."); return; }

    btn.disabled = true; btn.innerText = "Guardando...";
    const res = await enviarDatosAPI("registrarMovimiento", data);
    btn.disabled = false; btn.innerText = "Guardar registro";
    mostrarMensaje("mensajeRegistro", res.mensaje);
    if (!res.error) { document.getElementById("conceptoRegistro").value = ""; teclaC(); document.getElementById("notaRegistro").value = ""; cargarDatos(); }
}

function mostrarMensaje(id, texto) {
    const m = document.getElementById(id); m.innerText = texto; m.style.display = "block"; setTimeout(() => m.style.display = "none", 4000);
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed(); document.getElementById("fechaRegistro").valueAsDate = new Date();
    document.querySelector('.type-btn.active').click(); cargarDatos();
});
