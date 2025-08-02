// test-socket.js
import { io } from "socket.io-client";

const socket = io("http://localhost:8000", {
    transports: ["websocket"],
    withCredentials: true,
});

socket.on("connect", () => {
    console.log("✅ Connected:", socket.id);

    // Send a test event
    socket.emit("client-message", { msg: "Hello from test!" });

    // Listen for a server response
    socket.on("server-message", (data) => {
        console.log("📡 Server says:", data);
    });
});

socket.on("disconnect", () => {
    console.log("🔴 Disconnected");
});
