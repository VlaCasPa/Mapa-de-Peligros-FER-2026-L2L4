// 1. MAPA BASE: Google Maps oficial con tu filtro de gris tenue
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// Capa Base 1: Google Maps Gris Tenue (Predeterminada)
const googleGrisLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@129&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    className: 'mapa-google-gris'
}).addTo(map);

// Capa Base 2: Topografía / Relieve (OpenTopoMap como alternativa web de MDE)
const topografiaLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 17,
    attribution: 'Map data: &copy; OpenTopoMap contributors'
});

// 2. CONFIGURACIÓN DE COLORES NORMADOS CENEPRED
function getColorPeligro(nivel) {
    if (!nivel) return '#ffffff';
    let n = String(nivel).toUpperCase().trim();
    if (n.includes('MUY ALTO')) return '#d32f2f'; // Rojo
    if (n.includes('ALTO')) return '#f57c00';     // Naranja
    if (n.includes('MEDIO')) return '#fbc02d';    // Amarillo
    if (n.includes('BAJO')) return '#388e3c';     // Verde
    return '#ffffff';
}

function getTextColor(nivel) {
    if (!nivel) return '#333333';
    let n = String(nivel).toUpperCase().trim();
    if (n.includes('MUY ALTO') || n.includes('ALTO') || n.includes('BAJO')) return '#ffffff';
    return '#000000';
}

// 3. VARIABLES GLOBALES DE CAPAS
let layerRios, layerLineas, layerDistritos, layerEstructuras, layerInundacion, layerHuaycos;
let tableDataMaster = [];
const baseUrl = 'datos_vectoriales/';

// --- A. CAPA FIJA: RÍOS ---
fetch(baseUrl + 'RIOS%20RIMAC%20CHILLON.geojson')
    .then(res => res.json())
    .then(data => {
        layerRios = L.geoJSON(data, { style: { color: '#00bcd4', weight: 3, opacity: 0.8 } }).addTo(map);
    });

// --- B. CAPA FIJA: LÍNEAS 2 Y 4 (Continuas y gruesas) ---
fetch(baseUrl + 'Lineas%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerLineas = L.geoJSON(data, { 
            style: { color: '#0b3d59', weight: 5.5, opacity: 0.9, dashArray: null } 
        }).addTo(map);
    });

// --- C. CAPA FIJA: ESTRUCTURAS ---
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


// 4. CARGA DE TABLA CSV OFICIAL Y PINTADO DE CELDAS
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE27I4VwWlYKQEgCkNRcGydFG8zFseeR5_0SFF3F_-HEW_VLBPUY_G8uCuexKw2NkkIEq3Wl1i7ipE/pub?gid=1027540316&single=true&output=csv';

Papa.parse(csvUrl, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        tableDataMaster = results.data;
        renderTable(tableDataMaster);
    }
});

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';
    
    data.forEach(row => {
        let keys = Object.keys(row);
        let idKey = keys.find(k => k.toUpperCase().includes('ID'));
        let inunKey = keys.find(k => k.toUpperCase().includes('INUNDACI'));
        let masasKey = keys.find(k => k.toUpperCase().includes('MOVIMIENTO') || k.toUpperCase().includes('MASAS'));

        let structId = idKey ? row[idKey] : '';
        let inundacionVal = inunKey ? row[inunKey] : '';
        let masasVal = masasKey ? row[masasKey] : '';

        if (!structId) return;

        let colorInun = getColorPeligro(inundacionVal);
        let colorMasas = getColorPeligro(masasVal);
        let textInun = getTextColor(inundacionVal);
        let textMasas = getTextColor(masasVal);

        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td><b>${structId}</b></td>
            <td style="background-color: ${colorInun}; color: ${textInun}; font-weight: 500;">${inundacionVal}</td>
            <td style="background-color: ${colorMasas}; color: ${textMasas}; font-weight: 500;">${masasVal}</td>
        `;
        
        tr.addEventListener('click', () => {
            document.querySelectorAll('#tableBody tr').forEach(el => el.classList.remove('selected-row'));
            tr.classList.add('selected-row');
            
            if(layerEstructuras) {
                layerEstructuras.eachLayer(layer => {
                    let featId = layer.feature.properties.ID || layer.feature.properties.id || '';
                    if(featId.toUpperCase() === String(structId).toUpperCase()) {
                        map.setView(layer.getLatLng(), 15);
                        layer.openPopup();
                    }
                });
            }
        });
        tbody.appendChild(tr);
    });
}


// 5. CONTROL DE CHECKBOXES (Capas, Topografía exclusiva y Leyenda)
document.getElementById('chkDistritos').addEventListener('change', function() {
    if(this.checked) map.addLayer(layerDistritos);
    else map.removeLayer(layerDistritos);
});

// Control exclusivo del mapa base Topográfico vs Google Gris
document.getElementById('chkTopografia').addEventListener('change', function() {
    if(this.checked) {
        map.removeLayer(googleGrisLayer);
        topografiaLayer.addTo(map);
    } else {
        map.removeLayer(topografiaLayer);
        googleGrisLayer.addTo(map);
    }
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
        let keys = Object.keys(r);
        let idKey = keys.find(k => k.toUpperCase().includes('ID'));
        let sId = idKey ? r[idKey] : '';
        return String(sId).toUpperCase().includes(val);
    });
    renderTable(filtered);
});


// 7. CONTROL DE LA VENTANA MODAL (README)
const modal = document.getElementById('readmeModal');
const btnOpen = document.getElementById('btnOpenReadme');
const btnClose = document.getElementById('btnCloseReadme');
const btnCloseBottom = document.getElementById('btnCloseModalBottom');

btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; });
btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
btnCloseBottom.addEventListener('click', () => { modal.style.display = 'none'; });

modal.addEventListener('click', (e) => {
    if (e.target === modal) { modal.style.display = 'none'; }
});
