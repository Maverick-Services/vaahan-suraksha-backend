import { Router } from "express";
import { getUserDetails, loginUser } from "../controllers/user.controller.js";
import { verifyJWT } from './../middlewares/auth.middlewares.js';

const router = Router()

router.route("/login").post(loginUser);
router.route("/my-details").get(verifyJWT, getUserDetails);

export default router