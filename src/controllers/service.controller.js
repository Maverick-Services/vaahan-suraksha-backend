import mongoose from "mongoose";
import { Service } from "../models/service.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateServiceId } from "../utils/generateId.js";

// Service Management Controllers
const createService = asyncHandler(async (req, res) => {
    const {
        name,
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
        active
    });

    if (!newService) {
        throw new ApiError(500, "Could not create service");
    }

    return res.status(201).json(
        new ApiResponse(201, newService, "Service created successfully")
    )

});

// Subscription Management Controllers
const createSubscription = asyncHandler(async (req, res) => {
    const {
        name,
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
        active
    });

    if (!newSubscription) {
        throw new ApiError(500, "Could not create subscription");
    }

    return res.status(201).json(
        new ApiResponse(201, newSubscription, "Subscription created successfully")
    )

});

// Subscription Management Controllers
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

// Controller for bulk updating services in subscription at subscription module
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

export {
    createService,
    createSubscription,
    addServiceInSubscription,
    bulkServicesUpdateInSubscription
}