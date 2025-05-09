import gradio as gr
from tensorflow.keras.models import model_from_json
import numpy as np
from tensorflow.keras.preprocessing import image

# Cargar la arquitectura del modelo desde el archivo JSON
with open('model.json', 'r') as json_file:
    model_json = json_file.read()

model = model_from_json(model_json)

# Cargar los pesos desde el archivo binario
model.load_weights('weights.bin')

# Define la función de predicción
def classify_residue(img):
    # Redimensiona la imagen a las dimensiones de entrada del modelo
    img = img.resize((180, 180))  # Ajusta las dimensiones según las de tu modelo
    img_array = np.array(img)
    img_array = np.expand_dims(img_array, axis=0)  # Añadimos una dimensión para el batch
    img_array = img_array / 255.0  # Normalizamos si es necesario

    # Predicción
    predictions = model.predict(img_array)
    predicted_class = np.argmax(predictions, axis=1)

    # Nombres de las clases (ajusta según las clases que tengas)
    class_names = ['metal', 'orgánico', 'papel', 'plástico', 'vidrio']  # Reemplaza según tu conjunto de datos
    return class_names[predicted_class[0]]

# Crea la interfaz con Gradio
interface = gr.Interface(fn=classify_residue, 
                         inputs=gr.Image(type="pil"),  # Entrada: imagen
                         outputs="text")  # Salida: texto (nombre de la clase)

# Lanza la interfaz
interface.launch()
