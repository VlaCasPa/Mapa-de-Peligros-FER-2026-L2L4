// --- CONFIGURACIÓN DE FIREBASE (PROYECTO CENTRAL: MetroL2-IAM-Central) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC1XakVAZLUDq3-240Q_KoYYPU5JKCTjzs",
    authDomain: "metrol2-iam-central.firebaseapp.com",
    projectId: "metrol2-iam-central",
    storageBucket: "metrol2-iam-central.firebasestorage.app",
    messagingSenderId: "78845391762",
    appId: "1:78845391762:web:d64611cd7c4ef65a24074b"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

window.loginConCorreoPassword = async function() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    
    if (!emailInput || !passwordInput) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        alert("Por favor ingrese su correo corporativo y contraseña.");
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        console.error("Error de Autenticación Firebase:", error);
        alert("Error de autenticación: Verifique sus credenciales.");
    }
};

window.loginConGoogle = async function() {
    try {
        await signInWithPopup(auth, googleProvider);
    } catch (error) {
        console.error("Error Google IAM:", error);
        alert("Error al iniciar sesión con Google.");
    }
};

window.aceptarDisclaimer = function() {
    const disclaimerModal = document.getElementById('disclaimer-modal');
    if (disclaimerModal) {
        disclaimerModal.style.display = 'none';
    }
    sessionStorage.setItem('disclaimerAceptado', 'true');
};

onAuthStateChanged(auth, async (user) => {
    const loginModal = document.getElementById('login-modal');
    const disclaimerModal = document.getElementById('disclaimer-modal');

    if (user) {
        if (loginModal) loginModal.style.display = 'none';
        const disclaimerAceptado = sessionStorage.getItem('disclaimerAceptado');
        if (!disclaimerAceptado && disclaimerModal) {
            disclaimerModal.style.display = 'flex';
        } else if (disclaimerModal) {
            disclaimerModal.style.display = 'none';
        }

        const userBadge = document.getElementById('onlineUsers');
        if (userBadge) userBadge.innerHTML = `🟢 ${user.email || 'Autorizado'}`;
        const userBadgeMob = document.getElementById('onlineUsersMob');
        if (userBadgeMob) userBadgeMob.innerHTML = `🟢 ${user.email || 'Autorizado'}`;
    } else {
        if (loginModal) loginModal.style.display = 'flex';
        if (disclaimerModal) disclaimerModal.style.display = 'none';
    }
});


// 1. MAPA BASE
const map = L.map('map', { zoomControl: false }).setView([-12.0464, -77.0428], 11);
L.control.zoom({ position: 'topright' }).addTo(map);

const googleGrisLayer = L.tileLayer('https://mt1.google.com/vt/lyrs=m@129&x={x}&y={y}&z={z}', {
    attribution: '&copy; Google Maps',
    maxZoom: 20,
    className: 'mapa-google-gris'
}).addTo(map);

// 2. CONFIGURACIÓN Y NORMALIZACIÓN CENEPRED
function normalizarTexto(str) {
    if (!str) return '';
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();
}

function obtenerNivelEstandar(str) {
    let n = normalizarTexto(str);
    if (n.includes('MUY ALTO')) return 'MUY ALTO';
    if (n === 'ALTO' || (n.includes('ALTO') && !n.includes('MUY'))) return 'ALTO';
    if (n.includes('MEDIO')) return 'MEDIO';
    if (n.includes('BAJO')) return 'BAJO';
    return '';
}

function getColorPeligro(nivel) {
    let estandar = obtenerNivelEstandar(nivel);
    if (estandar === 'MUY ALTO') return '#d32f2f';
    if (estandar === 'ALTO') return '#f57c00';
    if (estandar === 'MEDIO') return '#fbc02d';
    if (estandar === 'BAJO') return '#388e3c';
    return '#ffffff';
}

function getTextColor(nivel) {
    let estandar = obtenerNivelEstandar(nivel);
    if (estandar === 'MUY ALTO' || estandar === 'ALTO' || estandar === 'BAJO') return '#ffffff';
    return '#000000';
}

// 3. VARIABLES GLOBALES
let layerRios, layerLineas, layerDistritos, layerEstructuras, layerInundacion, layerHuaycos;
let rasterElevationLayer = null;
let rawOriginBounds = null;
let tableDataMaster = [];
const baseUrl = 'datos_vectoriales/';

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


// --- CARGA DE CAPAS ---
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

fetch(baseUrl + 'DISTRITOS%20DE%20LIMA%20Y%20CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        layerDistritos = L.geoJSON(data, {
            style: { fillColor: '#ffffff', fillOpacity: 0.15, color: '#ffffff', weight: 2, opacity: 0.9 },
            onEachFeature: function (feature, layer) {
                let nombreDistrito = feature.properties.NOMBDIST || feature.properties.distrito || 'Distrito';
                layer.bindTooltip(`<b>Distrito:</b> ${nombreDistrito}`, { sticky: true, direction: 'auto' });
            }
        });
        if(document.getElementById('chkDistritos').checked) layerDistritos.addTo(map);

        if (!rawOriginBounds) {
            const b = layerDistritos.getBounds();
            rawOriginBounds = [[b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]];
            updateRasterPosition();
        }
    });

fetch(baseUrl + 'RIOS%20RIMAC%20CHILLON.geojson')
    .then(res => res.json())
    .then(data => {
        layerRios = L.geoJSON(data, { style: { color: '#00bcd4', weight: 3, opacity: 0.8 } }).addTo(map);
    });

fetch(baseUrl + 'Lineas%20L2L4.geojson')
    .then(res => res.json())
    .then(data => {
        layerLineas = L.geoJSON(data, { style: { color: '#0b3d59', weight: 7.5, opacity: 0.95 } }).addTo(map);
    });

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
                let structId = String(feature.properties.ID || '').toUpperCase().trim();
                layer.bindPopup(`<b>Estructura ID:</b> ${structId}`);
                layer.on('click', () => { seleccionarFilaEnTabla(structId); });
            }
        }).addTo(map);
        aplicarFiltrosFEN();
    });


// --- WIDGET DE CALIBRACIÓN RÁSTER ---
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


// --- CARGA DE TABLA CSV CON PAPAPARSE ---
const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTE27I4VwWlYKQEgCkNRcGydFG8zFseeR5_0SFF3F_-HEW_VLBPUY_G8uCuexKw2NkkIEq3Wl1i7ipE/pub?gid=1027540316&single=true&output=csv';

function iniciarCargaCSV() {
    if (typeof Papa === 'undefined') {
        setTimeout(iniciarCargaCSV, 100);
        return;
    }
    Papa.parse(csvUrl, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            tableDataMaster = results.data;
            renderTable(tableDataMaster);
        },
        error: function(err) {
            console.error("Error al cargar el CSV remoto:", err);
        }
    });
}

iniciarCargaCSV();

function extraerColumnasFila(row) {
    let keys = Object.keys(row);
    let idKey = keys.find(k => normalizarTexto(k).includes('ID')) || keys[0];
    let inunKey = keys.find(k => normalizarTexto(k).includes('INUNDACI') || normalizarTexto(k).includes('INUNDACION')) || keys[1];
    let masasKey = keys.find(k => normalizarTexto(k).includes('MOVIMIENTO') || normalizarTexto(k).includes('MASAS') || normalizarTexto(k).includes('HUAYCO')) || keys[2];

    return {
        structId: idKey ? String(row[idKey] || '').trim() : '',
        inundacionVal: inunKey ? String(row[inunKey] || '').trim() : '',
        masasVal: masasKey ? String(row[masasKey] || '').trim() : ''
    };
}

function renderTable(data) {
    const tbody = document.getElementById('tableBody');
    const tbodyMob = document.getElementById('tableBodyMob');
    if (tbody) tbody.innerHTML = '';
    if (tbodyMob) tbodyMob.innerHTML = '';
    
    data.forEach(row => {
        let { structId, inundacionVal, masasVal } = extraerColumnasFila(row);
        if (!structId) return;

        let colorInun = getColorPeligro(inundacionVal);
        let colorMasas = getColorPeligro(masasVal);
        let textInun = getTextColor(inundacionVal);
        let textMasas = getTextColor(masasVal);

        let rowHtml = `
            <td class="td-id"><b>${structId}</b></td>
            <td class="td-inundacion" style="background-color: ${colorInun}; color: ${textInun}; font-weight: 600; text-align: center;">${inundacionVal}</td>
            <td class="td-huaycos" style="background-color: ${colorMasas}; color: ${textMasas}; font-weight: 600; text-align: center;">${masasVal}</td>
        `;

        if (tbody) {
            let tr = document.createElement('tr');
            tr.dataset.structId = structId.toUpperCase();
            tr.dataset.inundacion = obtenerNivelEstandar(inundacionVal);
            tr.dataset.huaycos = obtenerNivelEstandar(masasVal);
            tr.innerHTML = rowHtml;
            tr.addEventListener('click', () => { seleccionarFilaEnTabla(structId); });
            tbody.appendChild(tr);
        }

        if (tbodyMob) {
            let trMob = document.createElement('tr');
            trMob.dataset.structId = structId.toUpperCase();
            trMob.dataset.inundacion = obtenerNivelEstandar(inundacionVal);
            trMob.dataset.huaycos = obtenerNivelEstandar(masasVal);
            trMob.innerHTML = rowHtml;
            trMob.addEventListener('click', () => { seleccionarFilaEnTabla(structId); });
            tbodyMob.appendChild(trMob);
        }
    });

    aplicarFiltrosFEN();
}

function seleccionarFilaEnTabla(structId) {
    const rows = document.querySelectorAll('#tableBody tr, #tableBodyMob tr');
    let encontrada = null;
    rows.forEach(tr => {
        tr.classList.remove('selected-row');
        if (tr.dataset.structId === structId) encontrada = tr;
    });
    if (encontrada) {
        encontrada.classList.add('selected-row');
        encontrada.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


// --- LEYENDA COLAPSIBLE ---
window.toggleLeyenda = function() {
    const body = document.getElementById('legendContent');
    const icon = document.getElementById('legendToggleIcon');
    if (!body || !icon) return;
    if (body.style.display === 'none') {
        body.style.display = 'block';
        icon.innerText = '▼';
    } else {
        body.style.display = 'none';
        icon.innerText = '▲';
    }
};


// --- VENTANA FLOTANTE ---
const floatingPanel = document.getElementById('floatingSummary');
const floatingHeader = document.getElementById('floatingHeader');
let isDragging = false, offsetX = 0, offsetY = 0;

if (floatingHeader && floatingPanel) {
    floatingHeader.addEventListener('mousedown', (e) => {
        isDragging = true;
        offsetX = e.clientX - floatingPanel.offsetLeft;
        offsetY = e.clientY - floatingPanel.offsetTop;
    });
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        floatingPanel.style.left = (e.clientX - offsetX) + 'px';
        floatingPanel.style.top = (e.clientY - offsetY) + 'px';
        floatingPanel.style.position = 'absolute';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });
}

const btnCloseFlo = document.getElementById('btnCloseFloating');
if (btnCloseFlo) {
    btnCloseFlo.addEventListener('click', () => {
        if (floatingPanel) floatingPanel.style.display = 'none';
    });
}

function actualizarVentanaFlotante(elementosFiltrados, modoEscenario, hayFiltroActivo) {
    const floatingBody = document.getElementById('floatingBody');
    if (!floatingBody) return;
    floatingBody.innerHTML = '';

    if (floatingPanel && hayFiltroActivo) {
        floatingPanel.style.display = 'flex';
    } else {
        if (floatingPanel) floatingPanel.style.display = 'none';
        return;
    }

    if (elementosFiltrados.length === 0) {
        floatingBody.innerHTML = `<p style="font-size: 11px; color: #666; text-align: center; padding: 10px;">Sin estructuras coincidentes</p>`;
        return;
    }

    elementosFiltrados.forEach(item => {
        let nivelTexto = (modoEscenario === 'HUAYCOS') ? item.huaycos : item.inundacion;
        let colorNivel = getColorPeligro(nivelTexto);
        let textoColorNivel = getTextColor(nivelTexto);
        let tipoLabel = (modoEscenario === 'HUAYCOS') ? 'Mov. Masas' : ((modoEscenario === 'INUNDACION') ? 'Inundación' : 'Riesgo FEN');

        let div = document.createElement('div');
        div.className = 'floating-item';
        div.style.borderLeftColor = colorNivel;
        div.innerHTML = `
            <div>
                <span class="floating-item-id">${item.id}</span>
                <div style="font-size: 9.5px; color: #555;">${tipoLabel}</div>
            </div>
            <span class="floating-item-badge" style="background-color: ${colorNivel}; color: ${textoColorNivel};">${nivelTexto || 'N/D'}</span>
        `;
        div.addEventListener('click', () => {
            if(layerEstructuras) {
                layerEstructuras.eachLayer(layer => {
                    let featId = String(layer.feature.properties.ID || '').toUpperCase().trim();
                    if(featId === item.id) {
                        map.setView(layer.getLatLng(), 16);
                        layer.openPopup();
                    }
                });
            }
        });
        floatingBody.appendChild(div);
    });
}

function sincronizarCapasMapa(modoEscenario) {
    let chkInun = document.getElementById('chkInundacion');
    let chkHuay = document.getElementById('chkHuaycos');
    let chkInunMob = document.getElementById('chkInundacionMob');
    let chkHuayMob = document.getElementById('chkHuaycosMob');

    if (modoEscenario === 'INUNDACION') {
        if (chkInun) chkInun.checked = true;
        if (chkHuay) chkHuay.checked = false;
        if (chkInunMob) chkInunMob.checked = true;
        if (chkHuayMob) chkHuayMob.checked = false;

        if (layerHuaycos && map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos);
        if (layerInundacion && !map.hasLayer(layerInundacion)) map.addLayer(layerInundacion);
        updateLegend('Inundación');
    } else if (modoEscenario === 'HUAYCOS') {
        if (chkHuay) chkHuay.checked = true;
        if (chkInun) chkInun.checked = false;
        if (chkHuayMob) chkHuayMob.checked = true;
        if (chkInunMob) chkInunMob.checked = false;

        if (layerInundacion && map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion);
        if (layerHuaycos && !map.hasLayer(layerHuaycos)) map.addLayer(layerHuaycos);
        updateLegend('Movimientos en Masa');
    } else {
        if (chkInun) chkInun.checked = false;
        if (chkHuay) chkHuay.checked = false;
        if (chkInunMob) chkInunMob.checked = false;
        if (chkHuayMob) chkHuayMob.checked = false;

        if (layerInundacion && map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion);
        if (layerHuaycos && map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos);
        clearLegend();
    }
}

// --- MOTOR DE FILTRADO FEN UNIFICADO (PC Y MÓVIL) ---
function aplicarFiltrosFEN() {
    const isMobile = window.innerWidth <= 900;
    
    let inputIdEl = document.getElementById(isMobile ? 'filterIdMob' : 'filterId') || document.getElementById('filterId');
    let selectTipoEl = document.getElementById(isMobile ? 'filterTipoPeligroMob' : 'filterTipoPeligro') || document.getElementById('filterTipoPeligro');
    let selectNivelEl = document.getElementById(isMobile ? 'filterNivelRiesgoMob' : 'filterNivelRiesgo') || document.getElementById('filterNivelRiesgo');

    let textId = inputIdEl ? normalizarTexto(inputIdEl.value) : '';
    let rawTipoVal = selectTipoEl ? normalizarTexto(selectTipoEl.value) : '';
    let rawTipoText = (selectTipoEl && selectTipoEl.selectedIndex >= 0) ? normalizarTexto(selectTipoEl.options[selectTipoEl.selectedIndex].text) : '';
    
    let modoEscenario = 'TODOS';
    if (rawTipoVal.includes('INUND') || rawTipoText.includes('INUND')) {
        modoEscenario = 'INUNDACION';
    } else if (rawTipoVal.includes('HUAYC') || rawTipoVal.includes('MASA') || rawTipoVal.includes('MOV') || rawTipoText.includes('MASA') || rawTipoText.includes('MOV')) {
        modoEscenario = 'HUAYCOS';
    }

    let rawNivelVal = selectNivelEl ? selectNivelEl.value : '';
    let normNivelBuscado = obtenerNivelEstandar(rawNivelVal);

    let hayFiltroActivo = (textId !== '' || normNivelBuscado !== '');

    sincronizarCapasMapa(modoEscenario);

    let rows = document.querySelectorAll('#tableBody tr');
    let rowsMob = document.querySelectorAll('#tableBodyMob tr');
    
    let idsVisibles = new Set();
    let totalVisibles = 0;
    let totalGeneral = tableDataMaster.length > 0 ? tableDataMaster.length : 79;
    let boundsGroup = [];
    let listaParaFlotante = [];
    let mapaNivelesEstructuras = {};

    rows.forEach((tr, index) => {
        let cellInun = tr.querySelector('.td-inundacion');
        let cellHuay = tr.querySelector('.td-huaycos');
        let trMob = rowsMob[index];

        let sId = (tr.dataset.structId || '').toUpperCase().trim();
        let textoInunOriginal = cellInun ? cellInun.textContent.trim() : '';
        let textoHuayOriginal = cellHuay ? cellHuay.textContent.trim() : '';

        let nivelFilaInun = obtenerNivelEstandar(textoInunOriginal);
        let nivelFilaHuay = obtenerNivelEstandar(textoHuayOriginal);

        let matchId = !textId || sId.includes(textId);
        let matchPeligroNivel = true;

        if (normNivelBuscado !== '') {
            if (modoEscenario === 'INUNDACION') {
                matchPeligroNivel = (nivelFilaInun === normNivelBuscado);
            } else if (modoEscenario === 'HUAYCOS') {
                matchPeligroNivel = (nivelFilaHuay === normNivelBuscado);
            } else {
                matchPeligroNivel = (nivelFilaInun === normNivelBuscado || nivelFilaHuay === normNivelBuscado);
            }
        }

        if (matchId && matchPeligroNivel) {
            tr.classList.remove('filtered-out');
            if (trMob) trMob.classList.remove('filtered-out');
            idsVisibles.add(sId);
            totalVisibles++;

            let nivelAsociado = (modoEscenario === 'HUAYCOS') ? nivelFilaHuay : nivelFilaInun;
            mapaNivelesEstructuras[sId] = nivelAsociado;

            listaParaFlotante.push({
                id: sId,
                inundacion: nivelFilaInun || textoInunOriginal.toUpperCase(),
                huaycos: nivelFilaHuay || textoHuayOriginal.toUpperCase()
            });

            if (modoEscenario === 'INUNDACION') {
                if (cellInun) cellInun.classList.remove('col-dimmed');
                if (cellHuay) cellHuay.classList.add('col-dimmed');
                if (trMob) {
                    let cIn = trMob.querySelector('.td-inundacion');
                    let cH = trMob.querySelector('.td-huaycos');
                    if (cIn) cIn.classList.remove('col-dimmed');
                    if (cH) cH.classList.add('col-dimmed');
                }
            } else if (modoEscenario === 'HUAYCOS') {
                if (cellInun) cellInun.classList.add('col-dimmed');
                if (cellHuay) cellHuay.classList.remove('col-dimmed');
                if (trMob) {
                    let cIn = trMob.querySelector('.td-inundacion');
                    let cH = trMob.querySelector('.td-huaycos');
                    if (cIn) cIn.classList.add('col-dimmed');
                    if (cH) cH.classList.remove('col-dimmed');
                }
            } else {
                if (cellInun) cellInun.classList.remove('col-dimmed');
                if (cellHuay) cellHuay.classList.remove('col-dimmed');
                if (trMob) {
                    let cIn = trMob.querySelector('.td-inundacion');
                    let cH = trMob.querySelector('.td-huaycos');
                    if (cIn) cIn.classList.remove('col-dimmed');
                    if (cH) cH.classList.remove('col-dimmed');
                }
            }
        } else {
            tr.classList.add('filtered-out');
            if (trMob) trMob.classList.add('filtered-out');
            if (cellInun) cellInun.classList.remove('col-dimmed');
            if (cellHuay) cellHuay.classList.remove('col-dimmed');
        }
    });

    let badge = document.getElementById('counterBadge');
    let badgeMob = document.getElementById('counterBadgeMob');
    let tCounter = document.getElementById('tableCounter');
    let tCounterMob = document.getElementById('tableCounterMob');

    if (badge) badge.innerText = `${totalVisibles} / ${totalGeneral}`;
    if (badgeMob) badgeMob.innerText = `${totalVisibles} / ${totalGeneral}`;
    if (tCounter) tCounter.innerText = `(${totalVisibles} expuestas)`;
    if (tCounterMob) tCounterMob.innerText = `(${totalVisibles} expuestas)`;

    actualizarVentanaFlotante(listaParaFlotante, modoEscenario, hayFiltroActivo);

    if (layerEstructuras) {
        layerEstructuras.eachLayer(layer => {
            let featId = String(layer.feature.properties.ID || layer.feature.properties.id || '').toUpperCase().trim();
            let elDiv = layer.getElement();
            if (elDiv) {
                let labelEl = elDiv.querySelector('.structure-label');
                if (idsVisibles.has(featId)) {
                    elDiv.style.opacity = '1';
                    if (labelEl) {
                        if (normNivelBuscado !== '') {
                            let nivelActual = mapaNivelesEstructuras[featId];
                            labelEl.style.backgroundColor = getColorPeligro(nivelActual);
                            labelEl.style.color = getTextColor(nivelActual);
                        } else {
                            labelEl.style.backgroundColor = '#ffffff';
                            labelEl.style.color = '#000000';
                        }
                        labelEl.style.fontWeight = 'bold';
                    }
                    boundsGroup.push(layer.getLatLng());
                } else {
                    elDiv.style.opacity = '0.2';
                    if (labelEl) {
                        labelEl.style.backgroundColor = '#ffffff';
                        labelEl.style.color = '#000000';
                        labelEl.style.fontWeight = 'normal';
                    }
                }
            }
        });

        if (textId !== '' || normNivelBuscado !== '') {
            if (boundsGroup.length > 0) {
                let groupBounds = L.latLngBounds(boundsGroup);
                map.fitBounds(groupBounds, { padding: [50, 50], maxZoom: 15, animate: true });
            } else {
                map.setView([-12.0464, -77.0428], 11, { animate: true });
            }
        }
    }
}

// Sincronizar eventos filtros PC y Móvil
['filterId', 'filterIdMob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', aplicarFiltrosFEN);
});
['filterTipoPeligro', 'filterTipoPeligroMob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', aplicarFiltrosFEN);
});
['filterNivelRiesgo', 'filterNivelRiesgoMob'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', aplicarFiltrosFEN);
});

// --- EXPORTAR A EXCEL ---
function exportarExcel() {
    let htmlContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="UTF-8"></head><body><table><thead><tr><th>ID</th><th>Inundación</th><th>Movimientos en Masa</th></tr></thead><tbody>`;
    tableDataMaster.forEach(row => {
        let { structId, inundacionVal, masasVal } = extraerColumnasFila(row);
        if(structId) {
            htmlContent += `<tr><td>${structId}</td><td>${inundacionVal}</td><td>${masasVal}</td></tr>`;
        }
    });
    htmlContent += `</tbody></table></body></html>`;

    let blob = new Blob([htmlContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    let link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Matriz_Riesgos_FEN_L2L4.xls";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

const btnEx = document.getElementById('btnExportExcel');
const btnExMob = document.getElementById('btnExportExcelMob');
if (btnEx) btnEx.addEventListener('click', exportarExcel);
if (btnExMob) btnExMob.addEventListener('click', exportarExcel);

// --- CHECKBOXES DE CAPAS SINCRONIZADOS ---
function manejarCapasDistrito(e) {
    const checked = e.target.checked;
    if(document.getElementById('chkDistritos')) document.getElementById('chkDistritos').checked = checked;
    if(document.getElementById('chkDistritosMob')) document.getElementById('chkDistritosMob').checked = checked;
    if(checked) map.addLayer(layerDistritos);
    else map.removeLayer(layerDistritos);
}
if(document.getElementById('chkDistritos')) document.getElementById('chkDistritos').addEventListener('change', manejarCapasDistrito);
if(document.getElementById('chkDistritosMob')) document.getElementById('chkDistritosMob').addEventListener('change', manejarCapasDistrito);

function manejarTopografia(e) {
    const checked = e.target.checked;
    if(document.getElementById('chkTopografia')) document.getElementById('chkTopografia').checked = checked;
    if(document.getElementById('chkTopografiaMob')) document.getElementById('chkTopografiaMob').checked = checked;
    if(checked) {
        map.removeLayer(googleGrisLayer);
        if (rasterElevationLayer) {
            rasterElevationLayer.addTo(map);
            rasterElevationLayer.bringToBack();
            if (rasterElevationLayer._image) {
                rasterElevationLayer._image.style.transform = `rotate(${RASTER_ROTATION}deg)`;
            }
        }
        if (calibBox) calibBox.style.display = 'block';
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
        if (calibBox) calibBox.style.display = 'none';
    }
}
if(document.getElementById('chkTopografia')) document.getElementById('chkTopografia').addEventListener('change', manejarTopografia);
if(document.getElementById('chkTopografiaMob')) document.getElementById('chkTopografiaMob').addEventListener('change', manejarTopografia);

function manejarInundacion(e) {
    const checked = e.target.checked;
    if(document.getElementById('chkInundacion')) document.getElementById('chkInundacion').checked = checked;
    if(document.getElementById('chkInundacionMob')) document.getElementById('chkInundacionMob').checked = checked;
    if(checked) sincronizarCapasMapa('INUNDACION');
    else { if(layerInundacion && map.hasLayer(layerInundacion)) map.removeLayer(layerInundacion); clearLegend(); }
}
if(document.getElementById('chkInundacion')) document.getElementById('chkInundacion').addEventListener('change', manejarInundacion);
if(document.getElementById('chkInundacionMob')) document.getElementById('chkInundacionMob').addEventListener('change', manejarInundacion);

function manejarHuaycos(e) {
    const checked = e.target.checked;
    if(document.getElementById('chkHuaycos')) document.getElementById('chkHuaycos').checked = checked;
    if(document.getElementById('chkHuaycosMob')) document.getElementById('chkHuaycosMob').checked = checked;
    if(checked) sincronizarCapasMapa('HUAYCOS');
    else { if(layerHuaycos && map.hasLayer(layerHuaycos)) map.removeLayer(layerHuaycos); clearLegend(); }
}
if(document.getElementById('chkHuaycos')) document.getElementById('chkHuaycos').addEventListener('change', manejarHuaycos);
if(document.getElementById('chkHuaycosMob')) document.getElementById('chkHuaycosMob').addEventListener('change', manejarHuaycos);

function updateLegend(tipo) {
    const lTitle = document.getElementById('legendTitle');
    const legend = document.getElementById('legendContent');
    if (lTitle) lTitle.innerText = `Niveles de ${tipo}`;
    if (legend) {
        legend.innerHTML = `
            <div class="legend-item"><span class="legend-color" style="background:#d32f2f"></span>Muy Alto</div>
            <div class="legend-item"><span class="legend-color" style="background:#f57c00"></span>Alto</div>
            <div class="legend-item"><span class="legend-color" style="background:#fbc02d"></span>Medio</div>
            <div class="legend-item"><span class="legend-color" style="background:#388e3c"></span>Bajoo</div>
        `;
    }
}

function clearLegend() {
    const lTitle = document.getElementById('legendTitle');
    const legend = document.getElementById('legendContent');
    if (lTitle) lTitle.innerText = 'Leyenda';
    if (legend) legend.innerHTML = 'Seleccione una capa de riesgo';
}

// --- MODAL README ---
const modal = document.getElementById('readmeModal');
const btnOpen = document.getElementById('btnOpenReadme');
const btnOpenMob = document.getElementById('btnOpenReadmeMob');
const btnClose = document.getElementById('btnCloseReadme');
const btnCloseBottom = document.getElementById('btnCloseModalBottom');

if(modal) {
    if(btnOpen) btnOpen.addEventListener('click', () => { modal.style.display = 'flex'; });
    if(btnOpenMob) btnOpenMob.addEventListener('click', () => { modal.style.display = 'flex'; });
    if(btnClose) btnClose.addEventListener('click', () => { modal.style.display = 'none'; });
    if(btnCloseBottom) btnCloseBottom.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}

