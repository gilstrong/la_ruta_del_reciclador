// mapa.js

// Espera a que el DOM esté cargado
window.addEventListener('DOMContentLoaded', () => {
  // Leer datos de usuario
  const raw = localStorage.getItem('userData');
  if (!raw) {
    alert('No se detectó un usuario válido. Por favor inicia sesión.');
    return window.location.href = '/login';
  }

  const { nombre: nombreUsuario, usuarioId } = JSON.parse(raw);
  if (!usuarioId) {
    alert('Necesitas iniciar sesión primero.');
    return window.location.href = '/login';
  }

  // Inicializar mapa
  const map = L.map('map').setView([18.4861, -69.9312], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  const marcadores = [];

  // Crear marcador y acciones asociadas
  function crearMarcador(lat, lng) {
    const marcador = L.marker([lat, lng]).addTo(map)
      .bindPopup('¡Aquí tengo material para reciclar!');
    marcadores.push(marcador);

    // Guardar ubicación
    fetch(`${window.API_URL}/ubicaciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ usuarioId, latitud: lat, longitud: lng })
    })
      .then(res => res.json())
      .then(res => console.log('Ubicación guardada:', res))
      .catch(err => console.error('Error en /api/ubicaciones:', err));

    // Sumar punto
    fetch(`${window.API_URL}/sumar-punto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ nombre: nombreUsuario })
    })
      .then(res => res.json().then(data => {
        if (res.ok) {
          alert(`¡Punto sumado! Ahora tienes ${data.usuario.puntos} puntos.`);
        } else {
          console.error('Error sumando punto:', data.error);
        }
      }))
      .catch(err => console.error('Error en /api/sumar-punto:', err));

    // Menú contextual para eliminar
    marcador.on('contextmenu', () => {
      if (confirm('¿Eliminar este punto de reciclaje?')) {
        map.removeLayer(marcador);
        marcadores.splice(marcadores.indexOf(marcador), 1);

        fetch(`${window.API_URL}/eliminar-punto`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ lat, lng })
        })
          .then(res => res.json())
          .then(res => console.log('Punto eliminado:', res))
          .catch(err => console.error('Error eliminando punto:', err));
      }
    });
  }

  // Cargar puntos existentes
  function cargarPuntosDeReciclaje() {
    fetch(`${window.API_URL}/ubicaciones`, {
      method: 'GET',
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => {
        console.log('Puntos cargados:', data);
        data.forEach(punto => crearMarcador(punto.lat, punto.lng));
      })
      .catch(err => {
        console.error('Error al cargar puntos:', err);
        document.getElementById('mensajeError').textContent = 'No se pudieron cargar los puntos.';
      });
  }

  // Funciones de ruta (misma lógica que tenías)
  function calcularDistancia(a, b) {
    const dx = a.lat - b.lat;
    const dy = a.lng - b.lng;
    return Math.sqrt(dx * dx + dy * dy);
  }

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

  function mostrarRutaEnMapa(mapa, ruta) {
    const latlngs = ruta.map(p => [p.lat, p.lng]);
    L.polyline(latlngs).addTo(mapa);
    mapa.fitBounds(latlngs);
  }

  // Eventos de botones
  document.getElementById('btnUbicacion').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocalización no soportada');
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      crearMarcador(lat, lng);
      map.setView([lat, lng], 17);
    }, () => alert('No se pudo obtener tu ubicación.'));
  });

  document.getElementById('btnBorrarTodo').addEventListener('click', () => {
    if (!confirm('¿Eliminar TODOS los puntos?')) return;
    marcadores.forEach(m => {
      const { lat, lng } = m.getLatLng();
      map.removeLayer(m);
      fetch(`${window.API_URL}/eliminar-punto`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ lat, lng })
      });
    });
    marcadores.length = 0;
  });

  document.getElementById('btnRuta').addEventListener('click', () => {
    if (marcadores.length === 0) return alert('No hay puntos para la ruta.');
    const puntos = marcadores.map(m => m.getLatLng());
    const ruta = calcularRuta(puntos, puntos[0]);
    mostrarRutaEnMapa(map, ruta);
  });

  // Inicializa carga de puntos
  cargarPuntosDeReciclaje();
});
