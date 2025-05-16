function guardarUbicacion(usuarioId, latitud, longitud, puntos) {
  // Verificar que todos los datos estén disponibles
  if (!usuarioId || !latitud || !longitud || !puntos) {
    console.error('Faltan datos necesarios para guardar la ubicación');
    return;
  }

  fetch('/api/ubicaciones', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ usuarioId, latitud, longitud, puntos })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Ubicación guardada:', data);
    // Mostrar mensaje de éxito al usuario
    alert('Ubicación guardada exitosamente');
  })
  .catch(error => {
    console.error('Error al guardar la ubicación:', error);
    // Mostrar mensaje de error al usuario
    alert('Hubo un error al guardar la ubicación, por favor intenta nuevamente');
  });
}

// Ejemplo de uso (asegurándose de que los datos estén disponibles):
const usuarioId = localStorage.getItem('usuarioId'); // Obtener el usuarioId del localStorage

// Verificar si usuarioId está disponible antes de continuar
if (!usuarioId) {
  alert('No se encontró el usuario. Por favor, inicia sesión');
  return;
}

const latitud = 40.7128; // Obtener la latitud del mapa
const longitud = -74.0060; // Obtener la longitud del mapa
const puntos = 10; // Obtener los puntos del usuario (puedes obtenerlo de algún lugar o calcularlo)

guardarUbicacion(usuarioId, latitud, longitud, puntos);
