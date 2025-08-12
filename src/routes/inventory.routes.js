import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createProduct, updateProduct,
    updateProductStock
} from "../controllers/inventory.controller.js";

const router = Router()

// Product Management Routes
router.route("/product/create").post(verifyJWT, createProduct);
router.route("/product/update").put(verifyJWT, updateProduct);
router.route("/product/stock/update").put(verifyJWT, updateProductStock);
// router.route("/paginated/").get(verifyJWT, getPaginatedServices);
// router.route("/").get(getServices);

// Model Management Routes
// router.route("/model/create").post(verifyJWT, createCarModel);
// router.route("/subscription/update").put(verifyJWT, updateSubscription);
// router.route("/subscription/addService").post(verifyJWT, addServiceInSubscription);
// router.route("/subscription/bulkUpdateServices").post(verifyJWT, bulkServicesUpdateInSubscription);
// router.route("/subscription/paginated/").get(verifyJWT, getPaginatedSubscriptions);
// router.route("/subscription/").get(getSubscriptions);

export default router