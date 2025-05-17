// --- db.js ---
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error);
    throw error;
  }
};

module.exports = connectDB;
