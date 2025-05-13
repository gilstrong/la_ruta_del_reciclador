const mongoose = require('mongoose');

const puntoSchema = new mongoose.Schema({
  lat: { 
    type: Number, 
    required: true 
  },
  lng: { 
    type: Number, 
    required: true 
  },
  nombre: { 
    type: String, 
    default: "Punto de reciclaje" 
  },
  usuario: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Usuario' 
  },
  fechaCreacion: { 
    type: Date, 
    default: Date.now 
  }
}, { 
  collection: 'puntos', // Nombre exacto de la colección
  versionKey: false // Elimina el campo __v
});

// Índice para búsquedas por ubicación
puntoSchema.index({ lat: 1, lng: 1 });

module.exports = mongoose.model('Punto', puntoSchema);