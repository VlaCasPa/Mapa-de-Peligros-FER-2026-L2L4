// 1. MAPA BASE: Aplicando tu clase .mapa-google-gris para el estilo idéntico a tus otros repos
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20,
    className: 'mapa-google-gris' // <--- AQUÍ APLICAMOS TU FILTRO GRIS TENUE
}).addTo(map);

// 2. CONFIGURACIÓN DE COLORES NORMADOS CENEPRED
function getColorPeligro(nivel) {
    if (!nivel) return '#cccccc';
    let n = nivel.toUpperCase();
    if (n.includes('MUY ALTO')) return '#d32f2f'; // Rojo
    if (n.includes('ALTO')) return '#f57c00';     // Naranja
    if (n.includes('MEDIO')) return '#fbc02d';    // Amarillo
    if (n.includes('BAJO')) return '#388e3c';     // Verde
    return '#cccccc';
}

// 3. VARIABLES GLOBALES DE CAPAS
let layerRios, layerLineas, layerDistritos, layerEstructuras, layerInundacion, layerHuaycos;
let tableDataMaster = [];
const baseUrl = 'datos_vectoriales/';

// --- A. CAPA BASE FIJA: RÍOS ---
fetch(baseUrl + 'RIOS%20RIMAC%20CHILLON.geojson')
    .then(res => res.json())
    .then(data => {
        layerRios = L.geoJSON(data, { style: { color: '#00bcd4', weight: 3, opacity: 0.8 } }).addTo(map);
    });

// --- B. CAPA BASE FIJA: LÍNEAS 2 Y 4 ---
fetch(baseUrl + 'Lineas%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerLineas = L.geoJSON(data, { style: { color: '#0b3d59', weight: 3.5, dashArray: '4, 4' } }).addTo(map);
    });

// --- C. CAPA BASE FIJA: ESTRUCTURAS (Punto negro + Texto ID al costado) ---
fetch(baseUrl + 'ESTRUCTURAS%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerEstructuras = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                let idText = feature.properties.ID || 'N/A';
                return L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'custom-structure-icon',
                        html: `<div class="structure-marker-container"><div class="structure-dot"></div><div class="structure-label">${idText}</div></div>`,
                        iconSize: [60, 20],
                        iconAnchor: [6, 10]
                    })
                });
            },
            onEachFeature: function (feature, layer) {
                layer.bindPopup(`<b>Estructura ID:</b> ${feature.properties.ID || 'N/A'}`);
            }
        }).addTo(map);
    });

// --- D. CAPA OPCIONAL: LÍMITES DISTRITALES ---
fetch(baseUrl + 'DISTRITOS%20DE%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerDistritos = L.geoJSON(data, {
            style: { fillColor: 'transparent', fillOpacity: 0, color: '#888888', weight: 1 }
        });
        if(document.getElementById('chkDistritos').checked) layerDistritos.addTo(map);
    });

// --- E. CAPA OPCIONAL: INUNDACIÓN ---
fetch(baseUrl + 'PELIGRO%20INUNDACION%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerInundacion = L.geoJSON(data, {
            style: function(feature) {
                return { fillColor: getColorPeligro(feature.properties.niv_sinu), weight: 1, color: '#fff', fillOpacity: 0.6 };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`<b>Distrito:</b> ${feature.properties.NOMBDIST}<br><b>Inundación:</b> ${feature.properties.niv_sinu}`);
            }
        });
    });

// --- F. CAPA OPCIONAL: HUAYCOS ---
fetch(baseUrl + 'PELIGRO%20MOVIMIENTOS%20EN%20MASAS%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerHuaycos = L.geoJSON(data, {
            style: function(feature) {
                return { fillColor: getColorPeligro(feature.properties.npel_mm), weight: 1, color: '#fff', fillOpacity: 0.6 };
            },
            onEachFeature: function(feature, layer) {
                layer.bindPopup(`<b>Distrito:</b> ${feature.properties.NOMBDIST}<br><b>Mov. Masas:</b> ${feature.properties.npel_mm}`);
            }
        });
    });


// 4. CARGA DE TABLA CSV OFICIAL Y MAPEADO DE COLUMNAS
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE27I4VwWlYKQEgCkNRcGydFG8zFseeR5_0SFF3F_-HEW_VLBPUY_G8uCuexKw2NkkIEq3Wl1i7ipE/pub?gid=1027540316&single=true&output=csv';

Papa.parse(csvUrl, {
    download: true,
    header: true,
    complete: function(results) {
        tableDataMaster = results.data.filter(row => row.ID || row.id || row.Id);
        renderTable(tableDataMaster);
    }
});

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    data.forEach(row => {
        let structId = row.ID || row.id || row.Id || '';
        let inundacionVal = row['Nivel de Peligro por inundación'] || row['Inundación'] || row['inundacion'] || '';
        let masasVal = row['Nivel de Peligro por movimiento en masas'] || row['Mov. Masas'] || row['mov_masas'] || '';

        if (!structId) return;

        let tr = document.createElement('tr');
        tr.innerHTML = `<td><b>${structId}</b></td><td>${inundacionVal}</td><td>${masasVal}</td>`;
        
        // Evento Responsivo: Clic en fila centra el mapa en la estructura
        tr.addEventListener('click', () => {
            document.querySelectorAll('#tableBody tr').forEach(el => el.classList.remove('selected-row'));
            tr.classList.add('selected-row');
            
            if(layerEstructuras) {
                layerEstructuras.eachLayer(layer => {
                    let featId = layer.feature.properties.ID || layer.feature.properties.id || '';
                    if(featId.toUpperCase() === structId.toUpperCase()) {
                        map.setView(layer.getLatLng(), 15);
                        layer.openPopup();
                    }
                });
            }
        });
        tbody.appendChild(tr);
    });
}


// 5. CONTROL DE CHECKBOXES (Capas y Leyenda)
document.getElementById('chkDistritos').addEventListener('change', function() {
    if(this.checked) map.addLayer(layerDistritos);
    else map.removeLayer(layerDistritos);
});

document.getElementById('chkInundacion').addEventListener('change', function() {
    let huaycoChk = document.getElementById('chkHuaycos');
    if(this.checked) {
        huaycoChk.checked = false;
        if(map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos);
        map.addLayer(layerInundacion);
        updateLegend('Inundación');
    } else {
        map.removeLayer(layerInundacion);
        clearLegend();
    }
});

document.getElementById('chkHuaycos').addEventListener('change', function() {
    let inunChk = document.getElementById('chkInundacion');
    if(this.checked) {
        inunChk.checked = false;
        if(map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion);
        map.addLayer(layerHuaycos);
        updateLegend('Movimientos en Masa');
    } else {
        map.removeLayer(layerHuaycos);
        clearLegend();
    }
});

function updateLegend(tipo) {
    const legend = document.getElementById('legendContent');
    legend.innerHTML = `
        <b>Niveles de ${tipo}</b>
        <div class="legend-item"><span class="legend-color" style="background:#d32f2f"></span>Muy Alto</div>
        <div class="legend-item"><span class="legend-color" style="background:#f57c00"></span>Alto</div>
        <div class="legend-item"><span class="legend-color" style="background:#fbc02d"></span>Medio</div>
        <div class="legend-item"><span class="legend-color" style="background:#388e3c"></span>Bajo</div>
    `;
}

function clearLegend() {
    document.getElementById('legendContent').innerHTML = 'Seleccione una capa de riesgo';
}


// 6. FILTROS RÁPIDOS EN EL PANEL
document.getElementById('filterId').addEventListener('input', function() {
    let val = this.value.toUpperCase();
    let filtered = tableDataMaster.filter(r => {
        let sId = r.ID || r.id || r.Id || '';
        return sId.toUpperCase().includes(val);
    });
    renderTable(filtered);
});
