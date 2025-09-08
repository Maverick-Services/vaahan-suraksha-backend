import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createBrand, createCar, createCarModel,
    deleteCar,
    getBrands,
    getCarByUser,
    getCarModelsByBrand,
    updateBrand,
    updateCar,
    updateCarModel
} from "../controllers/car.controller.js";
import { getPaginatedBrands, getPaginatedCarModels } from "../controllers/pagination.controller.js";

const router = Router()

// Brand Management Routes
router.route("/brand/create").post(verifyJWT, createBrand);
router.route("/brand/update").put(verifyJWT, updateBrand);
router.route("/brand/paginated/").get(verifyJWT, getPaginatedBrands);
router.route("/brand/").get(getBrands);

// Model Management Routes
router.route("/model/create").post(verifyJWT, createCarModel);
router.route("/model/update").put(verifyJWT, updateCarModel);
router.route("/model/paginated/").get(verifyJWT, getPaginatedCarModels);
router.route("/model/:brandId").get(getCarModelsByBrand);

// User Car Management Routes
router.route("/create").post(verifyJWT, createCar);
router.route("/update").put(verifyJWT, updateCar);
router.route("/delete").delete(verifyJWT, deleteCar);
router.route("/").get(verifyJWT, getCarByUser);

export default router