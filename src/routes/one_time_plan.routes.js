import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    addServiceInPlan,
    bulkServicesUpdateInPlan,
    createOneTimePlan,
    getPlans,
    updateOneTimePlan
} from "../controllers/OneTimePlan.controller.js";
import { getPaginatedOneTimePlans } from "../controllers/pagination.controller.js";

const router = Router()

// Service Management Routes
router.route("/create").post(verifyJWT, createOneTimePlan);
router.route("/update").put(verifyJWT, updateOneTimePlan);
router.route("/addService").post(verifyJWT, addServiceInPlan);
router.route("/bulkUpdateServices").post(verifyJWT, bulkServicesUpdateInPlan);
router.route("/paginated/").get(verifyJWT, getPaginatedOneTimePlans);
router.route("/").get(getPlans);

export default router