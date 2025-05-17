// Obtener nombre de usuario desde la URL y guardarlo en localStorage
const params = new URLSearchParams(window.location.search);
const nombreDesdeUrl = params.get('nombre');
if (nombreDesdeUrl) {
  localStorage.setItem("usuario", nombreDesdeUrl);
}

// Recuperar nombre desde localStorage
const nombreUsuario = localStorage.getItem("usuario");
if (!nombreUsuario) {
  alert("No se detectó un usuario válido. Por favor vuelve a iniciar sesión.");
}

// Obtener usuarioId del localStorage (debe haberse guardado en el login)
const usuarioId = localStorage.getItem("usuarioId");

// Inicializar mapa en Villa Juana
const map = L.map('map').setView([18.4861, -69.9312], 16);

// Cargar capa base de OpenStreetMap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Lista de marcadores actuales en el mapa
const marcadores = [];

// Crear un nuevo marcador con funcionalidad de suma y eliminación
function crearMarcador(lat, lng) {
  const marcador = L.marker([lat, lng]).addTo(map)
    .bindPopup('¡Aquí tengo material para reciclar!');
  marcadores.push(marcador);

  // Guardar ubicación usando la API visible
  if (usuarioId) {
    guardarUbicacion(usuarioId, lat, lng, 1);
  } else {
    console.error('No se encontró el usuarioId en localStorage');
  }

  if (nombreUsuario) {
    sumarPunto(nombreUsuario);
  }

  marcador.on('contextmenu', () => {
    if (confirm('¿Seguro que quieres eliminar este punto de reciclaje?')) {
      map.removeLayer(marcador);
      const index = marcadores.indexOf(marcador);
      if (index > -1) {
        marcadores.splice(index, 1);
      }
      eliminarUbicacion(lat, lng);
    }
  });
}

// Guardar ubicación en el backend
function guardarUbicacion(usuarioId, latitud, longitud, puntos) {
  const data = { usuarioId, latitud, longitud, puntos };
  console.log('POST /api/ubicaciones', data);

  fetch(`${window.API_URL}/ubicaciones`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
  .then(response => response.json())
  .then(res => console.log('Respuesta de /api/ubicaciones:', res))
  .catch(error => console.error('Error en /api/ubicaciones:', error));
}

// Eliminar ubicación del backend
function eliminarUbicacion(lat, lng) {
  const data = { lat, lng };
  console.log('DELETE /api/eliminar-punto', data);

  fetch(`${window.API_URL}/eliminar-punto`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(response => console.log('Respuesta de eliminación:', response))
  .catch(error => console.error('Error al eliminar ubicación:', error));
}

// Cargar puntos desde la API
function cargarPuntosDeReciclaje() {
  fetch(`${window.API_URL}/puntos`, {
    method: 'GET',
    credentials: 'include'
  })
  .then(res => res.json())
  .then(data => {
    console.log('Puntos cargados:', data);
    data.forEach(punto => {
      L.marker([punto.lat, punto.lng]).addTo(map)
        .bindPopup(`Punto de Reciclaje: ${punto.nombre}`)
        .openPopup();
    });
  })
  .catch(err => console.error('Error al cargar puntos:', err));
}

// Sumar un punto al usuario
async function sumarPunto(nombre) {
  console.log('POST /sumar-punto', { nombre });

  try {
    const response = await fetch(`${window.API_URL.replace('/api', '')}/sumar-punto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre })
    });

    const data = await response.json();

    if (response.ok) {
      console.log('Punto sumado:', data);
      alert(`¡Punto sumado! Ahora tienes ${data.usuario.puntos} puntos.`);
    } else {
      console.error('Error al sumar punto:', data.error);
    }
  } catch (error) {
    console.error('Error al sumar el punto:', error);
  }
}

// Al cargar la página
window.onload = cargarPuntosDeReciclaje;

// Agregar punto al hacer clic en el mapa
map.on('click', e => {
  const { lat, lng } = e.latlng;
  crearMarcador(lat, lng);
});

// Usar ubicación actual
let ubicacionActual = null;
document.getElementById('btnUbicacion').addEventListener('click', () => {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        ubicacionActual = { lat, lng };
        crearMarcador(lat, lng);
        map.setView([lat, lng], 17);
      },
      () => alert('No se pudo obtener tu ubicación.')
    );
  } else {
    alert('Tu navegador no soporta geolocalización.');
  }
});

// Eliminar todos los marcadores
document.getElementById('btnBorrarTodo').addEventListener('click', () => {
  if (confirm('¿Seguro que quieres eliminar TODOS los puntos de reciclaje?')) {
    marcadores.forEach(marcador => {
      const { lat, lng } = marcador.getLatLng();
      eliminarUbicacion(lat, lng);
      map.removeLayer(marcador);
    });
    marcadores.length = 0;
  }
});

// Generar ruta optimizada
document.getElementById('btnRuta').addEventListener('click', () => {
  if (!ubicacionActual) {
    alert('Debes activar tu ubicación actual primero.');
    return;
  }

  const puntos = marcadores.map(m => m.getLatLng());

  if (puntos.length === 0) {
    alert('No hay puntos de reciclaje para generar una ruta.');
    return;
  }

  const ruta = calcularRuta(puntos, ubicacionActual);
  mostrarRutaEnMapa(map, ruta);
});

// Calcular distancia
function calcularDistancia(a, b) {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.sqrt(dx * dx + dy * dy);
}

// Ruta ordenada por cercanía
function calcularRuta(puntos, ubicacionInicial) {
  const ruta = [];
  const restantes = [...puntos];
  let actual = ubicacionInicial;

  while (restantes.length > 0) {
    restantes.sort((a, b) => calcularDistancia(actual, a) - calcularDistancia(actual, b));
    const siguiente = restantes.shift();
    ruta.push(siguiente);
    actual = siguiente;
  }

  return ruta;
}

// Dibujar ruta en el mapa
function mostrarRutaEnMapa(mapa, ruta) {
  const latlngs = ruta.map(p => [p.lat, p.lng]);
  L.polyline(latlngs, { color: 'blue' }).addTo(mapa);
  mapa.fitBounds(latlngs);
}
