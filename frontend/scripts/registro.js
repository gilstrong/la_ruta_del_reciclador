document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registroForm');
  const nombreInput = document.getElementById('nombre');
  
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
  
    const nombre = nombreInput.value.trim();
    if (!nombre) {
      alert('Por favor ingresa un nombre.');
      return;
    }
  
    // Configuración de la URL de la API
   
    const API_BASE = window.API_URL || 'resourceful-enchantment-production.up.railway.app';
  
    try {
      console.log(`Enviando petición a: ${API_BASE}/registrar-usuario`);
      
      const response = await fetch(`${API_BASE}/registrar-usuario`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        credentials: 'include', 
        body: JSON.stringify({ nombre })
      });
  
      console.log('Status de respuesta:', response.status);
      
      // Verificar si la respuesta es JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Respuesta no es JSON válido. Content-Type: ${contentType}`);
      }
  
      const data = await response.json();
      console.log('Datos recibidos:', data);
  
      if (response.ok) {
        // Guardar en localStorage y redirigir
        localStorage.setItem("usuario", nombre);
        localStorage.setItem("usuarioId", data.usuario?._id || data.id || '');
        
        alert('¡Usuario registrado exitosamente!');
        window.location.href = `/perfil?nombre=${encodeURIComponent(nombre)}`;
      } else {
        // Mostrar error específico del servidor
        const errorMessage = data.error || data.message || 'Hubo un error al registrar el usuario.';
        alert(errorMessage);
        console.error('Error del servidor:', data);
      }
    } catch (error) {
      console.error('Error completo:', error);
      
      // Mensajes de error más específicos
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        alert('Error de conexión: No se puede conectar al servidor. Verifica tu conexión a internet.');
      } else if (error.message.includes('JSON')) {
        alert('Error del servidor: Respuesta inválida. El servidor puede estar caído.');
      } else {
        alert('Hubo un error inesperado. Intenta nuevamente en unos minutos.');
      }
    }
  });
});
