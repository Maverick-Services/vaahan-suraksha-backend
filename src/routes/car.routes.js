import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createBrand, createCar, createCarModel,
    deleteCar,
    getBrands,
    getCarByUser,
    getCarModelsByBrand,
    updateCar
} from "../controllers/car.controller.js";

const router = Router()

// Brand Management Routes
router.route("/brand/create").post(verifyJWT, createBrand);
// router.route("/update").put(verifyJWT, updateService);
// router.route("/paginated/").get(verifyJWT, getPaginatedServices);
router.route("/brand/").get(getBrands);

// Model Management Routes
router.route("/model/create").post(verifyJWT, createCarModel);
// router.route("/subscription/update").put(verifyJWT, updateSubscription);
// router.route("/subscription/addService").post(verifyJWT, addServiceInSubscription);
// router.route("/subscription/bulkUpdateServices").post(verifyJWT, bulkServicesUpdateInSubscription);
// router.route("/subscription/paginated/").get(verifyJWT, getPaginatedSubscriptions);
router.route("/model/:brandId").get(getCarModelsByBrand);

// User Car Management Routes
router.route("/create").post(verifyJWT, createCar);
router.route("/update").put(verifyJWT, updateCar);
router.route("/delete").delete(verifyJWT, deleteCar);
router.route("/").get(verifyJWT, getCarByUser);

export default router