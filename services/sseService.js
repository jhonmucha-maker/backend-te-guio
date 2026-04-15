const notificationService = require('./notificationService');

// Almacena conexiones SSE por userId
const connections = new Map(); // userId -> Set<res>
// Mapea userId -> rol para despachar role_events sin query a BD
const userRoles = new Map(); // userId -> string (rol)

const setupSSE = (app) => {
  app.get('/api/events', (req, res) => {
    // Verificar token via query param
    const jwt = require('jsonwebtoken');
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: 'Token requerido' });

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Token invalido' });
    }

    const userId = decoded.id;
    const userRole = decoded.rol;

    // Headers SSE (usar setHeader para no sobreescribir CORS del middleware)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.status(200);
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ event: 'connected', userId })}\n\n`);

    // Registrar conexion y rol
    if (!connections.has(userId)) connections.set(userId, new Set());
    connections.get(userId).add(res);
    userRoles.set(userId, userRole);

    // Keepalive
    const keepalive = setInterval(() => {
      try { res.write(': keepalive\n\n'); } catch {}
    }, 30000);

    req.on('close', () => {
      clearInterval(keepalive);
      const userConns = connections.get(userId);
      if (userConns) {
        userConns.delete(res);
        if (userConns.size === 0) {
          connections.delete(userId);
          userRoles.delete(userId);
        }
      }
    });
  });

  // Escuchar eventos del notification service
  notificationService.on('user_event', ({ userId, event, data, ts_utc }) => {
    const userConns = connections.get(userId);
    if (userConns) {
      const payload = JSON.stringify({ event_id: `${Date.now()}-${userId}`, ts_utc, type: event, data });
      userConns.forEach(res => {
        try { res.write(`data: ${payload}\n\n`); } catch {}
      });
    } else {
      console.log(`[SSE] user_event descartado: userId=${userId} event=${event} (sin conexion activa)`);
    }
  });

  notificationService.on('role_event', ({ role, event, data, ts_utc }) => {
    const payload = JSON.stringify({ event_id: `${Date.now()}-role`, ts_utc, type: event, data });
    // Enviar a todos los usuarios conectados que tengan el rol indicado
    for (const [userId, userRole] of userRoles.entries()) {
      if (userRole !== role) continue;
      const userConns = connections.get(userId);
      if (userConns) {
        userConns.forEach(res => {
          try { res.write(`data: ${payload}\n\n`); } catch {}
        });
      }
    }
  });
};

module.exports = { setupSSE };
