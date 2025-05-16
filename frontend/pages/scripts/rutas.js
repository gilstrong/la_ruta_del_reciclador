// rutas.js

// Variables globales
let map;
let marcadores = [];
let routingControl;

// Ejecutar al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  inicializarMapa();
  mostrarNombreUsuario();
  cargarUbicacionesYRuta();
  configurarBotones();
});

function inicializarMapa() {
  map = L.map('map').setView([18.4801, -69.9395], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);
  L.control.scale({ imperial: false }).addTo(map);
}

function mostrarNombreUsuario() {
  // window.USUARIO se inyecta desde el backend
  const nombre = window.USUARIO || '';
  const el = document.getElementById('nombreUsuario');
  if (el && nombre) {
    el.textContent = `Bienvenido, ${nombre}`;
  }
}

async function cargarUbicacionesYRuta() {
  try {
    const res = await fetch('/api/ubicaciones', { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Filtrar únicamente entradas con latitud y longitud numéricas
    const validas = data.filter(p => typeof p.lat === 'number' && typeof p.lng === 'number');

    // Limpiar marcadores previos del array (pero no del mapa aún)
    marcadores = [];

    // Añadir marcadores y poblar el array
    validas.forEach(p => {
      L.marker([p.lat, p.lng])
        .addTo(map)
        .bindPopup(`Punto de ${p.usuario?.nombre || 'anónimo'}`);
      marcadores.push(L.latLng(p.lat, p.lng));
    });

    if (marcadores.length === 0) {
      console.warn('No hay puntos guardados.');
      return;
    }

    // Ajustar vista para ver todos los marcadores
    const group = L.featureGroup(marcadores.map(ll => L.marker(ll)));
    map.fitBounds(group.getBounds(), { padding: [50, 50] });

    // Dibujar ruta óptima
    dibujarRutaOptima();
  } catch (err) {
    console.error('Error al cargar ubicaciones o trazar ruta:', err);
  }
}

function dibujarRutaOptima() {
  if (routingControl) {
    map.removeControl(routingControl);
    routingControl = null;
  }

  if (marcadores.length < 2) return;

  routingControl = L.Routing.control({
    waypoints: marcadores,
    router: L.Routing.osrmv1({
      serviceUrl: 'https://router.project-osrm.org/route/v1'
    }),
    createMarker: () => null,      // No queremos marcadores adicionales
    addWaypoints: false,           // No permitir arrastrar waypoints
    fitSelectedRoutes: false,      // No recenter automático al seleccionar ruta
    lineOptions: {
      styles: [{ color: 'blue', weight: 5, opacity: 0.8 }]
    }
  }).addTo(map);
}

function configurarBotones() {
  // Botón "Usar mi ubicación"
  const btnUbic = document.getElementById('btnUbicacion');
  if (btnUbic) {
    btnUbic.addEventListener('click', () => {
      if (!navigator.geolocation) {
        return alert('Geolocalización no soportada');
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          const usuarioLL = L.latLng(pos.coords.latitude, pos.coords.longitude);
          // Añadimos al inicio para que sea primer waypoint
          marcadores.unshift(usuarioLL);
          // Re-dibujar ruta
          cargarUbicacionesYRuta();
        },
        () => alert('No se pudo obtener tu ubicación')
      );
    });
  }

  // Botón "Borrar todos los puntos"
  const btnBorrar = document.getElementById('btnBorrarTodo');
  if (btnBorrar) {
    btnBorrar.addEventListener('click', async () => {
      if (!confirm('¿Eliminar TODOS los puntos?')) return;
      try {
        // Eliminar en servidor uno a uno
        for (let ll of marcadores) {
          await fetch('/api/eliminar-punto', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: ll.lat, lng: ll.lng })
          });
        }
        // Limpiar cliente
        marcadores = [];
        if (routingControl) {
          map.removeControl(routingControl);
          routingControl = null;
        }
        map.eachLayer(layer => {
          if (layer instanceof L.Marker || layer instanceof L.Polyline) {
            map.removeLayer(layer);
          }
        });
      } catch (e) {
        console.error('Error al borrar puntos:', e);
      }
    });
  }
}
