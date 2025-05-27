const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, unique: true },
  puntos: { type: Number, default: 0 }
});

module.exports = mongoose.model('Usuario', usuarioSchema);

