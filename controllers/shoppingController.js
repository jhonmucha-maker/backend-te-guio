const prisma = require('../config/db');
const { SHOPPING_LIST_STATUS, RATING_WINDOW_DAYS, TIMEZONE } = require('../config/constants');
const notificationService = require('../services/notificationService');

const getShoppingList = async (req, res) => {
  try {
    let lista = await prisma.tbl_listas_compras.findFirst({
      where: { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.OPEN },
      include: {
        items: {
          include: {
            tbl_productos: {
              select: {
                id: true, nombre: true, precio: true, moneda: true, precio_visible: true,
                fotos: { take: 1, orderBy: { posicion: 'asc' } },
                tbl_tiendas: {
                  select: {
                    id: true, nombre: true, numero_local: true,
                    suscripcion_activa: { select: { estado: true, fin_en: true } },
                    tbl_galerias: {
                      select: {
                        id: true, nombre: true, direccion: true, latitud: true, longitud: true,
                        tbl_zonas: { select: { id: true, nombre: true } },
                        tbl_ciudades: { select: { id: true, nombre: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { fecha_hora_registro: 'asc' },
        },
      },
    });

    // Si no hay lista abierta, crear una
    if (!lista) {
      lista = await prisma.tbl_listas_compras.create({
        data: { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.OPEN },
        include: { items: true },
      });
    }

    // Filtrar items: solo mostrar productos de tiendas con suscripción vigente (items manuales siempre visibles)
    const now = new Date();
    const itemsFiltrados = lista.items.filter(item => {
      if (item.tipo === 'MANUAL') return true;
      const sub = item.tbl_productos?.tbl_tiendas?.suscripcion_activa;
      return sub && sub.estado === 'ACTIVE' && new Date(sub.fin_en) >= now;
    });

    // Calcular total (solo productos con precio visible, no manuales ni precio oculto)
    const total = itemsFiltrados
      .filter(i => i.tipo === 'PRODUCT' && i.snapshot_precio && i.tbl_productos?.precio_visible !== false)
      .reduce((sum, i) => sum + parseFloat(i.snapshot_precio) * i.cantidad, 0);

    // Transformar nombres Prisma a formato frontend
    const itemsTransformados = itemsFiltrados.map(item => {
      const { tbl_productos, tbl_listas_compras, ...rest } = item;
      const resultado = {
        ...rest,
        precio_snapshot: item.snapshot_precio,
        nombre_referencia: item.texto_manual,
      };

      if (tbl_productos) {
        const { tbl_tiendas, ...prodRest } = tbl_productos;
        resultado.producto = { ...prodRest, foto: tbl_productos.fotos?.[0]?.url || null };
        if (tbl_tiendas) {
          const { tbl_galerias, ...tiendaRest } = tbl_tiendas;
          resultado.producto.tienda = { ...tiendaRest };
          if (tbl_galerias) {
            const { tbl_zonas, tbl_ciudades, ...galeriaRest } = tbl_galerias;
            resultado.producto.tienda.galeria = {
              ...galeriaRest,
              zona: tbl_zonas || null,
              ciudad: tbl_ciudades || null,
            };
          }
        }
      }

      return resultado;
    });

    const { items: _raw, ...listaRest } = lista;
    res.json({ data: { ...listaRest, items: itemsTransformados, total_estimado: total } });
  } catch (error) {
    console.error('Error obteniendo lista:', error);
    res.status(500).json({ error: 'Error al obtener lista de compras' });
  }
};

const addItem = async (req, res) => {
  try {
    const { tipo, product_id, texto_manual, cantidad, zone_id, gallery_id } = req.body;

    // Obtener o crear lista abierta
    let lista = await prisma.tbl_listas_compras.findFirst({
      where: { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.OPEN },
    });
    if (!lista) {
      lista = await prisma.tbl_listas_compras.create({
        data: { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.OPEN },
      });
    }

    const itemData = {
      id_lista: lista.id,
      tipo: (tipo === 'MANUAL') ? 'MANUAL' : 'PRODUCT',
      cantidad: parseInt(cantidad) || 1,
      id_usuario_registro: req.user.id,
    };

    if (tipo === 'MANUAL') {
      if (!texto_manual) return res.status(400).json({ error: 'Texto manual requerido' });

      itemData.texto_manual = texto_manual;

      if (zone_id) {
        itemData.snapshot_id_zona = parseInt(zone_id);
      }
      if (gallery_id) {
        const galeria = await prisma.tbl_galerias.findFirst({
          where: { id: parseInt(gallery_id), activo: true, eliminado_en: null },
        });
        if (!galeria) return res.status(400).json({ error: 'Galeria no valida' });
        itemData.snapshot_id_galeria = parseInt(gallery_id);
        itemData.snapshot_id_ciudad = galeria.id_ciudad;
      }
    } else {
      if (!product_id) return res.status(400).json({ error: 'product_id requerido' });

      const producto = await prisma.tbl_productos.findFirst({
        where: {
          id: parseInt(product_id),
          estado_aprobacion: 'APROBADO',
          estado: 'ACTIVE',
          eliminado_en: null,
          tbl_tiendas: {
            estado_aprobacion: 'APROBADO',
            activo: true,
            eliminado_en: null,
            suscripcion_activa: { estado: 'ACTIVE', fin_en: { gte: new Date() } },
          },
        },
        include: {
          tbl_tiendas: {
            select: { id: true, id_galeria: true, tbl_galerias: { select: { id_zona: true, id_ciudad: true } } },
          },
        },
      });
      if (!producto) return res.status(400).json({ error: 'Producto no disponible' });

      // Si el producto ya existe en la lista y no fue comprado, incrementar cantidad
      const existingItem = await prisma.tbl_items_lista_compras.findFirst({
        where: {
          id_lista: lista.id,
          id_producto: parseInt(product_id),
          comprado: false,
        },
      });

      if (existingItem) {
        const updated = await prisma.tbl_items_lista_compras.update({
          where: { id: existingItem.id },
          data: {
            cantidad: existingItem.cantidad + (parseInt(cantidad) || 1),
            snapshot_precio: producto.precio,
          },
        });
        notificationService.shoppingListUpdated(req.user.id);
        return res.status(200).json({ data: updated });
      }

      itemData.id_producto = producto.id;
      itemData.snapshot_precio = producto.precio;
      itemData.snapshot_id_tienda = producto.tbl_tiendas.id;
      itemData.snapshot_id_galeria = producto.tbl_tiendas.id_galeria;
      itemData.snapshot_id_zona = producto.tbl_tiendas.tbl_galerias.id_zona;
      itemData.snapshot_id_ciudad = producto.tbl_tiendas.tbl_galerias.id_ciudad;
    }

    const item = await prisma.tbl_items_lista_compras.create({ data: itemData });

    notificationService.shoppingListUpdated(req.user.id);
    res.status(201).json({ data: item });
  } catch (error) {
    console.error('Error agregando item:', error);
    res.status(500).json({ error: 'Error al agregar item' });
  }
};

const updateItem = async (req, res) => {
  try {
    const { cantidad, comentario } = req.body;
    const item = await prisma.tbl_items_lista_compras.findFirst({
      where: { id: parseInt(req.params.id) },
      include: { tbl_listas_compras: true },
    });

    if (!item || item.tbl_listas_compras.id_comprador !== req.user.id) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    if (item.tbl_listas_compras.estado !== SHOPPING_LIST_STATUS.OPEN) {
      return res.status(400).json({ error: 'La lista ya esta completada' });
    }

    const data = {};
    if (cantidad !== undefined) data.cantidad = parseInt(cantidad);
    if (comentario !== undefined) data.comentario = comentario;

    const updated = await prisma.tbl_items_lista_compras.update({
      where: { id: item.id },
      data,
    });

    res.json({ data: updated });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar item' });
  }
};

const markPurchased = async (req, res) => {
  try {
    const item = await prisma.tbl_items_lista_compras.findFirst({
      where: { id: parseInt(req.params.id) },
      include: { tbl_listas_compras: true },
    });

    if (!item || item.tbl_listas_compras.id_comprador !== req.user.id) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    if (item.tbl_listas_compras.estado !== SHOPPING_LIST_STATUS.OPEN) {
      return res.status(400).json({ error: 'La lista ya esta completada' });
    }

    const now = new Date();
    await prisma.tbl_items_lista_compras.update({
      where: { id: item.id },
      data: { comprado: true, comprado_en: now },
    });

    // Verificar si todos los items estan comprados
    const itemsSinComprar = await prisma.tbl_items_lista_compras.count({
      where: { id_lista: item.id_lista, comprado: false },
    });

    let listaCompletada = false;
    if (itemsSinComprar === 0) {
      await prisma.tbl_listas_compras.update({
        where: { id: item.id_lista },
        data: { estado: SHOPPING_LIST_STATUS.COMPLETED, completada_en: now },
      });
      // Crear nueva lista abierta
      await prisma.tbl_listas_compras.create({
        data: { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.OPEN },
      });
      listaCompletada = true;
    }

    // Payload para modal de calificacion
    const ratingPayload = {};
    if (item.tipo === 'PRODUCT' && item.id_producto) {
      const deadlineAt = new Date(now.getTime() + RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

      // Verificar si ya califico hoy (TZ Peru)
      const hoyPeru = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
      const inicioDia = new Date(hoyPeru.getFullYear(), hoyPeru.getMonth(), hoyPeru.getDate());
      const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

      const [calProdHoy, calTiendaHoy] = await Promise.all([
        prisma.tbl_calificaciones_productos.count({
          where: {
            id_comprador: req.user.id,
            id_producto: item.id_producto,
            calificado_en: { gte: inicioDia, lt: finDia },
          },
        }),
        item.snapshot_id_tienda ? prisma.tbl_calificaciones_tiendas.count({
          where: {
            id_comprador: req.user.id,
            id_tienda: item.snapshot_id_tienda,
            calificado_en: { gte: inicioDia, lt: finDia },
          },
        }) : Promise.resolve(0),
      ]);

      ratingPayload.product_id = item.id_producto;
      ratingPayload.store_id = item.snapshot_id_tienda;
      ratingPayload.deadline_at = deadlineAt;
      ratingPayload.puede_calificar_producto_hoy = calProdHoy === 0;
      ratingPayload.puede_calificar_tienda_hoy = calTiendaHoy === 0;
    }

    notificationService.shoppingListUpdated(req.user.id);

    res.json({
      mensaje: 'Item marcado como comprado',
      lista_completada: listaCompletada,
      rating_payload: ratingPayload,
    });
  } catch (error) {
    console.error('Error marcando comprado:', error);
    res.status(500).json({ error: 'Error al marcar como comprado' });
  }
};

const unmarkPurchased = async (req, res) => {
  try {
    const item = await prisma.tbl_items_lista_compras.findFirst({
      where: { id: parseInt(req.params.id) },
      include: { tbl_listas_compras: true },
    });

    if (!item || item.tbl_listas_compras.id_comprador !== req.user.id) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }
    if (!item.comprado) {
      return res.json({ mensaje: 'El item ya no esta marcado como comprado' });
    }

    // Si la lista fue completada, revertirla a OPEN y eliminar la nueva lista vacía que se creó
    if (item.tbl_listas_compras.estado === SHOPPING_LIST_STATUS.COMPLETED) {
      // Reabrir esta lista
      await prisma.tbl_listas_compras.update({
        where: { id: item.id_lista },
        data: { estado: SHOPPING_LIST_STATUS.OPEN, completada_en: null },
      });
      // Eliminar la lista vacía que se creó automáticamente al completar
      const listaVacia = await prisma.tbl_listas_compras.findFirst({
        where: {
          id_comprador: req.user.id,
          estado: SHOPPING_LIST_STATUS.OPEN,
          id: { not: item.id_lista },
        },
        include: { _count: { select: { items: true } } },
      });
      if (listaVacia && listaVacia._count.items === 0) {
        await prisma.tbl_listas_compras.delete({ where: { id: listaVacia.id } });
      }
    }

    // Desmarcar el item
    await prisma.tbl_items_lista_compras.update({
      where: { id: item.id },
      data: { comprado: false, comprado_en: null },
    });

    // Eliminar calificaciones hechas HOY por este comprador para este producto/tienda
    // y recalcular agregados
    const deletedIds = { product_rating_deleted: false, store_rating_deleted: false };

    if (item.tipo === 'PRODUCT' && item.id_producto) {
      const hoyPeru = new Date(new Date().toLocaleString('en-US', { timeZone: TIMEZONE }));
      const inicioDia = new Date(hoyPeru.getFullYear(), hoyPeru.getMonth(), hoyPeru.getDate());
      const finDia = new Date(inicioDia.getTime() + 24 * 60 * 60 * 1000);

      // Eliminar calificación del producto de hoy
      const deletedProd = await prisma.tbl_calificaciones_productos.deleteMany({
        where: {
          id_comprador: req.user.id,
          id_producto: item.id_producto,
          calificado_en: { gte: inicioDia, lt: finDia },
        },
      });
      deletedIds.product_rating_deleted = deletedProd.count > 0;

      // Recalcular agregados del producto
      if (deletedIds.product_rating_deleted) {
        const stats = await prisma.tbl_calificaciones_productos.aggregate({
          where: { id_producto: item.id_producto },
          _avg: { estrellas: true },
          _count: { id: true },
        });
        const promedioProd = stats._avg.estrellas
          ? parseFloat(Number(stats._avg.estrellas).toFixed(2))
          : 0;
        await prisma.tbl_agregados_cal_productos.upsert({
          where: { id_producto: item.id_producto },
          create: {
            id_producto: item.id_producto,
            promedio: promedioProd,
            total: stats._count.id,
          },
          update: {
            promedio: promedioProd,
            total: stats._count.id,
            actualizado_en: new Date(),
          },
        });
      }

      // Eliminar calificación de la tienda de hoy
      if (item.snapshot_id_tienda) {
        const deletedStore = await prisma.tbl_calificaciones_tiendas.deleteMany({
          where: {
            id_comprador: req.user.id,
            id_tienda: item.snapshot_id_tienda,
            calificado_en: { gte: inicioDia, lt: finDia },
          },
        });
        deletedIds.store_rating_deleted = deletedStore.count > 0;

        // Recalcular agregados de la tienda
        if (deletedIds.store_rating_deleted) {
          const stats = await prisma.tbl_calificaciones_tiendas.aggregate({
            where: { id_tienda: item.snapshot_id_tienda },
            _avg: { estrellas: true },
            _count: { id: true },
          });
          const promedioTienda = stats._avg.estrellas
            ? parseFloat(Number(stats._avg.estrellas).toFixed(2))
            : 0;
          await prisma.tbl_agregados_cal_tiendas.upsert({
            where: { id_tienda: item.snapshot_id_tienda },
            create: {
              id_tienda: item.snapshot_id_tienda,
              promedio: promedioTienda,
              total: stats._count.id,
            },
            update: {
              promedio: promedioTienda,
              total: stats._count.id,
              actualizado_en: new Date(),
            },
          });
        }
      }
    }

    notificationService.shoppingListUpdated(req.user.id);

    res.json({
      mensaje: 'Compra desmarcada',
      ...deletedIds,
    });
  } catch (error) {
    console.error('Error desmarcando compra:', error);
    res.status(500).json({ error: 'Error al desmarcar compra' });
  }
};

const deleteItem = async (req, res) => {
  try {
    const item = await prisma.tbl_items_lista_compras.findFirst({
      where: { id: parseInt(req.params.id) },
      include: { tbl_listas_compras: true },
    });

    if (!item || item.tbl_listas_compras.id_comprador !== req.user.id) {
      return res.status(404).json({ error: 'Item no encontrado' });
    }

    await prisma.tbl_items_lista_compras.delete({ where: { id: item.id } });
    notificationService.shoppingListUpdated(req.user.id);
    res.json({ mensaje: 'Item eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar item' });
  }
};

const getShoppingHistory = async (req, res) => {
  try {
    const page = parseInt(req.query.page || 1);
    const limit = 10;
    const { q, desde, hasta } = req.query;

    const where = { id_comprador: req.user.id, estado: SHOPPING_LIST_STATUS.COMPLETED };

    // Filtro por rango de fechas
    if (desde || hasta) {
      where.completada_en = {};
      if (desde) where.completada_en.gte = new Date(desde);
      if (hasta) {
        const hastaDate = new Date(hasta);
        hastaDate.setHours(23, 59, 59, 999);
        where.completada_en.lte = hastaDate;
      }
    }

    // Filtro por búsqueda en items
    if (q) {
      where.items = {
        some: {
          OR: [
            { texto_manual: { contains: q, mode: 'insensitive' } },
            { tbl_productos: { nombre: { contains: q, mode: 'insensitive' } } },
          ],
        },
      };
    }

    const [listas, total] = await Promise.all([
      prisma.tbl_listas_compras.findMany({
        where,
        include: {
          items: {
            include: {
              tbl_productos: {
                select: {
                  id: true,
                  nombre: true,
                  precio: true,
                  precio_visible: true,
                  id_tienda: true,
                  estado: true,
                  eliminado_en: true,
                  fotos: { take: 1, orderBy: { posicion: 'asc' }, select: { url: true } },
                  tbl_tiendas: {
                    select: {
                      id: true,
                      nombre: true,
                      tbl_galerias: { select: { nombre: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { completada_en: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tbl_listas_compras.count({ where }),
    ]);

    // Collect unique product and store IDs to check ratings
    const productIds = new Set();
    const storeIds = new Set();
    for (const lista of listas) {
      for (const item of lista.items) {
        if (item.id_producto) productIds.add(item.id_producto);
        const tiendaId = item.tbl_productos?.id_tienda || item.snapshot_id_tienda;
        if (tiendaId) storeIds.add(tiendaId);
      }
    }

    // Query existing ratings for this buyer
    const [ratedProducts, ratedStores] = await Promise.all([
      productIds.size > 0
        ? prisma.tbl_calificaciones_productos.findMany({
            where: { id_comprador: req.user.id, id_producto: { in: [...productIds] } },
            select: { id_producto: true },
          })
        : [],
      storeIds.size > 0
        ? prisma.tbl_calificaciones_tiendas.findMany({
            where: { id_comprador: req.user.id, id_tienda: { in: [...storeIds] } },
            select: { id_tienda: true },
          })
        : [],
    ]);

    const ratedProductSet = new Set(ratedProducts.map((r) => r.id_producto));
    const ratedStoreSet = new Set(ratedStores.map((r) => r.id_tienda));

    // Enrich items with rating flags and store/gallery info
    const enrichedLists = listas.map((lista) => ({
      ...lista,
      items: lista.items.map((item) => {
        const tiendaId = item.tbl_productos?.id_tienda || item.snapshot_id_tienda;
        const tienda = item.tbl_productos?.tbl_tiendas;
        return {
          ...item,
          id_tienda: tiendaId || null,
          nombre_tienda: tienda?.nombre || null,
          nombre_galeria: tienda?.tbl_galerias?.nombre || null,
          calificado_producto: item.id_producto ? ratedProductSet.has(item.id_producto) : false,
          calificado_tienda: tiendaId ? ratedStoreSet.has(tiendaId) : false,
        };
      }),
    }));

    res.json({
      data: enrichedLists,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
};

// Tiendas donde el comprador ha comprado (listas completadas)
const getPurchasedStores = async (req, res) => {
  try {
    const items = await prisma.tbl_items_lista_compras.findMany({
      where: {
        tipo: 'PRODUCT',
        snapshot_id_tienda: { not: null },
        tbl_listas_compras: {
          id_comprador: req.user.id,
          estado: SHOPPING_LIST_STATUS.COMPLETED,
        },
      },
      select: { snapshot_id_tienda: true },
      distinct: ['snapshot_id_tienda'],
    });

    const storeIds = items.map((i) => i.snapshot_id_tienda);
    if (storeIds.length === 0) return res.json({ data: [] });

    const stores = await prisma.tbl_tiendas.findMany({
      where: { id: { in: storeIds } },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });

    res.json({ data: stores });
  } catch (error) {
    console.error('Error obteniendo tiendas compradas:', error);
    res.status(500).json({ error: 'Error al obtener tiendas' });
  }
};

module.exports = {
  getShoppingList, addItem, updateItem, markPurchased, unmarkPurchased, deleteItem, getShoppingHistory, getPurchasedStores,
};
