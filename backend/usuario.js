const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { 
    type: String, 
    required: [true, 'El nombre de usuario es obligatorio'],
    unique: true,
    trim: true,
    lowercase: true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
    maxlength: [30, 'El nombre no puede exceder los 30 caracteres'],
    match: [/^[a-zA-Z0-9_]+$/, 'Solo se permiten letras, números y guiones bajos']
  },
  puntos: { 
    type: Number, 
    default: 0,
    min: [0, 'Los puntos no pueden ser negativos']
  },
  fechaRegistro: {
    type: Date,
    default: Date.now
  },
  ultimaConexion: {
    type: Date,
    default: Date.now
  },
  nivel: {
    type: String,
    enum: ['principiante', 'intermedio', 'avanzado', 'experto'],
    default: 'principiante'
  },
  logros: [{
    nombre: String,
    fecha: Date,
    puntosOtorgados: Number
  }],
  ubicacionesRegistradas: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Punto'
  }]
}, {
  timestamps: true, // Añade createdAt y updatedAt automáticamente
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Índices para mejorar el rendimiento de búsquedas
usuarioSchema.index({ nombre: 1 }); // Índice único ya está por la propiedad unique
usuarioSchema.index({ puntos: -1 }); // Para ranking de usuarios
usuarioSchema.index({ 'logros.nombre': 1 }); // Para búsqueda de logros

// Middleware pre-save para normalizar el nombre
usuarioSchema.pre('save', function(next) {
  if (this.isModified('nombre')) {
    this.nombre = this.nombre.trim().toLowerCase();
  }
  next();
});

// Método para sumar puntos
usuarioSchema.methods.sumarPuntos = async function(cantidad = 1, razon = '') {
  this.puntos += cantidad;
  
  if (razon) {
    this.logros.push({
      nombre: razon,
      fecha: new Date(),
      puntosOtorgados: cantidad
    });
  }
  
  // Actualiza el nivel según los puntos
  if (this.puntos >= 1000) this.nivel = 'experto';
  else if (this.puntos >= 500) this.nivel = 'avanzado';
  else if (this.puntos >= 100) this.nivel = 'intermedio';
  
  return this.save();
};

// Método para registrar una nueva ubicación
usuarioSchema.methods.registrarUbicacion = async function(puntoId) {
  if (!this.ubicacionesRegistradas.includes(puntoId)) {
    this.ubicacionesRegistradas.push(puntoId);
    await this.save();
  }
  return this;
};

// Virtual para el ranking (ejemplo)
usuarioSchema.virtual('ranking').get(function() {
  if (this.puntos >= 1000) return 'top';
  if (this.puntos >= 500) return 'medio';
  return 'base';
});

// Middleware para actualizar última conexión
usuarioSchema.methods.actualizarUltimaConexion = async function() {
  this.ultimaConexion = new Date();
  return this.save();
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;
