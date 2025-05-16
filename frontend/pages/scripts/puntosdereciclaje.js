// models/PuntoReciclaje.js
const mongoose = require('mongoose');

// Definir el esquema para los puntos de reciclaje
const puntoReciclajeSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  lat: { type: Number, required: true },
  lng: { type: Number, required: true },
  direccion: String,
  tipo: String
});

const PuntoReciclaje = mongoose.model('PuntoReciclaje', puntoReciclajeSchema);

module.exports = PuntoReciclaje;
