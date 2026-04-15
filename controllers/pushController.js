const prisma = require('../config/db');

// Registrar dispositivo para push notifications
const registerDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token_dispositivo, plataforma } = req.body;

    if (!token_dispositivo || !plataforma) {
      return res.status(400).json({ error: 'token_dispositivo y plataforma son obligatorios' });
    }

    const valid = ['ANDROID', 'IOS', 'WEB'];
    if (!valid.includes(plataforma)) {
      return res.status(400).json({ error: `plataforma debe ser: ${valid.join(', ')}` });
    }

    // Upsert: si ya existe el token para este usuario, actualizar
    await prisma.tbl_dispositivos_push.upsert({
      where: {
        id_usuario_token_dispositivo: {
          id_usuario: userId,
          token_dispositivo,
        },
      },
      create: {
        id_usuario: userId,
        token_dispositivo,
        plataforma,
        activo: true,
        ultima_conexion: new Date(),
      },
      update: {
        activo: true,
        ultima_conexion: new Date(),
      },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Error al registrar dispositivo' });
  }
};

// Desregistrar dispositivo
const unregisterDevice = async (req, res) => {
  try {
    const userId = req.user.id;
    const { token_dispositivo } = req.body;

    if (!token_dispositivo) {
      return res.status(400).json({ error: 'token_dispositivo es obligatorio' });
    }

    await prisma.tbl_dispositivos_push.updateMany({
      where: {
        id_usuario: userId,
        token_dispositivo,
      },
      data: { activo: false },
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ error: 'Error al desregistrar dispositivo' });
  }
};

// Obtener dispositivos del usuario (para debug/admin)
const getMyDevices = async (req, res) => {
  try {
    const devices = await prisma.tbl_dispositivos_push.findMany({
      where: { id_usuario: req.user.id, activo: true },
      select: { id: true, plataforma: true, ultima_conexion: true },
    });
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener dispositivos' });
  }
};

module.exports = { registerDevice, unregisterDevice, getMyDevices };
