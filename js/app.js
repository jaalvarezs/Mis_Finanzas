// --- LÓGICA DE SERVICE WORKER (OFFLINE) ---
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
    const msj = document.getElementById(id);
    msj.innerText = texto;
    msj.style.display = "block";
    setTimeout(() => msj.style.display = "none", 5000);
}

// Variables Globales
let estadoApp = { creditos: [], tarjetas: [], comparativoMensual: [], categoriasGastos: [] };

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
            const opt = document.createElement("option"); opt.value = cat; opt.textContent = cat;
            selectCategoria.appendChild(opt);
        });
    } else {
        document.getElementById("grupoCategoria").style.display = "none"; 
        document.getElementById("grupoDeudas").style.display = "block";
        document.getElementById("labelDeuda").innerText = tipo === "PagoCredito" ? "Seleccionar Crédito" : "Seleccionar Tarjeta";
        llenarSelectDeudas(tipo);
    }
}

// --- CARGA INSTANTÁNEA (CACHÉ LOCAL) ---
async function cargarDatos() {
    const divDash = document.getElementById("dashboard-content");
    const btnAct = document.querySelector(".btn-blue");

    // 1. Mostrar datos en 0.1 segundos desde la memoria del celular
    const datosGuardados = localStorage.getItem("finanzas_cache_v1");
    if (datosGuardados) {
        const data = JSON.parse(datosGuardados);
        estadoApp = {
            creditos: data.creditos || [],
            tarjetas: data.tarjetas || [],
            comparativoMensual: data.comparativoMensual || [],
            categoriasGastos: data.categoriasGastos || []
        };
        pintarDashboard(data);
        llenarSelectMeses();
        cambiarMesDashboard();
        pintarModuloCreditos();
        cambiarFormularioRegistro();
    } else {
        divDash.innerHTML = "<div class='empty'>Descargando información desde Google Sheets...</div>";
    }

    btnAct.innerText = "Sincronizando..."; btnAct.disabled = true;

    // 2. Traer datos frescos de Google en silencio
    const data = await enviarDatosAPI("obtenerDashboard", {});
    btnAct.innerText = "Actualizar"; btnAct.disabled = false;

    if (data.error) { 
        if (!datosGuardados) divDash.innerHTML = `<div class='empty' style='color:red;'>Error al conectar: ${data.mensaje}</div>`; 
        return; 
    }

    // 3. Guardar lo nuevo en memoria y actualizar pantalla
    localStorage.setItem("finanzas_cache_v1", JSON.stringify(data));
    estadoApp = {
        creditos: data.creditos || [],
        tarjetas: data.tarjetas || [],
        comparativoMensual: data.comparativoMensual || [],
        categoriasGastos: data.categoriasGastos || []
    };

    pintarDashboard(data);
    llenarSelectMeses();
    cambiarMesDashboard();
    pintarModuloCreditos();
    cambiarFormularioRegistro();
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
    
    if (estadoApp.comparativoMensual.length === 0) {
        select.innerHTML = "<option>Sin datos</option>"; return;
    }
    
    estadoApp.comparativoMensual.forEach(item => {
        const opt = document.createElement("option");
        opt.value = item.mes; opt.textContent = item.mes; select.appendChild(opt);
    });
    
    if (valorPrevio && [...select.options].some(o => o.value === valorPrevio)) {
        select.value = valorPrevio;
    } else {
        select.selectedIndex = select.options.length - 1; 
    }
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

    pintarTopGastos("categoriasGastosUI", estadoApp.categoriasGastos, "red-bg");
}

function pintarTopGastos(idContenedor, lista, claseBarra) {
    const cont = document.getElementById(idContenedor);
    cont.innerHTML = "";
    if (!lista || lista.length === 0) { cont.innerHTML = `<div class="empty">Sin datos.</div>`; return; }
    
    const topLista = lista.slice(0, 5);
    const max = Math.max(...topLista.map(x => Number(x.valor || 0)), 1);

    topLista.forEach(item => {
        const porcentaje = Math.round((Number(item.valor || 0) / max) * 100);
        const div = document.createElement("div"); div.className = "bar-row";
        div.innerHTML = `
          <div class="bar-head"><span>${item.categoria}</span><span>${formatoPesos(item.valor)}</span></div>
          <div class="bar-bg"><div class="bar ${claseBarra}" style="width:${porcentaje}%"></div></div>
        `;
        cont.appendChild(div);
    });
}

function pintarModuloCreditos() {
    const cont = document.getElementById("listaDeudasVigentes");
    cont.innerHTML = "";
    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) {
        cont.innerHTML = `<div class="empty">No tienes deudas activas.</div>`; return;
    }
    let html = "";
    estadoApp.creditos.forEach(c => {
        html += `<div class="debt-card"><div class="debt-title"><span>🏦 ${c.nombre}</span><span class="red">${formatoPesos(c.saldoActual)}</span></div><div class="movement-bottom">${c.entidad} · Cuota: ${formatoPesos(c.cuotaActual)}</div></div>`;
    });
    estadoApp.tarjetas.forEach(t => {
        html += `<div class="debt-card"><div class="debt-title"><span>💳 ${t.nombre}</span><span class="red">${formatoPesos(t.saldoActual)}</span></div><div class="movement-bottom">Cupo: ${formatoPesos(t.cupoTotal)} · Disponible: ${formatoPesos(t.disponible)}</div></div>`;
    });
    cont.innerHTML = html;
}

function llenarSelectDeudas(tipo) {
    const select = document.getElementById("deudaSeleccionada"); select.innerHTML = "";
    const lista = tipo === "PagoCredito" ? estadoApp.creditos : estadoApp.tarjetas;
    if (lista.length === 0) {
        const opt = document.createElement("option"); opt.value = ""; opt.textContent = "No tienes deudas registradas"; select.appendChild(opt); return;
    }
    lista.forEach(item => {
        const opt = document.createElement("option"); opt.value = tipo === "PagoCredito" ? item.idCredito : item.idTarjeta;
        opt.textContent = `${item.nombre} - Saldo: ${formatoPesos(item.saldoActual)}`; select.appendChild(opt);
    });
}

async function procesarRegistro() {
    const btn = document.getElementById("btnGuardarRegistro");
    const data = {
        fecha: document.getElementById("fechaRegistro").value,
        tipo: document.getElementById("tipoRegistro").value,
        concepto: document.getElementById("conceptoRegistro").value,
        valor: document.getElementById("valorRegistro").value,
        nota: document.getElementById("notaRegistro").value
    };

    if (data.tipo === "Ingreso" || data.tipo === "Gasto" || data.tipo === "Ahorro") {
        data.categoria = document.getElementById("categoriaRegistro").value;
    } else {
        data.categoria = "Deudas";
        data.idDeuda = document.getElementById("deudaSeleccionada").value;
    }

    if (!data.fecha || !data.concepto || !data.valor) {
        mostrarMensaje("mensajeRegistro", "Completa fecha, concepto y valor."); return;
    }

    btn.disabled = true; btn.innerText = "Guardando...";
    let action = "registrarMovimiento"; let payload = data;

    if (data.tipo === "PagoCredito") {
        action = "registrarPagoCredito";
        payload = { idCredito: data.idDeuda, fecha: data.fecha, valorPagado: data.valor, registrarComoGasto: true, nota: data.nota };
    } else if (data.tipo === "PagoTarjeta") {
        action = "registrarMovimientoTarjeta";
        payload = { idTarjeta: data.idDeuda, tipoMovimiento: "Pago", fecha: data.fecha, valorBase: data.valor, registrarGasto: true, nota: data.nota };
    }

    const res = await enviarDatosAPI(action, payload);
    btn.disabled = false; btn.innerText = "Guardar Registro";
    mostrarMensaje("mensajeRegistro", res.mensaje);
    
    if (!res.error) {
        document.getElementById("conceptoRegistro").value = "";
        document.getElementById("valorRegistro").value = "";
        document.getElementById("notaRegistro").value = "";
        cargarDatos(); 
    }
}

document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed();
    document.getElementById("fechaRegistro").valueAsDate = new Date();
    cambiarFormularioRegistro();
    cargarDatos();
});
