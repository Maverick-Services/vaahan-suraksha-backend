import { Router } from "express";
import { createCompany, createEmployee, createUser } from "../controllers/user.controller.js";

const router = Router()

router.route("/createEmploye").post(createEmployee);
router.route("/createCompany").post(createCompany);
router.route("/createUser").post(createUser);

export default router