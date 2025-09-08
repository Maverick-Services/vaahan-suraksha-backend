import mongoose from "mongoose";
import Razorpay from "razorpay";
import crypto from 'crypto';
import { v4 as uuidv4 } from "uuid";
import { Service } from "../models/service.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Order } from "../models/order.model.js";
import { ROLES, STATUS } from "../constants.js";
import { User } from "../models/user.model.js";
import { OneTime } from "../models/oneTimePlan.model.js";

// Razorpy Config
const razorpayConfig = () => {
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    return razorpay;
}

// One Time Subscription Order Management
const createOneTimeOrder = asyncHandler(async (req, res) => {

    let {
        amount,
        name, phoneNo,
        scheduledOn,
        location,
        planId,
        serviceIds,
        pricingType,
        carType
    } = req?.body;

    const razorpay = await razorpayConfig();

    if (req?.user?.role != ROLES.USER) {
        throw new ApiError(401, "Only customers can buy services.");
    }

    if (!planId || !pricingType || amount == undefined || amount < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to create Order.");
    }

    if (!name || !phoneNo || !scheduledOn || !location) {
        throw new ApiError(404, "Customer details not found.");
    }

    //Check for valid plan Id
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ApiError(404, "Valid Plan Id required.");
    }

    const foundPlan = await OneTime.findById(planId);
    if (!foundPlan) {
        throw new ApiError(500, "Plan not found");
    }

    //check if service exist in subscription
    for (let serviceId of serviceIds) {
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            throw new ApiError(404, "Valid Service Id required.");
        }
        if (!foundPlan?.services?.some(sr => sr?.toString() == serviceId?.toString())) {
            throw new ApiError(404, `${serviceId} not found in plan`);
        }
    }

    // 1️⃣ Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
        amount: amount * 100, // in paise
        currency: 'INR',
        receipt: `rcpt_${uuidv4().split('-')[0]}`,
        payment_capture: 1
    });

    const newOrder = await Order.create({
        serviceCharge: amount,
        paidAmount: amount,
        orderAmount: amount,
        oneTimePlan: planId,
        subscriptionName: foundPlan?.name,
        type: pricingType == "oneTimePrice" ? "oneTime" : "monthly",
        services: serviceIds,
        name, phoneNo,
        scheduledOn,
        location,
        carType,
        userId: req?.user?._id
    });

    return res.status(201).json(
        new ApiResponse(201, {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            newOrderId: newOrder._id,
        }, 'Razorpay Order Created')
    );
});

const verifyOneTimeOrderPayment = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        orderId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
        throw new ApiError(400, 'Payment verification details missing.');
    }

    // 1️⃣ Verify Signature
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    const order = await Order.findById(orderId);
    if (!order) throw new ApiError(404, 'Order not found.');

    let updatedUser = null;
    if (isValid) {
        order.paymentStatus = "Paid";
        order.razorpayOrderId = razorpay_order_id;
        order.razorpayPaymentId = razorpay_payment_id;
        await order.save();

        // Add Order in User Order
        updatedUser = await User.findByIdAndUpdate(
            order.userId,
            { $push: { orders: order._id } },
            { new: true }
        ).select('-password -refreshToken');
    }

    return res.status(200).json(
        new ApiResponse(200, { order, user: updatedUser }, "Payment Verified. Order Completed")
    );
});

// Subscribed User Order Management
// One Time Subscription Order Management
const createSubscribedUserOrder = asyncHandler(async (req, res) => {

    let {
        amount,
        name, phoneNo,
        scheduledOn,
        location,
        planId,
        serviceIds,
        pricingType
    } = req?.body;


    if (req?.user?.role != ROLES.USER) {
        throw new ApiError(401, "Only customers can book subscription.");
    }

    if (!req?.user?.isSubscribed) {
        throw new ApiError(401, "User not Subscribed");
    }

    if (!req?.user?.currentPlan?.isVerified) {
        throw new ApiError(401, "Subscription not verified");
    }

    if (req?.user?.currentPlan?.limit < 1) {
        throw new ApiError(400, "Service limit exhausted, Renew Subscription");
    }

    if (!planId || amount == undefined || amount < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to create Order.");
    }

    if (!name || !phoneNo || !scheduledOn || !location) {
        throw new ApiError(404, "Customer details not found.");
    }

    //Check for valid subscription Id
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ApiError(404, "Valid Subscription Id required.");
    }

    const foundSubscription = await Subscription.findById(planId);
    if (!foundSubscription) {
        throw new ApiError(500, "Subscription not found");
    }

    //check if service exist in subscription
    for (let serviceId of serviceIds) {
        if (!mongoose.Types.ObjectId.isValid(serviceId)) {
            throw new ApiError(404, "Valid Service Id required.");
        }
        if (!req?.user?.currentPlan?.services?.some(sr => sr?.toString() == serviceId?.toString())) {
            throw new ApiError(404, `One or more service is not included in the plan`);
        }
    }

    const newOrder = await Order.create({
        serviceCharge: 0,
        paidAmount: 0,
        orderAmount: 0,
        subscriptionId: planId || req?.user?.currentPlan?.subscriptionId,
        subscriptionName: req?.user?.currentPlan?.name,
        type: "monthly",
        services: serviceIds,
        paymentStatus: "Paid",
        name, phoneNo,
        scheduledOn,
        location,
        userId: req?.user?._id
    });


    const updatedUser = await User.findOneAndUpdate(
        { _id: req?.user?._id, "currentPlan.limit": { $gt: 0 } }, // only if limit > 0
        [
            {
                $set: {
                    orders: { $concatArrays: ["$orders", [newOrder._id]] },
                    "currentPlan.limit": { $subtract: ["$currentPlan.limit", 1] },
                    isSubscribed: {
                        $cond: {
                            if: { $gt: [{ $subtract: ["$currentPlan.limit", 1] }, 0] },
                            then: true,
                            else: false
                        }
                    },
                    "currentPlan.isVerified": {
                        $cond: {
                            if: { $gt: [{ $subtract: ["$currentPlan.limit", 1] }, 0] },
                            then: true,
                            else: false
                        }
                    }
                }
            }
        ],
        { new: true }
    ).select('-password -refreshToken')
        .populate('currentPlan.services');

    if (!updatedUser) {
        throw new Error("Plan limit exhausted");
    }


    return res.status(201).json(
        new ApiResponse(201, {
            user: updatedUser,
            order: newOrder
        }, 'Order Created Successfully')
    );
});


const acceptOrderByVendor = asyncHandler(async (req, res) => {
    const user = req?.user;
    const { orderId } = req?.body;

    if (user?.role != ROLES.RIDER) {
        throw new ApiError(401, "Only rider can accept booking");
    }

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        throw new ApiError(401, "Not a valid order Id");
    }

    const foundOrder = await Order.findById(orderId);
    if (!foundOrder) {
        throw new ApiError(404, "Order not found");
    }

    if (foundOrder.status != STATUS.PENDING) {
        throw new ApiError(401, "Order is already accepted");
    }

    //Update the order status and assign mechanic
    const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
            status: STATUS.ACCEPTED,
            trackStatus: STATUS.SCHEDULED,
            mechanic: user?._id
        },
        { new: true }
    )
        .populate("services")
        .populate({
            path: "userId",
            model: "User",
            select: "-password -refreshToken"
        })
        .populate({
            path: "mechanic",
            model: "User",
            select: "-password -refreshToken"
        });

    if (!updatedOrder) {
        throw new ApiError(400, "Could not accept order")
    }

    //Add the order in mechanic
    const updatedUser = await User.findByIdAndUpdate(
        req?.user?._id,
        {
            $push: updatedOrder?._id
        },
        { new: true }
    ).select('-password -refreshToken');
    if (!updatedUser) {
        throw new ApiError(400, "Could not update order in mechanic")
    }

    return res.status(200).json(
        new ApiResponse(200, {
            order: updatedOrder,
            user: updatedUser
        }, "Order accepted and assigned successfully")
    );
})



export {
    createOneTimeOrder,
    verifyOneTimeOrderPayment,
    createSubscribedUserOrder,
    acceptOrderByVendor,
}