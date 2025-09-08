import mongoose from "mongoose";
import { OneTime } from "../models/oneTimePlan.model.js";
import { Service } from "../models/service.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Subscription Management Controllers
const createOneTimePlan = asyncHandler(async (req, res) => {
    const {
        name,
        icon,
        active
    } = req.body;

    if (!name || active == undefined || active == null) {
        throw new ApiError(404, "Complete details not found to create plan");
    }

    const newPlan = await OneTime.create({
        // service_id,
        name,
        icon,
        active
    });

    if (!newPlan) {
        throw new ApiError(500, "Could not create plan");
    }

    return res.status(201).json(
        new ApiResponse(201, newPlan, "Plan created successfully")
    )

});

const updateOneTimePlan = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { planId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in plan");
    }

    if (!planId) {
        throw new ApiError(500, "Could not find plan Id");
    }

    const foundPlan = await OneTime.findById(planId);
    if (!foundPlan) {
        throw new ApiError(500, "Plan not found");
    }

    const updatedPlan = await OneTime.findByIdAndUpdate(
        planId,
        {
            ...updates
        },
        { new: true }
    );

    if (!updatedPlan) {
        throw new ApiError(500, "Could not update plan");
    }

    return res.status(201).json(
        new ApiResponse(201, updatedPlan, "Plan updated successfully")
    )

});

const addServiceInPlan = asyncHandler(async (req, res) => {
    const {
        planId,
        serviceId
    } = req.body;

    if (!planId || !serviceId) {
        throw new ApiError(404, "Plan Id and Service Id required");
    }

    const foundPlan = await OneTime.findById(planId);
    if (!foundPlan) {
        throw new ApiError(500, "Plan not found");
    }

    const foundService = await Service.findById(serviceId);
    if (!foundService) {
        throw new ApiError(500, "Service not found");
    }

    if (foundPlan?.services?.some(sr => sr == serviceId)) {
        throw new ApiError(401, "Service already added in plan");
    }

    // Add Service in Subscription's service array
    const updatedPlan = await OneTime.findByIdAndUpdate(
        planId,
        {
            $push: {
                services: serviceId
            }
        },
        { new: true }
    );

    if (!updatedPlan) {
        throw new ApiError(500, "Could not add service in plan");
    }

    // Add Subscription in Service's package array
    const updatedService = await Service.findByIdAndUpdate(
        serviceId,
        {
            $push: {
                plans: planId
            }
        },
        { new: true }
    );

    if (!updatedService) {
        throw new ApiError(500, "Could not add plan id in service");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedPlan, "Service added successfully")
    )

});

const bulkServicesUpdateInPlan = asyncHandler(async (req, res) => {
    const {
        planId,
        services
    } = req.body;

    /* ------------------------------ 1. validation ----------------------------- */
    if (!planId || !Array.isArray(services)) {
        throw new ApiError(400, "Plan Id and Service Ids array are required");
    }

    // normalise IDs → ObjectIds & dedupe
    const desired = [
        ...new Set(services?.map(id => new mongoose.Types.ObjectId(id)))
    ];

    /* ------------------------------ 2. look‑ups ------------------------------- */
    const oneTimePlan = await OneTime.findById(planId);
    if (!oneTimePlan) throw new ApiError(404, "Plan not found");

    const current = oneTimePlan?.services?.map(id => id.toString());

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
            oneTimePlan.services = desired;          // overwrite to exact list
            await oneTimePlan.save({ session });

            // 5b. add subscriptionId to each new Service
            if (servicesToAdd.length) {
                await Service.updateMany(
                    { _id: { $in: servicesToAdd } },
                    { $addToSet: { plans: oneTimePlan._id } },
                    { session }
                );
            }

            // 5c. pull subscriptionId from removed Services
            if (servicesToRemove.length) {
                await Service.updateMany(
                    { _id: { $in: servicesToRemove } },
                    { $pull: { plans: oneTimePlan._id } },
                    { session }
                );
            }
        });
    } finally {
        await session.endSession();
    }

    /* ------------------------------ 6. response ------------------------------- */
    const populatedPlan = await OneTime.findById(planId)
        .populate("services")
        .exec();

    return res
        .status(200)
        .json(new ApiResponse(200, populatedPlan, "Plan services updated"));
});

const getPlans = asyncHandler(async (req, res) => {

    const allPlans = await OneTime.find({
        active: true
    }).populate("services");

    if (!allPlans) {
        throw new ApiError(500, "Could not get One Time plans");
    }

    return res.status(200).json(
        new ApiResponse(200, allPlans, "Plans fetched successfully")
    )

});

export {
    createOneTimePlan,
    updateOneTimePlan,
    addServiceInPlan,
    bulkServicesUpdateInPlan,
    getPlans
}