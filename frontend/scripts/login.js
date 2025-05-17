<script>
document.addEventListener('DOMContentLoaded', () => {
  const formLogin = document.getElementById('formLogin');
  const mensajeError = document.getElementById('mensajeErrorLogin');

  const isLocal = window.location.hostname.includes('localhost');
  const API_URL = isLocal
    ? 'http://localhost:3000/api'
    : 'https://resourceful-enchantment-production.up.railway.app/api';

  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita envío por defecto

    const nombre = document.getElementById('nombreLogin').value.trim();

    if (!nombre) {
      mensajeError.textContent = 'Por favor ingresa un nombre de usuario';
      return;
    }

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nombre }),
        credentials: 'include', // Para incluir cookies de sesión
      });

      const data = await response.json();

      if (response.ok) {
        // Guardamos datos del usuario en localStorage
        localStorage.setItem('usuario', data.usuario.nombre);
        localStorage.setItem('usuarioId', data.usuario._id);

        alert('Inicio de sesión exitoso');
        window.location.href = '/perfil';
      } else {
        mensajeError.textContent = data.error || 'Usuario no encontrado';
      }
    } catch (error) {
      console.error('Error al intentar iniciar sesión:', error);
      mensajeError.textContent = 'Error de conexión. Intenta nuevamente.';
    }
  });
});
</script>
