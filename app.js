// 1. Inicialización del Mapa
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// Capa Base: Gris Tenue (para que resalten los colores de CENEPRED)
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// 2. Funciones de Estilo (Colores Normados CENEPRED)
function getColorPeligro(nivel) {
    if (!nivel) return '#cccccc'; // Gris por defecto si no hay dato
    let n = nivel.toUpperCase();
    if (n.includes('MUY ALTO')) return '#d32f2f'; // Rojo
    if (n.includes('ALTO')) return '#f57c00'; // Naranja
    if (n.includes('MEDIO')) return '#fbc02d'; // Amarillo
    if (n.includes('BAJO')) return '#388e3c'; // Verde
    return '#cccccc';
}

function styleInundacion(feature) {
    return { fillColor: getColorPeligro(feature.properties.niv_sinu), weight: 1, opacity: 1, color: '#ffffff', fillOpacity: 0.65 };
}

function styleHuaycos(feature) {
    return { fillColor: getColorPeligro(feature.properties.npel_mm), weight: 1, opacity: 1, color: '#ffffff', fillOpacity: 0.65 };
}

// 3. Variables Globales para las capas
let layerInundacion, layerHuaycos, layerEstructuras, layerLineas, layerRios;
const baseUrl = 'datos_vectoriales/'; // La carpeta que creaste en GitHub

// 4. CARGA DE DATOS GEOJSON DESDE GITHUB (Fetch)

// A. Cargar Ríos y Franja (Celeste)
fetch(baseUrl + 'RIOS%20RIMAC%20CHILLON.geojson')
    .then(res => res.json())
    .then(data => {
        layerRios = L.geoJSON(data, { style: { color: '#00bcd4', weight: 4 } }).addTo(map);
    });

// B. Cargar Trazos de Líneas L2 y L4 (Azul oscuro punteado)
fetch(baseUrl + 'Lineas%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerLineas = L.geoJSON(data, { style: { color: '#0b3d59', weight: 4, dashArray: '5, 5' } }).addTo(map);
    });

// C. Cargar Estructuras (Estaciones y Pozos - Puntos blancos con borde azul)
fetch(baseUrl + 'ESTRUCTURAS%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerEstructuras = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.circleMarker(latlng, { radius: 6, fillColor: "#ffffff", color: "#0b3d59", weight: 2, fillOpacity: 1 });
            },
            onEachFeature: function (feature, layer) {
                // Pop-up al hacer clic en una estructura
                layer.bindPopup('<b>ID Estructura: </b>' + (feature.properties.ID || 'N/A'));
            }
        }).addTo(map); // Estas capas siempre estarán visibles
    });

// D. Cargar Peligro Inundación (Cargado en memoria, oculto inicialmente)
fetch(baseUrl + 'PELIGRO%20INUNDACION%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerInundacion = L.geoJSON(data, {
            style: styleInundacion,
            onEachFeature: function (feature, layer) {
                layer.bindPopup('<b>Distrito: </b>' + feature.properties.NOMBDIST + '<br><b>Inundación: </b>' + feature.properties.niv_sinu);
            }
        });
    });

// E. Cargar Peligro Huaycos (Cargado en memoria, oculto inicialmente)
fetch(baseUrl + 'PELIGRO%20MOVIMIENTOS%20EN%20MASAS%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerHuaycos = L.geoJSON(data, {
            style: styleHuaycos,
            onEachFeature: function (feature, layer) {
                layer.bindPopup('<b>Distrito: </b>' + feature.properties.NOMBDIST + '<br><b>Huaycos: </b>' + feature.properties.npel_mm);
            }
        });
    });

// 5. LÓGICA DE BOTONES DEL TABLERO ANDON (Prender y apagar mapas)

// Botón Inundación
document.getElementById('btnInundacion').addEventListener('click', function() {
    this.classList.toggle('active');
    document.getElementById('btnHuaycos').classList.remove('active'); // Apagar el otro botón
    
    if (map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos); // Apagar el otro mapa
    
    if (this.classList.contains('active')) {
        map.addLayer(layerInundacion); // Prender mapa inundación
        layerEstructuras.bringToFront(); // Que las estaciones se vean arriba del color
        // Cambiar texto de análisis
        document.getElementById('analysisContent').innerHTML = `
            <p style="color:#d32f2f"><b>Estructuras en Peligro:</b> PV01BIS hasta E10.</p>
            <p><b>Sustento:</b> Empozamiento por nivel freático superficial y topografía llana (cota 0). El agua no escurre.</p>
            <p><b>Mitigación recomendada:</b> Elevación de brocales en Pozos de Ventilación y disposición anticipada de motobombas de alto caudal.</p>`;
    } else {
        map.removeLayer(layerInundacion);
        document.getElementById('analysisContent').innerHTML = '<p><i>Seleccione una capa de riesgo...</i></p>';
    }
});

// Botón Movimientos en Masa (Huaycos)
document.getElementById('btnHuaycos').addEventListener('click', function() {
    this.classList.toggle('active');
    document.getElementById('btnInundacion').classList.remove('active');
    
    if (map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion);
    
    if (this.classList.contains('active')) {
        map.addLayer(layerHuaycos);
        layerEstructuras.bringToFront();
        document.getElementById('analysisContent').innerHTML = `
            <p style="color:#f57c00"><b>Estructuras en Peligro:</b> E24, E25, E26, E27.</p>
            <p><b>Sustento:</b> Flujo de detritos por reactivación de quebradas secas en estribaciones andinas (Ate/Vitarte).</p>
            <p><b>Mitigación recomendada:</b> Reforzamiento de cerramientos con barreras New Jersey y desvíos de escorrentía superficial.</p>`;
    } else {
        map.removeLayer(layerHuaycos);
        document.getElementById('analysisContent').innerHTML = '<p><i>Seleccione una capa de riesgo...</i></p>';
    }
});

// Lógica para Mobile Bottom Sheet
const sidePanel = document.getElementById('sidePanel');
const mobileHandle = document.getElementById('mobileHandle');
mobileHandle.addEventListener('click', () => {
    sidePanel.classList.toggle('expanded');
});
