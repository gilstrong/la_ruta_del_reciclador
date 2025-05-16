const imagenInput = document.getElementById('imagenInput');
const imagenEntrada = document.getElementById('imagenEntrada');
const mensajeDiv = document.getElementById('mensaje');
const probarTensorflowBtn = document.getElementById('probarTensorflow');

let model;

// Cargar modelo desde la ruta pública
async function cargarModelo() {
    try {
        const modelo = await tmImage.load('/model/model.json');
        if (!modelo) {
            throw new Error('El modelo no se cargó correctamente');
        }
        // Inicializar el modelo o realizar operaciones adicionales
        console.log('Modelo cargado con éxito');
    } catch (error) {
        console.error('Error al cargar el modelo:', error);
    }

        console.log('Modelo cargado con éxito');
        mensajeDiv.textContent = 'Modelo cargado con éxito. Ahora puedes procesar imágenes.';
        mensajeDiv.className = 'exito';
        probarTensorflowBtn.style.display = 'inline-block'; // Mostrar el botón después de cargar el modelo


async function realizarPrediccion() {
    if (!model) {
        mensajeDiv.textContent = '❌ El modelo no está cargado aún.';
        mensajeDiv.className = 'error';
        return;
    }

    if (!imagenEntrada.src) {
        mensajeDiv.textContent = '❌ No se ha cargado una imagen.';
        mensajeDiv.className = 'error';
        return;
    }

    mensajeDiv.textContent = 'Procesando imagen...';
    mensajeDiv.className = ''; // Reiniciar el mensaje

    try {
        // Realizar la predicción con la imagen cargada
        const prediction = await model.predict(imagenEntrada);
        const top = prediction.reduce((a, b) => (a.probability > b.probability ? a : b));
        mensajeDiv.textContent = `🔍 Objeto reconocido: ${top.className}`;
        mensajeDiv.className = 'exito'; // Mostrar el resultado como éxito
    } catch (err) {
        console.error('Error al procesar la imagen:', err);
        mensajeDiv.textContent = '❌ Error al procesar la imagen.';
        mensajeDiv.className = 'error';
    }
}

imagenInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagenEntrada.src = e.target.result;
            imagenEntrada.style.display = 'block';
            probarTensorflowBtn.style.display = 'inline-block';
            mensajeDiv.textContent = 'Imagen cargada. Haz clic en "Procesar Imagen".';
            mensajeDiv.className = '';
        };
        reader.readAsDataURL(file);
    }
});

probarTensorflowBtn.addEventListener('click', realizarPrediccion);

// Cargar el modelo al iniciar la página
cargarModelo();
