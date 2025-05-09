const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');
const path = require('path');

// Ruta al modelo
const modelPath = path.join(__dirname, 'models', 'teachable', 'model.json');

// Ruta a la imagen
const imagePath = path.join('C:', 'Users', 'jaime', 'Downloads', 'bike.png');

async function loadImage(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const tfimage = tf.node.decodeImage(imageBuffer);
  const resized = tf.image.resizeBilinear(tfimage, [224, 224]); // Tamaño típico de Teachable Machine
  const expanded = resized.expandDims(0);
  return expanded;
}

async function run() {
  try {
    const model = await tf.loadLayersModel(`file://${modelPath}`);
    console.log('✅ Modelo cargado correctamente');

    const inputImage = await loadImage(imagePath);
    const prediction = model.predict(inputImage);
    const predictionData = await prediction.data();

    console.log('📊 Resultados de la predicción:', predictionData);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

run();
