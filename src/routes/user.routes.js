import { Router } from "express";
import {
    createCompany, createEmployee, createRider, createUser
} from "../controllers/user.controller.js";

const router = Router()

// User Management Routes
router.route("/createEmploye").post(createEmployee);
router.route("/createRider").post(createRider);
router.route("/createCompany").post(createCompany);
router.route("/createUser").post(createUser);

//Service Management Routes

export default router