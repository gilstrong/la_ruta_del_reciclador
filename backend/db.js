// --- db.js ---
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      throw new Error('La variable de entorno MONGO_URI no está definida.');
    }

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✅ Conexión a MongoDB establecida exitosamente.');
  } catch (error) {
    console.error('❌ Error al conectar con MongoDB:', error.message);
    process.exit(1); // Finaliza el proceso si la conexión falla
  }
};

module.exports = connectDB;
