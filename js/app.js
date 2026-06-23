if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js'); });
}

function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    if (navigator.onLine) {
        badge.innerText = 'Online - Sincronizado'; badge.style.background = '#38bdf8'; badge.style.color = '#020617';
    } else {
        badge.innerText = 'Modo Offline'; badge.style.background = '#ef4444'; badge.style.color = '#ffffff';
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
    setTimeout(() => msj.style.display = "none", 5000);
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
        document.getElementById("labelDeuda").innerText = tipo === "PagoCredito" ? "Seleccionar Crédito" : "Seleccionar Tarjeta";
        llenarSelectDeudas(tipo);
    }
}

async function cargarDatos() {
    const divDash = document.getElementById("dashboard-content");
    const btnAct = document.querySelector(".btn-blue");

    const datosGuardados = localStorage.getItem("finanzas_cache_v10");
    if (datosGuardados) {
        const data = JSON.parse(datosGuardados);
        estadoApp = {
            creditos: data.creditos || [], tarjetas: data.tarjetas || [],
            comparativoMensual: data.comparativoMensual || [], 
            categoriasGastos: data.categoriasGastos || [],
            categoriasAhorro: data.categoriasAhorro || [],
            ultimosMovimientos: data.ultimosMovimientos || []
        };
        pintarDashboard(data); llenarSelectMeses(); cambiarMesDashboard();
        pintarModuloCreditos(); pintarHistorial(); cambiarFormularioRegistro();
    } else {
        divDash.innerHTML = "<div class='empty'>Descargando información desde Google Sheets...</div>";
    }

    btnAct.innerText = "Sincronizando..."; btnAct.disabled = true;
    const data = await enviarDatosAPI("obtenerDashboard", {});
    btnAct.innerText = "Actualizar"; btnAct.disabled = false;

    if (data.error) { 
        if (!datosGuardados) divDash.innerHTML = `<div class='empty' style='color:red;'>Error al conectar: ${data.mensaje}</div>`; 
        return; 
    }

    localStorage.setItem("finanzas_cache_v10", JSON.stringify(data));
    estadoApp = {
        creditos: data.creditos || [], tarjetas: data.tarjetas || [],
        comparativoMensual: data.comparativoMensual || [], 
        categoriasGastos: data.categoriasGastos || [],
        categoriasAhorro: data.categoriasAhorro || [],
        ultimosMovimientos: data.ultimosMovimientos || []
    };

    pintarDashboard(data); llenarSelectMeses(); cambiarMesDashboard();
    pintarModuloCreditos(); pintarHistorial(); cambiarFormularioRegistro();
}

function pintarDashboard(data) {
    const mes = data.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    document.getElementById("dashboard-content").innerHTML = `
        <div class="label">Balance del mes</div>
        <div class="money-big">${formatoPesos(mes.balance)}</div>
        <div class="stats" style="margin-top:14px;">
            <div class="stat"><div class="label">Ingresos</div><div class="stat-value green">${formatoPesos(mes.ingresos)}</div></div>
            <div class="stat"><div class="label">Gastos</div><div class="stat-value red">${formatoPesos(mes.gastos)}</div></div>
            <div class="stat"><div class="label">Ahorro</div><div class="stat-value blue">${formatoPesos(mes.ahorro)}</div></div>
        </div>
    `;
}

function llenarSelectMeses() {
    const select = document.getElementById("filtroMes");
    const valorPrevio = select.value;
    select.innerHTML = "";
    if (estadoApp.comparativoMensual.length === 0) { select.innerHTML = "<option>Sin datos</option>"; return; }
    
    estadoApp.comparativoMensual.forEach(item => {
        const opt = document.createElement("option"); opt.value = item.mes; opt.textContent = item.mes; select.appendChild(opt);
    });
    if (valorPrevio && [...select.options].some(o => o.value === valorPrevio)) { select.value = valorPrevio; } 
    else { select.selectedIndex = select.options.length - 1; }
}

function cambiarMesDashboard() {
    const mesSeleccionado = document.getElementById("filtroMes").value;
    const contGrafica = document.getElementById("graficaMesSeleccionado");
    const datosMes = estadoApp.comparativoMensual.find(m => m.mes === mesSeleccionado);
    
    if (!datosMes) { contGrafica.innerHTML = "<div class='empty'>No hay datos.</div>"; return; }

    const ingresos = Number(datosMes.ingresos || 0); const gastos = Number(datosMes.gastos || 0); const ahorro = Number(datosMes.ahorro || 0);
    const max = Math.max(ingresos, gastos, ahorro, 1);
    const hIngreso = Math.max(Math.round((ingresos / max) * 100), ingresos > 0 ? 5 : 0);
    const hGasto = Math.max(Math.round((gastos / max) * 100), gastos > 0 ? 5 : 0);
    const hAhorro = Math.max(Math.round((ahorro / max) * 100), ahorro > 0 ? 5 : 0);

    contGrafica.innerHTML = `
      <div class="chart-summary">
        <div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar-vertical bar-ingreso" style="height:${hIngreso}%"></div></div><div class="chart-label">Ingresos</div><div class="chart-value green">${formatoPesos(ingresos)}</div></div>
        <div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar-vertical bar-gasto" style="height:${hGasto}%"></div></div><div class="chart-label">Gastos</div><div class="chart-value red">${formatoPesos(gastos)}</div></div>
        <div class="chart-col"><div class="chart-bar-wrap"><div class="chart-bar-vertical bar-ahorro" style="height:${hAhorro}%"></div></div><div class="chart-label">Ahorro</div><div class="chart-value blue">${formatoPesos(ahorro)}</div></div>
      </div>
    `;

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
        const div = document.createElement("div"); div.className = "bar-row";
        div.innerHTML = `
            <div class="bar-head">
                <span>${item.categoria} <span style="font-size: 11px; color: var(--muted); font-weight: 800;">(${porcentaje}%)</span></span>
                <span>${formatoPesos(item.valor)}</span>
            </div>
            <div class="bar-bg"><div class="bar ${claseBarra}" style="width:${porcentaje}%"></div></div>
        `;
        cont.appendChild(div);
    });
}

function lanzarConfeti() {
    const colores = ['#22c55e', '#38bdf8', '#fbbf24', '#ef4444', '#a855f7'];
    for (let i = 0; i < 110; i++) {
        const confeti = document.createElement('div');
        confeti.classList.add('confetti');
        confeti.style.left = Math.random() * 100 + 'vw';
        confeti.style.backgroundColor = colores[Math.floor(Math.random() * colores.length)];
        confeti.style.width = (Math.random() * 8 + 6) + 'px';
        confeti.style.height = (Math.random() * 8 + 6) + 'px';
        confeti.style.animationDuration = (Math.random() * 3 + 2) + 's';
        confeti.style.animationDelay = (Math.random() * 2) + 's';
        document.body.appendChild(confeti);
        setTimeout(() => confeti.remove(), 6000);
    }
    setTimeout(() => {
        alert("✈️ 🎉 ¡FELICITACIONES! Has logrado tu primer millón ahorrado en el sistema. El vuelo hacia los 50 Millones ha despegado con éxito. ¡Sigue así!");
    }, 600);
}

// --- ACTUALIZADO: META 5% CON RETRASO EXPLICITO ---
function pintarMetaAhorro() {
    const cont = document.getElementById("moduloAhorro5");
    if (!cont) return;

    const selectMes = document.getElementById("filtroMes");
    const mesSeleccionado = selectMes ? selectMes.value : null;
    const datosMes = estadoApp.comparativoMensual.find(m => m.mes === mesSeleccionado) || { ingresos: 0, ahorro: 0 };

    let totalIngresos = 0; let totalAhorro = 0;
    estadoApp.comparativoMensual.forEach(m => { totalIngresos += (m.ingresos || 0); totalAhorro += (m.ahorro || 0); });
    
    // El retraso o excedente acumulado
    const metaTotal = totalIngresos * 0.05;
    const diffTotal = totalAhorro - metaTotal; 

    if (totalAhorro >= 1000000 && !localStorage.getItem('confeti_1m_logrado')) {
        localStorage.setItem('confeti_1m_logrado', 'true');
        lanzarConfeti();
    }

    const META_GLOBAL = 50000000;
    const porcentajeAvion = Math.min((totalAhorro / META_GLOBAL) * 100, 100);

    cont.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 14px; color: var(--muted);">Balance Histórico de Ahorro</h4>
        <div class="debt-card" style="background: transparent; border: 1px solid var(--soft2);">
            <div class="debt-title" style="font-size: 13px;"><span>Ingresos Históricos:</span><span>${formatoPesos(totalIngresos)}</span></div>
            <div class="debt-title" style="font-size: 13px; color: var(--blue);"><span>Ahorro Ideal (5%):</span><span>${formatoPesos(metaTotal)}</span></div>
            <div class="debt-title" style="font-size: 13px;"><span>Ahorro Real:</span><span class="${diffTotal < 0 ? 'red' : 'green'}">${formatoPesos(totalAhorro)}</span></div>
            
            <hr style="border: 0; border-top: 1px dashed var(--muted); margin: 8px 0;">
            
            <div class="debt-title" style="font-size: 14px; margin-bottom:0;">
                <span>${diffTotal < 0 ? '⚠️ Déficit / Retraso:' : '✅ Ahorro a favor:'}</span>
                <span class="${diffTotal < 0 ? 'red' : 'green'}">${formatoPesos(Math.abs(diffTotal))}</span>
            </div>
            ${diffTotal < 0 ? `<div style="font-size: 11px; color: var(--muted); margin-top: 4px;">Le debes este dinero a tu propia bolsa de ahorros.</div>` : ''}
        </div>

        <h4 style="margin: 25px 0 10px 0; font-size: 14px; color: var(--muted);">Vuelo hacia los $50 Millones</h4>
        <div class="debt-card">
            <div class="debt-title">
                <span>Progreso Total</span>
                <span class="blue">${porcentajeAvion.toFixed(2)}%</span>
            </div>

            <div class="airplane-track">
                <div class="airplane-fill" style="width: ${porcentajeAvion}%">
                    <div class="airplane-icon">✈️</div>
                </div>
            </div>

            <div class="movement-bottom" style="display: flex; justify-content: space-between; margin-top: 15px;">
                <span>Ahorrado:<br><strong class="green">${formatoPesos(totalAhorro)}</strong></span>
                <span style="text-align: right;">Faltan:<br><strong class="red">${formatoPesos(META_GLOBAL - totalAhorro)}</strong></span>
            </div>
        </div>
    `;
}

// --- NUEVA LÓGICA: ABONO RÁPIDO ---
async function procesarAhorroRapido() {
    const valorInput = document.getElementById("valorAhorroRapido").value;
    
    if (!valorInput || valorInput <= 0) {
        mostrarMensaje("msjAhorroRapido", "Ingresa un valor válido.");
        return;
    }

    const btn = document.getElementById("btnAhorroRapido");
    btn.disabled = true; btn.innerText = "...";

    const payload = {
        fecha: new Date().toISOString().split('T')[0],
        tipo: "Ahorro",
        categoria: "Ahorro personal",
        concepto: "Abono directo a meta",
        valor: valorInput,
        nota: "Registrado desde acceso rápido Meta 5%"
    };

    const res = await enviarDatosAPI("registrarMovimiento", payload);
    btn.disabled = false; btn.innerText = "Abonar";
    mostrarMensaje("msjAhorroRapido", res.mensaje);

    if (!res.error) {
        document.getElementById("valorAhorroRapido").value = "";
        cargarDatos(); 
    }
}

function pintarModuloCreditos() {
    const cont = document.getElementById("listaDeudasVigentes");
    cont.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) { cont.innerHTML = `<div class="empty">No tienes deudas activas.</div>`; return; }
    let html = "";
    estadoApp.creditos.forEach(c => { html += `<div class="debt-card"><div class="debt-title"><span>🏦 ${c.nombre}</span><span class="red">${formatoPesos(c.saldoActual)}</span></div><div class="movement-bottom">${c.entidad} · Cuota: ${formatoPesos(c.cuotaActual)}</div></div>`; });
    estadoApp.tarjetas.forEach(t => { html += `<div class="debt-card"><div class="debt-title"><span>💳 ${t.nombre}</span><span class="red">${formatoPesos(t.saldoActual)}</span></div><div class="movement-bottom">Cupo: ${formatoPesos(t.cupoTotal)} · Disponible: ${formatoPesos(t.disponible)}</div></div>`; });
    cont.innerHTML = html;
}

function pintarHistorial() {
    const cont = document.getElementById("listaMovimientos");
    if (!cont) return;

    if (!estadoApp.ultimosMovimientos || estadoApp.ultimosMovimientos.length === 0) {
        cont.innerHTML = `<div class="empty">Aún no hay movimientos registrados.</div>`;
        return;
    }

    let html = "";
    estadoApp.ultimosMovimientos.forEach(m => {
        let colorClase = m.tipo === "Ingreso" ? "green" : m.tipo === "Gasto" ? "red" : "blue";
        let signo = m.tipo === "Ingreso" ? "+" : "-";

        html += `
        <div class="debt-card" style="padding: 12px;">
            <div class="debt-title" style="margin-bottom: 6px;">
                <span>${m.concepto}</span>
                <span class="${colorClase}">${signo} ${formatoPesos(m.valor)}</span>
            </div>
            <div class="movement-bottom" style="display: flex; justify-content: space-between; align-items: center;">
                <span>${m.fechaTexto} · ${m.categoria}</span>
                <span style="font-size: 10px; background: rgba(255,255,255,0.5); padding: 3px 8px; border-radius: 6px; color: var(--text);">${m.tipo}</span>
            </div>
            ${m.nota ? `<div style="font-size: 11px; color: var(--muted); margin-top: 8px; font-style: italic; border-top: 1px solid var(--soft2); padding-top: 8px;">${m.nota}</div>` : ""}
        </div>`;
    });
    cont.innerHTML = html;
}

function llenarSelectDeudas(tipo) {
    const select = document.getElementById("deudaSeleccionada"); select.innerHTML = "";
    const lista = tipo === "PagoCredito" ? estadoApp.creditos : estadoApp.tarjetas;
    if (lista.length === 0) { const opt = document.createElement("option"); opt.value = ""; opt.textContent = "No tienes deudas registradas"; select.appendChild(opt); return; }
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
    btn.disabled = false; btn.innerText = "Guardar Registro";
    mostrarMensaje("mensajeRegistro", res.mensaje);
    
    if (!res.error) {
        document.getElementById("conceptoRegistro").value = ""; document.getElementById("valorRegistro").value = ""; document.getElementById("notaRegistro").value = "";
        cargarDatos(); 
    }
}

function cambiarFormularioDeuda() {
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const labelSaldo = document.getElementById("labelSaldoCupo");
    labelSaldo.innerText = tipo === "credito" ? "Saldo Actual / Inicial" : "Cupo Total de la Tarjeta";
}

async function crearNuevaObligacion() {
    const btn = document.getElementById("btnCrearDeuda");
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const banco = document.getElementById("bancoNuevaDeuda").value;
    const nombre = document.getElementById("nombreNuevaDeuda").value;
    const saldoCupo = document.getElementById("saldoNuevaDeuda").value;
    const diaPago = document.getElementById("diaPagoNuevaDeuda").value;

    if (!banco || !nombre || !saldoCupo) {
        mostrarMensaje("mensajeNuevaDeuda", "Completa la entidad, nombre y saldo/cupo.");
        return;
    }

    btn.disabled = true; btn.innerText = "Creando...";
    let action = ""; let payload = {};

    if (tipo === "credito") {
        action = "registrarCredito";
        payload = { nombre: nombre, entidad: banco, tipoCredito: "Otro crédito", saldoActual: saldoCupo, saldoInicial: saldoCupo, diaPago: diaPago };
    } else {
        action = "registrarTarjeta";
        payload = { nombre: nombre, banco: banco, cupoTotal: saldoCupo, saldoActual: 0, diaPago: diaPago };
    }

    const res = await enviarDatosAPI(action, payload);
    btn.disabled = false; btn.innerText = "Crear Registro";
    mostrarMensaje("mensajeNuevaDeuda", res.mensaje);

    if (!res.error) {
        document.getElementById("bancoNuevaDeuda").value = "";
        document.getElementById("nombreNuevaDeuda").value = "";
        document.getElementById("saldoNuevaDeuda").value = "";
        document.getElementById("diaPagoNuevaDeuda").value = "";
        cargarDatos();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed();
    document.getElementById("fechaRegistro").valueAsDate = new Date();
    cambiarFormularioRegistro();
    cargarDatos();
});
