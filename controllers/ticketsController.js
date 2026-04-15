const prisma = require('../config/db');
const { TICKET_STATUS, TICKET_SELLER_CLOSE_DAYS, ROLES, SHOPPING_LIST_STATUS } = require('../config/constants');
const notificationService = require('../services/notificationService');

// Helper: obtener IDs de todos los admins activos
const getAdminIds = async () => {
  const admins = await prisma.tbl_usuarios.findMany({
    where: { tbl_roles: { nombre: ROLES.ADMINISTRADOR }, activo: true, eliminado_en: null },
    select: { id: true },
  });
  return admins.map(a => a.id);
};

const createTicket = async (req, res) => {
  const { tipo, objetivo, id_tienda, asunto, mensaje } = req.body;

  if (!tipo || !objetivo || !asunto || !mensaje) {
    return res.status(400).json({ error: 'tipo, objetivo, asunto y mensaje son requeridos' });
  }

  try {
    if (objetivo === 'STORE' && id_tienda) {
      const tienda = await prisma.tbl_tiendas.findFirst({ where: { id: parseInt(id_tienda) } });
      if (!tienda) return res.status(400).json({ error: 'Tienda no encontrada' });

      // Verificar que el comprador tenga al menos una compra completada en esta tienda
      const hasPurchase = await prisma.tbl_items_lista_compras.findFirst({
        where: {
          tipo: 'PRODUCT',
          snapshot_id_tienda: parseInt(id_tienda),
          tbl_listas_compras: {
            id_comprador: req.user.id,
            estado: SHOPPING_LIST_STATUS.COMPLETED,
          },
        },
      });
      if (!hasPurchase) {
        return res.status(403).json({ error: 'Solo puedes enviar quejas o sugerencias a tiendas donde hayas realizado compras' });
      }
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const t = await tx.tbl_tickets.create({
        data: {
          tipo,
          objetivo,
          id_tienda: objetivo === 'STORE' && id_tienda ? parseInt(id_tienda) : null,
          asunto,
          estado: TICKET_STATUS.PENDIENTE,
          id_creador: req.user.id,
          id_usuario_registro: req.user.id,
        },
      });

      // Primer mensaje
      await tx.tbl_mensajes_tickets.create({
        data: { id_ticket: t.id, id_autor: req.user.id, cuerpo: mensaje },
      });

      // Participantes
      const participantes = [{ id_ticket: t.id, id_usuario: req.user.id }];

      // Si es hacia tienda, agregar vendedor como participante
      if (objetivo === 'STORE' && id_tienda) {
        const tienda = await tx.tbl_tiendas.findUnique({ where: { id: parseInt(id_tienda) } });
        if (tienda) {
          participantes.push({ id_ticket: t.id, id_usuario: tienda.id_vendedor });
        }
      }

      await tx.tbl_participantes_tickets.createMany({ data: participantes, skipDuplicates: true });

      // Estado de lectura: creador ya leyo
      await tx.tbl_estados_lectura_tickets.create({
        data: { id_ticket: t.id, id_usuario: req.user.id },
      });

      return t;
    });

    // Notificar al destinatario del ticket + admins siempre
    const targetIds = [];
    const adminIds = await getAdminIds();

    if (objetivo === 'ADMIN') {
      adminIds.forEach(id => targetIds.push(id));
    } else if (objetivo === 'STORE' && id_tienda) {
      const tiendaTarget = await prisma.tbl_tiendas.findUnique({ where: { id: parseInt(id_tienda) }, select: { id_vendedor: true } });
      if (tiendaTarget) targetIds.push(tiendaTarget.id_vendedor);
      // Admins tambien ven todos los tickets
      adminIds.forEach(id => { if (!targetIds.includes(id)) targetIds.push(id); });
    }
    if (targetIds.length > 0) {
      notificationService.ticketCreated(ticket.id, targetIds);
    }

    res.status(201).json({ data: ticket });
  } catch (error) {
    console.error('Error creando ticket:', error);
    res.status(500).json({ error: 'Error al crear ticket' });
  }
};

const getMyTickets = async (req, res) => {
  try {
    const { status, unread_only } = req.query;
    const isAdmin = req.user.rol === ROLES.ADMINISTRADOR;

    const where = {};
    // Admin ve todos los tickets; otros solo los que participan
    if (!isAdmin) {
      where.participantes = { some: { id_usuario: req.user.id } };
    }
    if (status) where.estado = status;

    const tickets = await prisma.tbl_tickets.findMany({
      where,
      include: {
        tbl_usuarios: {
          select: {
            id: true,
            nombre: true,
            correo: true,
            telefono: true,
            tbl_roles: { select: { nombre: true } },
          },
        },
        tbl_tiendas: { select: { id: true, nombre: true } },
        mensajes: {
          orderBy: { fecha_hora_registro: 'asc' },
          take: 1,
          select: { cuerpo: true },
        },
        estados_lectura: {
          where: { id_usuario: req.user.id },
          select: { ultima_lectura: true },
        },
        _count: { select: { mensajes: true } },
      },
      orderBy: { ultimo_mensaje_en: 'desc' },
    });

    let result = tickets.map(t => {
      const ultimaLectura = t.estados_lectura[0]?.ultima_lectura;
      const noLeido = ultimaLectura ? t.ultimo_mensaje_en > ultimaLectura : true;
      return {
        id: t.id,
        tipo: t.tipo,
        objetivo: t.objetivo,
        asunto: t.asunto,
        descripcion: t.mensajes[0]?.cuerpo || null,
        estado: t.estado,
        usuario: t.tbl_usuarios ? {
          id: t.tbl_usuarios.id,
          nombre: t.tbl_usuarios.nombre,
          correo: t.tbl_usuarios.correo,
          telefono: t.tbl_usuarios.telefono || null,
          rol: t.tbl_usuarios.tbl_roles?.nombre || null,
        } : null,
        tienda: t.tbl_tiendas,
        ultimo_mensaje_en: t.ultimo_mensaje_en,
        total_mensajes: t._count.mensajes,
        no_leido: noLeido,
        cerrado_por: t.cerrado_por,
        motivo_cierre: t.motivo_cierre,
        creado_en: t.fecha_hora_registro,
      };
    });

    if (unread_only === 'true') {
      result = result.filter(t => t.no_leido);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tickets' });
  }
};

const getTicketDetail = async (req, res) => {
  try {
    const ticket = await prisma.tbl_tickets.findFirst({
      where: {
        id: parseInt(req.params.id),
        participantes: { some: { id_usuario: req.user.id } },
      },
      include: {
        tbl_tiendas: { select: { id: true, nombre: true } },
        mensajes: {
          include: { tbl_usuarios: { select: { id: true, nombre: true, tbl_roles: { select: { nombre: true } } } } },
          orderBy: { fecha_hora_registro: 'asc' },
        },
      },
    });

    // Admin puede ver todos
    if (!ticket && req.user.rol === ROLES.ADMINISTRADOR) {
      const ticketAdmin = await prisma.tbl_tickets.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          tbl_tiendas: { select: { id: true, nombre: true } },
          mensajes: {
            include: { tbl_usuarios: { select: { id: true, nombre: true, tbl_roles: { select: { nombre: true } } } } },
            orderBy: { fecha_hora_registro: 'asc' },
          },
        },
      });
      if (!ticketAdmin) return res.status(404).json({ error: 'Ticket no encontrado' });
      return res.json({ data: ticketAdmin });
    }

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });

    res.json({ data: ticket });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ticket' });
  }
};

const sendMessage = async (req, res) => {
  const { cuerpo } = req.body;
  if (!cuerpo) return res.status(400).json({ error: 'Mensaje requerido' });

  try {
    const isAdmin = req.user.rol === ROLES.ADMINISTRADOR;

    let ticket;
    if (isAdmin) {
      // Admin puede enviar mensajes en cualquier ticket
      ticket = await prisma.tbl_tickets.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { tbl_tiendas: { select: { id_vendedor: true } } },
      });
    } else {
      ticket = await prisma.tbl_tickets.findFirst({
        where: {
          id: parseInt(req.params.id),
          OR: [
            { participantes: { some: { id_usuario: req.user.id } } },
            { id_creador: req.user.id },
          ],
        },
        include: { tbl_tiendas: { select: { id_vendedor: true } } },
      });
    }

    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket.estado === TICKET_STATUS.ATENDIDO) {
      return res.status(400).json({ error: 'El ticket ya esta cerrado. No se pueden enviar mas mensajes.' });
    }

    // Determinar nuevo estado segun autor
    const rolUsuario = req.user.rol;
    let nuevoEstado = ticket.estado;

    if (rolUsuario === ROLES.VENDEDOR || rolUsuario === ROLES.ADMINISTRADOR) {
      nuevoEstado = TICKET_STATUS.RESPONDIDO;
    } else if (rolUsuario === ROLES.COMPRADOR) {
      // Si ya hubo respuesta de seller/admin antes, cambia a EN_ESPERA
      const mensajesPrevios = await prisma.tbl_mensajes_tickets.findMany({
        where: { id_ticket: ticket.id },
        include: { tbl_usuarios: { include: { tbl_roles: true } } },
      });
      const huboRespuesta = mensajesPrevios.some(m =>
        m.tbl_usuarios.tbl_roles.nombre === ROLES.VENDEDOR ||
        m.tbl_usuarios.tbl_roles.nombre === ROLES.ADMINISTRADOR
      );
      nuevoEstado = huboRespuesta ? TICKET_STATUS.EN_ESPERA_DE_RESPUESTA : TICKET_STATUS.PENDIENTE;
    }

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      await tx.tbl_mensajes_tickets.create({
        data: { id_ticket: ticket.id, id_autor: req.user.id, cuerpo },
      });

      await tx.tbl_tickets.update({
        where: { id: ticket.id },
        data: {
          estado: nuevoEstado,
          ultimo_mensaje_en: now,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: now,
        },
      });

      // Agregar como participante si no lo es (ej: admin)
      await tx.tbl_participantes_tickets.upsert({
        where: { id_ticket_id_usuario: { id_ticket: ticket.id, id_usuario: req.user.id } },
        create: { id_ticket: ticket.id, id_usuario: req.user.id },
        update: {},
      });
    });

    // Notificar a participantes + admins
    const participantes = await prisma.tbl_participantes_tickets.findMany({
      where: { id_ticket: ticket.id },
      select: { id_usuario: true },
    });
    const participantIds = participantes.map(p => p.id_usuario);
    const adminIds = await getAdminIds();
    adminIds.forEach(id => { if (!participantIds.includes(id)) participantIds.push(id); });
    notificationService.ticketMessageCreated(ticket.id, participantIds, req.user.id);

    res.json({ mensaje: 'Mensaje enviado', estado: nuevoEstado });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    res.status(500).json({ error: 'Error al enviar mensaje' });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.id;

    const tickets = await prisma.tbl_tickets.findMany({
      where: {
        participantes: { some: { id_usuario: userId } },
        estado: { not: TICKET_STATUS.ATENDIDO },
      },
      select: {
        ultimo_mensaje_en: true,
        estados_lectura: {
          where: { id_usuario: userId },
          select: { ultima_lectura: true },
        },
      },
    });

    const count = tickets.filter(t => {
      const ul = t.estados_lectura[0]?.ultima_lectura;
      return ul ? t.ultimo_mensaje_en > ul : true;
    }).length;

    res.json({ count });
  } catch (error) {
    console.error('Error al obtener conteo de tickets no leidos:', error);
    res.status(500).json({ error: 'Error al obtener conteo' });
  }
};

const markRead = async (req, res) => {
  try {
    await prisma.tbl_estados_lectura_tickets.upsert({
      where: {
        id_ticket_id_usuario: { id_ticket: parseInt(req.params.id), id_usuario: req.user.id },
      },
      create: { id_ticket: parseInt(req.params.id), id_usuario: req.user.id },
      update: { ultima_lectura: new Date() },
    });
    res.json({ mensaje: 'Marcado como leido' });
  } catch (error) {
    res.status(500).json({ error: 'Error al marcar como leido' });
  }
};

const acceptTicket = async (req, res) => {
  try {
    const ticket = await prisma.tbl_tickets.findFirst({
      where: { id: parseInt(req.params.id), id_creador: req.user.id },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket.estado !== TICKET_STATUS.RESPONDIDO) {
      return res.status(400).json({ error: 'Solo puedes aceptar tickets con estado RESPONDIDO' });
    }

    await prisma.tbl_tickets.update({
      where: { id: ticket.id },
      data: {
        estado: TICKET_STATUS.ATENDIDO,
        cerrado_por: 'BUYER',
        motivo_cierre: 'ACCEPTED',
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: new Date(),
      },
    });

    // Notificar a participantes + admins del cierre por aceptacion
    const participantes = await prisma.tbl_participantes_tickets.findMany({
      where: { id_ticket: ticket.id },
      select: { id_usuario: true },
    });
    const participantIds = participantes.map(p => p.id_usuario);
    const adminIds = await getAdminIds();
    adminIds.forEach(id => { if (!participantIds.includes(id)) participantIds.push(id); });
    notificationService.ticketStatusUpdated(ticket.id, participantIds, TICKET_STATUS.ATENDIDO);

    res.json({ mensaje: 'Ticket aceptado y cerrado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al aceptar ticket' });
  }
};

const closeTicket = async (req, res) => {
  const { nota_cierre } = req.body;

  try {
    const ticket = await prisma.tbl_tickets.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket no encontrado' });
    if (ticket.estado === TICKET_STATUS.ATENDIDO) {
      return res.status(400).json({ error: 'El ticket ya esta cerrado' });
    }

    const rolUsuario = req.user.rol;

    if (rolUsuario === ROLES.VENDEDOR) {
      // Validar regla 7 dias
      if (ticket.objetivo !== 'STORE') {
        return res.status(403).json({ error: 'Solo puedes cerrar tickets dirigidos a tu tienda' });
      }
      if (ticket.estado !== TICKET_STATUS.RESPONDIDO) {
        return res.status(400).json({ error: 'El ticket debe estar en estado RESPONDIDO' });
      }

      const diffMs = Date.now() - ticket.ultimo_mensaje_en.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays < TICKET_SELLER_CLOSE_DAYS) {
        return res.status(400).json({
          error: `Debes esperar ${TICKET_SELLER_CLOSE_DAYS} dias sin respuesta del comprador para cerrar`,
        });
      }

      await prisma.tbl_tickets.update({
        where: { id: ticket.id },
        data: {
          estado: TICKET_STATUS.ATENDIDO,
          cerrado_por: 'SELLER',
          motivo_cierre: 'NO_BUYER_RESPONSE_7D',
          nota_cierre: nota_cierre || null,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });
    } else if (rolUsuario === ROLES.ADMINISTRADOR) {
      await prisma.tbl_tickets.update({
        where: { id: ticket.id },
        data: {
          estado: TICKET_STATUS.ATENDIDO,
          cerrado_por: 'ADMIN',
          motivo_cierre: 'ADMIN_CLOSED',
          nota_cierre: nota_cierre || null,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });
    } else {
      return res.status(403).json({ error: 'No tienes permisos para cerrar este ticket' });
    }

    // Notificar a participantes + admins del cierre
    const participantes = await prisma.tbl_participantes_tickets.findMany({
      where: { id_ticket: ticket.id },
      select: { id_usuario: true },
    });
    const participantIds = participantes.map(p => p.id_usuario);
    const adminIds = await getAdminIds();
    adminIds.forEach(id => { if (!participantIds.includes(id)) participantIds.push(id); });
    notificationService.ticketStatusUpdated(ticket.id, participantIds, TICKET_STATUS.ATENDIDO);

    res.json({ mensaje: 'Ticket cerrado' });
  } catch (error) {
    console.error('Error cerrando ticket:', error);
    res.status(500).json({ error: 'Error al cerrar ticket' });
  }
};

module.exports = {
  createTicket, getMyTickets, getTicketDetail, getUnreadCount, sendMessage,
  markRead, acceptTicket, closeTicket,
};
