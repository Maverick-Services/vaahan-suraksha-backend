import { Service } from "../models/service.model.js";
import { Subscription } from "../models/Subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getPaginatedUsers = asyncHandler(async (req, res) => {
    const { role, startDate, endDate, type, searchQuery } = req.query;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const filter = {};

    if (role && role !== "all") {
        filter.role = role;
    }

    if (type) {
        filter.type = type;
    }

    if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setUTCHours(23, 59, 59, 999);
        filter.createdAt = { $gte: start, $lte: end };
    }

    if (searchQuery) {
        const regex = new RegExp(searchQuery, "i");
        filter.$or = [
            { name: regex },
            { email: regex },
            { phoneNo: regex }
        ];
    }

    /* ========== Fetch Users with Pagination ========== */
    const [users, totalCount] = await Promise.all([
        User.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .select("-password -refreshToken")
            .lean(),
        User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return res.status(200).json(
        new ApiResponse(200, {
            users,
            totalCount,
            pagination: {
                page,
                limit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
            },
        }, "Users fetched successfully")
    );
});

const getPaginatedServices = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const parsedPage = Math.max(1, parseInt(page));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (parsedPage - 1) * parsedLimit;

    //   const filter = { active: true };
    const filter = {};

    const [services, totalCount] = await Promise.all([
        Service.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean(),
        Service.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return res.status(200).json(
        new ApiResponse(200, {
            services,
            totalCount,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                totalPages,
                hasNextPage: parsedPage < totalPages,
                hasPrevPage: parsedPage > 1,
            },
        }, "Services fetched successfully")
    );
});

const getPaginatedSubscriptions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;

    const parsedPage = Math.max(1, parseInt(page));
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit)));
    const skip = (parsedPage - 1) * parsedLimit;

    const filter = { active: true };

    const [subscriptions, totalCount] = await Promise.all([
        Subscription.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parsedLimit)
            .lean(),
        Subscription.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / parsedLimit);

    return res.status(200).json(
        new ApiResponse(200, {
            subscriptions,
            totalCount,
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                totalPages,
                hasNextPage: parsedPage < totalPages,
                hasPrevPage: parsedPage > 1,
            },
        }, "Subscriptions fetched successfully")
    );
});

export {
    getPaginatedUsers,
    getPaginatedServices,
    getPaginatedSubscriptions
};