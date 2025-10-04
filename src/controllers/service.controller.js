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
import { ROLES, USER_TYPE } from "../constants.js";
import { User } from "../models/user.model.js";

// Razorpy Config
const razorpayConfig = () => {
    const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    return razorpay;
}

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

// ******************** SUBSCRIPTION MANAGEMENT ************************

//Subscription Purchase Management - B2C
const purchaseB2CUserSubscription = asyncHandler(async (req, res) => {

    let {
        planId,
        serviceIds,
        price,
        limit,
    } = req?.body;

    const razorpay = await razorpayConfig();

    if (req?.user?.role != ROLES.USER) {
        throw new ApiError(401, "Only customers can purchase subscription.");
    }

    //Ensure only B2C Customer purchase subscription
    if (req?.user?.type == USER_TYPE.B2B) {
        throw new ApiError(401, "Only B2C customer can purchase subscription.");
    }

    if (req?.user?.isSubscribed) {
        throw new ApiError(401, "User already subscribed");
    }

    if (!planId || !price || !limit || limit < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to purchase subscription.");
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
        amount: price * 100, // in paise
        currency: 'INR',
        receipt: `rcpt_${uuidv4().split('-')[0]}`,
        payment_capture: 1
    });

    const currentPlan = {
        subscriptionId: planId,
        name: foundSubscription?.name,
        services: serviceIds,
        price,
        limit
    }

    const updatedUser = await User.findByIdAndUpdate(
        req?.user?._id,
        {
            currentPlan
        },
        { new: true }
    ).select('-password -refreshToken');

    return res.status(201).json(
        new ApiResponse(201, {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            user: updatedUser
        }, 'Razorpay Order Created')
    );
});

const verifyB2CSubscriptionPurchase = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        userId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature ||
        !userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Payment verification details missing.');
    }

    // 1️⃣ Verify Signature
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    const isValid = generatedSignature === razorpay_signature;

    let updatedUser = await User.findById(userId);
    if (isValid) {

        // Update Start Date and Verify the current plan of user
        const currentPlan = {
            ...updatedUser?.currentPlan,
            isVerified: true,
            startDate: new Date(),
            //TODO: next billing date to be added
        }

        console.log(currentPlan);

        // Mark User Subscribed
        updatedUser = await User.findByIdAndUpdate(
            userId,
            {
                "currentPlan.isVerified": true,
                "currentPlan.startDate": Date.now(),
                isSubscribed: true
            },
            { new: true }
        )
    }

    // Create billing history entry (example structure)
    const billingEntry = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        amount: updatedUser?.currentPlan?.price,
        currency: 'INR',
        plan: updatedUser?.currentPlan,
        createdAt: new Date(),
        status: 'paid'
    };

    updatedUser = await User.findByIdAndUpdate(
        userId,
        { $push: { billingHistory: billingEntry } },
        { new: true }
    ).select('-password -refreshToken')
        .populate('car')
        .populate('currentPlan.services');

    //Add user in subscription's subscribed member array
    const updatedSubscription = await Subscription.findByIdAndUpdate(
        updatedUser?.currentPlan?.subscriptionId,
        {
            $push: {
                currentSubscribers: updatedUser?._id
            }
        }
    ).populate('currentSubscribers');

    return res.status(200).json(
        new ApiResponse(200, {
            user: updatedUser,
            subscription: updatedSubscription
        }, "Payment Verified. Subscription purchased successfully")
    );
});

//Subscription Upgrade Management 
const upgradeB2CUserSubscription = asyncHandler(async (req, res) => {
    let {
        planId,
        serviceIds,
        price,
        limit,
    } = req?.body;

    console.log("Called")
    const razorpay = await razorpayConfig();

    if (req?.user?.role != ROLES.USER) {
        throw new ApiError(401, "Only customers can upgrade subscription.");
    }

    // //Ensure only B2C Customer purchase subscription
    // if (req?.user?.type != USER_TYPE.B2B) {
    //     throw new ApiError(401, "Only B2C customer can upgrade subscription.");
    // }

    // if (!req?.user?.isSubscribed) {
    //     throw new ApiError(401, "User not subscribed to any plan");
    // }

    if (!planId || !price || !limit || limit < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to upgrade subscription.");
    }

    //Check for valid subscription Id
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ApiError(404, "Valid Subscription Id required.");
    }

    if (req?.user?.isSubscribed && req?.user?.currentPlan?.subscriptionId?.toString() == planId?.toString()) {
        throw new ApiError(401, "User already subscribed to this plan");
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

    // Decide the amount to be paid
    const existingPlan = req?.user?.currentPlan;

    // 1️⃣ Validate limit
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 0) {
        throw new ApiError(400, "Limit must be a valid non-negative integer");
    }
    const parsedExistingLimit = Number(existingPlan?.limit || 0);
    if (!Number.isInteger(parsedExistingLimit) || parsedExistingLimit < 0) {
        throw new ApiError(400, "Existing limit is invalid");
    }

    // 2️⃣ Validate prices
    const parsedPrice = Number(price);
    const parsedExistingPrice = Number(existingPlan?.price || 0);
    if (isNaN(parsedPrice) || parsedPrice < 0 || isNaN(parsedExistingPrice) || parsedExistingPrice < 0) {
        throw new ApiError(400, "Invalid price value");
    }

    // 3️⃣ Decide amount to be paid (higher - lower)
    const amountToBePaid = parseFloat(Math.max(0, parsedPrice - parsedExistingPrice).toFixed(2));

    console.log("Amount to be paid:", amountToBePaid);
    // 4️⃣ Create Razorpay Order
    const razorpayOrder = await razorpay.orders.create({
        amount: Math.round(amountToBePaid * 100), // in paise; ensure integer
        currency: 'INR',
        receipt: `rcpt_${uuidv4().split('-')[0]}`,
        payment_capture: 1
    });

    // 5️⃣ Save pending purchase on user (do NOT update currentPlan)
    // Build a pending purchase snapshot (stores rupees)
    const pendingPurchase = {
        orderId: razorpayOrder.id,
        amount: amountToBePaid,
        currency: razorpayOrder.currency,
        plan: {
            subscriptionId: planId,
            name: foundSubscription?.name,
            services: serviceIds,
            price: parsedPrice,
            limit: parsedExistingLimit + parsedLimit, // what will be applied after verification
            // startDate: new Date(),
            // //end date to be added
            // upgradeDate: new Date(),
        },
        createdAt: new Date(),
        // Optionally: expiresAt: Date.now() + 1000 * 60 * 60 // 1 hour
    };

    // Save pendingPurchase on user
    const updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { pendingSubscriptionPurchase: pendingPurchase },
        { new: true }
    ).select('-password -refreshToken');

    return res.status(201).json(
        new ApiResponse(201, {
            razorpayOrderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
            user: updatedUser
        }, 'Razorpay Order Created')
    );
});

const verifyB2CSubscriptionUpgrade = asyncHandler(async (req, res) => {
    const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        userId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id ||
        // !razorpay_signature || //commented for testing purposes
        !userId || !mongoose.Types.ObjectId.isValid(userId)) {
        throw new ApiError(400, 'Payment verification details missing.');
    }

    // 1️⃣ Verify signature
    const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    const isValid = generatedSignature === razorpay_signature;
    // let isValid = true;

    if (!isValid) {
        throw new ApiError(400, 'Invalid payment signature');
    }

    // 2️⃣ Load user & pending purchase
    const user = await User.findById(userId).select('+pendingSubscriptionPurchase'); // ensure field present
    if (!user) throw new ApiError(404, 'User not found');

    const pending = user.pendingSubscriptionPurchase;
    console.log(pending)
    if (!pending || pending.orderId !== razorpay_order_id) {
        throw new ApiError(400, 'No matching pending purchase found for this order');
    }

    // (Optional) verify amount matches (paise)
    const expectedPaise = Math.round(pending.amount * 100);
    // You may want to compare against the payment gateway amount if available

    // 3️⃣ Start transaction to apply the plan & billing history atomically
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            // Reload user inside session
            const userInTx = await User.findById(userId).session(session);
            if (!userInTx) throw new Error('User missing in transaction');

            let oldPlan = null;
            if (userInTx.currentPlan && Object.keys(userInTx.currentPlan).length > 0) {
                oldPlan = typeof userInTx.currentPlan.toObject === 'function'
                    ? userInTx.currentPlan.toObject()
                    : { ...userInTx.currentPlan };
            }


            // 3.a Push old plan to pastPlans (if exists)
            if (oldPlan && Object.keys(oldPlan).length) {
                // add endDate to oldPlan
                const oldPlanWithEnd = { ...oldPlan, endDate: new Date() };
                await User.updateOne(
                    { _id: userId },
                    { $push: { pastPlans: oldPlanWithEnd } },
                    { session }
                );
            }

            // 3.b Create billing history entry (example structure)
            const billingEntry = {
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                amount: pending.amount,
                currency: pending.currency || 'INR',
                plan: pending.plan,
                createdAt: new Date(),
                status: 'paid'
            };

            await User.updateOne(
                { _id: userId },
                { $push: { billingHistory: billingEntry } },
                { session }
            );

            // 3.c Apply new currentPlan & mark verified/subscribed, remove pendingPurchase

            const currentPlan = {
                isVerified: true,
                startDate: new Date(),
                ...pending.plan,
                isVerified: true,
                startDate: new Date(),
                upgradeDate: new Date()
                //TODO: next billing date to be added
            }
            await User.updateOne(
                { _id: userId },
                {
                    $set: {
                        currentPlan,
                        isSubscribed: true,
                        // "currentPlan.isVerified": true,
                        // "currentPlan.startDate": new Date(),
                        // "currentPlan.upgradeDate": new Date(),
                    },
                    $unset: { pendingSubscriptionPurchase: "" }
                },
                { session }
            );

            await User.findByIdAndUpdate(
                userId,
                {
                    "currentPlan.isVerified": true,
                    "currentPlan.startDate": new Date(),
                    "currentPlan.upgradeDate": new Date(),
                },
                { session }
            )

            // 3.d Add user to Subscription.currentSubscribers and place user to past subscribers in old plan atomically
            if (pending.plan && pending.plan.subscriptionId) {
                //add to current in new plan
                await Subscription.findByIdAndUpdate(
                    pending.plan.subscriptionId,
                    { $addToSet: { currentSubscribers: userId } }, // addToSet avoids duplicates
                    { session }
                );

                // update user in past from current in old plan
                await Subscription.findByIdAndUpdate(
                    oldPlan.subscriptionId,
                    {
                        $pull: { currentSubscribers: userId },
                        $addToSet: { pastSubscribers: userId }
                    }, // addToSet avoids duplicates
                    { session }
                );
            }
        }, {
            readPreference: 'primary',
            readConcern: { level: 'local' },
            writeConcern: { w: 'majority' }
        });

        // After commit, return fresh user and subscription
        let updatedUser = await User.findById(userId).select('-password -refreshToken').populate('currentPlan.services');
        let updatedSubscription = null;
        if (updatedUser?.currentPlan?.subscriptionId) {
            updatedSubscription = await Subscription.findById(updatedUser.currentPlan.subscriptionId).populate('currentSubscribers');
        }

        return res.status(200).json(
            new ApiResponse(200, {
                user: updatedUser,
                subscription: updatedSubscription
            }, "Payment Verified. Subscription purchased successfully")
        );

    } catch (err) {
        console.error("Payment verification TX failed:", err);
        // session.withTransaction aborts on throw; rethrow mapped to ApiError
        throw new ApiError(500, err.message || 'Failed to finalize subscription purchase');
    } finally {
        session.endSession();
    }
});

//Subscription Renewal Management - B2C: Not completed yet 
const renewB2CUserSubscription = asyncHandler(async (req, res) => {
  
    let {
        planId,
        serviceIds,
        price,
        limit,
    } = req?.body;

  const razorpay = await razorpayConfig();

  if (req?.user?.role != ROLES.USER) {
    throw new ApiError(401, "Only customers can renew subscription.");
  }

  // User must be subscribed to renew
  if (!req?.user?.isSubscribed || !req?.user?.currentPlan) {
    throw new ApiError(400, "User not subscribed to any plan to renew.");
  }

  if (!planId || !price || !limit || limit < 0 || !serviceIds || !serviceIds?.length) {
        throw new ApiError(404, "Valid details not found to purchase subscription.");
    }

    //Check for valid subscription Id
    if (!mongoose.Types.ObjectId.isValid(planId)) {
        throw new ApiError(404, "Valid Subscription Id required.");
    }

  // Load subscription (to get canonical duration/durationUnit if needed)
  const subscription = await Subscription.findById(planId);
  if (!subscription) {
    throw new ApiError(404, "Subscription not found");
  }

  // Decide amount to be paid: usually full plan price for the next cycle
  // Use currentPlan.price stored on user (rupees float)
  const renewalAmount = Number(price || 0);
  if (isNaN(renewalAmount) || renewalAmount <= 0) {
    throw new ApiError(400, "Invalid renewal amount.");
  }

  // Create Razorpay order (amount in paise)
  const razorpayOrder = await razorpay.orders.create({
    amount: Math.round(renewalAmount * 100),
    currency: 'INR',
    receipt: `renew_rcpt_${uuidv4().split('-')[0]}`,
    payment_capture: 1
  });

  const renewPurchase = {
        orderId: razorpayOrder.id,
        amount: renewalAmount,
        currency: razorpayOrder.currency,
        plan: {
            subscriptionId: planId,
            name: subscription?.name,
            services: serviceIds,
            price: renewalAmount,
            limit: limit, // what will be applied after verification
            // startDate: new Date(),
            // //end date to be added
            // upgradeDate: new Date(),
        },
        createdAt: new Date(),
    };

  // Build pending purchase snapshot (reuse your PendingSubscriptionPurchaseSchema shape)
//   const pendingPurchase = {
//     orderId: razorpayOrder.id,
//     amount: renewalAmount,
//     currency: razorpayOrder.currency,
//     plan: {
//       ...req.user.currentPlan, // snapshot current plan to re-apply on success
//       limit:subscription?.limit
//       // keep startDate as-is or set startDate: new Date() if you prefer
//     },
//     createdAt: new Date(),
//     // Optional: set expiresAt if you want
//   };

  // Save pendingPurchase on user (same field you used in upgrade flow)
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { renewSubscriptionPurchase: renewPurchase },
    { new: true }
  ).select('-password -refreshToken');

  return res.status(201).json(new ApiResponse(201, {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key: process.env.RAZORPAY_KEY_ID,
    user: updatedUser
  }, 'Razorpay Renewal Order Created'));
});

// Helper: add duration to a date (months or years)
function addDurationToDate(date, duration = 1, unit = "month") {
  const d = new Date(date);
  if (unit === "month") {
    const targetMonth = d.getMonth() + duration;
    d.setMonth(targetMonth);
    return d;
  } else if (unit === "year") {
    d.setFullYear(d.getFullYear() + duration);
    return d;
  }
  d.setMonth(d.getMonth() + duration);
  return d;
}

const verifyB2CSubscriptionRenewal = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    userId
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'Payment verification details missing.');
  }

  // 1. Verify signature
//   const generatedSignature = crypto
//     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//     .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//     .digest('hex');

//   const isValid = generatedSignature === razorpay_signature;
  const isValid = true;
  if (!isValid) throw new ApiError(400, 'Invalid payment signature');

  // 2. Load user & pending renew purchase
  // Select renewSubscriptionPurchase explicitly (and pendingSubscriptionPurchase if you still use it elsewhere)
  let user = await User.findById(userId).select('+renewSubscriptionPurchase +pendingSubscriptionPurchase');
  if (!user) throw new ApiError(404, 'User not found');
  
  user = await User.findByIdAndUpdate(
    userId,
    {
        "renewSubscriptionPurchase.paymentVerified": true
    },
    {new: true}
  ).select('+renewSubscriptionPurchase +pendingSubscriptionPurchase');
  
  const pending = user.renewSubscriptionPurchase;
//   console.log("user:",user)
//   console.log("Pending:",pending)
  if (!pending || pending.orderId !== razorpay_order_id) {
    throw new ApiError(400, 'No matching pending renewal purchase found for this order');
  }

  // Optional: verify expected amount (paise)
  const expectedPaise = Math.round(pending.amount * 100);

  // 3. Start transaction
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const userInTx = await User.findById(userId).session(session);
      if (!userInTx) throw new Error('User missing in transaction');

      // Idempotency: do not duplicate billing entries for same paymentId
      const alreadyPaid = (userInTx.billingHistory || []).some(b => b && b.paymentId === razorpay_payment_id);
      if (alreadyPaid) {
        // Already processed — nothing to do (transactionally safe)
        return;
      }

      // 3.a Create billing history entry (always first)
      const billingEntry = {
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        amount: pending.amount,
        currency: pending.currency || 'INR',
        plan: pending.plan,
        status: 'paid',
        createdAt: new Date()
      };

      await User.updateOne(
        { _id: userId },
        { $push: { billingHistory: billingEntry } },
        { session }
      );

      // 3.b Determine whether current plan is expired OR exhausted (limit <= 0)
      const now = new Date();
      const currentPlan = userInTx.currentPlan || null;

      console.log("Expiry Time",new Date(currentPlan.endDate).getTime(), now.getTime())
      const isExpired = currentPlan && currentPlan.endDate
        ? (new Date(currentPlan.endDate).getTime() <= now.getTime())
        : false;

      // Treat absent limit as "not exhausted". If you use remainingLimit or another field, swap here.
      const isLimitExhausted = currentPlan && (typeof currentPlan.limit === 'number')
        ? (currentPlan.limit <= 0)
        : false;

      const shouldReplacePlan = isLimitExhausted || isExpired;

      // Load subscription doc for duration info if needed
      const subscriptionDoc = pending.plan && pending.plan.subscriptionId
        ? await Subscription.findById(pending.plan.subscriptionId).session(session)
        : null;

      if (shouldReplacePlan) {
        // 3.c Apply pending plan now (because current plan is expired OR exhausted)

        // Push old plan to pastPlans if exists
        if (currentPlan && Object.keys(currentPlan).length) {
          const oldPlanWithEnd = {
            ...(typeof currentPlan.toObject === 'function' ? currentPlan.toObject() : { ...currentPlan }),
            endDate: currentPlan.endDate ? new Date(currentPlan.endDate) : now
          };

          await User.updateOne(
            { _id: userId },
            { $push: { pastPlans: oldPlanWithEnd } },
            { session }
          );
        }

        // Build new currentPlan from pending.plan
        const newCurrentPlan = {
          ...pending.plan,
          isVerified: true,
          startDate: now,
          upgradeDate: now
        };

        let nextBillingDate = now;

        if (subscriptionDoc && subscriptionDoc.duration) {
          nextBillingDate = addDurationToDate(now, subscriptionDoc.duration, subscriptionDoc.durationUnit || 'year');
        } else {
          // fallback one month
          nextBillingDate = addDurationToDate(now, 1, 'year');
        }

        // Apply new plan & unset the renew purchase (since it's consumed)
        await User.updateOne(
          { _id: userId },
          {
            $set: {
              currentPlan: newCurrentPlan,
              isSubscribed: true
            },
            $unset: { renewSubscriptionPurchase: "" }
          },
          { session }
        );

        await User.findByIdAndUpdate(
                userId,
                {
                    "currentPlan.isVerified": true,
                    "currentPlan.startDate": now,
                    "currentPlan.upgradeDate": now,
                    "currentPlan.endDate": nextBillingDate,
                    "currentPlan.nextBillingDate": nextBillingDate,
                },
                { session }
            )


        // 3.c.2 Subscriber logic: only if old subscription id !== new subscription id
        const oldSubId = currentPlan && currentPlan.subscriptionId ? String(currentPlan.subscriptionId) : null;
        const newSubId = pending.plan && pending.plan.subscriptionId ? String(pending.plan.subscriptionId) : null;

        if (newSubId && (!oldSubId || oldSubId !== newSubId)) {
          // add to new plan's currentSubscribers
          await Subscription.findByIdAndUpdate(
            newSubId,
            { $addToSet: { currentSubscribers: userId } },
            { session }
          );
        }

        if (oldSubId && oldSubId !== newSubId) {
          // remove from old plan's currentSubscribers, and add to pastSubscribers
          await Subscription.findByIdAndUpdate(
            oldSubId,
            {
              $pull: { currentSubscribers: userId },
              $addToSet: { pastSubscribers: userId }
            },
            { session }
          );
        }

      } 
    //   else {
    //     // 3.d Current plan NOT expired AND not exhausted -> keep renewSubscriptionPurchase intact for later use.
    //     // Billing entry is already recorded; we do NOT unset renewSubscriptionPurchase or modify currentPlan.
    //     // No subscriber changes are performed.

    //     // Optionally: if you want to mark billingHistory.note that this is a prepayment, you can update the billingEntry pushed above.
    //     // For now we keep it simple — billingHistory contains the plan snapshot and amount.
    //   }

    }, {
      readPreference: 'primary',
      readConcern: { level: 'local' },
      writeConcern: { w: 'majority' }
    });

    // After commit, return fresh user
    let updatedUser = await User.findById(userId).select('-password -refreshToken').populate('currentPlan.services');
    let updatedSubscription = null;
    if (updatedUser?.currentPlan?.subscriptionId) {
      updatedSubscription = await Subscription.findById(updatedUser.currentPlan.subscriptionId).populate('currentSubscribers');
    }

    // Friendly message
    const appliedNow = (updatedUser && updatedUser.renewSubscriptionPurchase == null) || // cleared -> applied
      (updatedUser?.currentPlan && pending.plan && String(updatedUser.currentPlan.subscriptionId || '') === String(pending.plan.subscriptionId || '') &&
        (new Date(updatedUser.currentPlan.startDate || 0).getTime() >= (Date.now() - 60 * 1000)));

    const message = appliedNow
      ? "Payment verified and pending renewal applied (current plan was expired or exhausted)."
      : "Payment verified. Renewal purchase retained for later application (current plan still active and not exhausted).";

    return res.status(200).json(
      new ApiResponse(200, {
        user: updatedUser,
        subscription: updatedSubscription,
        appliedNow
      }, message)
    );

  } catch (err) {
    console.error("Renewal verification TX failed:", err);
    throw new ApiError(500, err.message || 'Failed to finalize subscription renewal');
  } finally {
    session.endSession();
  }
});


// const verifyB2CSubscriptionRenewal = asyncHandler(async (req, res) => {
//   const {
//     razorpay_order_id,
//     razorpay_payment_id,
//     razorpay_signature,
//     userId
//   } = req.body;

//   if (!razorpay_order_id || !razorpay_payment_id || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
//     throw new ApiError(400, 'Payment verification details missing.');
//   }

//   // 1. Verify signature
//   const generatedSignature = crypto
//     .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
//     .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//     .digest('hex');

//   const isValid = generatedSignature === razorpay_signature;
//   if (!isValid) throw new ApiError(400, 'Invalid payment signature');

//   // 2. Load user & pending purchase (select the pending field)
//   const user = await User.findById(userId).select('+pendingSubscriptionPurchase');
//   if (!user) throw new ApiError(404, 'User not found');

//   const pending = user.renewSubscriptionPurchase;
//   if (!pending || pending.orderId !== razorpay_order_id) {
//     throw new ApiError(400, 'No matching pending purchase found for this order');
//   }

//   // Optionally validate amount: expected vs pending.amount
//   const expectedPaise = Math.round(pending.amount * 100);

//   // 3. Start transaction to finalize renewal
//   const session = await mongoose.startSession();
//   try {
//     await session.withTransaction(async () => {
//       const userInTx = await User.findById(userId).session(session);
//       if (!userInTx) throw new Error('User missing in transaction');

//       // Prepare billing history entry (same shape as BillingEntrySchema)
//       const billingEntry = {
//         orderId: razorpay_order_id,
//         paymentId: razorpay_payment_id,
//         signature: razorpay_signature,
//         amount: pending.amount,
//         currency: pending.currency || 'INR',
//         plan: pending.plan,
//         status: 'paid',
//         createdAt: new Date()
//       };

//       // push billing history
//       await User.updateOne(
//         { _id: userId },
//         { $push: { billingHistory: billingEntry } },
//         { session }
//       );

//       // Compute nextBillingDate:
//       // - Prefer to use the official Subscription.duration/durationUnit if available
//       const subscriptionDoc = await Subscription.findById(pending.plan.subscriptionId).session(session);
//       let nextBilling;
//       const now = new Date();
//       if (subscriptionDoc && subscriptionDoc.duration) {
//         // use currentPlan.nextBillingDate if it exists, else start from now
//         const base = userInTx.currentPlan?.nextBillingDate ? new Date(userInTx.currentPlan.nextBillingDate) : now;
//         nextBilling = addDurationToDate(base, subscriptionDoc.duration, subscriptionDoc.durationUnit || 'month');
//       } else {
//         // fallback: add 1 month from current nextBillingDate or now
//         const base = userInTx.currentPlan?.nextBillingDate ? new Date(userInTx.currentPlan.nextBillingDate) : now;
//         nextBilling = addDurationToDate(base, 1, 'month');
//       }

//       // Update user's currentPlan.nextBillingDate and optionally startDate if not set
//       await User.updateOne(
//         { _id: userId },
//         {
//           $set: {
//             "currentPlan.nextBillingDate": nextBilling,
//             "currentPlan.isVerified": true,
//             // If the plan didn't have a startDate, set it (optional)
//             "currentPlan.startDate": userInTx.currentPlan?.startDate ? userInTx.currentPlan.startDate : new Date()
//           },
//           $unset: { pendingSubscriptionPurchase: "" }
//         },
//         { session }
//       );

//       // Subscription docs: no change in subscribers for renewals normally.
//       // But if you want to ensure the user is in Subscription.currentSubscribers:
//       if (pending.plan && pending.plan.subscriptionId) {
//         await Subscription.findByIdAndUpdate(
//           pending.plan.subscriptionId,
//           { $addToSet: { currentSubscribers: userId } },
//           { session }
//         );
//       }
//     }, {
//       readPreference: 'primary',
//       readConcern: { level: 'local' },
//       writeConcern: { w: 'majority' }
//     });

//     // After commit, return fresh user
//     let updatedUser = await User.findById(userId).select('-password -refreshToken').populate('currentPlan.services');
//     let updatedSubscription = null;
//     if (updatedUser?.currentPlan?.subscriptionId) {
//       updatedSubscription = await Subscription.findById(updatedUser.currentPlan.subscriptionId).populate('currentSubscribers');
//     }

//     return res.status(200).json(new ApiResponse(200, {
//       user: updatedUser,
//       subscription: updatedSubscription
//     }, "Payment Verified. Subscription renewed successfully"));

//   } catch (err) {
//     console.error("Renewal verification TX failed:", err);
//     throw new ApiError(500, err.message || 'Failed to finalize subscription renewal');
//   } finally {
//     session.endSession();
//   }
// });

//Subscription Purchase Management - B2B


// ******************** ORDER MANAGEMENT ************************

const updateSubscriptionOrder = asyncHandler(async (req, res) => {

    const updates = req.body;
    const { orderId } = req?.body;

    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        throw new ApiError(404, "Valid Order Id not found.");
    }

    const foundOrder = await Order.findById(orderId);
    if (!foundOrder) {
        throw new ApiError(404, "Order not found.");
    }

    const updatedOrder = await Order.findByIdAndUpdate(
        orderId,
        {
            ...updates
        }
    )
        .populate('subscriptionId services userId mechanic')
        .populate({
            path: "items.productId",
            model: "Product",
            select: "name images sellingPrice"
        })
        .exec();

    return res.status(201).json(
        new ApiResponse(200, updatedOrder, 'Order Updated Successfully')
    );
});

// One Time Subscription Order Management
const createSubscriptionOrder = asyncHandler(async (req, res) => {

    let {
        amount,
        name, phoneNo,
        scheduledOn,
        location,
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
        serviceCharge: amount,
        paidAmount: amount,
        orderAmount: amount,
        subscriptionId: planId,
        subscriptionName: foundSubscription?.name,
        type: pricingType == "oneTimePrice" ? "oneTime" : "monthly",
        services: serviceIds,
        name, phoneNo,
        scheduledOn,
        location,
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

export {
    createService,
    updateService,
    getServices,
    createSubscription,
    updateSubscription,
    getSubscriptions,
    addServiceInSubscription,
    bulkServicesUpdateInSubscription,
    purchaseB2CUserSubscription,
    verifyB2CSubscriptionPurchase,
    upgradeB2CUserSubscription,
    verifyB2CSubscriptionUpgrade,
    renewB2CUserSubscription,
    verifyB2CSubscriptionRenewal,
    createSubscriptionOrder,
    verifySubscriptionOrderPayment,
    updateSubscriptionOrder
}