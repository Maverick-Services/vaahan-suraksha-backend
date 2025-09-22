import cron from "node-cron";
import { rejectOrders } from "../jobs/rejectOrders.job.js";

export const startOrderRejectScheduler = () => {
    cron.schedule("*/30 * * * *", async () => {
        console.log("⏰ Running order reject job at", new Date().toISOString());
        try {
            await rejectOrders();
        } catch (error) {
            console.error("❌ Error running order reject job:", error?.message);
        }
    });
};