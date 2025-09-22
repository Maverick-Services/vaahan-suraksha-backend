import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import multer from "multer"
import { ApiError } from "./utils/ApiError.js"

const app = express()

app.use(cors(
    {
        origin: process.env.CORS_ORIGIN,
        credentials: true
    }
))

// app.use(express.json({ limit: "16kb" }))
// app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())

import userRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';
import serviceRoutes from './routes/service.routes.js';
import oneTimePlanRoutes from './routes/one_time_plan.routes.js';
import carRoutes from './routes/car.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import orderRoutes from './routes/order.routes.js';
import { startOrderRejectScheduler } from "./scheduler/rejectOrderScheduler.js"

app.use('/api/v1/user', userRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/service', serviceRoutes);
app.use('/api/v1/oneTime', oneTimePlanRoutes);
app.use('/api/v1/car', carRoutes);
app.use('/api/v1/inventory', inventoryRoutes);
app.use('/api/v1/order', orderRoutes);

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Your server is up and running...."
    });
});

startOrderRejectScheduler();

// Global error handler
app.use((err, req, res, next) => {
    // logger.error(err);
    console.log(err);
    if (err instanceof multer.MulterError) {
        // Multer-specific errors
        return res
            .status(400)
            .json({ message: "Multer error", error: err.message });
    }
    if (err.message && err.message.toLowerCase().includes("cloudinary")) {
        // Cloudinary-specific errors
        return res
            .status(500)
            .json({ message: "Cloudinary error", error: err.message });
    }
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            status: err.statusCode,
            message: err.message,
            errors: err.errors || [],
            success: false,
        });
    }

    return res.status(500).json({
        status: 500,
        message: err.message || "Internal Server Error",
        success: false,
    });
});

export { app }