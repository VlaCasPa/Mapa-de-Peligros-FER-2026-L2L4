// 1. MAPA BASE: Google Maps oficial con tu filtro de gris tenue
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

// Capa Base 1: Google Maps Gris Tenue (Predeterminada)
const googleGrisLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@129&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    className: 'mapa-google-gris'
}).addTo(map);

// 2. CONFIGURACIÓN UNIFICADA DE COLORES NORMADOS CENEPRED
function getColorPeligro(nivel) {
    if (!nivel) return '#ffffff';
    let n = String(nivel).toUpperCase().trim();
    if (n.includes('MUY ALTO')) return '#d32f2f'; // Rojo CENEPRED
    if (n.includes('ALTO')) return '#f57c00';     // Naranja CENEPRED
    if (n.includes('MEDIO')) return '#fbc02d';    // Amarillo CENEPRED
    if (n.includes('BAJO')) return '#388e3c';     // Verde CENEPRED
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
let rasterElevationLayer = null;
let rawOriginBounds = null;
let tableDataMaster = [];
const baseUrl = 'datos_vectoriales/';

// Conversor UTM a WGS84
function utm18SToLatLng(easting, northing) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e = Math.sqrt(2 * f - f * f);
    const e1sq = e * e / (1 - e * e);
    const x = easting - 500000.0;
    const y = northing - 10000000.0;
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
    const lng = -75.0 + ((Q5 - Q6 + Q7) / cosFp) * (180 / Math.PI);

    return [lat, lng];
}

let SHIFT_LAT = 0.0020;
let SHIFT_LNG = 0.0032;
let RASTER_ROTATION = 0.0;
let anchorMarker = null;
let isAnchorModeActive = false;

function updateRasterPosition() {
    if (!rawOriginBounds) return;
    const calibratedBounds = [
        [rawOriginBounds[0][0] + SHIFT_LAT, rawOriginBounds[0][1] + SHIFT_LNG],
        [rawOriginBounds[1][0] + SHIFT_LAT, rawOriginBounds[1][1] + SHIFT_LNG]
    ];
    
    if (rasterElevationLayer) {
        rasterElevationLayer.setBounds(calibratedBounds);
        if (rasterElevationLayer._image) {
            if (anchorMarker) {
                let mapPoint = map.latLngToContainerPoint(anchorMarker.getLatLng());
                let imagePoint = map.latLngToContainerPoint(rasterElevationLayer.getBounds().getCenter());
                let pivotX = mapPoint.x - imagePoint.x + (rasterElevationLayer._image.clientWidth / 2);
                let pivotY = mapPoint.y - imagePoint.y + (rasterElevationLayer._image.clientHeight / 2);
                rasterElevationLayer._image.style.transformOrigin = `${pivotX}px ${pivotY}px`;
            } else {
                rasterElevationLayer._image.style.transformOrigin = 'center center';
            }
            rasterElevationLayer._image.style.transform = `rotate(${RASTER_ROTATION}deg)`;
        }
    } else {
        rasterElevationLayer = L.imageOverlay('datos_raster/elevacion.png', calibratedBounds, {
            opacity: 0.85,
            interactive: false
        });
    }
    
    const lbl = document.getElementById('calibValues');
    if (lbl) {
        lbl.innerText = `Lat: ${SHIFT_LAT.toFixed(4)}° | Lng: ${SHIFT_LNG.toFixed(4)}°\nGiro: ${RASTER_ROTATION.toFixed(2)}°`;
    }
}

const imgWidth = 702;
const imgHeight = 1160;

fetch('datos_raster/elevacion.pgw')
    .then(res => res.ok ? res.text() : Promise.reject())
    .then(text => {
        const lines = text.trim().split(/\r?\n/).map(Number);
        if (lines.length >= 6 && !isNaN(lines[0])) {
            const pixelSizeX = lines[0];
            const pixelSizeY = lines[3];
            const originX = lines[4];
            const originY = lines[5];

            const minX = originX - (pixelSizeX / 2);
            const maxY = originY - (pixelSizeY / 2);
            const maxX = minX + (imgWidth * pixelSizeX);
            const minY = maxY + (imgHeight * pixelSizeY);

            if (Math.abs(originX) <= 180 && Math.abs(originY) <= 90) {
                rawOriginBounds = [[minY, minX], [maxY, maxX]];
                updateRasterPosition();
            } else if (originX > 100000 && originY > 8000000) {
                const sw = utm18SToLatLng(minX, minY);
                const ne = utm18SToLatLng(maxX, maxY);
                rawOriginBounds = [sw, ne];
                updateRasterPosition();
            }
        }
    }).catch(() => {});


// --- CARGA DE CAPAS VECTORIALES CON ORDEN JERÁRQUICO PERFECTO ---

// 1. Peligro Inundación
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

// 2. Peligro Movimientos en Masa
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

// 3. Delimitación Distrital
fetch(baseUrl + 'DISTRITOS%20DE%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerDistritos = L.geoJSON(data, {
            style: { fillColor: '#ffffff', fillOpacity: 0.15, color: '#666666', weight: 3, opacity: 0.8 },
            onEachFeature: function (feature, layer) {
                let nombreDistrito = feature.properties.NOMBDIST || feature.properties.distrito || 'Distrito';
                layer.bindTooltip(`<b>Distrito:</b> ${nombreDistrito}`, { sticky: true, direction: 'auto' });
                layer.on({
                    mouseover: function (e) {
                        e.target.setStyle({ weight: 4, color: '#0b3d59', fillOpacity: 0.35 });
                        e.target.bringToFront();
                    },
                    mouseout: function (e) {
                        layerDistritos.resetStyle(e.target);
                    }
                });
            }
        });
        if(document.getElementById('chkDistritos').checked) layerDistritos.addTo(map);

        if (!rawOriginBounds) {
            const b = layerDistritos.getBounds();
            rawOriginBounds = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
            updateRasterPosition();
        }
    });

// 4. Ríos
fetch(baseUrl + 'RIOS%20RIMAC%20CHILLON.geojson')
    .then(res => res.json())
    .then(data => {
        layerRios = L.geoJSON(data, { style: { color: '#00bcd4', weight: 3, opacity: 0.8 } }).addTo(map);
    });

// 5. Líneas del Metro (L2 y L4) - Grosor de trazo en 7.5
fetch(baseUrl + 'Lineas%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerLineas = L.geoJSON(data, { 
            style: { color: '#0b3d59', weight: 7.5, opacity: 0.95, dashArray: null } 
        }).addTo(map);
    });

// 6. Estructuras (Con sincronización bidireccional)
fetch(baseUrl + 'ESTRUCTURAS%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerEstructuras = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                let idText = feature.properties.ID || 'N/A';
                return L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'custom-structure-icon',
                        html: `<div class="structure-marker-container"><div class="structure-dot"></div><div class="structure-label id-label-${idText}">${idText}</div></div>`,
                        iconSize: [65, 22],
                        iconAnchor: [6, 11]
                    }),
                    zIndexOffset: 1000
                });
            },
            onEachFeature: function (feature, layer) {
                let structId = String(feature.properties.ID || '').toUpperCase();
                layer.bindPopup(`<b>Estructura ID:</b> ${structId}`);
                
                layer.on('click', () => {
                    seleccionarFilaEnTabla(structId);
                });
            }
        }).addTo(map);
    });


// --- CARGA DE TABLA CSV Y MOTOR DE FILTRADO FEN ROBUSTO ---
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
        tr.dataset.structId = String(structId).toUpperCase();
        tr.dataset.inundacion = String(inundacionVal).toUpperCase();
        tr.dataset.huaycos = String(masasVal).toUpperCase();

        tr.innerHTML = `
            <td><b>${structId}</b></td>
            <td class="td-inundacion" style="background-color: ${colorInun}; color: ${textInun}; font-weight: 600; text-align: center;">${inundacionVal}</td>
            <td class="td-huaycos" style="background-color: ${colorMasas}; color: ${textMasas}; font-weight: 600; text-align: center;">${masasVal}</td>
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

    aplicarFiltrosFEN();
}

function seleccionarFilaEnTabla(structId) {
    const rows = document.querySelectorAll('#tableBody tr');
    let encontrada = null;
    rows.forEach(tr => {
        tr.classList.remove('selected-row');
        if (tr.dataset.structId === structId) {
            encontrada = tr;
        }
    });
    if (encontrada) {
        encontrada.classList.add('selected-row');
        encontrada.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


// --- LÓGICA DE FILTRADO CRUZADO FEN EXHAUSTIVO (MAPA + TABLA + CONTADORES + ZOOM AUTOMÁTICO) ---
function aplicarFiltrosFEN() {
    let textId = document.getElementById('filterId').value.toUpperCase().trim();
    let tipoPeligro = document.getElementById('filterTipoPeligro').value;
    let nivelRiesgo = document.getElementById('filterNivelRiesgo').value.toUpperCase().trim();

    let rows = document.querySelectorAll('#tableBody tr');
    let idsVisibles = new Set();
    let totalVisibles = 0;
    let totalGeneral = rows.length;
    let boundsGroup = []; // Para almacenar las coordenadas y hacer zoom automático

    rows.forEach(tr => {
        let sId = tr.dataset.structId || '';
        let inun = (tr.dataset.inundacion || '').toUpperCase().trim();
        let huay = (tr.dataset.huaycos || '').toUpperCase().trim();

        let normalizar = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, ' ').trim();

        let normInun = normalizar(inun);
        let normHuay = normalizar(huay);
        let normNivel = normalizar(nivelRiesgo);

        let matchId = !textId || sId.includes(textId);
        let matchPeligroNivel = true;

        if (normNivel !== "") {
            if (tipoPeligro === 'inundacion') {
                matchPeligroNivel = (normInun === normNivel || normInun.includes(normNivel));
            } else if (tipoPeligro === 'huaycos') {
                matchPeligroNivel = (normHuay === normNivel || normHuay.includes(normNivel));
            } else {
                matchPeligroNivel = (normInun === normNivel || normInun.includes(normNivel) || normHuay === normNivel || normHuay.includes(normNivel));
            }
        }

        let cellInun = tr.querySelector('.td-inundacion');
        let cellHuay = tr.querySelector('.td-huaycos');

        if (matchId && matchPeligroNivel) {
            tr.classList.remove('filtered-out');
            idsVisibles.add(sId);
            totalVisibles++;

            // Atenuar en la tabla la columna que NO se está filtrando
            if (tipoPeligro === 'inundacion') {
                if(cellInun) cellInun.style.opacity = '1';
                if(cellHuay) cellHuay.style.opacity = '0.25';
            } else if (tipoPeligro === 'huaycos') {
                if(cellInun) cellInun.style.opacity = '0.25';
                if(cellHuay) cellHuay.style.opacity = '1';
            } else {
                if(cellInun) cellInun.style.opacity = '1';
                if(cellHuay) cellHuay.style.opacity = '1';
            }
        } else {
            tr.classList.add('filtered-out');
            if(cellInun) cellInun.style.opacity = '1';
            if(cellHuay) cellHuay.style.opacity = '1';
        }
    });

    // Actualizar contadores gerenciales
    document.getElementById('counterBadge').innerText = `${totalVisibles} / ${totalGeneral}`;
    document.getElementById('tableCounter').innerText = `(${totalVisibles} expuestas)`;

    // Actualizar marcadores en el mapa, opacidad y recopilar bounds para zoom automático
    if (layerEstructuras) {
        layerEstructuras.eachLayer(layer => {
            let featId = String(layer.feature.properties.ID || layer.feature.properties.id || '').toUpperCase();
            let elDiv = layer.getElement();
            if (elDiv) {
                let labelEl = elDiv.querySelector('.structure-label');
                if (idsVisibles.has(featId)) {
                    elDiv.style.opacity = '1';
                    if (labelEl) {
                        labelEl.style.backgroundColor = '#d32f2f';
                        labelEl.style.color = '#ffffff';
                        labelEl.style.fontWeight = 'bold';
                    }
                    boundsGroup.push(layer.getLatLng());
                } else {
                    elDiv.style.opacity = '0.25';
                    if (labelEl) {
                        labelEl.style.backgroundColor = '#ffffff';
                        labelEl.style.color = '#000000';
                        labelEl.style.fontWeight = 'normal';
                    }
                }
            }
        });

        // Hacer zoom automático a los elementos filtrados si existen coincidencias
        if (boundsGroup.length > 0 && (nivelRiesgo !== "" || textId !== "" || tipoPeligro !== "")) {
            let groupBounds = L.latLngBounds(boundsGroup);
            map.fitBounds(groupBounds, { padding: [50, 50], maxZoom: 15, animate: true });
        }
    }

    if (tipoPeligro === 'inundacion') {
        let chk = document.getElementById('chkInundacion');
        if(!chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
    } else if (tipoPeligro === 'huaycos') {
        let chk = document.getElementById('chkHuaycos');
        if(!chk.checked) { chk.checked = true; chk.dispatchEvent(new Event('change')); }
    }
}

document.getElementById('filterId').addEventListener('input', aplicarFiltrosFEN);
document.getElementById('filterTipoPeligro').addEventListener('change', aplicarFiltrosFEN);
document.getElementById('filterNivelRiesgo').addEventListener('change', aplicarFiltrosFEN);


// --- EXPORTAR TABLA A EXCEL NATIVO (.xls) ---
document.getElementById('btnExportExcel').addEventListener('click', function() {
    let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Matriz de Riesgos FEN</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            <table>
                <thead>
                    <tr style="background-color: #0b3d59; color: #ffffff; font-weight: bold;">
                        <th>ID</th>
                        <th>Inundación</th>
                        <th>Movimientos en Masa</th>
                    </tr>
                </thead>
                <tbody>
    `;

    tableDataMaster.forEach(row => {
        let keys = Object.keys(row);
        let idKey = keys.find(k => k.toUpperCase().includes('ID'));
        let inunKey = keys.find(k => k.toUpperCase().includes('INUNDACI'));
        let masasKey = keys.find(k => k.toUpperCase().includes('MOVIMIENTO') || k.toUpperCase().includes('MASAS'));

        let sId = idKey ? row[idKey] : '';
        let inun = inunKey ? row[inunKey] : '';
        let masas = masasKey ? row[masasKey] : '';

        if(sId) {
            htmlContent += `
                <tr>
                    <td>${sId}</td>
                    <td>${inun}</td>
                    <td>${masas}</td>
                </tr>
            `;
        }
    });

    htmlContent += `
                </tbody>
            </table>
        </body>
        </html>
    `;

    let blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    let link = document.createElement("a");
    let url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", "Matriz_Riesgos_FEN_L2L4.xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});


// 5. WIDGET DE CALIBRACIÓN RÁSTER
const calibBox = document.createElement('div');
calibBox.id = 'rasterCalibBox';
calibBox.style.cssText = 'display:none; position:absolute; bottom:25px; left:25px; background:white; padding:8px 12px; border-radius:6px; box-shadow:0 2px 10px rgba(0,0,0,0.2); z-index:1000; font-size:11px; text-align:center; width: 175px;';
calibBox.innerHTML = `
    <div style="font-weight:bold; color:#0b3d59; margin-bottom:4px;">🎯 Calibración con Pin</div>
    <div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:3px; margin-bottom:4px;">
        <button id="btnRotCCW" style="padding:3px; cursor:pointer;" title="Giro Antihorario">↺</button>
        <button id="btnCalibUp" style="padding:3px; cursor:pointer;" title="Mover Arriba">▲</button>
        <button id="btnRotCW" style="padding:3px; cursor:pointer;" title="Giro Horario">↻</button>
        <button id="btnCalibLeft" style="padding:3px; cursor:pointer;" title="Mover Izquierda">◀</button>
        <button id="btnCalibDown" style="padding:3px; cursor:pointer;" title="Mover Abajo">▼</button>
        <button id="btnCalibRight" style="padding:3px; cursor:pointer;" title="Mover Derecha">▶</button>
    </div>
    <button id="btnToggleAnchor" style="width:100%; padding:3px; background:#f0f4f8; border:1px solid #0b3d59; color:#0b3d59; font-weight:bold; cursor:pointer; border-radius:3px; margin-bottom:4px;">📍 Colocar Pin Anclaje</button>
    <div id="calibValues" style="font-size:9.5px; color:#555; white-space: pre-line;">Lat: 0° | Lng: 0°\nGiro: 0°</div>
`;
document.querySelector('.map-container').appendChild(calibBox);

const STEP_POS = 0.0002;
const STEP_ROT = 0.25;

document.getElementById('btnCalibLeft').addEventListener('click', () => { SHIFT_LNG -= STEP_POS; updateRasterPosition(); });
document.getElementById('btnCalibRight').addEventListener('click', () => { SHIFT_LNG += STEP_POS; updateRasterPosition(); });
document.getElementById('btnCalibUp').addEventListener('click', () => { SHIFT_LAT += STEP_POS; updateRasterPosition(); });
document.getElementById('btnCalibDown').addEventListener('click', () => { SHIFT_LAT -= STEP_POS; updateRasterPosition(); });
document.getElementById('btnRotCCW').addEventListener('click', () => { RASTER_ROTATION -= STEP_ROT; updateRasterPosition(); });
document.getElementById('btnRotCW').addEventListener('click', () => { RASTER_ROTATION += STEP_ROT; updateRasterPosition(); });

document.getElementById('btnToggleAnchor').addEventListener('click', () => {
    isAnchorModeActive = !isAnchorModeActive;
    const btn = document.getElementById('btnToggleAnchor');
    if (isAnchorModeActive) {
        btn.style.background = '#0b3d59';
        btn.style.color = 'white';
        btn.innerText = 'Click en mapa para Pin...';
    } else {
        btn.style.background = '#f0f4f8';
        btn.style.color = '#0b3d59';
        btn.innerText = '📍 Colocar Pin Anclaje';
    }
});

map.on('click', function(e) {
    if (!isAnchorModeActive) return;
    if (anchorMarker) map.removeLayer(anchorMarker);
    
    const pinIcon = L.divIcon({
        className: 'custom-pin-icon',
        html: `<div style="background:#d32f2f; color:white; width:22px; height:22px; border-radius:50%; border:2px solid white; display:flex; align-items:center; justify-content:center; font-size:12px; box-shadow:0 2px 5px rgba(0,0,0,0.3);">📍</div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
    });

    anchorMarker = L.marker(e.latlng, { icon: pinIcon }).addTo(map);
    anchorMarker.bindPopup(`<b>Punto de Anclaje</b><br>Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`).openPopup();

    isAnchorModeActive = false;
    const btn = document.getElementById('btnToggleAnchor');
    btn.style.background = '#f0f4f8';
    btn.style.color = '#0b3d59';
    btn.innerText = '📍 Pin Fijado (Cambiar)';
    updateRasterPosition();
});


// 6. CONTROL DE CHECKBOXES
document.getElementById('chkDistritos').addEventListener('change', function() {
    if(this.checked) map.addLayer(layerDistritos);
    else map.removeLayer(layerDistritos);
});

document.getElementById('chkTopografia').addEventListener('change', function() {
    if(this.checked) {
        map.removeLayer(googleGrisLayer);
        if (rasterElevationLayer) {
            rasterElevationLayer.addTo(map);
            rasterElevationLayer.bringToBack();
            if (rasterElevationLayer._image) {
                rasterElevationLayer._image.style.transform = `rotate(${RASTER_ROTATION}deg)`;
            }
        }
        calibBox.style.display = 'block';
        updateRasterPosition();
    } else {
        if (rasterElevationLayer && map.hasLayer(rasterElevationLayer)) {
            map.removeLayer(rasterElevationLayer);
        }
        if (anchorMarker) {
            map.removeLayer(anchorMarker);
            anchorMarker = null;
        }
        googleGrisLayer.addTo(map);
        googleGrisLayer.bringToBack();
        calibBox.style.display = 'none';
    }
});

document.getElementById('chkInundacion').addEventListener('change', function() {
    let huaycoChk = document.getElementById('chkHuaycos');
    if(this.checked) {
        huaycoChk.checked = false;
        if(map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos);
        if(layerInundacion) {
            map.addLayer(layerInundacion);
            if(layerLineas) layerLineas.bringToFront();
            if(layerEstructuras) layerEstructuras.bringToFront();
        }
        updateLegend('Inundación');
    } else {
        if(layerInundacion) map.removeLayer(layerInundacion);
        clearLegend();
    }
});

document.getElementById('chkHuaycos').addEventListener('change', function() {
    let inunChk = document.getElementById('chkInundacion');
    if(this.checked) {
        inunChk.checked = false;
        if(map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion);
        if(layerHuaycos) {
            map.addLayer(layerHuaycos);
            if(layerLineas) layerLineas.bringToFront();
            if(layerEstructuras) layerEstructuras.bringToFront();
        }
        updateLegend('Movimientos en Masa');
    } else {
        if(layerHuaycos) map.removeLayer(layerHuaycos);
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


// 7. FILTROS RÁPIDOS
document.getElementById('filterId').addEventListener('input', aplicarFiltrosFEN);


// 8. CONTROL DE LA VENTANA MODAL (README)
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
