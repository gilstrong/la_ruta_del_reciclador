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
  
    // API_URL debe haberse definido en el HTML antes de este script
    const API_BASE = window.API_URL || 'http://localhost:3000/api';
  
    try {
      const response = await fetch(`${API_BASE}/registrar-usuario`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', 
        body: JSON.stringify({ nombre })
      });
  
      const data = await response.json();
  
      if (response.ok) {
        // Guardar en localStorage y redirigir
        localStorage.setItem("usuario", nombre);
        localStorage.setItem("usuarioId", data.usuario?._id || '');
        window.location.href = `/perfil?nombre=${encodeURIComponent(nombre)}`;
      } else {
        alert(data.error || 'Hubo un error al registrar el usuario. Intenta nuevamente.');
      }
    } catch (error) {
      console.error('Error al registrar el usuario:', error);
      alert('Hubo un error de conexión. Intenta nuevamente.');
    }
  });
});
