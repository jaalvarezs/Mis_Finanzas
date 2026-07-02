/**
 * CONEXIÓN A SUPABASE — reemplaza la conexión a Google Apps Script.
 * ──────────────────────────────────────────────────────────────────────────
 * Antes, todos los cálculos (resumen del mes, gráficas, meta de ahorro)
 * los hacía el backend en Apps Script y la app solo mostraba el resultado.
 * Supabase no ejecuta ese tipo de código de servidor por defecto — solo
 * entrega filas de las tablas — así que esos cálculos ahora se hacen aquí
 * mismo, en el navegador, con la información ya cargada.
 *
 * app.js NO CAMBIÓ: sigue llamando a enviarDatosAPI(accion, datos) y
 * esperando exactamente las mismas formas de respuesta que entregaba
 * Apps Script, así que toda la interfaz sigue funcionando igual.
 */

const SUPABASE_URL = 'https://jkptzoburbvvxrvfsrnf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImprcHR6b2J1cmJ2dnhydmZzcm5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDU4NzEsImV4cCI6MjA5ODUyMTg3MX0.JMmSfpthSIMuhluni7phgluxvJZ7T4tg0JrjlASzugk';
const SUPABASE_EMAIL = 'jaalvarezs@gmail.com';
const SUPABASE_PASSWORD = 'CL%n8@9ceej%*_L';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const NOMBRES_MES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

// ───────────────────────── SESIÓN ─────────────────────────
// La app inicia sesión sola con la cuenta que creamos en Supabase — el
// usuario nunca ve ni escribe ninguna contraseña, esto pasa en segundo plano.
let sesionLista = null;
async function asegurarSesion() {
    if (sesionLista) return sesionLista;
    sesionLista = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        const { data, error } = await supabase.auth.signInWithPassword({ email: SUPABASE_EMAIL, password: SUPABASE_PASSWORD });
        if (error) throw error;
        return data.session;
    })();
    return sesionLista;
}

// ───────────────────────── UTILIDADES DE FECHA (en español, sin depender del locale del navegador) ─────────────────────────
function partesFechaEs(fechaISO) {
    const f = new Date(fechaISO + (String(fechaISO).length <= 10 ? 'T00:00:00' : ''));
    return { dia: f.getDate(), anio: f.getFullYear(), mesNumero: f.getMonth() + 1, mesNombre: NOMBRES_MES[f.getMonth()] };
}
function fechaBaseMes(m) { return m.mes || m.fecha; }
function primerDiaMes(fechaStr) {
    const f = new Date(fechaStr + 'T00:00:00');
    return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}-01`;
}
function formatearHora(fechaISO) {
    if (!fechaISO) return '';
    const f = new Date(fechaISO);
    return String(f.getHours()).padStart(2, '0') + ':' + String(f.getMinutes()).padStart(2, '0');
}

// ───────────────────────── COLA DE SINCRONIZACIÓN OFFLINE (igual que antes) ─────────────────────────
const ACCIONES_MUTABLES = new Set(['registrarMovimiento', 'editarMovimiento', 'eliminarMovimiento', 'registrarCredito', 'editarCredito', 'eliminarCredito', 'registrarTarjeta', 'editarTarjeta', 'eliminarTarjeta']);
const QUEUE_KEY = 'finanzas_cola_pendiente_v1';

function generarId() { return (crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2)); }
function leerCola() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (e) { return []; } }
function guardarCola(cola) { localStorage.setItem(QUEUE_KEY, JSON.stringify(cola)); }
function contarPendientesSync() { return leerCola().length; }

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
        await asegurarSesion();
        return await ejecutarAccion(action, payload);
    } catch (error) {
        console.error('Error en API:', error);
        if (esMutable) {
            const cola = leerCola();
            cola.push({ action, payload, ts: Date.now() });
            guardarCola(cola);
            return { error: false, queued: true, mensaje: 'Error de conexión con Supabase. Se guardó y se sincronizará automáticamente.' };
        }
        return { error: true, mensaje: 'Error de conexión con Supabase: ' + (error.message || 'desconocido') };
    }
}

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
                await asegurarSesion();
                await ejecutarAccion(item.action, item.payload);
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

// ───────────────────────── ENRUTADOR DE ACCIONES ─────────────────────────
async function ejecutarAccion(action, payload) {
    switch (action) {
        case 'obtenerDashboard': return await obtenerDashboard();
        case 'registrarMovimiento': return await registrarMovimiento(payload);
        case 'editarMovimiento': return await editarMovimiento(payload);
        case 'eliminarMovimiento': return await eliminarMovimiento(payload);
        case 'registrarCredito': return await registrarCredito(payload);
        case 'editarCredito': return await editarCredito(payload);
        case 'eliminarCredito': return await eliminarCredito(payload);
        case 'registrarTarjeta': return await registrarTarjeta(payload);
        case 'editarTarjeta': return await editarTarjeta(payload);
        case 'eliminarTarjeta': return await eliminarTarjeta(payload);
        default: return { error: true, mensaje: 'Acción no válida: ' + action };
    }
}

// ───────────────────────── DASHBOARD (cálculos que antes vivían en Apps Script) ─────────────────────────
async function obtenerDashboard() {
    const [{ data: movimientos, error: e1 }, { data: creditosRaw, error: e2 }, { data: tarjetasRaw, error: e3 }] = await Promise.all([
        supabase.from('movimientos').select('*'),
        supabase.from('creditos').select('*'),
        supabase.from('tarjetas').select('*')
    ]);
    if (e1) throw e1; if (e2) throw e2; if (e3) throw e3;

    const hoy = new Date();
    const mesActual = hoy.getMonth() + 1, anioActual = hoy.getFullYear();

    const resumenMes = calcularResumen(movimientos, mesActual, anioActual);
    const comparativoMensual = calcularComparativoMensual(movimientos);
    const categoriasGastos = calcularCategorias(movimientos, 'Gasto', mesActual, anioActual);
    const categoriasAhorro = calcularCategorias(movimientos, 'Ahorro', mesActual, anioActual);

    const mapearMovimiento = m => {
        const p = partesFechaEs(m.fecha);
        return {
            id: m.id || '',
            fecha: m.fecha,
            fechaTexto: p.dia + ' de ' + p.mesNombre,
            hora: formatearHora(m.fecha_registro),
            tipo: m.tipo,
            categoria: m.categoria,
            concepto: m.concepto,
            valor: Number(m.valor) || 0,
            nota: m.nota || ''
        };
    };

    const ultimosMovimientos = movimientos.slice()
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 40)
        .map(mapearMovimiento);

    const ahorrosMesActual = movimientos
        .filter(m => {
            if (m.tipo !== 'Ahorro') return false;
            const p = partesFechaEs(fechaBaseMes(m));
            return p.mesNumero === mesActual && p.anio === anioActual;
        })
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .map(mapearMovimiento);

    return {
        error: false,
        resumenMes,
        comparativoMensual,
        categoriasGastos,
        categoriasAhorro,
        ultimosMovimientos,
        ahorrosMesActual,
        creditos: leerCreditos(creditosRaw),
        tarjetas: leerTarjetas(tarjetasRaw)
    };
}

function calcularResumen(movimientos, mes, anio) {
    let ingresos = 0, gastos = 0, ahorro = 0;
    movimientos.forEach(m => {
        const p = partesFechaEs(fechaBaseMes(m));
        if (p.mesNumero !== mes || p.anio !== anio) return;
        const v = Number(m.valor) || 0;
        if (m.tipo === 'Ingreso') ingresos += v;
        if (m.tipo === 'Gasto') gastos += v;
        if (m.tipo === 'Ahorro') ahorro += v;
    });
    return { ingresos, gastos, ahorro, balance: ingresos - gastos - ahorro };
}

function calcularComparativoMensual(movimientos) {
    const porMes = {};
    movimientos.forEach(m => {
        const p = partesFechaEs(fechaBaseMes(m));
        const mesPad = String(p.mesNumero).padStart(2, '0');
        const key = p.anio + '-' + mesPad;
        if (!porMes[key]) porMes[key] = { mes: p.mesNombre + ' ' + p.anio, anio: p.anio, mesNumero: p.mesNumero, ingresos: 0, gastos: 0, ahorro: 0 };
        const v = Number(m.valor) || 0;
        if (m.tipo === 'Ingreso') porMes[key].ingresos += v;
        if (m.tipo === 'Gasto') porMes[key].gastos += v;
        if (m.tipo === 'Ahorro') porMes[key].ahorro += v;
    });
    return Object.keys(porMes).sort().map(k => porMes[k]);
}

function calcularCategorias(movimientos, tipo, mes, anio) {
    const porCategoria = {};
    movimientos.forEach(m => {
        if (m.tipo !== tipo) return;
        const p = partesFechaEs(fechaBaseMes(m));
        if (p.mesNumero !== mes || p.anio !== anio) return;
        const cat = m.categoria || 'Otro';
        porCategoria[cat] = (porCategoria[cat] || 0) + (Number(m.valor) || 0);
    });
    return Object.keys(porCategoria).map(cat => ({ categoria: cat, valor: porCategoria[cat] })).sort((a, b) => b.valor - a.valor);
}

function leerCreditos(rows) {
    return (rows || []).map(c => ({
        idCredito: c.id,
        entidad: c.entidad,
        nombre: c.nombre,
        saldoActual: Number(c.saldo_actual) || 0,
        cuotaActual: Number(c.cuota_actual) || 0,
        diaPago: c.dia_pago || ''
    }));
}

function leerTarjetas(rows) {
    return (rows || []).map(t => ({
        idTarjeta: t.id,
        nombre: t.nombre,
        banco: t.banco,
        cupoTotal: Number(t.cupo_total) || 0,
        saldoActual: Number(t.saldo_actual) || 0,
        disponible: (Number(t.cupo_total) || 0) - (Number(t.saldo_actual) || 0),
        diaPago: t.dia_pago || ''
    }));
}

// ───────────────────────── MOVIMIENTOS ─────────────────────────

async function registrarMovimiento(data) {
    if (!data.fecha || !data.concepto || data.valor === undefined || data.valor === '') {
        return { error: true, mensaje: 'Faltan campos obligatorios.' };
    }
    const id = crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('movimientos').insert({
        id, user_id: user.id, fecha: data.fecha, mes: primerDiaMes(data.fecha), tipo: data.tipo,
        categoria: data.categoria || '', concepto: data.concepto, valor: Number(data.valor),
        nota: data.nota || '', fecha_registro: new Date().toISOString()
    });
    if (error) throw error;

    let mensaje = 'Movimiento guardado.';
    if (data.tipo === 'PagoCredito' && data.idDeuda && data.tipoDeuda) {
        try { await ajustarSaldoDeuda(data.tipoDeuda, data.idDeuda, Number(data.valor), data.direccion); }
        catch (e) { mensaje = 'Movimiento guardado, pero no se pudo actualizar el saldo: ' + e.message; }
    }
    return { error: false, mensaje, id };
}

async function ajustarSaldoDeuda(tipoDeuda, id, valor, direccion) {
    const tabla = tipoDeuda === 'tarjeta' ? 'tarjetas' : 'creditos';
    const { data: fila, error: e1 } = await supabase.from(tabla).select('saldo_actual').eq('id', id).single();
    if (e1 || !fila) throw new Error('No se encontró la obligación vinculada.');
    const nuevoSaldo = direccion === 'avance' ? (Number(fila.saldo_actual) || 0) + valor : Math.max(0, (Number(fila.saldo_actual) || 0) - valor);
    const { error: e2 } = await supabase.from(tabla).update({ saldo_actual: nuevoSaldo, fecha_actualizacion: new Date().toISOString() }).eq('id', id);
    if (e2) throw e2;
}

async function editarMovimiento(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID del movimiento a editar.' };
    const { error } = await supabase.from('movimientos').update({
        fecha: data.fecha, mes: primerDiaMes(data.fecha), tipo: data.tipo,
        categoria: data.categoria || '', concepto: data.concepto, valor: Number(data.valor), nota: data.nota || ''
    }).eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Movimiento actualizado.' };
}

async function eliminarMovimiento(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID del movimiento a eliminar.' };
    const { error } = await supabase.from('movimientos').delete().eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Movimiento eliminado.' };
}

// ───────────────────────── CRÉDITOS Y TARJETAS ─────────────────────────

async function registrarCredito(data) {
    if (!data.nombre || !data.entidad) return { error: true, mensaje: 'Faltan campos obligatorios.' };
    const id = 'CRE-' + crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('creditos').insert({
        id, user_id: user.id, nombre: data.nombre, entidad: data.entidad,
        saldo_actual: Number(data.saldoActual) || 0, cuota_actual: Number(data.cuotaActual) || 0,
        dia_pago: data.diaPago || '', fecha_actualizacion: new Date().toISOString()
    });
    if (error) throw error;
    return { error: false, mensaje: 'Crédito creado.', id };
}

async function editarCredito(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID del crédito.' };
    const { error } = await supabase.from('creditos').update({
        nombre: data.nombre, entidad: data.entidad, saldo_actual: Number(data.saldoActual) || 0,
        cuota_actual: Number(data.cuotaActual) || 0, dia_pago: data.diaPago || '', fecha_actualizacion: new Date().toISOString()
    }).eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Crédito actualizado.' };
}

async function eliminarCredito(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID del crédito.' };
    const { error } = await supabase.from('creditos').delete().eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Crédito eliminado.' };
}

async function registrarTarjeta(data) {
    if (!data.nombre || !data.banco) return { error: true, mensaje: 'Faltan campos obligatorios.' };
    const id = 'TAR-' + crypto.randomUUID();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('tarjetas').insert({
        id, user_id: user.id, nombre: data.nombre, banco: data.banco,
        cupo_total: Number(data.cupoTotal) || 0, saldo_actual: Number(data.saldoActual) || 0,
        dia_pago: data.diaPago || '', fecha_actualizacion: new Date().toISOString()
    });
    if (error) throw error;
    return { error: false, mensaje: 'Tarjeta creada.', id };
}

async function editarTarjeta(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID de la tarjeta.' };
    const { error } = await supabase.from('tarjetas').update({
        nombre: data.nombre, banco: data.banco, cupo_total: Number(data.cupoTotal) || 0,
        saldo_actual: Number(data.saldoActual) || 0, dia_pago: data.diaPago || '', fecha_actualizacion: new Date().toISOString()
    }).eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Tarjeta actualizada.' };
}

async function eliminarTarjeta(data) {
    if (!data.id) return { error: true, mensaje: 'Falta el ID de la tarjeta.' };
    const { error } = await supabase.from('tarjetas').delete().eq('id', data.id);
    if (error) throw error;
    return { error: false, mensaje: 'Tarjeta eliminada.' };
}
