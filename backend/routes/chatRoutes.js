import express from 'express';
import { getChats, createChat, deleteChat, getMessages, handleChatStream, handleMemoryChat, getUserMemory } from '../controllers/langchainChatController.js';

const router = express.Router();

router.route('/').get(getChats).post(createChat);
router.route('/:id').delete(deleteChat);
router.route('/:id/messages').get(getMessages);
router.post('/stream', handleChatStream);

// New Advanced Memory System Routes
router.post('/memory', handleMemoryChat);
router.get('/memory/:userId', getUserMemory);

export default router;
