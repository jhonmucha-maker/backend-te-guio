const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { validateCreateTicket, validateSendMessage } = require('../validators/ticketValidator');
const { createTicket, getMyTickets, getTicketDetail, getUnreadCount, sendMessage, markRead, acceptTicket, closeTicket } = require('../controllers/ticketsController');

router.post('/tickets', verificarToken, validateCreateTicket, createTicket);
router.get('/tickets', verificarToken, getMyTickets);
router.get('/tickets/unread-count', verificarToken, getUnreadCount);
router.get('/tickets/:id', verificarToken, getTicketDetail);
router.post('/tickets/:id/messages', verificarToken, validateSendMessage, sendMessage);
router.post('/tickets/:id/mark-read', verificarToken, markRead);
router.patch('/tickets/:id/read', verificarToken, markRead);
router.post('/tickets/:id/accept', verificarToken, acceptTicket);
router.patch('/tickets/:id/accept', verificarToken, acceptTicket);
router.post('/tickets/:id/close', verificarToken, closeTicket);
router.patch('/tickets/:id/close', verificarToken, closeTicket);

module.exports = router;
