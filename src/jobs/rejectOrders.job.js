import mongoose from "mongoose";
import { Order } from "../models/order.model.js";
import { User } from "../models/user.model.js";
import { ORDER_TYPES, STATUS } from "../constants.js";

const rejectOrders = async () => {

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const orders = await Order.find({
        createdAt: { $lt: thirtyMinutesAgo },
        type: ORDER_TYPES.MONTHLY,
        status: STATUS.PENDING
    })
    // .populate("userId");

    console.log(orders);
    for (const order of orders) {
        let orderId = order?._id;
        let userId = order?.userId;

        if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) continue;

        const foundOrder = await Order.findById(orderId);
        if (!foundOrder) continue;

        if (foundOrder.type == ORDER_TYPES.ONE_TIME) continue;

        if (foundOrder.status == STATUS.REJECTED) continue;

        if (foundOrder.status != STATUS.PENDING) continue;

        //Update the order status to rejected
        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            {
                status: STATUS.REJECTED,
                trackStatus: STATUS.REJECTED,
            },
            { new: true }
        )
        console.log("Updated Order:", updatedOrder);

        //Update User limit
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            [
                {
                    $set: {
                        "currentPlan.limit": { $add: ["$currentPlan.limit", 1] },
                        "currentPlan.isVerified": {
                            $cond: [
                                { $eq: ["$currentPlan.limit", 0] }, // before increment
                                true,
                                "$currentPlan.isVerified"
                            ]
                        },
                        isSubscribed: {
                            $cond: [
                                { $eq: ["$currentPlan.limit", 0] }, // before increment
                                true,
                                "$isSubscribed"
                            ]
                        }
                    }
                }
            ],
            { new: true }
        ).select('-password -refreshToken');

        console.log("Updated User:", updatedUser);

    }
}

export {
    rejectOrders
}