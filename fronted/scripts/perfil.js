document.addEventListener('DOMContentLoaded', async () => {
  // Obtener el nombre desde localStorage
  const nombre = localStorage.getItem('usuario');

  if (!nombre) {
    alert('Usuario no encontrado. Por favor inicia sesión.');
    window.location.href = '/login'; // Redirige si no hay usuario
    return;
  }

  try {
    // Llama a la API con el nombre almacenado
    const respuesta = await fetch(`/api/perfil/${nombre.toLowerCase()}`);
    const datos = await respuesta.json();

    if (datos.error) {
      alert('No se pudo cargar el perfil: ' + datos.error);
      return;
    }

    // Actualiza el DOM con los datos del usuario
    document.getElementById('nombreUsuario').textContent = datos.nombre;
    document.getElementById('puntosUsuario').textContent = datos.puntos;

    // Cargar foto desde localStorage
    const fotoPerfil = localStorage.getItem(`fotoPerfil-${nombre.toLowerCase()}`);
    const fotoElement = document.querySelector('.perfil-foto img');

    if (fotoPerfil) {
      fotoElement.src = fotoPerfil; // Si hay foto, mostrarla
    }

  } catch (error) {
    console.error('Error al cargar perfil:', error);
    alert('Error al conectar con el servidor.');
  }
});

// Función para actualizar la foto de perfil
function actualizarFotoPerfil(event) {
  const nombre = localStorage.getItem('usuario'); // Obtener el nombre del usuario actual
  const archivo = event.target.files[0];
  
  if (archivo && nombre) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      const fotoDataUrl = e.target.result;
      localStorage.setItem(`fotoPerfil-${nombre.toLowerCase()}`, fotoDataUrl); // Guardar foto en localStorage
      document.querySelector('.perfil-foto img').src = fotoDataUrl; // Mostrar la foto en el DOM
    };

    reader.readAsDataURL(archivo);
  } else {
    alert("Por favor selecciona una foto.");
  }
}

// Agregar el evento para el input de foto
const inputFoto = document.querySelector('#fotoPerfilInput');
inputFoto.addEventListener('change', actualizarFotoPerfil);
