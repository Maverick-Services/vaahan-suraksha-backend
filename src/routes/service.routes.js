import { Router } from "express";
import {
    createService,
    addServiceInSubscription, bulkServicesUpdateInSubscription,
    createSubscription
} from "../controllers/service.controller.js";

const router = Router()

router.route("/create").post(createService);
router.route("/subscription/create").post(createSubscription);
router.route("/subscription/addService").post(addServiceInSubscription);
router.route("/subscription/bulkUpdateServices").post(bulkServicesUpdateInSubscription);

export default router