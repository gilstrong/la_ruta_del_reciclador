document.getElementById('formLogin').addEventListener('submit', async (e) => {
  e.preventDefault(); // Evitar envío por defecto

  const nombre = document.getElementById('nombreLogin').value.trim();

  if (!nombre) {
    document.getElementById('mensajeErrorLogin').textContent = 'Por favor ingresa un nombre de usuario';
    return;
  }

  try {
    const response = await fetch('https://resourceful-enchantment-production.up.railway.app/api/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',  // Enviar cookies para sesión
      body: JSON.stringify({ nombre }),
    });

    const data = await response.json();
    console.log('Respuesta login:', data);

    if (response.ok) {
      localStorage.setItem('usuario', data.usuario.nombre);
      localStorage.setItem('usuarioId', data.usuario._id);

      alert('Inicio de sesión exitoso');

      // Cambia aquí si es necesario a URL absoluta
      window.location.href = '/perfil';
    } else {
      document.getElementById('mensajeErrorLogin').textContent = data.error || 'Error desconocido';
    }
  } catch (error) {
    console.error('Error al intentar iniciar sesión:', error);
    document.getElementById('mensajeErrorLogin').textContent = 'Hubo un error, por favor intenta nuevamente';
  }
});
