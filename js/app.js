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
    // Ocultar todas las secciones
    document.querySelectorAll(".section").forEach(sec => sec.classList.remove("active"));
    // Quitar color a todos los botones
    document.querySelectorAll(".tab").forEach(tab => tab.classList.remove("active"));
    
    // Mostrar la seleccionada
    document.getElementById(idSeccion).classList.add("active");
    botonClicado.classList.add("active");
}

// --- LÓGICA DEL FORMULARIO UNIFICADO DE REGISTRO ---
const categoriasMenu = {
    "Ingreso": ["Salario", "Bonificación", "Ventas", "Regalo", "Otro ingreso"],
    "Gasto": ["Servicios públicos", "Canasta familiar", "Transporte", "Vivienda", "Salud", "Educación", "Entretenimiento", "Otro gasto"],
    "Ahorro": ["Ahorro personal", "Fondo de emergencia", "Inversión", "Otro ahorro"]
};

function cambiarFormularioRegistro() {
    const tipo = document.getElementById("tipoRegistro").value;
    const grupoCategoria = document.getElementById("grupoCategoria");
    const grupoDeudas = document.getElementById("grupoDeudas");
    const selectCategoria = document.getElementById("categoriaRegistro");
    
    if (tipo === "Ingreso" || tipo === "Gasto" || tipo === "Ahorro") {
        // Mostrar categorías normales, ocultar lista de deudas
        grupoCategoria.style.display = "block";
        grupoDeudas.style.display = "none";
        
        // Llenar las categorías según lo elegido
        selectCategoria.innerHTML = "";
        categoriasMenu[tipo].forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            selectCategoria.appendChild(opt);
        });
    } else {
        // Es un Pago (Crédito o Tarjeta) -> Ocultar categorías, mostrar deudas
        grupoCategoria.style.display = "none";
        grupoDeudas.style.display = "block";
        
        document.getElementById("labelDeuda").innerText = 
            tipo === "PagoCredito" ? "Seleccionar Crédito / Almacén" : "Seleccionar Tarjeta";
            
        // NOTA: Aquí luego conectaremos los créditos reales traídos de Google Sheets.
        document.getElementById("deudaSeleccionada").innerHTML = "<option>Cargando tus deudas...</option>";
    }
}

// Inicializar la app cuando carga la pantalla
document.addEventListener('DOMContentLoaded', () => {
    actualizarEstadoRed();
    // Poner la fecha de hoy por defecto
    document.getElementById("fechaRegistro").valueAsDate = new Date();
    // Ejecutar el cambio de menú para que cargue los Gastos por defecto
    cambiarFormularioRegistro();
});
