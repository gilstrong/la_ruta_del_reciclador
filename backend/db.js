const mongoose = require('mongoose');

// Conectar a MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect('tu_cadena_de_conexion_a_mongo', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Conectado a MongoDB');
  } catch (error) {
    console.error('Error al conectar a MongoDB:', error);
    process.exit(1); // Detiene la aplicación si no se puede conectar a la base de datos
  }
};

module.exports = connectDB;
