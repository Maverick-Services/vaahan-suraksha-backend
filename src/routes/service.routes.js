import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createService,
    createSubscription,
    updateSubscription,
    addServiceInSubscription, bulkServicesUpdateInSubscription,
    getServices,
    getSubscriptions,
    updateService,
    purchaseB2CUserSubscription,
    verifyB2CSubscriptionPurchase,
    upgradeB2CUserSubscription,
    verifyB2CSubscriptionUpgrade,
    renewB2CUserSubscription,
    verifyB2CSubscriptionRenewal,
} from "../controllers/service.controller.js";
import { getPaginatedServices, getPaginatedSubscriptions } from "../controllers/pagination.controller.js";

const router = Router()

// Service Management Routes
router.route("/create").post(verifyJWT, createService);
router.route("/update").put(verifyJWT, updateService);
router.route("/paginated/").get(verifyJWT, getPaginatedServices);
router.route("/").get(getServices);

// Subscription Management Routes
router.route("/subscription/create").post(verifyJWT, createSubscription);
router.route("/subscription/update").put(verifyJWT, updateSubscription);
router.route("/subscription/addService").post(verifyJWT, addServiceInSubscription);
router.route("/subscription/bulkUpdateServices").post(verifyJWT, bulkServicesUpdateInSubscription);
router.route("/subscription/b2c/purchase").post(verifyJWT, purchaseB2CUserSubscription);
router.route("/subscription/b2c/purchase/verify").post(verifyJWT, verifyB2CSubscriptionPurchase);
router.route("/subscription/upgrade").post(verifyJWT, upgradeB2CUserSubscription);
router.route("/subscription/upgrade/verify").post(verifyJWT, verifyB2CSubscriptionUpgrade);
router.route("/subscription/renew").post(verifyJWT, renewB2CUserSubscription);
router.route("/subscription/renew/verify").post(verifyJWT, verifyB2CSubscriptionRenewal);
router.route("/subscription/paginated/").get(verifyJWT, getPaginatedSubscriptions);
router.route("/subscription/").get(getSubscriptions);

export default router