import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createSubscriptionOrder,
    getMyOrders,
    verifySubscriptionOrderPayment
} from "../controllers/service.controller.js";
import { createSubscribedUserOrder } from "../controllers/order.controller.js";

const router = Router()

// Order Management Routes
router.route("/monthly/create").post(verifyJWT, createSubscribedUserOrder);
router.route("/oneTime/create").post(verifyJWT, createSubscriptionOrder);
router.route("/oneTime/verify").post(verifyJWT, verifySubscriptionOrderPayment);
router.route("/my").get(verifyJWT, getMyOrders);


export default router