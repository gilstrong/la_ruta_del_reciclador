const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    
    if (!uri) {
      throw new Error('❌ La variable MONGO_URI no está definida. Verifica tu configuración en Railway.');
    }

    const conn = await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 segundos de espera
      maxPoolSize: 10 // Conexiones máximas
    });

    console.log(`✅ MongoDB Conectado: ${conn.connection.host}`.cyan.underline);
    
    // Manejo de eventos de conexión
    mongoose.connection.on('error', (err) => {
      console.error(`❌ Error de MongoDB: ${err.message}`.red.bold);
    });

  } catch (error) {
    console.error(`❌ Error al conectar: ${error.message}`.red.bold);
    process.exit(1);
  }
};

module.exports = connectDB;
