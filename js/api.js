const API_URL = 'https://script.google.com/macros/s/AKfycbyqo7ej2BtVszPZcDUiocNT4vVMxsJpnqVznaXGRgOhvcNlUNFHAjyGDxotLc4eBRwU/exec';

// Acciones que MODIFICAN datos: si fallan por estar offline, se encolan de verdad
// en lugar de perderse (antes el mensaje decía "guardado localmente" pero no se guardaba nada).
const ACCIONES_MUTABLES = new Set(['registrarMovimiento', 'editarMovimiento', 'eliminarMovimiento', 'registrarCredito', 'editarCredito', 'eliminarCredito', 'registrarTarjeta', 'editarTarjeta', 'eliminarTarjeta']);
const QUEUE_KEY = 'finanzas_cola_pendiente_v1';

function generarId() {
    return (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2));
}

function leerCola() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; }
}
function guardarCola(cola) { localStorage.setItem(QUEUE_KEY, JSON.stringify(cola)); }
function contarPendientesSync() { return leerCola().length; }

async function _postAPI(action, payload) {
    const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: action, payload: payload }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
    });
    return await response.json();
}

async function enviarDatosAPI(action, payload) {
    const esMutable = ACCIONES_MUTABLES.has(action);

    if (esMutable && !payload.clientId) payload.clientId = generarId();

    if (!navigator.onLine) {
        if (esMutable) {
            const cola = leerCola();
            cola.push({ action, payload, ts: Date.now() });
            guardarCola(cola);
            return { error: false, queued: true, mensaje: 'Sin conexión. Se guardó y se sincronizará automáticamente.' };
        }
        return { error: true, mensaje: 'Sin conexión. Mostrando los últimos datos guardados.' };
    }

    try {
        return await _postAPI(action, payload);
    } catch (error) {
        console.error('Error en API:', error);
        if (esMutable) {
            const cola = leerCola();
            cola.push({ action, payload, ts: Date.now() });
            guardarCola(cola);
            return { error: false, queued: true, mensaje: 'Error de red. Se guardó y se sincronizará automáticamente.' };
        }
        return { error: true, mensaje: 'Error de red. Inténtalo de nuevo.' };
    }
}

// Se llama al recuperar conexión (evento 'online') y al iniciar la app.
// Procesa la cola en orden y detiene en el primer fallo para no perder el resto.
let sincronizando = false;
async function sincronizarPendientes() {
    if (sincronizando) return { sincronizados: 0 };
    sincronizando = true;
    let sincronizados = 0;
    try {
        let cola = leerCola();
        while (cola.length > 0 && navigator.onLine) {
            const item = cola[0];
            try {
                await _postAPI(item.action, item.payload);
                cola.shift();
                guardarCola(cola);
                sincronizados++;
            } catch (e) {
                console.error('No se pudo sincronizar, se reintentará después:', e);
                break;
            }
        }
    } finally {
        sincronizando = false;
    }
    return { sincronizados };
}
