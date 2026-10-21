# 🗺️ Dashboard Geoespacial de Riesgos: Línea 2 y Línea 4 del Metro de Lima ante el Fenómeno del Niño

**Sistema de Alerta Temprana y Toma de Decisiones Estratégicas para Infraestructura Subterránea**

Este repositorio contiene la arquitectura de datos geoespaciales, los mapas base y el análisis topográfico necesarios para evaluar y mitigar los impactos del Fenómeno del Niño (lluvias intensas 2026-2027) sobre los frentes de obra y estructuras definitivas del primer metro subterráneo del Perú.

---

## 🎯 Objetivo del Proyecto

Transformar la cartografía estática oficial del Estado Peruano en un **Dashboard de Gestión Visual** dinámico. El panel (dividido en 2/3 de mapa interactivo y 1/3 de panel de análisis) permite a las gerencias de construcción, ingeniería y permisos identificar visualmente las estructuras críticas y aplicar presupuestos de contingencia de manera proactiva.

### 🧠 Filosofía de Gestión
Este repositorio está estructurado bajo dos grandes marcos de trabajo:
*   **PMBOK (Gestión de Riesgos del Proyecto):** Evoluciona la identificación del riesgo hacia un *Plan de Respuesta a los Riesgos* con sustento científico. Permite pasar de la incertidumbre a la mitigación (ej. compras anticipadas de equipos de bombeo).
*   **Lean Construction (Gestión Visual / Tablero Andon):** Funciona como un sistema de alerta (Visual Management). Al cruzar el cronograma de obra (Lookahead) con este mapa, se asegura el flujo de construcción, evitando cuellos de botella y paralizaciones no planificadas por contingencias climáticas.

---

## 🔬 Sustento Técnico y Metodológico

Para garantizar la precisión en estructuras de ingeniería civil, este análisis descarta las variables de "vulnerabilidad social" (pobreza monetaria) y se enfoca exclusivamente en la **Susceptibilidad Física (El Peligro Puro)** del territorio.

### 1. Variables de Análisis Oficiales (CENEPRED / SENAMHI)
*   **Peligro por Inundación (`niv_sinu`):** Probabilidad de empozamiento por lluvias extremas y napa freática superficial.
*   **Peligro por Movimientos en Masa (`npel_mm`):** Probabilidad de flujo de detritos (huaycos) por activación de quebradas.
*   *Fuente:* Informe Técnico N° 69-2026/SENAMHI-DMA-SPC y Estudio de Escenarios de Riesgo (CENEPRED).

### 2. Validación Topográfica (Modelo de Elevación Digital)
El peligro ha sido validado geométricamente mediante un MDE (Ráster):
*   **Cota Cero (Zonas Planas):** Callao y Lima Centro. Validando el alto riesgo de inundación por falta de escorrentía gravitacional.
*   **Altas Pendientes (Estribaciones Andinas):** Ate / Vitarte. Validando el alto riesgo dinámico por huaycos en los conos de deyección.

---

## 🚧 Zonificación de Peligros y Plan de Mitigación

El cruce espacial de las estaciones con los mapas de peligro arroja tres zonas de comportamiento crítico para las líneas 2 y 4:

### 🟢 Zona 1: Llanura Aluvial (Callao - Lima Oeste)
*   **Estructuras:** PV01BIS, L4 (completa), E01 hasta E12.
*   **Diagnóstico:** **Inundación ALTA** | Huaycos BAJO.
*   **Mitigación recomendada (Acción Inmediata):** 
    1. Elevación preventiva de brocales (muretes) en Pozos de Ventilación.
    2. Adquisición y conexión de motobombas de alto caudal.
    3. Gestión de permisos municipales para ocupación temporal de vía con equipos de evacuación hídrica.

### 🟡 Zona 2: Transición (Lima Centro)
*   **Estructuras:** PV12 hasta E19.
*   **Diagnóstico:** **Inundación MEDIO** | Huaycos BAJO.
*   **Mitigación recomendada:** Monitoreo estándar de sumideros y bombeo interno de la estación.

### 🔴 Zona 3: Estribaciones Andinas (Lima Este / Ate)
*   **Estructuras:** E24, E25, E26 (Cruce Prolong. Javier Prado), E27.
*   **Diagnóstico:** **Inundación ALTO** | **Huaycos MUY ALTO**.
*   **Mitigación recomendada (Acción Crítica):** 
    1. Reforzamiento físico de los cerramientos de obra con barreras dinámicas de concreto (New Jersey) y sacos terreros.
    2. Construcción de desvíos de escorrentía superficial para proteger las rejillas y accesos.
    3. Asegurar intangibilidad del frente respecto a la Franja Marginal del Río Rímac (Resoluciones ANA).

---

## 📊 Matriz de Riesgo por Estructura

| ID Estructura | Nivel Peligro: Inundación | Nivel Peligro: Movimiento Masas |
| :--- | :--- | :--- |
| **L4 (E4-01 a E4-08, PVs)** | Alto | Bajo |
| **E01 a E11** | Alto | Bajo |
| **E12 a E19** | Medio | Bajo |
| **E20 a E22** | Alto | Bajo |
| **E23** | Alto | Medio |
| **E24** | Alto | Alto |
| **E25 a E27** | Alto | Muy Alto |

*(Ver tabla completa en el directorio `/documentacion/Matriz_Riesgos_L2L4.csv`)*

---

## 📂 Estructura del Repositorio

*   📁 `datos_vectoriales/`: Contiene los archivos GeoJSON optimizados (Límites, Líneas de Metro, Estaciones, Franja Marginal ANA, Polígonos de Peligro CENEPRED).
*   📁 `datos_raster/`: Contiene el Modelo de Elevación Digital unificado (`Elevacion_LimaCallao.tif`).
*   📁 `documentacion/`: Tablas maestras de datos socioeconómicos y de peligro del Estado Peruano.

---
**Diseño e Ingeniería de Permisos:** Vladimir Casas  
**Software GIS:** RustGIS / QGIS  
**Actualización:** Octubre 2026
