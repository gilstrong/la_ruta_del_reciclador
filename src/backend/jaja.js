const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const Usuario = require('./models/Usuario');
const Punto = require('./models/punto');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
  secret: 'mi_clave_secreta',
  resave: false,
  saveUninitialized: true
}));

// Conexión a MongoDB (ajustado a rucRecicloder)
mongoose.connect('mongodb://127.0.0.1:27017/rucRecicloder', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('✅ Conectado a MongoDB'))
.catch(err => console.error('❌ Error conectando a MongoDB:', err));

// Archivos estáticos
app.use('/styles', express.static(path.join(__dirname, '..', 'styles')));
app.use('/scripts', express.static(path.join(__dirname, '..', '..', 'public', 'scripts')));
app.use('/model', express.static(path.join(__dirname, '..', '..', 'public', 'model')));

// Middleware para proteger rutas
function requireLogin(req, res, next) {
  if (!req.session.nombre) {
    return res.redirect('/login');
  }
  next();
}

// Rutas para HTML
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'index.html')));
app.get('/mapa', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'mapa.html')));
app.get('/registro', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'registro.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'login.html')));
app.get('/perfil', requireLogin, (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'perfil.html')));
app.get('/residuos', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'residuos.html')));
app.get('/rutas', (req, res) => res.sendFile(path.join(__dirname, '..', 'pages', 'rutas.html')));

// Redirecciones amigables
app.get('/index.html', (req, res) => res.redirect('/'));
app.get('/mapa.html', (req, res) => res.redirect('/mapa'));
app.get('/registro.html', (req, res) => res.redirect('/registro'));
app.get('/login.html', (req, res) => res.redirect('/login'));
app.get('/perfil.html', (req, res) => res.redirect('/perfil'));
app.get('/residuos.html', (req, res) => res.redirect('/residuos'));
app.get('/rutas.html', (req, res) => res.redirect('/rutas'));

// API Endpoints

// Registro de usuario
app.post('/api/registrar-usuario', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre es obligatorio' });
  }

  try {
    const nombreNormalizado = nombre.toLowerCase();
    let usuario = await Usuario.findOne({ nombre: nombreNormalizado });

    if (usuario) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });
    }

    usuario = new Usuario({ nombre: nombreNormalizado, puntos: 0 });
    await usuario.save();

    res.status(201).json({ mensaje: 'Usuario registrado con éxito', usuarioId: usuario._id });
  } catch (error) {
    console.error('Error al registrar el usuario:', error);
    res.status(500).json({ error: 'Error al registrar el usuario' });
  }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
  const { nombre } = req.body;

  if (!nombre) {
    return res.status(400).json({ error: 'El nombre de usuario es obligatorio' });
  }

  const nombreNormalizado = nombre.toLowerCase();

  try {
    let usuario = await Usuario.findOne({ nombre: nombreNormalizado });

    if (!usuario) {
      return res.status(404).json({ error: 'El usuario no está registrado' });
    }

    req.session.nombre = nombreNormalizado;
    req.session.usuarioId = usuario._id;
    
    res.status(200).json({ 
      mensaje: 'Inicio de sesión exitoso',
      usuarioId: usuario._id,
      nombre: usuario.nombre
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ error: 'Hubo un problema con el inicio de sesión' });
  }
});

// Perfil del usuario
app.get('/api/perfil/:nombre', async (req, res) => {
  const nombreNormalizado = req.params.nombre.toLowerCase();

  try {
    let usuario = await Usuario.findOne({ nombre: nombreNormalizado });

    if (!usuario) {
      usuario = new Usuario({ nombre: nombreNormalizado, puntos: 0 });
      await usuario.save();
    }

    res.json({
      nombre: usuario.nombre,
      puntos: usuario.puntos,
      usuarioId: usuario._id
    });
  } catch (error) {
    console.error('Error al obtener el perfil:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Usuario logueado
app.get('/api/usuario-logueado', (req, res) => {
  if (!req.session.nombre) {
    return res.status(401).json({ error: 'No hay sesión activa' });
  }
  res.json({ 
    nombre: req.session.nombre,
    usuarioId: req.session.usuarioId 
  });
});

// Sumar punto
app.post('/sumar-punto', async (req, res) => {
  const { nombre } = req.body;
  if (!nombre) return res.status(400).json({ error: 'Se requiere el nombre del usuario' });

  const nombreNormalizado = nombre.toLowerCase();

  try {
    let usuario = await Usuario.findOne({ nombre: nombreNormalizado });

    if (!usuario) {
      usuario = new Usuario({ nombre: nombreNormalizado, puntos: 1 });
    } else {
      usuario.puntos += 1;
    }

    await usuario.save();
    res.json({ mensaje: 'Punto sumado con éxito', usuario });

  } catch (error) {
    console.error('Error al guardar el punto:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Guardar ubicación - Versión definitiva que funciona
app.post('/api/ubicaciones', async (req, res) => {
    console.log("Datos recibidos:", req.body);
    
    try {
      // Validación básica
      if (!req.body.latitud || !req.body.longitud) {
        return res.status(400).json({ error: "Se requieren coordenadas" });
      }
  
      // Crear el punto con valores por defecto
      const nuevoPunto = new Punto({
        lat: req.body.latitud,
        lng: req.body.longitud,
        usuario: req.body.usuarioId || null,
        puntos: req.body.puntos || 1
      });
  
      // Guardar en MongoDB
      const puntoGuardado = await nuevoPunto.save();
      console.log("Punto guardado en DB:", puntoGuardado);
      
      return res.status(201).json({
        mensaje: "Punto guardado correctamente",
        punto: puntoGuardado
      });
  
    } catch (error) {
      console.error("Error al guardar punto:", error);
      return res.status(500).json({ 
        error: "Error al guardar punto",
        detalle: error.message 
      });
    }
  });
  
  // Eliminar TODOS los puntos - Versión definitiva
  app.delete('/api/eliminar-todos', async (req, res) => {
    try {
      const resultado = await Punto.deleteMany({});
      console.log("Puntos eliminados:", resultado.deletedCount);
      
      return res.json({
        mensaje: `Se eliminaron ${resultado.deletedCount} puntos`,
        eliminados: resultado.deletedCount
      });
      
    } catch (error) {
      console.error("Error al eliminar puntos:", error);
      return res.status(500).json({ 
        error: "Error al eliminar puntos",
        detalle: error.message 
      });
    }
  });

// Obtener todos los puntos de reciclaje
app.get('/api/puntos', async (req, res) => {
  try {
    const puntos = await Punto.find().populate('usuario');

    if (!puntos || puntos.length === 0) {
      return res.status(404).json({ error: 'No hay puntos de reciclaje disponibles' });
    }

    res.json(puntos);
  } catch (error) {
    console.error('Error al obtener los puntos:', error);
    res.status(500).json({ error: 'Error al obtener los puntos de reciclaje' });
  }
});

// Iniciar servidor
const port = 3000;
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});