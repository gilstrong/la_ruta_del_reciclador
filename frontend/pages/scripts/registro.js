document.getElementById('registroForm').addEventListener('submit', async function(event) {
  event.preventDefault();

  const nombre = document.getElementById('nombre').value;

  if (!nombre) {
    alert('Por favor ingresa un nombre.');
    return;
  }

  try {
    const response = await fetch('/api/registrar-usuario', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nombre }),
    });

    const data = await response.json();

    if (response.ok) {
      localStorage.setItem("usuario", nombre); // ✅ Guardar en localStorage
      window.location.href = `/perfil?nombre=${nombre}`; // 🔁 Redirigir al perfil
    }
    } else {
      alert(data.error || 'Hubo un error al registrar el usuario. Intenta nuevamente.');
    }
  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    alert('Hubo un error al registrar el usuario. Intenta nuevamente.');
  }
});
