import express from 'express';
import { addToCart, getCartProducts, removeAllFromCart, updateQuantity } from '../controllers/cart.controller.js';
import { protectRoute } from '../middleware/auth.middleware.js';
const router = express.Router();

router.get('/', protectRoute, getCartProducts);
router.post('/', protectRoute,  addToCart);
router.delete('/', protectRoute,  removeAllFromCart);
router.put('/:productId', protectRoute,  updateQuantity); // this wll make the product either increased or decresed

export default router;