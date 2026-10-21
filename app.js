// 1. Inicialización del Mapa (Centrado en Lima Metropolitana)
// Coordenadas aprox: Lat -12.0464, Lng -77.0428
const map = L.map('map', {
    zoomControl: false // Desactivamos el default para moverlo luego si es necesario
}).setView([-12.0464, -77.0428], 11);

// Agregamos control de zoom en la esquina superior derecha
L.control.zoom({ position: 'topright' }).addTo(map);

// 2. Capa Base: Gris Tenue (Light Gray Canvas)
// Utilizamos CartoDB Positron, que es el estándar gratuito para mapas grises limpios
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
}).addTo(map);

// --- SECCIÓN PARA FUTURAS CONEXIONES GEOJSON ---
/* 
Ejemplo de cómo conectarás tus archivos desde GitHub Pages:

let inundacionLayer;
fetch('datos_vectoriales/PELIGRO_INUNDACION_LIMA_Y_CALLAO.geojson')
    .then(res => res.json())
    .then(data => {
        inundacionLayer = L.geoJSON(data, {
            style: function(feature) {
                // Aquí pondrás la lógica para leer niv_sinu y asignar colores
            }
        });
    });
*/

// 3. Interacción UI: Bottom Sheet para Móviles
const sidePanel = document.getElementById('sidePanel');
const mobileHandle = document.getElementById('mobileHandle');

// Evento simple para expandir/colapsar en móviles al tocar la barra superior
mobileHandle.addEventListener('click', () => {
    sidePanel.classList.toggle('expanded');
});

// 4. Lógica de Interacción de Botones Andon
document.querySelectorAll('.btn-toggle').forEach(button => {
    button.addEventListener('click', (e) => {
        // Remover clase activa de los hermanos (si es excluyente)
        // e.target.classList.toggle('active');
        
        // Aquí inyectarás la lógica para:
        // - map.addLayer(inundacionLayer)
        // - Actualizar el HTML de #analysisContent con los textos PMBOK
        console.log("Botón presionado:", e.target.id);
    });
});
