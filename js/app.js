// --- LÓGICA DE SERVICE WORKER (OFFLINE) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('Service Worker registrado'))
      .catch(err => console.error('Error al registrar SW', err));
  });
}

// Control visual de conexión
function actualizarEstadoRed() {
    const badge = document.getElementById('estadoConexion');
    if (navigator.onLine) {
        badge.innerText = 'Online - Sincronizado';
        badge.style.background = '#38bdf8';
        badge.style.color = '#020617';
    } else {
        badge.innerText = 'Modo Offline';
        badge.style.background = '#ef4444';
        badge.style.color = '#ffffff';
    }
}
window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);

// --- NAVEGACIÓN DE PESTAÑAS ---
function mostrarSeccion(idSeccion, botonClicado) {
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    document.getElementById(idSeccion).classList.add("active");
    botonClicado.classList.add("active");
}

// --- UTILIDADES ---
function formatoPesos(valor) {
    return new Intl.NumberFormat("es-CO", { 
        style: "currency", 
        currency: "COP", 
        maximumFractionDigits: 0 
    }).format(valor || 0);
}

// Variables globales para guardar los datos descargados
let estadoApp = {
    creditos: [],
    tarjetas: []
};

// --- LÓGICA DEL FORMULARIO UNIFICADO DE REGISTRO ---
const categoriasMenu = {
    "Ingreso": ["Salario", "Bonificación", "Pago proveedores", "Regalo", "Venta", "Trabajo extra", "Otro ingreso"],
    "Gasto": ["Servicios públicos", "Canasta familiar", "Deudas", "Transporte", "Combustible", "Vivienda", "Salud", "Educación", "Entretenimiento", "Otro gasto"],
    "Ahorro": ["Ahorro personal", "Fondo de emergencia", "Inversión", "Otro ahorro"]
};

function cambiarFormularioRegistro() {
    const tipo = document.getElementById("tipoRegistro").value;
    const grupoCategoria = document.getElementById("grupoCategoria");
    const grupoDeudas = document.getElementById("grupoDeudas");
    const selectCategoria = document.getElementById("categoriaRegistro");
    
    if (tipo === "Ingreso" || tipo === "Gasto" || tipo === "Ahorro") {
        // Modo normal
        grupoCategoria.style.display = "block";
        grupoDeudas.style.display = "none";
        
        selectCategoria.innerHTML = "";
        categoriasMenu[tipo].forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            selectCategoria.appendChild(opt);
        });
    } else {
        // Modo Pago de Deuda
        grupoCategoria.style.display = "none";
        grupoDeudas.style.display = "block";
        
        document.getElementById("labelDeuda").innerText = 
            tipo === "PagoCredito" ? "Seleccionar Crédito / Almacén" : "Seleccionar Tarjeta";
            
        llenarSelectDeudas(tipo);
    }
}

function cambiarFormularioDeuda() {
    const tipo = document.getElementById("tipoNuevaDeuda").value;
    const labelSaldo = document.getElementById("labelSaldoCupo");
    labelSaldo.innerText = tipo === "credito" ? "Saldo Actual / Inicial" : "Cupo Total de la Tarjeta";
}

// --- CARGA DE DATOS DESDE GOOGLE SHEETS ---
async function cargarDatos() {
    const divDash = document.getElementById("dashboard-content");
    const btnAct = document.querySelector(".btn-blue");
    
    divDash.innerHTML = "<div class='empty'>Descargando información desde Google Sheets...</div>";
    btnAct.innerText = "Cargando...";
    btnAct.disabled = true;

    // Conectar con Google (usando api.js)
    const data = await enviarDatosAPI("obtenerDashboard", {});

    btnAct.innerText = "Actualizar";
    btnAct.disabled = false;

    if (data.error) {
        divDash.innerHTML = `<div class='empty' style='color:red;'>Error al conectar: ${data.mensaje}</div>`;
        return;
    }

    // Guardar datos en memoria para usarlos en el formulario
    estadoApp.creditos = data.creditos || [];
    estadoApp.tarjetas = data.tarjetas || [];

    // Pintar la pantalla
    pintarDashboard(data);
    pintarModuloCreditos();
    cambiarFormularioRegistro(); // Actualiza el select del formulario si estaba en modo pago
}

function pintarDashboard(data) {
    const mes = data.resumenMes || { ingresos: 0, gastos: 0, ahorro: 0, balance: 0 };
    
    const html = `
        <div class="label">Balance del mes</div>
        <div class="money-big">${formatoPesos(mes.balance)}</div>
        <div class="stats" style="margin-top:14px;">
            <div class="stat"><div class="label">Ingresos</div><div class="stat-value green">${formatoPesos(mes.ingresos)}</div></div>
            <div class="stat"><div class="label">Gastos</div><div class="stat-value red">${formatoPesos(mes.gastos)}</div></div>
            <div class="stat"><div class="label">Ahorro</div><div class="stat-value blue">${formatoPesos(mes.ahorro)}</div></div>
        </div>
    `;
    document.getElementById("dashboard-content").innerHTML = html;
}

function pintarModuloCreditos() {
    const cont = document.getElementById("listaDeudasVigentes");
    cont.innerHTML = "";

    if (estadoApp.creditos.length === 0 && estadoApp.tarjetas.length === 0) {
        cont.innerHTML = `<div class="empty">No tienes deudas activas.</div>`;
        return;
    }

    let html = "";
    
    estadoApp.creditos.forEach(c => {
        html += `
        <div class="debt-card">
            <div class="debt-title">
                <span>🏦 ${c.nombre}</span>
                <span class="red">${formatoPesos(c.saldoActual)}</span>
            </div>
            <div class="movement-bottom">${c.entidad} · Cuota programada: ${formatoPesos(c.cuotaActual)}</div>
        </div>`;
    });

    estadoApp.tarjetas.forEach(t => {
        html += `
        <div class="debt-card">
            <div class="debt-title">
                <span>💳 ${t.nombre}</span>
                <span class="red">${formatoPesos(t.saldoActual)}</span>
            </div>
            <div class="movement-bottom">Cupo Total: ${formatoPesos(t.cupoTotal)} · Disponible: ${formatoPesos(t.disponible)}</div>
        </div>`;
    });

    cont.innerHTML = html;
}

function llenarSelectDeudas(tipo) {
    const select = document.getElementById("deudaSeleccionada");
    select.innerHTML = "";
    
    const lista = tipo === "PagoCredito" ? estadoApp.creditos : estadoApp.tarjetas;
    
    if (lista.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.textContent = "No tienes deudas registradas";
        select.appendChild(opt);
        return;
    }

    lista.forEach(item => {
        const opt = document.createElement("option");
        opt.value = tipo === "PagoCredito" ? item.idCredito : item.idTarjeta;
        opt.textContent = `${item.nombre} - Saldo: ${formatoPesos(item.saldoActual)}`;
        select.appendChild(opt);
    });
}

// Iniciar aplicación
document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed();
    document.getElementById("fechaRegistro").valueAsDate = new Date();
    cambiarFormularioRegistro();
    cambiarFormularioDeuda();
    
    // Descargar datos automáticamente al abrir
    cargarDatos();
});
