// --- LÓGICA DE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); });
}

// --- SISTEMA DE MODO DÍA Y NOCHE ---
function initTheme() {
    const savedTheme = localStorage.getItem('finanzas_theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    document.getElementById('btnTheme').innerText = savedTheme === 'dark' ? '☀️' : '🌙';
    document.getElementById('metaTheme').setAttribute('content', savedTheme === 'dark' ? '#060b19' : '#f8fafc');
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('finanzas_theme', newTheme);
    document.getElementById('btnTheme').innerText = newTheme === 'dark' ? '☀️' : '🌙';
    document.getElementById('metaTheme').setAttribute('content', newTheme === 'dark' ? '#060b19' : '#f8fafc');
}

function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    if (navigator.onLine) {
        badge.innerText = 'Online - Sincronizado'; badge.style.color = 'var(--blue)';
    } else {
        badge.innerText = 'Modo Offline'; badge.style.color = 'var(--red)';
    }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

function mostrarSeccion(idSeccion, botonClicado) {
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(idSeccion).classList.add("active");
    botonClicado.classList.add("active");
}

function formatoPesos(valor) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor || 0);
}

function mostrarMensaje(id, texto) {
    const msj = document.getElementById(id); msj.innerText = texto; msj.style.display = "block";
    setTimeout(() => msj.style.display = "none", 4000);
}

// DICCIONARIO DE ÍCONOS VISUALES
function obtenerIcono(categoria, tipo) {
    const text = categoria.toLowerCase();
    if(tipo === 'Ingreso') return '📈';
    if(tipo === 'Ahorro') return '🐷';
    if(text.includes('mercado') || text.includes('canasta')) return '🛒';
    if(text.includes('transporte') || text.includes('combustible') || text.includes('moto')) return '🏍️';
    if(text.includes('servicios') || text.includes('claro') || text.includes('hogar')) return '🏠';
    if(text.includes('educación') || text.includes('especialización')) return '🎓';
    if(text.includes('salud')) return '🛡️';
    if(text.includes('entretenimiento')) return '🎮';
    if(text.includes('deuda') || text.includes('tarjeta') || text.includes('crédito')) return '💳';
    if(text.includes('suscripción') || text.includes('gemini') || text.includes('ai')) return '🤖';
    return '📝';
}

let estadoApp = { creditos: [], tarjetas: [], comparativoMensual: [], categoriasGastos: [], categoriasAhorro: [], ultimosMovimientos: [] };

const categoriasMenu = {
    "Ingreso": ["Salario", "Bonificación", "Pago proveedores", "Regalo", "Venta", "Trabajo extra", "Otro ingreso"],
    "Gasto": ["Servicios públicos", "Canasta familiar", "Deudas", "Transporte", "Combustible", "Vivienda", "Salud", "Educación", "Entretenimiento", "Otro gasto"],
    "Ahorro": ["Ahorro personal", "Fondo de emergencia", "Inversión", "Otro ahorro"]
};

function cambiarFormularioRegistro() {
    const tipo = document.getElementById("tipoRegistro").value;
    const selectCategoria = document.getElementById("categoriaRegistro");
    if (tipo === "Ingreso" || tipo === "Gasto" || tipo === "Ahorro") {
        document.getElementById("grupoCategoria").style.display = "block"; 
        document.getElementById("grupoDeudas").style.display = "none";
        selectCategoria.innerHTML = "";
        categoriasMenu[tipo].forEach(cat => {
            const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat; selectCategoria.appendChild(opt);
        });
    } else {
        document.getElementById("grupoCategoria").style.display = "none"; 
        document.getElementById("grupoDeudas").style.display = "block";
        document.getElementById("labelDeuda").innerText = tipo === "PagoCredito" ? "Crédito a Pagar" : "Tarjeta a Pagar/Usar";
        llenarSelectDeudas(tipo);
    }
}

async function cargarDatos() {
    const divDash = document.getElementById("dashboard-content");
    const btnAct = document.querySelector(".btn-blue");

    const datosGuardados = localStorage.getItem("finanzas_cache_v12");
    if (datosGuardados) {
        const data = JSON.parse(datosGuardados);
        estadoApp = {
            creditos: data.creditos || [], tarjetas: data.tarjetas || [],
            comparativoMensual: data.comparativoMensual || [], categoriasGastos: data.categoriasGastos || [],
            categoriasAhorro: data.categoriasAhorro || [], ultimosMovimientos: data.ultimosMovimientos || []
        };
        pintarDashboard(data); llenarSelectMeses(); cambiarMesDashboard();
        pintarModuloCreditos(); pintarHistorial(); cambiarFormularioRegistro();
    }

    btnAct.innerText = "⏳"; btnAct.disabled = true;
    const data = await enviarDatosAPI("obtenerDashboard", {});
    btnAct.innerText = "↻ Actualizar"; btnAct.disabled = false;

    if (!data.error) { 
        localStorage.setItem("finanzas_cache_v12", JSON.stringify(data));
        estadoApp = {
            creditos: data.creditos || [], tarjetas: data.tarjetas || [],
            comparativoMensual: data.comparativoMensual || [], categoriasGastos: data.categoriasGastos || [],
            categoriasAhorro: data.categoriasAhorro || [], ultimosMovimientos: data.ultimosMovimientos || []
        };
        pintarDashboard(data); llenarSelectMeses(); cambiarMesDashboard();
        pintarModuloCreditos(); pintarHistorial(); cambiarFormularioRegistro();
    }
}

function pintarDashboard(data) {
    const mes = data.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="balance-panel">
            <div class="label" style="margin-top:0;">Balance del Mes</div>
            <div class="money-big">${formatoPesos(mes.balance)}</div>
        </div>
        <div class="stats">
            <div class="stat"><div class="stat-icon">📈</div><div class="label" style="margin:0;">Ingresos</div><div class="stat-value green">${formatoPesos(mes.ingresos)}</div></div>
            <div class="stat"><div class="stat-icon">📉</div><div class="label" style="margin:0;">Gastos</div><div class="stat-value red">${formatoPesos(mes.gastos)}</div></div>
            <div class="stat" style="grid-column: span 2;"><div class="stat-icon">🐷</div><div class="label" style="margin:0;">Ahorro</div><div class="stat-value blue">${formatoPesos(mes.ahorro)}</div></div>
        </div>
    `;
}

function llenarSelectMeses() {
    const select = document.getElementById("filtroMes");
    const valorPrevio = select.value;
    select.innerHTML = "";
    if (estadoApp.comparativoMensual.length === 0) return;
    
    estadoApp.comparativoMensual.forEach(item => {
        const opt = document.createElement("option"); opt.value = item.mes; opt.textContent = item.mes; select.appendChild(opt);
    });
    if (valorPrevio && [...select.options].some(o => o.value === valorPrevio)) { select.value = valorPrevio; } 
    else { select.selectedIndex = select.options.length - 1; }
}

function cambiarMesDashboard() {
    pintarDistribucion("categoriasGastosUI", estadoApp.categoriasGastos, "red-bg");
    pintarDistribucion("categoriasAhorrosUI", estadoApp.categoriasAhorro, "blue-bg");
    pintarMetaAhorro(); 
}

function pintarDistribucion(idContenedor, lista, claseBarra) {
    const cont = document.getElementById(idContenedor);
    cont.innerHTML = "";
    if (!lista || lista.length === 0) { cont.innerHTML = `<div class="empty">Sin datos registrados.</div>`; return; }
    
    const total = lista.reduce((acc, item) => acc + Number(item.valor || 0), 0);
    lista.forEach(item => {
        const porcentaje = total > 0 ? Math.round((Number(item.valor || 0) / total) * 100) : 0;
        const icono = obtenerIcono(item.categoria, claseBarra.includes('red') ? 'Gasto' : 'Ahorro');
        const div = document.createElement("div"); div.className = "bar-row";
        div.innerHTML = `
            <div class="bar-head">
                <span style="color: var(--text-main); font-weight: 700;">${icono} <span style="margin-left: 5px;">${item.categoria}</span> <span style="font-size: 11px; color: var(--text-muted); font-weight: 600;">(${porcentaje}%)</span></span>
                <span>${formatoPesos(item.valor)}</span>
            </div>
            <div class="bar-bg"><div class="bar ${claseBarra}" style="width:${porcentaje}%"></div></div>
        `;
        cont.appendChild(div);
    });
}

function lanzarConfeti() {
    const colores = ['#10b981', '#0ea5e9', '#f59e0b', '#f43f5e', '#8b5cf6'];
    for (let i = 0; i < 110; i++) {
        const confeti = document.createElement('div');
        confeti.classList.add('confetti');
        confeti.style.left = Math.random() * 100 + 'vw';
        confeti.style.backgroundColor = colores[Math.floor(Math.random() * colores.length)];
        confeti.style.width = (Math.random() * 8 + 6) + 'px'; confeti.style.height = (Math.random() * 8 + 6) + 'px';
        confeti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        document.body.appendChild(confeti);
        setTimeout(() => confeti.remove(), 6000);
    }
}

// --- ACTUALIZACIÓN: ANILLO CIRCULAR DE PROGRESO ---
function pintarMetaAhorro() {
    const cont = document.getElementById("moduloAhorro5");
    if (!cont) return;

    const selectMes = document.getElementById("filtroMes");
    const mesSeleccionado = selectMes ? selectMes.value : null;
    const datosMes = estadoApp.comparativoMensual.find(m => m.mes === mesSeleccionado) || { ingresos: 0, ahorro: 0 };

    let totalIngresos = 0; let totalAhorro = 0;
    estadoApp.comparativoMensual.forEach(m => { totalIngresos += (m.ingresos || 0); totalAhorro += (m.ahorro || 0); });
    
    // Cálculos del Anillo Circular (Mes)
    const ingresosMes = datosMes.ingresos || 0;
    const ahorroMes = datosMes.ahorro || 0;
    const metaMes = ingresosMes * 0.05;
    const diffMes = ahorroMes - metaMes; 
    
    // Evitar división por cero
    const porcentajeMes = metaMes > 0 ? Math.round((ahorroMes / metaMes) * 100) : 0;
    const gradosAnillo = Math.min((porcentajeMes / 100) * 360, 360); // CSS conic-gradient usa grados o %

    // Cálculos Históricos
    const metaTotal = totalIngresos * 0.05;
    const diffTotal = totalAhorro - metaTotal; 

    if (totalAhorro >= 1000000 && !localStorage.getItem('confeti_1m_logrado')) {
        localStorage.setItem('confeti_1m_logrado', 'true'); lanzarConfeti();
    }

    const META_GLOBAL = 50000000;
    const porcentajeAvion = Math.min((totalAhorro / META_GLOBAL) * 100, 100);

    cont.innerHTML = `
        <div class="stats" style="margin-bottom: 20px;">
            <div class="stat" style="text-align: center;"><div class="label" style="margin:0;">Ingresos Mes</div><div class="stat-value green" style="font-size: 16px;">${formatoPesos(ingresosMes)}</div></div>
            <div class="stat" style="text-align: center;"><div class="label" style="margin:0;">Meta Ideal (5%)</div><div class="stat-value blue" style="font-size: 16px;">${formatoPesos(metaMes)}</div></div>
        </div>
        
        <!-- ANILLO NEON DE PROGRESO -->
        <div style="background: var(--input-bg); border-radius: 20px; padding: 25px 15px; border: 1px solid var(--card-border); margin-bottom: 25px;">
            <div class="progress-ring-container">
                <div class="circular-progress" style="--progress: ${Math.min(porcentajeMes, 100)}">
                    <div class="circular-inner">
                        <div style="font-size: 24px; color: var(--primary);">🏆</div>
                        <div class="ring-value">${porcentajeMes}%</div>
                        <div class="ring-label">de la meta</div>
                    </div>
                </div>
            </div>
            
            <div style="text-align: center; margin-top: 15px;">
                <div style="font-size: 13px; color: var(--text-muted);">Ahorro este mes</div>
                <div class="money-big ${diffMes < 0 ? 'red' : 'green'}" style="font-size: 28px;">${formatoPesos(ahorroMes)}</div>
                ${diffMes >= 0 ? `<div style="color: var(--primary); font-size: 13px; font-weight: 700; margin-top: 5px;">¡Meta superada por ${formatoPesos(diffMes)}! 💪</div>` : `<div style="color: var(--red); font-size: 13px; font-weight: 700; margin-top: 5px;">Faltan ${formatoPesos(Math.abs(diffMes))}</div>`}
            </div>
        </div>

        <h4 style="margin: 30px 0 10px; font-size: 14px; text-transform: uppercase; color: var(--text-muted); text-align: center;">Resumen Histórico</h4>
        <div class="stats" style="margin-bottom: 25px;">
            <div class="stat"><div class="stat-icon">📊</div><div class="label" style="margin:0;">Ingresos Totales</div><div class="stat-value" style="font-size: 15px;">${formatoPesos(totalIngresos)}</div></div>
            <div class="stat"><div class="stat-icon">🎯</div><div class="label" style="margin:0;">Meta (5%)</div><div class="stat-value blue" style="font-size: 15px;">${formatoPesos(metaTotal)}</div></div>
            <div class="stat" style="grid-column: span 2; display: flex; flex-direction: row; justify-content: space-between; align-items: center;">
                <div>
                    <div class="label" style="margin:0;">Ahorro Real</div>
                    <div class="stat-value ${diffTotal < 0 ? 'red' : 'green'}">${formatoPesos(totalAhorro)}</div>
                </div>
                <div style="text-align: right;">
                    <div class="label" style="margin:0;">Estado</div>
                    <div style="font-size: 13px; font-weight: 800; color: var(--${diffTotal < 0 ? 'red' : 'primary'});">${diffTotal < 0 ? 'Deuda' : 'A favor'}</div>
                </div>
            </div>
        </div>

        <h4 style="margin: 30px 0 10px; font-size: 14px; text-transform: uppercase; color: var(--text-muted); text-align: center;">🚀 Vuelo a los $50 Millones</h4>
        <div style="background: var(--input-bg); padding: 25px 15px; border-radius: 20px; border: 1px solid var(--card-border);">
            <div style="display:flex; justify-content: space-between; font-weight: 800; font-size: 15px;">
                <span>Progreso Total</span><span class="blue">${porcentajeAvion.toFixed(2)}%</span>
            </div>
            <div class="airplane-track">
                <div class="airplane-fill" style="width: ${porcentajeAvion}%"><div class="airplane-icon">✈️</div></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; color: var(--text-muted); font-weight: 700; margin-top: 10px;">
                <span>Logrado: <strong class="green">${formatoPesos(totalAhorro)}</strong></span>
                <span>Faltan: <strong class="red">${formatoPesos(META_GLOBAL - totalAhorro)}</strong></span>
            </div>
        </div>
    `;
}

async function procesarAhorroRapido() {
    const valorInput = document.getElementById("valorAhorroRapido").value;
    if (!valorInput || valorInput <= 0) { mostrarMensaje("msjAhorroRapido", "Valor inválido."); return; }
    const btn = document.getElementById("btnAhorroRapido");
    btn.disabled = true; btn.innerText = "...";
    const payload = { fecha: new Date().toISOString().split('T')[0], tipo: "Ahorro", categoria: "Ahorro personal", concepto: "Abono a meta", valor: valorInput, nota: "Meta 5%" };
    const res = await enviarDatosAPI("registrarMovimiento", payload);
    btn.disabled = false; btn.innerText = "Abonar";
    if (!res.error) { document.getElementById("valorAhorroRapido").value = ""; cargarDatos(); }
}

function pintarModuloCreditos() {
    const cont = document.getElementById("listaDeudasVigentes");
    cont.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { cont.innerHTML = `<div class="empty">No tienes deudas activas.</div>`; return; }
    let html = "";
    estadoApp.creditos.forEach(c => { 
        html += `<div class="card" style="padding: 18px; margin-bottom: 12px;"><div class="debt-title" style="margin-bottom: 12px;"><span><span style="font-size: 20px; margin-right: 8px;">🏦</span>${c.nombre}</span><span class="red">${formatoPesos(c.saldoActual)}</span></div><div class="movement-bottom" style="display: flex; justify-content: space-between; border-top: 1px dashed var(--card-border); padding-top: 12px;"><span>${c.entidad}</span><span>Cuota: <strong style="color: var(--text-main); font-size: 14px;">${formatoPesos(c.cuotaActual)}</strong></span></div></div>`; 
    });
    estadoApp.tarjetas.forEach(t => { 
        html += `<div class="card" style="padding: 18px; margin-bottom: 12px;"><div class="debt-title" style="margin-bottom: 12px;"><span><span style="font-size: 20px; margin-right: 8px;">💳</span>${t.nombre}</span><span class="red">${formatoPesos(t.saldoActual)}</span></div><div class="movement-bottom" style="display: flex; justify-content: space-between; border-top: 1px dashed var(--card-border); padding-top: 12px;"><span>Cupo: ${formatoPesos(t.cupoTotal)}</span><span>Disp: <strong class="green" style="font-size: 14px;">${formatoPesos(t.disponible)}</strong></span></div></div>`; 
    });
    cont.innerHTML = html;
}

// --- HISTORIAL REDISEÑADO ---
function pintarHistorial() {
    const cont = document.getElementById("listaMovimientos");
    if (!cont) return;
    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) { cont.innerHTML = `<div class="empty">No hay movimientos.</div>`; return; }
    
    let html = "";
    estadoApp.ultimosMovimientos.forEach(m => {
        let isIngreso = m.tipo === "Ingreso"; let isAhorro = m.tipo === "Ahorro";
        let colorClase = isIngreso ? "green" : isAhorro ? "blue" : "red";
        let signo = isIngreso ? "+" : "-";
        let icono = obtenerIcono(m.categoria, m.tipo);

        html += `
        <div class="historial-item">
            <div class="h-icon-wrap" style="color: var(--${colorClase}); border-color: rgba(var(--${colorClase}), 0.2); box-shadow: 0 2px 10px rgba(var(--${colorClase}), 0.1);">${icono}</div>
            <div class="h-details">
                <div class="h-title">${m.concepto}</div>
                <div class="h-date">${m.fechaTexto} · ${m.categoria} <span class="h-badge" style="color: var(--${colorClase}); border-color: rgba(var(--${colorClase}), 0.3);">${m.tipo}</span></div>
            </div>
            <div class="h-amount ${colorClase}">${signo} ${formatoPesos(m.valor)}</div>
        </div>`;
    });
    cont.innerHTML = html;
}

function llenarSelectDeudas(tipo) {
    const select = document.getElementById("deudaSeleccionada"); select.innerHTML = "";
    const lista = tipo === "PagoCredito" ? estadoApp.creditos : estadoApp.tarjetas;
    if (lista.length === 0) { const opt = document.createElement("option"); opt.value = ""; opt.textContent = "Sin registros"; select.appendChild(opt); return; }
    lista.forEach(item => { const opt = document.createElement("option"); opt.value = tipo === "PagoCredito" ? item.idCredito : item.idTarjeta; opt.textContent = `${item.nombre} - Saldo: ${formatoPesos(item.saldoActual)}`; select.appendChild(opt); });
}

async function procesarRegistro() {
    const btn = document.getElementById("btnGuardarRegistro");
    const data = { fecha: document.getElementById("fechaRegistro").value, tipo: document.getElementById("tipoRegistro").value, concepto: document.getElementById("conceptoRegistro").value, valor: document.getElementById("valorRegistro").value, nota: document.getElementById("notaRegistro").value };
    if (data.tipo === "Ingreso" || data.tipo === "Gasto" || data.tipo === "Ahorro") { data.categoria = document.getElementById("categoriaRegistro").value; } else { data.categoria = "Deudas"; data.idDeuda = document.getElementById("deudaSeleccionada").value; }
    if (!data.fecha || !data.concepto || !data.valor) { mostrarMensaje("mensajeRegistro", "Completa fecha, concepto y valor."); return; }

    btn.disabled = true; btn.innerText = "Guardando...";
    let action = "registrarMovimiento"; let payload = data;
    if (data.tipo === "PagoCredito") { action = "registrarPagoCredito"; payload = { idCredito: data.idDeuda, fecha: data.fecha, valorPagado: data.valor, registrarComoGasto: true, nota: data.nota }; } 
    else if (data.tipo === "PagoTarjeta") { action = "registrarMovimientoTarjeta"; payload = { idTarjeta: data.idDeuda, tipoMovimiento: "Pago", fecha: data.fecha, valorBase: data.valor, registrarGasto: true, nota: data.nota }; }

    const res = await enviarDatosAPI(action, payload);
    btn.disabled = false; btn.innerText = "Añadir Transacción";
    mostrarMensaje("mensajeRegistro", res.mensaje);
    if (!res.error) { document.getElementById("conceptoRegistro").value = ""; document.getElementById("valorRegistro").value = ""; document.getElementById("notaRegistro").value = ""; cargarDatos(); }
}

function cambiarFormularioDeuda() {
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    document.getElementById("labelSaldoCupo").innerText = tipo === "credito" ? "Saldo Inicial" : "Cupo Total";
}

async function crearNuevaObligacion() {
    const btn = document.getElementById("btnCrearDeuda");
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const banco = document.getElementById("bancoNuevaDeuda").value;
    const nombre = document.getElementById("nombreNuevaDeuda").value;
    const saldoCupo = document.getElementById("saldoNuevaDeuda").value;
    const diaPago = document.getElementById("diaPagoNuevaDeuda").value;

    if (!banco || !nombre || !saldoCupo) { mostrarMensaje("mensajeNuevaDeuda", "Faltan datos."); return; }
    btn.disabled = true; btn.innerText = "Creando...";
    let action = tipo === "credito" ? "registrarCredito" : "registrarTarjeta";
    let payload = tipo === "credito" ? { nombre: nombre, entidad: banco, tipoCredito: "Otro", saldoActual: saldoCupo, saldoInicial: saldoCupo, diaPago: diaPago } : { nombre: nombre, banco: banco, cupoTotal: saldoCupo, saldoActual: 0, diaPago: diaPago };
    
    const res = await enviarDatosAPI(action, payload);
    btn.disabled = false; btn.innerText = "Crear Obligación";
    mostrarMensaje("mensajeNuevaDeuda", res.mensaje);
    if (!res.error) { document.getElementById("bancoNuevaDeuda").value = ""; document.getElementById("nombreNuevaDeuda").value = ""; document.getElementById("saldoNuevaDeuda").value = ""; document.getElementById("diaPagoNuevaDeuda").value = ""; cargarDatos(); }
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    actualizarEstadoRed();
    document.getElementById("fechaRegistro").valueAsDate = new Date();
    cambiarFormularioRegistro();
    cargarDatos();
});
