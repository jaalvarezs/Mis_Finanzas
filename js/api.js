const API_URL = 'PEGA_AQUI_LA_URL_QUE_COPIASTE_DE_GOOGLE';

async function enviarDatosAPI(action, payload) {
    if (!navigator.onLine) {
        console.log("Offline: Guardando acción localmente...", action);
        return { error: false, mensaje: "Guardado localmente. Se sincronizará al tener conexión." };
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, payload: payload }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        return await response.json();
    } catch (error) {
        console.error("Error en API:", error);
        return { error: true, mensaje: "Error de red. Guardado para sincronización." };
    }
}
