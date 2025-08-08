import { Router } from "express";
import { verifyJWT } from './../middlewares/auth.middlewares.js';
import {
    createCompany, createEmployee, createRider, createUser,
    updateProfile
} from "../controllers/user.controller.js";
import { getPaginatedUsers } from "../controllers/pagination.controller.js";

const router = Router()

// User Management Routes
router.route("/createEmploye").post(verifyJWT, createEmployee);
router.route("/createRider").post(verifyJWT, createRider);
router.route("/createCompany").post(verifyJWT, createCompany);
router.route("/createUser").post(createUser);
router.route("/update").put(verifyJWT, updateProfile);
router.route("/paginated/").get(verifyJWT, getPaginatedUsers);

export default router