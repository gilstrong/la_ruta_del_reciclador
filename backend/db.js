// --- db.js ---
const mongoose = require('mongoose');

const connectDB = async (uri) => {
  try {
    if (!uri) throw new Error('MONGO_URI no está definida');
    
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      bufferCommands: false // Desactiva el buffering
    });

    console.log('✅ MongoDB conectado');
    
    // Manejo de eventos de conexión
    mongoose.connection.on('error', err => {
      console.error('❌ Error de MongoDB:', err);
    });

    return mongoose.connection;
  } catch (err) {
    console.error('❌ Error al conectar a MongoDB:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
