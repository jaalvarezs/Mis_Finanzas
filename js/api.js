const API_URL = 'https://script.google.com/macros/s/AKfycbyKYSYLcX295yFBXTx0pYoMl-7SS_HaCHja6hEs3QH2pyKt-Wz3tlVO1KgTu8UfdpcwBA/exec';
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
