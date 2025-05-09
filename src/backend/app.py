import gradio as gr
import numpy as np
from keras.models import load_model
from PIL import Image, ImageOps

# Cargar el modelo Keras
model = load_model("keras_Model.h5", compile=False)

# Leer las etiquetas
class_names = open("labels.txt", "r").readlines()

def classify_image(img):
    # Redimensionar la imagen a 224x224
    size = (224, 224)
    image = ImageOps.fit(img, size, Image.Resampling.LANCZOS)

    # Normalizar y convertir a array
    image_array = np.asarray(image).astype(np.float32)
    normalized_image_array = (image_array / 127.5) - 1
    data = np.expand_dims(normalized_image_array, axis=0)

    # Hacer la predicción
    prediction = model.predict(data)
    index = np.argmax(prediction)
    class_name = class_names[index].strip()
    confidence_score = prediction[0][index]

    return f"{class_name} ({confidence_score:.2f})"

# Interfaz de Gradio
interface = gr.Interface(fn=classify_image,
                         inputs=gr.Image(type="pil"),
                         outputs="text",
                         title="Clasificador de Residuos")

interface.launch()
