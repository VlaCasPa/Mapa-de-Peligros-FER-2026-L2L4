// 1. MAPA BASE: Google Maps oficial con tu filtro de gris tenue
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// Capa Base 1: Google Maps Gris Tenue (Predeterminada)
const googleGrisLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@129&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    className: 'mapa-google-gris'
}).addTo(map);

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

// 3. VARIABLES GLOBALES DE CAPAS Y CALIBRACIÓN EXACTA DEL RÁSTER
let layerRios, layerLineas, layerDistritos, layerEstructuras, layerInundacion, layerHuaycos;
let rasterElevationLayer = null;
let tableDataMaster = [];
const baseUrl = 'datos_vectoriales/';

// Conversor matemático exacto de UTM Zona 18S (EPSG:32718) a WGS84 (Lat/Lng)
function utm18SToLatLng(easting, northing) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e = Math.sqrt(2 * f - f * f);
    const e1sq = e * e / (1 - e * e);
    const x = easting - 500000.0;
    const y = northing - 10000000.0; // Hemisferio Sur
    const M = y / k0;
    const mu = M / (a * (1 - e * e / 4 - 3 * Math.pow(e, 4) / 64 - 5 * Math.pow(e, 6) / 256));
    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

    const J1 = (3 * e1 / 2 - 27 * Math.pow(e1, 3) / 32);
    const J2 = (21 * Math.pow(e1, 2) / 16 - 55 * Math.pow(e1, 4) / 32);
    const J3 = (151 * Math.pow(e1, 3) / 96);
    const J4 = (1097 * Math.pow(e1, 4) / 512);
    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu) + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const sinFp = Math.sin(fp);
    const cosFp = Math.cos(fp);
    const tanFp = Math.tan(fp);
    const C1 = e1sq * cosFp * cosFp;
    const T1 = tanFp * tanFp;
    const R1 = a * (1 - e * e) / Math.pow(1 - e * e * sinFp * sinFp, 1.5);
    const N1 = a / Math.sqrt(1 - e * e * sinFp * sinFp);
    const D = x / (N1 * k0);

    const Q1 = N1 * tanFp / R1;
    const Q2 = (D * D / 2);
    const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * e1sq) * Math.pow(D, 4) / 24;
    const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 3 * C1 * C1 - 252 * e1sq) * Math.pow(D, 6) / 720;
    const lat = (fp - Q1 * (Q2 - Q3 + Q4)) * (180 / Math.PI);

    const Q5 = D;
    const Q6 = (1 + 2 * T1 + C1) * Math.pow(D, 3) / 6;
    const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * e1sq + 24 * T1 * T1) * Math.pow(D, 5) / 120;
    const lng = -75.0 + ((Q5 - Q6 + Q7) / cosFp) * (180 / Math.PI); // Meridiano central Zona 18 = -75°

    return [lat, lng];
}

// Micro-ajuste fino para embonar el borde costero con el polígono distrital
// Valores negativos en SHIFT_LNG mueven toda la imagen hacia la izquierda sin deformarla
const SHIFT_LAT = -0.0008; // Ajuste vertical milimétrico
const SHIFT_LNG = -0.0042; // Mueve ligeramente a la izquierda (Oeste) respecto a la versión anterior

function createOrUpdateRaster(boundsArray) {
    const calibratedBounds = [
        [boundsArray[0][0] + SHIFT_LAT, boundsArray[0][1] + SHIFT_LNG],
        [boundsArray[1][0] + SHIFT_LAT, boundsArray[1][1] + SHIFT_LNG]
    ];
    if (rasterElevationLayer) {
        rasterElevationLayer.setBounds(calibratedBounds);
    } else {
        rasterElevationLayer = L.imageOverlay('datos_raster/elevacion.png', calibratedBounds, {
            opacity: 0.85,
            interactive: false
        });
    }
}

// Intento 1: Lectura directa de elevacion.pgw (soporta Grados WGS84 y Metros UTM 18S)
const imgWidth = 702;
const imgHeight = 1160;

fetch('datos_raster/elevacion.pgw')
    .then(res => {
        if (!res.ok) throw new Error("No se encontró PGW");
        return res.text();
    })
    .then(text => {
        const lines = text.trim().split(/\r?\n/).map(Number);
        if (lines.length >= 6 && !isNaN(lines[0])) {
            const pixelSizeX = lines[0];
            const pixelSizeY = lines[3]; // Negativo
            const originX = lines[4];
            const originY = lines[5];

            const minX = originX - (pixelSizeX / 2);
            const maxY = originY - (pixelSizeY / 2);
            const maxX = minX + (imgWidth * pixelSizeX);
            const minY = maxY + (imgHeight * pixelSizeY);

            // Caso A: El archivo .pgw está en grados geográficos (WGS84)
            if (Math.abs(originX) <= 180 && Math.abs(originY) <= 90) {
                createOrUpdateRaster([[minY, minX], [maxY, maxX]]);
            } 
            // Caso B: El archivo .pgw está en metros (UTM Zona 18S)
            else if (originX > 100000 && originY > 8000000) {
                const sw = utm18SToLatLng(minX, minY);
                const ne = utm18SToLatLng(maxX, maxY);
                createOrUpdateRaster([sw, ne]);
            }
        }
    })
    .catch(err => {
        console.log("Usando límites exactos de la capa de Distritos.");
    });

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

// --- D. CAPA OPCIONAL: LÍMITES DISTRITALES (Molde exacto para el Ráster) ---
fetch(baseUrl + 'DISTRITOS%20DE%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerDistritos = L.geoJSON(data, {
            style: { fillColor: 'transparent', fillOpacity: 0, color: '#888888', weight: 1 }
        });
        if(document.getElementById('chkDistritos').checked) layerDistritos.addTo(map);

        // Si aún no se creó por PGW, ajustamos directamente al molde exacto de los distritos
        // desplazándolo los -0.0042 grados a la izquierda para encajar la línea de costa
        if (!rasterElevationLayer) {
            const b = layerDistritos.getBounds();
            createOrUpdateRaster([
                [b.getSouth(), b.getWest()],
                [b.getNorth(), b.getEast()]
            ]);
        }
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

// Control exclusivo del mapa base: Cambia Google Gris por tu imagen elevacion.png perfectamente encajada
document.getElementById('chkTopografia').addEventListener('change', function() {
    if(this.checked) {
        map.removeLayer(googleGrisLayer);
        if (rasterElevationLayer) {
            rasterElevationLayer.addTo(map);
            rasterElevationLayer.bringToBack();
        }
    } else {
        if (rasterElevationLayer && map.hasLayer(rasterElevationLayer)) {
            map.removeLayer(rasterElevationLayer);
        }
        googleGrisLayer.addTo(map);
        googleGrisLayer.bringToBack();
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
