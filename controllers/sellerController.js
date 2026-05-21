const prisma = require('../config/db');
const { APPROVAL_STATUS, PRODUCT_STATE } = require('../config/constants');
const notificationService = require('../services/notificationService');

// ==================== PERFIL VENDEDOR ====================

const getSellerProfile = async (req, res) => {
  try {
    const perfil = await prisma.tbl_perfiles_vendedor.findUnique({
      where: { id_usuario: req.user.id },
      include: {
        documentos: true,
        tbl_usuarios: {
          select: {
            id: true, nombre: true, correo: true, telefono: true, imagen_perfil: true, id_ciudad: true,
            tiendas: {
              where: { eliminado_en: null, estado_aprobacion: 'APROBADO' },
              select: {
                id: true,
                nombre: true,
                suscripcion_activa: { select: { tipo_plan: true, estado: true, fin_en: true } },
              },
            },
          },
        },
      },
    });
    if (!perfil) return res.status(404).json({ error: 'Perfil de vendedor no encontrado' });
    res.json({ data: perfil });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil de vendedor' });
  }
};

const updateSellerProfile = async (req, res) => {
  try {
    const perfil = await prisma.tbl_perfiles_vendedor.findUnique({
      where: { id_usuario: req.user.id },
    });
    if (!perfil) return res.status(404).json({ error: 'Perfil de vendedor no encontrado' });

    const { nombre_negocio, ruc, dni, direccion, nombre, telefono, tipo_comprobante, razon_social } = req.body;

    // Actualizar datos del usuario si se proporcionan
    if (nombre || telefono) {
      const userData = {};
      if (nombre) userData.nombre = nombre;
      if (telefono !== undefined) userData.telefono = telefono;
      await prisma.tbl_usuarios.update({
        where: { id: req.user.id },
        data: { ...userData, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() },
      });
    }

    // Actualizar perfil de vendedor
    const perfilData = { id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() };
    if (nombre_negocio !== undefined) perfilData.nombre_negocio = nombre_negocio;
    if (ruc !== undefined) perfilData.ruc = ruc;
    if (dni !== undefined) perfilData.dni = dni;
    if (direccion !== undefined) perfilData.direccion = direccion;
    if (tipo_comprobante !== undefined) perfilData.tipo_comprobante = tipo_comprobante;
    if (razon_social !== undefined) perfilData.razon_social = razon_social;

    const updated = await prisma.tbl_perfiles_vendedor.update({
      where: { id: perfil.id },
      data: perfilData,
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('Error actualizando perfil vendedor:', error);
    res.status(500).json({ error: 'Error al actualizar perfil de vendedor' });
  }
};

// ==================== TIENDAS ====================

const getMyStores = async (req, res) => {
  try {
    const where = { id_vendedor: req.user.id, eliminado_en: null };
    if (req.query.status) where.estado_aprobacion = req.query.status;

    const tiendas = await prisma.tbl_tiendas.findMany({
      where,
      include: {
        fotos: { orderBy: { posicion: 'asc' } },
        tbl_galerias: {
          select: {
            id: true, nombre: true, direccion: true, id_zona: true, id_ciudad: true,
            tbl_zonas: { select: { id: true, nombre: true, id_ciudad: true } },
            tbl_ciudades: { select: { id: true, nombre: true } },
          },
        },
        suscripcion_activa: true,
        agregado_calificacion: true,
        solicitudes_suscripcion: {
          take: 1,
          orderBy: { solicitado_en: 'desc' },
          select: { id: true, estado: true, motivo_rechazo: true, decidido_en: true },
        },
        _count: { select: { productos: true } },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    res.json({ data: tiendas });
  } catch (error) {
    console.error('Error getMyStores:', error);
    res.status(500).json({ error: 'Error al obtener tiendas', detalle: error.message });
  }
};

const createStore = async (req, res) => {
  const { nombre, descripcion, direccion, latitud, longitud, horarios_json, redes_sociales_json, id_galeria, numero_local, telefono, observacion } = req.body;

  if (!nombre || !id_galeria) {
    return res.status(400).json({ error: 'Nombre y galeria son requeridos' });
  }

  try {
    const galeria = await prisma.tbl_galerias.findFirst({
      where: { id: parseInt(id_galeria), activo: true, eliminado_en: null },
    });
    if (!galeria) return res.status(400).json({ error: 'Galeria no valida' });

    // Parse redes_sociales_json if it's a string
    let redesParsed = redes_sociales_json || null;
    if (typeof redesParsed === 'string') {
      try { redesParsed = JSON.parse(redesParsed); } catch { redesParsed = null; }
    }

    const tiendaConFotos = await prisma.$transaction(async (tx) => {
      const tienda = await tx.tbl_tiendas.create({
        data: {
          id_vendedor: req.user.id,
          id_galeria: parseInt(id_galeria),
          nombre,
          descripcion: descripcion || null,
          telefono: telefono || null,
          numero_local: numero_local || null,
          observacion: observacion || null,
          direccion: direccion || null,
          latitud: latitud ? parseFloat(latitud) : null,
          longitud: longitud ? parseFloat(longitud) : null,
          horarios_json: horarios_json || null,
          redes_sociales_json: redesParsed,
          estado_aprobacion: APPROVAL_STATUS.PENDIENTE,
          activo: false,
          id_usuario_registro: req.user.id,
        },
      });

      if (req.files && req.files.length > 0) {
        await tx.tbl_fotos_tiendas.createMany({
          data: req.files.map((file, i) => ({
            id_tienda: tienda.id,
            url: file.s3Url,
            posicion: i,
          })),
        });
      }

      return tx.tbl_tiendas.findUnique({
        where: { id: tienda.id },
        include: { fotos: { orderBy: { posicion: 'asc' } } },
      });
    });

    notificationService.newPendingApproval('store', { nombre_tienda: nombre });

    res.status(201).json({ data: tiendaConFotos });
  } catch (error) {
    console.error('Error creando tienda:', error);
    res.status(500).json({ error: 'Error al crear tienda' });
  }
};

const updateStore = async (req, res) => {
  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(req.params.id), id_vendedor: req.user.id, eliminado_en: null },
    });
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });

    const data = { ...req.body, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() };
    if (data.id_galeria) data.id_galeria = parseInt(data.id_galeria);
    if (data.latitud) data.latitud = parseFloat(data.latitud);
    if (data.longitud) data.longitud = parseFloat(data.longitud);
    if (typeof data.redes_sociales_json === 'string') {
      try { data.redes_sociales_json = JSON.parse(data.redes_sociales_json); } catch { delete data.redes_sociales_json; }
    }
    // Remove fields that shouldn't be directly saved
    delete data.selectedCity;
    delete data.selectedZone;
    delete data.fotos;

    // Si estaba APROBADO, cualquier cambio => PENDIENTE y oculta
    if (tienda.estado_aprobacion === APPROVAL_STATUS.APROBADO) {
      data.estado_aprobacion = APPROVAL_STATUS.PENDIENTE;
      data.activo = false;
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Cascada: ocultar productos si pasa a PENDIENTE
      if (tienda.estado_aprobacion === APPROVAL_STATUS.APROBADO) {
        await tx.tbl_productos.updateMany({
          where: { id_tienda: tienda.id, eliminado_en: null },
          data: { estado: PRODUCT_STATE.INACTIVE },
        });
      }

      const store = await tx.tbl_tiendas.update({
        where: { id: tienda.id },
        data,
      });

      if (req.files && req.files.length > 0) {
        const maxPos = await tx.tbl_fotos_tiendas.aggregate({
          where: { id_tienda: tienda.id },
          _max: { posicion: true },
        });
        const startPos = (maxPos._max.posicion ?? -1) + 1;
        await tx.tbl_fotos_tiendas.createMany({
          data: req.files.map((file, i) => ({
            id_tienda: tienda.id,
            url: file.s3Url,
            posicion: startPos + i,
          })),
        });
      }

      return store;
    });

    // Si pasó a PENDIENTE, notificar a admins en tiempo real y avisar a compradores
    // afectados (favoritos / lista) para que su UI refleje al instante la pérdida de visibilidad.
    if (tienda.estado_aprobacion === APPROVAL_STATUS.APROBADO) {
      notificationService.newPendingApproval('store', { nombre_tienda: req.body.nombre || tienda.nombre });
      notificationService.notifyBuyersStoreVisibilityChanged(tienda.id);
    }

    res.json({ data: updated });
  } catch (error) {
    console.error('Error actualizando tienda:', error);
    res.status(500).json({ error: 'Error al actualizar tienda' });
  }
};

// ==================== PRODUCTOS ====================

const getMyProducts = async (req, res) => {
  try {
    const where = { eliminado_en: null, tbl_tiendas: { id_vendedor: req.user.id } };
    if (req.query.store_id) where.id_tienda = parseInt(req.query.store_id);
    if (req.query.status) where.estado_aprobacion = req.query.status;
    if (req.query.state) where.estado = req.query.state;

    const productos = await prisma.tbl_productos.findMany({
      where,
      include: {
        fotos: { orderBy: { posicion: 'asc' } },
        tbl_tiendas: { select: { id: true, nombre: true } },
        tbl_categorias: { select: { id: true, nombre: true } },
        agregado_calificacion: true,
      },
      orderBy: { nombre: 'asc' },
    });

    res.json({ data: productos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos' });
  }
};

const createProduct = async (req, res) => {
  const { id_tienda, id_categoria, nombre, descripcion, precio, precio_visible } = req.body;

  if (!id_tienda || !id_categoria || !nombre || precio === undefined) {
    return res.status(400).json({ error: 'Tienda, categoria, nombre y precio son requeridos' });
  }

  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(id_tienda), id_vendedor: req.user.id, eliminado_en: null },
    });
    if (!tienda) return res.status(400).json({ error: 'Tienda no valida' });

    const categoria = await prisma.tbl_categorias.findFirst({
      where: { id: parseInt(id_categoria), activo: true },
    });
    if (!categoria) return res.status(400).json({ error: 'Categoria no valida' });

    if (parseFloat(precio) < 0) return res.status(400).json({ error: 'Precio no puede ser negativo' });

    const productoConFotos = await prisma.$transaction(async (tx) => {
      const producto = await tx.tbl_productos.create({
        data: {
          id_tienda: parseInt(id_tienda),
          id_categoria: parseInt(id_categoria),
          nombre,
          descripcion: descripcion || null,
          precio: parseFloat(precio),
          precio_visible: precio_visible !== false && precio_visible !== 'false',
          estado_aprobacion: APPROVAL_STATUS.PENDIENTE,
          estado: PRODUCT_STATE.INACTIVE,
          id_usuario_registro: req.user.id,
        },
      });

      if (req.files && req.files.length > 0) {
        await tx.tbl_fotos_productos.createMany({
          data: req.files.map((file, i) => ({
            id_producto: producto.id,
            url: file.s3Url,
            posicion: i,
          })),
        });
      }

      return tx.tbl_productos.findUnique({
        where: { id: producto.id },
        include: { fotos: { orderBy: { posicion: 'asc' } } },
      });
    });

    const imagenProducto = req.files && req.files.length > 0 ? req.files[0].s3Url : null;
    notificationService.newPendingApproval('product', { nombre_producto: nombre, nombre_tienda: tienda.nombre, imagen_producto: imagenProducto });

    res.status(201).json({ data: productoConFotos });
  } catch (error) {
    console.error('Error creando producto:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
};

const updateProduct = async (req, res) => {
  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true, nombre: true } } },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    const data = { id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() };
    const camposNoPermitidos = ['nombre', 'descripcion', 'id_categoria', 'precio_visible'];
    const cambioNoPrecio = camposNoPermitidos.some(c => req.body[c] !== undefined);
    const hasNewPhotos = req.files && req.files.length > 0;

    if (req.body.nombre) data.nombre = req.body.nombre;
    if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion;
    if (req.body.id_categoria) data.id_categoria = parseInt(req.body.id_categoria);
    if (req.body.precio_visible !== undefined) data.precio_visible = req.body.precio_visible === true || req.body.precio_visible === 'true';
    if (req.body.precio !== undefined) data.precio = parseFloat(req.body.precio);

    // Si cambia algo distinto a precio o agrega fotos y estaba aprobado => PENDIENTE + oculto
    if ((cambioNoPrecio || hasNewPhotos) && producto.estado_aprobacion === APPROVAL_STATUS.APROBADO) {
      data.estado_aprobacion = APPROVAL_STATUS.PENDIENTE;
      data.estado = PRODUCT_STATE.INACTIVE;
    }

    // Si estaba rechazado, reenviar automáticamente como PENDIENTE
    if (producto.estado_aprobacion === APPROVAL_STATUS.RECHAZADO) {
      data.estado_aprobacion = APPROVAL_STATUS.PENDIENTE;
    }

    // Detectar cambio real de precio
    const precioAnterior = parseFloat(producto.precio);
    const precioNuevo = req.body.precio !== undefined ? parseFloat(req.body.precio) : null;
    const precioCambio = precioNuevo !== null && precioNuevo !== precioAnterior;

    const updated = await prisma.$transaction(async (tx) => {
      const prod = await tx.tbl_productos.update({
        where: { id: producto.id },
        data,
      });

      // Registrar historial de precio si cambió
      if (precioCambio) {
        await tx.tbl_historial_precios.create({
          data: {
            id_producto: producto.id,
            precio_anterior: precioAnterior,
            precio_nuevo: precioNuevo,
            id_usuario_cambio: req.user.id,
          },
        });
      }

      // Guardar fotos nuevas si se subieron junto con la edición
      if (req.files && req.files.length > 0) {
        const maxPos = await tx.tbl_fotos_productos.aggregate({
          where: { id_producto: producto.id },
          _max: { posicion: true },
        });
        const startPos = (maxPos._max.posicion ?? -1) + 1;
        await tx.tbl_fotos_productos.createMany({
          data: req.files.map((file, i) => ({
            id_producto: producto.id,
            url: file.s3Url,
            posicion: startPos + i,
          })),
        });
      }

      return prod;
    });

    // Notificar admin cuando el producto vuelve a PENDIENTE (sea desde RECHAZADO o APROBADO editado)
    if (data.estado_aprobacion === APPROVAL_STATUS.PENDIENTE) {
      const fotoProducto = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: producto.id }, orderBy: { posicion: 'asc' }, select: { url: true } });
      notificationService.newPendingApproval('product', { nombre_producto: req.body.nombre || producto.nombre, nombre_tienda: producto.tbl_tiendas.nombre, imagen_producto: fotoProducto?.url || null });
    }

    // Notificar cambio de precio a compradores interesados (favoritos + listas de compras)
    if (precioCambio) {
      const favs = await prisma.tbl_favoritos_productos.findMany({
        where: { id_producto: producto.id },
        select: { id_comprador: true },
      });
      const itemsLista = await prisma.tbl_items_lista_compras.findMany({
        where: { id_producto: producto.id, tipo: 'PRODUCT' },
        select: { tbl_listas_compras: { select: { id_comprador: true } } },
      });
      const buyerIds = [...new Set([
        ...favs.map(f => f.id_comprador),
        ...itemsLista.map(i => i.tbl_listas_compras.id_comprador),
      ])];
      if (buyerIds.length > 0) {
        const fotoProd = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: producto.id }, orderBy: { posicion: 'asc' }, select: { url: true } });
        notificationService.productPriceChanged(producto.id, buyerIds, {
          nombre_producto: req.body.nombre || producto.nombre,
          precio_anterior: precioAnterior.toFixed(2),
          precio_nuevo: precioNuevo.toFixed(2),
          nombre_tienda: producto.tbl_tiendas.nombre,
          imagen_producto: fotoProd?.url || null,
        });
      }
    }

    res.json({ data: updated });
  } catch (error) {
    console.error('Error actualizando producto:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
};

const updatePrice = async (req, res) => {
  const { precio } = req.body;
  if (precio === undefined || parseFloat(precio) < 0) {
    return res.status(400).json({ error: 'Precio valido requerido' });
  }

  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true, estado_aprobacion: true, nombre: true } } },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (producto.estado_aprobacion !== APPROVAL_STATUS.APROBADO) {
      return res.status(400).json({ error: 'Solo se puede cambiar el precio de productos aprobados' });
    }
    if (producto.tbl_tiendas.estado_aprobacion !== APPROVAL_STATUS.APROBADO) {
      return res.status(400).json({ error: 'La tienda debe estar aprobada' });
    }

    const nuevoPrecio = parseFloat(precio);

    await prisma.$transaction(async (tx) => {
      // Registrar historial
      await tx.tbl_historial_precios.create({
        data: {
          id_producto: producto.id,
          precio_anterior: producto.precio,
          precio_nuevo: nuevoPrecio,
          id_usuario_cambio: req.user.id,
        },
      });

      // Actualizar precio (sin cambiar estado)
      await tx.tbl_productos.update({
        where: { id: producto.id },
        data: {
          precio: nuevoPrecio,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });
    });

    // Notificar a compradores interesados (favoritos + listas de compras)
    const favs = await prisma.tbl_favoritos_productos.findMany({
      where: { id_producto: producto.id },
      select: { id_comprador: true },
    });
    const itemsLista = await prisma.tbl_items_lista_compras.findMany({
      where: { id_producto: producto.id, tipo: 'PRODUCT' },
      select: { tbl_listas_compras: { select: { id_comprador: true } } },
    });
    const buyerIds = [...new Set([
      ...favs.map(f => f.id_comprador),
      ...itemsLista.map(i => i.tbl_listas_compras.id_comprador),
    ])];
    if (buyerIds.length > 0) {
      const fotoProd = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: producto.id }, orderBy: { posicion: 'asc' }, select: { url: true } });
      notificationService.productPriceChanged(producto.id, buyerIds, {
        nombre_producto: producto.nombre,
        precio_anterior: parseFloat(producto.precio).toFixed(2),
        precio_nuevo: nuevoPrecio.toFixed(2),
        nombre_tienda: producto.tbl_tiendas.nombre,
        imagen_producto: fotoProd?.url || null,
      });
    }

    res.json({ mensaje: 'Precio actualizado' });
  } catch (error) {
    console.error('Error actualizando precio:', error);
    res.status(500).json({ error: 'Error al actualizar precio' });
  }
};

const toggleProduct = async (req, res) => {
  const action = req.path.includes('disable') ? PRODUCT_STATE.TEMP_DISABLED : PRODUCT_STATE.ACTIVE;

  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true } } },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (action === PRODUCT_STATE.ACTIVE && producto.estado_aprobacion !== APPROVAL_STATUS.APROBADO) {
      return res.status(400).json({ error: 'Solo se pueden habilitar productos aprobados' });
    }

    await prisma.tbl_productos.update({
      where: { id: producto.id },
      data: { estado: action, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() },
    });

    res.json({ mensaje: action === PRODUCT_STATE.ACTIVE ? 'Producto habilitado' : 'Producto deshabilitado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado del producto' });
  }
};

const resubmitStore = async (req, res) => {
  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(req.params.id), id_vendedor: req.user.id, eliminado_en: null },
    });
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });
    if (tienda.estado_aprobacion !== APPROVAL_STATUS.RECHAZADO && tienda.estado_aprobacion !== APPROVAL_STATUS.PENDIENTE) {
      return res.status(400).json({ error: 'Solo puedes re-enviar tiendas rechazadas o pendientes' });
    }

    // Construir datos de actualización con los campos editados
    const data = {
      estado_aprobacion: APPROVAL_STATUS.PENDIENTE,
      motivo_aprobacion: null,
      id_usuario_modificacion: req.user.id,
      fecha_hora_modificacion: new Date(),
    };

    // Aplicar campos editados si se enviaron
    const allowedFields = ['nombre', 'descripcion', 'id_galeria', 'numero_local', 'telefono', 'direccion', 'observacion', 'redes_sociales_json'];
    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) data[field] = req.body[field];
    });
    if (data.id_galeria) data.id_galeria = parseInt(data.id_galeria);
    if (typeof data.redes_sociales_json === 'string') {
      try { data.redes_sociales_json = JSON.parse(data.redes_sociales_json); } catch { delete data.redes_sociales_json; }
    }

    await prisma.$transaction(async (tx) => {
      await tx.tbl_tiendas.update({
        where: { id: tienda.id },
        data,
      });

      if (req.files && req.files.length > 0) {
        const maxPos = await tx.tbl_fotos_tiendas.aggregate({
          where: { id_tienda: tienda.id },
          _max: { posicion: true },
        });
        const startPos = (maxPos._max.posicion ?? -1) + 1;
        await tx.tbl_fotos_tiendas.createMany({
          data: req.files.map((file, i) => ({
            id_tienda: tienda.id,
            url: file.s3Url,
            posicion: startPos + i,
          })),
        });
      }
    });

    notificationService.newPendingApproval('store', { nombre_tienda: req.body.nombre || tienda.nombre });

    res.json({ mensaje: 'Tienda reenviada para aprobacion' });
  } catch (error) {
    res.status(500).json({ error: 'Error al reenviar tienda' });
  }
};

const resubmitProduct = async (req, res) => {
  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true, nombre: true } } },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }
    if (producto.estado_aprobacion !== APPROVAL_STATUS.RECHAZADO) {
      return res.status(400).json({ error: 'Solo puedes re-enviar productos rechazados' });
    }

    await prisma.tbl_productos.update({
      where: { id: producto.id },
      data: {
        estado_aprobacion: APPROVAL_STATUS.PENDIENTE,
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: new Date(),
      },
    });


    const fotoProducto = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: producto.id }, orderBy: { posicion: 'asc' }, select: { url: true } });
    notificationService.newPendingApproval('product', { nombre_producto: producto.nombre, nombre_tienda: producto.tbl_tiendas.nombre, imagen_producto: fotoProducto?.url || null });
    res.json({ mensaje: 'Producto reenviado para aprobacion' });
  } catch (error) {
    res.status(500).json({ error: 'Error al reenviar producto' });
  }
};

const deleteStore = async (req, res) => {
  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(req.params.id), id_vendedor: req.user.id, eliminado_en: null },
    });
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.tbl_productos.updateMany({
        where: { id_tienda: tienda.id, eliminado_en: null },
        data: { eliminado_en: now, estado: PRODUCT_STATE.INACTIVE },
      });
      await tx.tbl_tiendas.update({
        where: { id: tienda.id },
        data: { eliminado_en: now, activo: false, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: now },
      });
    });

    notificationService.notifyBuyersStoreVisibilityChanged(tienda.id);

    res.json({ mensaje: 'Tienda eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tienda' });
  }
};

const deleteProduct = async (req, res) => {
  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true } } },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    await prisma.tbl_productos.update({
      where: { id: producto.id },
      data: { eliminado_en: new Date(), estado: PRODUCT_STATE.INACTIVE, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() },
    });

    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
};

module.exports = {
  getSellerProfile, updateSellerProfile,
  getMyStores, createStore, updateStore, resubmitStore, deleteStore,
  getMyProducts, createProduct, updateProduct, updatePrice, toggleProduct, resubmitProduct, deleteProduct,
};
