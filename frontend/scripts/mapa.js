// Configuración inicial
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api' 
  : 'https://tu-backend-deploy.com/api';

// Elementos del DOM
const mapElement = document.getElementById('map');
const pointsCounter = document.getElementById('points-counter');
const userStatus = document.getElementById('user-status');
const btnUbicacion = document.getElementById('btn-ubicacion');
const btnBorrarTodo = document.getElementById('btn-borrar-todo');
const btnRuta = document.getElementById('btn-ruta');

// Variables de estado
let currentMap = null;
let currentMarkers = [];
let currentUser = null;
let userLocation = null;

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  await checkUserSession();
  initMap();
  loadRecyclingPoints();
  setupEventListeners();
});

// Verificar sesión de usuario
async function checkUserSession() {
  try {
    const response = await fetch(`${API_BASE_URL}/usuario-logueado`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      currentUser = data.usuario;
      updateUserStatus(currentUser.nombre);
    } else {
      showNotification('Debes iniciar sesión para marcar puntos', 'error');
      redirectToLogin();
    }
  } catch (error) {
    console.error('Error verificando sesión:', error);
    showNotification('Error al verificar sesión', 'error');
  }
}

// Inicializar mapa Leaflet
function initMap() {
  currentMap = L.map(mapElement).setView([18.4861, -69.9312], 16);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(currentMap);
  
  // Evento para agregar marcadores al hacer clic
  currentMap.on('click', async (e) => {
    if (!currentUser) {
      showNotification('Debes iniciar sesión para marcar puntos', 'error');
      return;
    }
    
    const { lat, lng } = e.latlng;
    await addRecyclingPoint(lat, lng);
  });
}

// Cargar puntos existentes desde la API
async function loadRecyclingPoints() {
  try {
    const response = await fetch(`${API_BASE_URL}/ubicaciones`, {
      credentials: 'include'
    });
    
    if (response.ok) {
      const points = await response.json();
      points.forEach(point => {
        addMarkerToMap(point.lat, point.lng, point.usuario, false);
      });
    }
  } catch (error) {
    console.error('Error cargando puntos:', error);
    showNotification('Error al cargar puntos de reciclaje', 'error');
  }
}

// Agregar un nuevo punto de reciclaje
async function addRecyclingPoint(lat, lng) {
  try {
    // Guardar ubicación en la base de datos
    const saveResponse = await fetch(`${API_BASE_URL}/puntos`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        usuarioId: currentUser._id,
        latitud: lat,
        longitud: lng
      })
    });
    
    if (!saveResponse.ok) {
      throw new Error('Error al guardar ubicación');
    }
    
    // Sumar punto al usuario
    const pointsResponse = await fetch(`${API_BASE_URL}/sumar-punto`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        nombre: currentUser.nombre
      })
    });
    
    if (pointsResponse.ok) {
      const data = await pointsResponse.json();
      updateUserPoints(data.usuario.puntos);
      addMarkerToMap(lat, lng, currentUser.nombre, true);
      showNotification('¡Punto agregado y sumado a tu cuenta!');
    } else {
      throw new Error('Error al sumar punto');
    }
  } catch (error) {
    console.error('Error:', error);
    showNotification('Error al agregar punto', 'error');
  }
}

// Agregar marcador al mapa
function addMarkerToMap(lat, lng, userName, isNew = true) {
  const marker = L.marker([lat, lng], {
    icon: L.icon({
      iconUrl: 'images/recycle-marker.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32]
    })
  }).addTo(currentMap);
  
  marker.bindPopup(`
    <b>Punto de reciclaje</b>
    <p>Usuario: ${userName}</p>
    <small>${new Date().toLocaleString()}</small>
  `);
  
  if (isNew) {
    marker.openPopup();
    currentMarkers.push(marker);
  }
  
  // Eliminar marcador con clic derecho
  marker.on('contextmenu', async () => {
    if (confirm('¿Eliminar este punto de reciclaje?')) {
      try {
        const response = await fetch(`${API_BASE_URL}/eliminar-punto`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ lat, lng })
        });
        
        if (response.ok) {
          currentMap.removeLayer(marker);
          currentMarkers = currentMarkers.filter(m => m !== marker);
          showNotification('Punto eliminado correctamente');
        } else {
          throw new Error('Error al eliminar punto');
        }
      } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar punto', 'error');
      }
    }
  });
}

// Configurar event listeners
function setupEventListeners() {
  // Botón de ubicación actual
  btnUbicacion?.addEventListener('click', () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          userLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          currentMap.setView([userLocation.lat, userLocation.lng], 17);
          showNotification('Ubicación actual establecida');
        },
        error => {
          console.error('Error obteniendo ubicación:', error);
          showNotification('No se pudo obtener tu ubicación', 'error');
        }
      );
    } else {
      showNotification('Tu navegador no soporta geolocalización', 'error');
    }
  });
  
  // Botón para borrar todos los puntos
  btnBorrarTodo?.addEventListener('click', async () => {
    if (confirm('¿Eliminar TODOS tus puntos de reciclaje?')) {
      try {
        // Nota: Esto deberías implementarlo en tu backend
        const response = await fetch(`${API_BASE_URL}/eliminar-puntos-usuario`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ usuarioId: currentUser._id })
        });
        
        if (response.ok) {
          currentMarkers.forEach(marker => currentMap.removeLayer(marker));
          currentMarkers = [];
          showNotification('Todos tus puntos han sido eliminados');
        } else {
          throw new Error('Error al eliminar puntos');
        }
      } catch (error) {
        console.error('Error:', error);
        showNotification('Error al eliminar puntos', 'error');
      }
    }
  });
  
  // Botón para calcular ruta
  btnRuta?.addEventListener('click', () => {
    if (!userLocation) {
      showNotification('Primero establece tu ubicación actual', 'error');
      return;
    }
    
    if (currentMarkers.length === 0) {
      showNotification('No hay puntos de reciclaje para calcular ruta', 'error');
      return;
    }
    
    calculateOptimalRoute();
  });
}

// Calcular ruta óptima
function calculateOptimalRoute() {
  const points = currentMarkers.map(marker => marker.getLatLng());
  const route = findShortestRoute(userLocation, points);
  drawRouteOnMap(route);
}

// Algoritmo para encontrar la ruta más corta (aproximación)
function findShortestRoute(start, points) {
  const remainingPoints = [...points];
  const route = [];
  let currentPoint = start;
  
  while (remainingPoints.length > 0) {
    // Encontrar el punto más cercano
    let closestIndex = 0;
    let closestDistance = calculateDistance(currentPoint, remainingPoints[0]);
    
    for (let i = 1; i < remainingPoints.length; i++) {
      const distance = calculateDistance(currentPoint, remainingPoints[i]);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      }
    }
    
    // Agregar a la ruta
    route.push(remainingPoints[closestIndex]);
    currentPoint = remainingPoints[closestIndex];
    remainingPoints.splice(closestIndex, 1);
  }
  
  return route;
}

// Calcular distancia entre dos puntos (fórmula de Haversine)
function calculateDistance(point1, point2) {
  const R = 6371e3; // Radio de la Tierra en metros
  const φ1 = point1.lat * Math.PI/180;
  const φ2 = point2.lat * Math.PI/180;
  const Δφ = (point2.lat - point1.lat) * Math.PI/180;
  const Δλ = (point2.lng - point1.lng) * Math.PI/180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

// Dibujar ruta en el mapa
function drawRouteOnMap(routePoints) {
  // Limpiar ruta anterior si existe
  if (window.currentRoute) {
    currentMap.removeLayer(window.currentRoute);
  }
  
  const routeLatLngs = [
    [userLocation.lat, userLocation.lng],
    ...routePoints.map(p => [p.lat, p.lng])
  ];
  
  window.currentRoute = L.polyline(routeLatLngs, {
    color: '#2ecc71',
    weight: 5,
    opacity: 0.7,
    dashArray: '10, 10'
  }).addTo(currentMap);
  
  currentMap.fitBounds(routeLatLngs);
  showNotification('Ruta óptima calculada');
}

// Actualizar UI con información del usuario
function updateUserStatus(userName) {
  if (userStatus) {
    userStatus.textContent = `Usuario: ${userName}`;
  }
}

function updateUserPoints(points) {
  if (pointsCounter) {
    pointsCounter.textContent = `Puntos: ${points}`;
  }
}

// Mostrar notificaciones
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Redireccionar a login
function redirectToLogin() {
  window.location.href = '/login';
}
