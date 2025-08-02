import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import multer from "multer"
import { ApiError } from "./utils/ApiError.js"

const app = express()

app.use(cors(
    // {
    //     origin: process.env.CORS_ORIGIN,
    //     credentials: true
    // }
))

// app.use(express.json({ limit: "16kb" }))
// app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static("public"))
app.use(cookieParser())

import adminRoutes from './routes/user.routes.js';
import authRoutes from './routes/auth.routes.js';

app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/auth', authRoutes);

app.get('/', (req, res) => {
    res.json({
        success: true,
        message: "Your server is up and running...."
    });
});


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