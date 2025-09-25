import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    assignInventoryToRider,
    createProduct, getProducts, updateProduct,
    updateProductStock
} from "../controllers/inventory.controller.js";
import { getPaginatedProducts } from "../controllers/pagination.controller.js";

const router = Router()

// Product Management Routes
router.route("/product/create").post(verifyJWT, createProduct);
router.route("/product/update").put(verifyJWT, updateProduct);
router.route("/product/stock/update").put(verifyJWT, updateProductStock);
router.route("/product/paginated").get(verifyJWT, getPaginatedProducts);
router.route("/product/").get(getProducts);

// Rider Inventory Management
router.route("/rider/assign").post(verifyJWT, assignInventoryToRider);

export default router