// server.js
import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { app } from "./src/app.js";
import connectDB from "./src/db/index.js";

dotenv.config();

const PORT = process.env.PORT || 8000;
const isVercel = Boolean(process.env.VERCEL);

let handler; // will hold the serverless handler when needed

if (!isVercel) {
    // --- Persistent environment ---
    const server = http.createServer(app);

    const io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || "http://localhost:3000",
            methods: ["GET", "POST"],
            credentials: true,
        },
    });

    io.on("connection", (socket) => {
        console.log("🟢 Socket connected:", socket.id);

        socket.on("client-message", (data) => {
            console.log("Received from client:", data);
            io.emit("server-message", { message: "message from server", data });
        });

        socket.on("disconnect", () => {
            console.log("🔴 Socket disconnected:", socket.id);
        });
    });

    connectDB()
        .then(() => {
            server.listen(PORT, () => {
                console.log(`🚀 Server listening on port ${PORT}`);
            });
        })
        .catch((err) => {
            console.error("❌ MONGO db connection failed !!! ", err);
        });
} else {
    // --- Vercel serverless mode ---
    console.log("Running on Vercel: exporting app (no sockets).");

    let isConnected = false;
    handler = async function (req, res) {
        if (!isConnected) {
            await connectDB();
            isConnected = true;
            console.log("✅ DB connected in serverless mode");
        }
        return app(req, res);
    };
}

// Top-level export (valid ESM)
export default handler;


// // server.js
// import http from "http";
// import dotenv from "dotenv";
// import { Server } from "socket.io";
// import { app } from "./src/app.js";
// import connectDB from "./src/db/index.js";

// dotenv.config();

// const PORT = process.env.PORT || 8000;

// const server = http.createServer(app);

// const io = new Server(server
//     , {
//         cors: {
//             origin: process.env.CORS_ORIGIN || "http://localhost:3000",
//             methods: ["GET", "POST"],
//             credentials: true
//         }
//     }
// );

// // Socket.IO Events
// io.on("connection", (socket) => {
//     console.log("🟢 Socket connected:", socket.id);

//     socket.on("client-message", (data) => {
//         console.log("Received from client:", data);
//         // Example broadcast
//         // socket.broadcast.emit("server-message", {
//         //     message: "Broadcast from server",
//         //     data,
//         // });
//         io.emit("server-message", {
//             message: "message from server",
//             data,
//         });
//     });

//     socket.on("disconnect", () => {
//         console.log("🔴 Socket disconnected:", socket.id);
//     });
// });
// connectDB()
//     .then(() => {
//         // app.listen(process.env.PORT || 8000, () => {
//         //     console.log(`⚙️ Server is running at  : ${process.env.PORT}`);
//         // })
//         server.listen(PORT, () => {
//             console.log(`🚀 Server listening on port ${PORT}`);
//         });
//     })
//     .catch((err) => {
//         console.log("MONGO db connection failed !!! ", err);
//     })
