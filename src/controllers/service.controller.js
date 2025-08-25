import mongoose from "mongoose";
import { Service } from "../models/service.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateServiceId } from "../utils/generateId.js";
import Razorpay from "razorpay";
import { Order } from "../models/order.model.js";
import crypto from 'crypto';
import { v4 as uuidv4 } from "uuid";
import { ROLES } from "../constants.js";

// Service Management Controllers
const createService = asyncHandler(async (req, res) => {
    const {
        name,
        images,
        active
    } = req.body;

    if (!name || active == undefined || active == null) {
        throw new ApiError(404, "Complete details not found to create service");
    }

    const service_id = generateServiceId();

    if (!service_id) {
        throw new ApiError(500, "Could not generate service Id");
    }

    const newService = await Service.create({
        service_id,
        name,
        images,
        active
    });

    if (!newService) {
        throw new ApiError(500, "Could not create service");
    }

    return res.status(201).json(
        new ApiResponse(201, newService, "Service created successfully")
    )

});

const updateService = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { serviceId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in service");
    }

    if (!serviceId) {
        throw new ApiError(500, "Could not find service Id");
    }

    const foundService = await Service.findById(serviceId);
    if (!foundService) {
        throw new ApiError(500, "Service not found");
    }

    const updatedService = await Service.findByIdAndUpdate(
        serviceId,
        {
            ...updates
        },
        { new: true }
    );

    if (!updatedService) {
        throw new ApiError(500, "Could not update service");
    }

    return res.status(201).json(
        new ApiResponse(201, updatedService, "Service updated successfully")
    )

});

const getServices = asyncHandler(async (req, res) => {

    const allServices = await Service.find({
        active: true
    });

    if (!allServices) {
        throw new ApiError(500, "Could not get services");
    }

    return res.status(200).json(
        new ApiResponse(200, allServices, "Services fetched successfully")
    )

});

// Subscription Management Controllers
const createSubscription = asyncHandler(async (req, res) => {
    const {
        name,
        icon,
        active
    } = req.body;

    if (!name || active == undefined || active == null) {
        throw new ApiError(404, "Complete details not found to create subscription plan");
    }

    // const service_id = generateServiceId();

    // if (!service_id) {
    //     throw new ApiError(500, "Could not generate subscription Id");
    // }

    const newSubscription = await Subscription.create({
        // service_id,
        name,
        icon,
        active
    });

    if (!newSubscription) {
        throw new ApiError(500, "Could not create subscription");
    }

    return res.status(201).json(
        new ApiResponse(201, newSubscription, "Subscription created successfully")
    )

});

const updateSubscription = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { subscriptionId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in subscription plan");
    }

    if (!subscriptionId) {
        throw new ApiError(500, "Could not find subscription Id");
    }

    const foundSubscription = await Subscription.findById(subscriptionId);
    if (!foundSubscription) {
        throw new ApiError(500, "Subscription not found");
    }

    const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        {
            ...updates
        },
        { new: true }
    );

    if (!updatedSubscription) {
        throw new ApiError(500, "Could not update subscription");
    }

    return res.status(201).json(
        new ApiResponse(201, updatedSubscription, "Subscription updated successfully")
    )

});

const addServiceInSubscription = asyncHandler(async (req, res) => {
    const {
        subscriptionId,
        serviceId
    } = req.body;

    if (!subscriptionId || !serviceId) {
        throw new ApiError(404, "Subscription Id and Service Id required");
    }

    const foundSubscription = await Subscription.findById(subscriptionId);
    if (!foundSubscription) {
        throw new ApiError(500, "Subscription not found");
    }

    const foundService = await Service.findById(serviceId);
    if (!foundService) {
        throw new ApiError(500, "Service not found");
    }

    if (foundSubscription?.services?.some(sr => sr == serviceId)) {
        throw new ApiError(401, "Service already added in plan");
    }

    // Add Service in Subscription's service array
    const updatedSubscription = await Subscription.findByIdAndUpdate(
        subscriptionId,
        {
            $push: {
                services: serviceId
            }
        },
        { new: true }
    );

    if (!updatedSubscription) {
        throw new ApiError(500, "Could not add service in subscription");
    }

    // Add Subscription in Service's package array
    const updatedService = await Service.findByIdAndUpdate(
        serviceId,
        {
            $push: {
                packages: subscriptionId
            }
        },
        { new: true }
    );

    if (!updatedService) {
        throw new ApiError(500, "Could not add subscription in service");
    }

    return res.status(201).json(
        new ApiResponse(201, updatedSubscription, "Subscription created successfully")
    )

});

const bulkServicesUpdateInSubscription = asyncHandler(async (req, res) => {
    const {
        subscriptionId,
        services
    } = req.body;

    /* ------------------------------ 1. validation ----------------------------- */
    if (!subscriptionId || !Array.isArray(services)) {
        throw new ApiError(400, "Subscription Id and Service Ids array are required");
    }

    // normalise IDs → ObjectIds & dedupe
    const desired = [
        ...new Set(services?.map(id => new mongoose.Types.ObjectId(id)))
    ];

    /* ------------------------------ 2. look‑ups ------------------------------- */
    const subscription = await Subscription.findById(subscriptionId);
    if (!subscription) throw new ApiError(404, "Subscription not found");

    const current = subscription?.services?.map(id => id.toString());

    /* ------------------------------ 3. diff sets ------------------------------ */
    const desiredSet = new Set(desired.map(id => id.toString()));
    const currentSet = new Set(current);

    const servicesToAdd = desired.filter(id => !currentSet.has(id.toString()));
    const servicesToRemove = current.filter(id => !desiredSet.has(id));

    /* ------------------------ 4. verify service existence --------------------- */
    const count = await Service.countDocuments({ _id: { $in: desired } });
    if (count !== desired.length) {
        throw new ApiError(400, "One or more Service Ids are invalid");
    }

    /* ----------------------- 5. transactional bulk ops ----------------------- */
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // 5a. update subscription
            subscription.services = desired;          // overwrite to exact list
            await subscription.save({ session });

            // 5b. add subscriptionId to each new Service
            if (servicesToAdd.length) {
                await Service.updateMany(
                    { _id: { $in: servicesToAdd } },
                    { $addToSet: { packages: subscription._id } },
                    { session }
                );
            }

            // 5c. pull subscriptionId from removed Services
            if (servicesToRemove.length) {
                await Service.updateMany(
                    { _id: { $in: servicesToRemove } },
                    { $pull: { packages: subscription._id } },
                    { session }
                );
            }
        });
    } finally {
        await session.endSession();
    }

    /* ------------------------------ 6. response ------------------------------- */
    const populatedSubscription = await Subscription.findById(subscriptionId)
        .populate("services")
        .exec();

    return res
        .status(200)
        .json(new ApiResponse(200, populatedSubscription, "Subscription services updated"));
});

const getSubscriptions = asyncHandler(async (req, res) => {

    const allSubscriptions = await Subscription.find({
        active: true
    }).populate("services");

    if (!allSubscriptions) {
        throw new ApiError(500, "Could not get subscriptions");
    }

    return res.status(200).json(
        new ApiResponse(200, allSubscriptions, "Subscriptions fetched successfully")
    )

});


// RazorPay Order Management
const razorpayConfig = () => {
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    return razorpay;
}

const createSubscriptionOrder = asyncHandler(async (req, res) => {

    let {
        amount,
        planId,
        serviceIds,
        pricingType
    } = req?.body;

    const razorpay = await razorpayConfig();

    if (req?.user?.role != ROLES.USER) {
        throw new ApiError(401, "Only customers can book subscription.");
    }

    if (!planId || !pricingType || amount == undefined || amount < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to create Order.");
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
        if (!foundSubscription?.services?.some(sr => sr?.toString() == serviceId?.toString())) {
            throw new ApiError(404, `${serviceId} not found in subscription`);
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
        amount,
        subscriptionId: planId,
        type: pricingType == "oneTimePrice" ? "oneTime" : "monthly",
        services: serviceIds,
        userId: req?.user?._id
    });

    return res.status(201).json(
        new ApiResponse(201, {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            newOrderId: newOrder._id,
            // user: updatedUser
        }, 'Razorpay Order Created')
    );
});

const verifySubscriptionOrderPayment = asyncHandler(async (req, res) => {
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
        await Order.save();

        // Add Order in User Order
        updatedUser = await User.findByIdAndUpdate(
            order.userId,
            { $push: { orders: order._id } },
            { new: true, session }
        ).select('-password -refreshToken');
    }

    return res.status(200).json(
        new ApiResponse(200, { order, user: updatedUser }, "Payment Verified. Order Completed")
    );
});

const getMyOrders = asyncHandler(async (req, res) => {
    const myOrders = await Order.find({
        userId: req?.user?._id
    })
        .populate("subscriptionId services");

    if (!myOrders) {
        throw new ApiError(500, "Could not get orders");
    }

    return res.status(200).json(
        new ApiResponse(200, myOrders, "Orders fetched successfully")
    )
});

export {
    createService,
    updateService,
    getServices,
    createSubscription,
    updateSubscription,
    getSubscriptions,
    addServiceInSubscription,
    bulkServicesUpdateInSubscription,
    createSubscriptionOrder,
    verifySubscriptionOrderPayment,
    getMyOrders
}