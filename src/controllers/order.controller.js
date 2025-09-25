import mongoose, { mongo } from "mongoose";
import Razorpay from "razorpay";
import crypto from 'crypto';
import { v4 as uuidv4 } from "uuid";
import { Subscription } from "../models/Subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Order } from "../models/order.model.js";
import { ORDER_TYPES, ROLES, STATUS } from "../constants.js";
import { User } from "../models/user.model.js";
import { OneTime } from "../models/oneTimePlan.model.js";
import { Product } from "../models/product.model.js";

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

    if (!planId || !serviceIds || !serviceIds?.length) {
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

    //check if service exist in current plan of user
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

const acceptOrderByMechanic = asyncHandler(async (req, res) => {
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
            $push: {
                orders: updatedOrder?._id
            }
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

//Common Order Functions
const getMyOrders = asyncHandler(async (req, res) => {
    const myOrders = await Order.find({
        userId: req?.user?._id,
        paymentStatus: "Paid"
    })
        .populate("subscriptionId oneTimePlan services mechanic")
        .populate({
            path: "spareParts.productId",
            model: "Product",
            select: "images _id name"
        });

    if (!myOrders) {
        throw new ApiError(500, "Could not get orders");
    }

    return res.status(200).json(
        new ApiResponse(200, myOrders, "Orders fetched successfully")
    )
});


/**
 * Helper: normalize single item input and default quantity = 1
 * Expected body: { orderId: "<id>", productId: "<id>", quantity?: number }
 */
// function normalizeSingleItem(body) {
//     const productId = body?.productId;
//     let quantity = body?.quantity;
//     if (quantity === undefined || quantity === null) quantity = 1;
//     quantity = Number(quantity);
//     return { productId, quantity };
// }

/**
 * addSparePartToOrder
 * - Input: orderId, productId, quantity(optional - default 1)
 * - Only logged-in rider (mechanic) assigned to order can add
 * - Deduct from rider.inventory and merge into order.spareParts
 * - Update order.sparePartsCharge and order.orderAmount
 * - No Stock records kept
 */
// const addSparePartToOrder = asyncHandler(async (req, res) => {
//     const session = await mongoose.startSession();
//     try {
//         const { orderId } = req.body;

//         //Only Rider can add/remove parts
//         if (req.user.role !== ROLES.RIDER)
//             throw new ApiError(403, "Only riders can add spare parts");

//         // Parse Quantity 
//         const { productId, quantity } = normalizeSingleItem(req.body);

//         //Validate Order Id, Product Id, Quantity format
//         if (!orderId || !mongoose.Types.ObjectId.isValid(orderId))
//             throw new ApiError(400, "Valid orderId is required");
//         if (!productId || !mongoose.Types.ObjectId.isValid(productId))
//             throw new ApiError(400, "Valid productId is required");
//         if (!Number.isInteger(quantity) || quantity <= 0)
//             throw new ApiError(400, "Quantity must be a positive integer");

//         //Define updated order
//         let updatedOrder = null;

//         // Start mongodb transaction to add spare parts and update inventory
//         await session.withTransaction(async () => {

//             //Validate Order
//             const order = await Order.findById(orderId).session(session);
//             if (!order)
//                 throw new ApiError(404, "Order not found");

//             //Check if mechanic is assigned and that one is updating the parts
//             if (!order.mechanic)
//                 throw new ApiError(400, "No mechanic assigned to this order");
//             if (order.mechanic.toString() !== req.user._id.toString())
//                 throw new ApiError(403, "You are not authorized to modify this order");

//             //Check for the stages when order cannot be updated
//             const forbidden = [
//                 STATUS.PENDING,
//                 STATUS.REJECTED,
//                 STATUS.COMPLETED,
//             ];
//             if (forbidden.includes(order.status))
//                 throw new ApiError(400, `Cannot add spare parts to ${order.status} Order`);

//             //Find rider and validate inventory
//             const rider = await User.findById(req.user._id).session(session);
//             if (!rider)
//                 throw new ApiError(404, "Rider not found");
//             if (!Array.isArray(rider.inventory)) rider.inventory = [];

//             // Fetch product to get pricing
//             const product = await Product.findById(productId).session(session);
//             if (!product) throw new ApiError(404, "Product not found");

//             const invIndex = rider.inventory.findIndex(i => i.productId?.toString() === productId.toString());
//             if (invIndex === -1) throw new ApiError(400, `${product.name || productId} not available in your inventory`);

//             if ((rider.inventory[invIndex].quantity || 0) < quantity) {
//                 throw new ApiError(400, `${product.name || productId} does not have sufficient quantity in inventory. Available: ${rider.inventory[invIndex].quantity || 0}`);
//             }

//             // Deduct from rider inventory
//             rider.inventory[invIndex].quantity = (rider.inventory[invIndex].quantity || 0) - quantity;
//             if (rider.inventory[invIndex].quantity <= 0) {
//                 rider.inventory.splice(invIndex, 1);
//             }

//             // Prepare order.spareParts array
//             if (!Array.isArray(order.spareParts)) order.spareParts = [];

//             // Try to find existing spare part in order and merge
//             const existingSpIndex = order.spareParts.findIndex(sp => sp.productId?.toString() === productId.toString());
//             const price = typeof rider.inventory[invIndex].sellingPrice === "number" ? rider.inventory[invIndex].sellingPrice : Number(rider.inventory[invIndex].sellingPrice || 0);
//             // const basePrice = typeof product.regularPrice === "number" ? product.regularPrice : Number(product.regularPrice || 0);
//             const deltaCharge = price * quantity;

//             if (existingSpIndex >= 0) {
//                 order.spareParts[existingSpIndex].quantity = (order.spareParts[existingSpIndex].quantity || 0) + quantity;
//                 // update price fields to latest
//                 order.spareParts[existingSpIndex].price = price;
//                 // order.spareParts[existingSpIndex].basePrice = basePrice;
//             } else {
//                 order.spareParts.push({
//                     productId: product._id,
//                     name: product.name || "",
//                     // basePrice,
//                     quantity,
//                     price,
//                 });
//             }

//             // Update totals
//             const finalSparePartsPrice = order.spareParts.reduce((acc,part) => 
//                 acc + (part?.quantity * part?.price),0);

//             order.sparePartsCharge = Number(order.sparePartsCharge || 0) + deltaCharge;
//             order.orderAmount = Number(order.orderAmount || 0) + deltaCharge;

//             // Save both docs in session
//             await rider.save({ session });
//             updatedOrder = await order.save({ session });
//         });

//         const payload = {
//             order: updatedOrder,
//             orderId: updatedOrder._id,
//             spareParts: updatedOrder.spareParts,
//             sparePartsCharge: updatedOrder.sparePartsCharge,
//             orderAmount: updatedOrder.orderAmount,
//         };
//         return res.status(200).json(new ApiResponse(200, payload, "Spare part added to order successfully"));
//     } catch (err) {
//         if (err instanceof ApiError) throw err;
//         throw new ApiError(500, err.message || "Failed to add spare part to order");
//     } finally {
//         session.endSession();
//     }
// });

/**
 * removeSparePartFromOrder
 * - Input: orderId, productId, quantity(optional default 1)
 * - Only logged-in rider who is mechanic can remove
 * - Increase rider.inventory (return parts) and decrement/remove from order.spareParts
 * - Update order totals accordingly
 */
// const removeSparePartFromOrder = asyncHandler(async (req, res) => {
//     const session = await mongoose.startSession();
//     try {
//         const { orderId } = req.body;

//         //Ensure that rider has permission to remove spare parts
//         if (req.user.role !== ROLES.RIDER) throw new ApiError(403, "Only riders can remove spare parts");

//         //Parse the quantity in correct format
//         const { productId, quantity } = normalizeSingleItem(req.body);

//         //validate orderId, product Id, and quantity
//         if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) throw new ApiError(400, "Valid orderId is required");
//         if (!productId || !mongoose.Types.ObjectId.isValid(productId)) throw new ApiError(400, "Valid productId is required");
//         if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, "Quantity must be a positive integer");

//         // define updated order and start the mongodb transaction to remove the spare part
//         let updatedOrder = null;

//         await session.withTransaction(async () => {

//             //Check if order exist
//             const order = await Order.findById(orderId).session(session);
//             if (!order) throw new ApiError(404, "Order not found");

//             // Check if mechanic is assigned and that one is updating the spare parts
//             if (!order.mechanic) throw new ApiError(400, "No mechanic assigned to this order");
//             if (order.mechanic.toString() !== req.user._id.toString()) throw new ApiError(403, "You are not authorized to modify this order");

//             // Check for valid stages to add spare parts in order
//             const forbidden = [
//                 STATUS.PENDING,
//                 STATUS.REJECTED,
//                 STATUS.COMPLETED,
//             ];
//             if (forbidden.includes(order.status)) throw new ApiError(400, `Cannot remove spare parts from ${order.status} Order`);

//             // Fetch rider and inventory
//             const rider = await User.findById(req.user._id).session(session);
//             if (!rider) throw new ApiError(404, "Rider not found");
//             if (!Array.isArray(rider.inventory)) rider.inventory = [];

//             //find spare part to remove from the inventory
//             if (!Array.isArray(order.spareParts)) order.spareParts = [];

//             const spIndex = order.spareParts.findIndex(sp => sp.productId?.toString() === productId.toString());
//             if (spIndex < 0) throw new ApiError(400, "Product not present in order spare parts");

//             const spObj = order.spareParts[spIndex];
//             if ((spObj.quantity || 0) < quantity) {
//                 throw new ApiError(400, `Order only has ${spObj.quantity || 0} units of this product, cannot remove ${quantity}`);
//             }

//             // Fetch product for pricing
//             const product = await Product.findById(productId).session(session);
//             if (!product) throw new ApiError(404, "Product not found");

//             const price = typeof product.sellingPrice === "number" ? product.sellingPrice : Number(product.sellingPrice || 0);
//             const deltaCharge = price * quantity;

//             // Decrement / remove from order
//             spObj.quantity = (spObj.quantity || 0) - quantity;
//             if (spObj.quantity <= 0) {
//                 order.spareParts.splice(spIndex, 1);
//             } else {
//                 order.spareParts[spIndex] = spObj;
//             }

//             // Return to rider inventory (merge)
//             const invIndex = rider.inventory.findIndex(i => i.productId?.toString() === productId.toString());
//             if (invIndex >= 0) {
//                 rider.inventory[invIndex].quantity = (rider.inventory[invIndex].quantity || 0) + quantity;
//             } else {
//                 rider.inventory.push({
//                     productId: product._id,
//                     name: product.name || "",
//                     quantity,
//                 });
//             }

//             // Update totals
//             order.sparePartsCharge = Number(order.sparePartsCharge || 0) - deltaCharge;
//             if (order.sparePartsCharge < 0) order.sparePartsCharge = 0;
//             order.orderAmount = Number(order.orderAmount || 0) - deltaCharge;
//             if (order.orderAmount < 0) order.orderAmount = 0;

//             // Save both
//             await rider.save({ session });
//             updatedOrder = await order.save({ session });
//         });

//         const payload = {
//             orderId: updatedOrder._id,
//             spareParts: updatedOrder.spareParts,
//             sparePartsCharge: updatedOrder.sparePartsCharge,
//             orderAmount: updatedOrder.orderAmount,
//         };
//         return res.status(200).json(new ApiResponse(200, payload, "Spare part removed from order successfully"));
//     } catch (err) {
//         if (err instanceof ApiError) throw err;
//         throw new ApiError(500, err.message || "Failed to remove spare part from order");
//     } finally {
//         session.endSession();
//     }
// });

// Add Spare parts in Order
// const addSparePartsInOrder = asyncHandler(async (req, res) => {
//     const session = await mongoose.startSession();
//     const { orderId, items } = req.body;
//     const riderInventory = req?.user?.inventory;

//     try {

//         // if (req?.user?.role != ROLES.ADMIN) {
//         //     throw new ApiError(404, "Only admins can assign inventory");
//         // }

//         // 1️⃣ Validate Rider
//         // const rider = await User.findById(riderId);
//         // if (!rider || rider.role != ROLES.RIDER) {
//         //     throw new ApiError(404, "Invalid rider ID or user is not a rider");
//         // }

//         if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
//             throw new ApiError(404, "Valid Order Id not found");
//         }

//         const foundOrder = await Order.findById(orderId);
//         if (!foundOrder) {
//             throw new ApiError(404, "Order not found");
//         }

//         if (!items || !Array.isArray(items) || items.length == 0) {
//             throw new ApiError(400, "No items provided");
//         }

//         // 2️⃣ Validate Products & Stock
//         let updatedItems = [];
//         for (let item of items) {
//             if (!item?.productId || !item?.quantity || item.quantity <= 0) {
//                 throw new ApiError(400, "Invalid product or quantity");
//             }

//             const product = riderInventory?.find(
//                     inv => inv?.productId?.toString() == item?.productId?.toString()
//                 );
//             if (!product) {
//                 throw new ApiError(404, `Product not found with Id: ${item.productId}`);
//             }

//             if (product.quantity < item.quantity) {
//                 throw new ApiError(
//                     400,
//                     `${product.name} does not have sufficient stock. Available: ${product.quantity}`
//                 );
//             }

//             updatedItems.push({
//                 productId: product._id,
//                 name: product.name,
//                 quantity: item.quantity,
//             });
//         }

//         // 3️⃣ Transaction: Deduct Stock First → Assign/Update Rider Inventory
//         await session.withTransaction(async () => {

//             let newStocksArray = [];

//             // Deduct stock from each Product
//             for (let item of updatedItems) {
//                 const foundProduct = await Product.findByIdAndUpdate(
//                     item.productId,
//                     { $inc: { totalStock: -item.quantity } },
//                     { session }
//                 );

//                 // Create stock entry (for addition in mechanic)
//                 const [newMechanicStock] = await Stock.create([{
//                     sellingPrice: foundProduct?.sellingPrice[foundProduct?.sellingPrice?.length - 1],
//                     quantity: item?.quantity,
//                     productId: item?.productId,
//                     mechanicName: rider?.name,
//                     mechanic: rider?._id
//                 }],
//                     { session });

//                 newStocksArray.push(newMechanicStock?._id);
//             }

//             // Update Rider inventory
//             for (let item of updatedItems) {
//                 const existingItem = rider.inventory.find(
//                     inv => inv.productId.toString() == item.productId.toString()
//                 );

//                 if (existingItem) {
//                     // If already exists → increase quantity
//                     existingItem.quantity += item.quantity;
//                 } else {
//                     // Otherwise push new item
//                     rider.inventory.push(item);
//                 }
//             }

//             console.log("New Stock History:", newStocksArray);
//             rider.stock = [...rider?.stock, ...newStocksArray];

//             await rider.save({ session });
//         });

//         // ✅ Success Response
//         res.status(200).json({
//             success: true,
//             message: "Inventory assigned to rider successfully",
//             inventory: rider.inventory,
//             stcokHistory: rider?.stock
//         });

//     } catch (error) {
//         console.error("Assign Inventory Error:", error);
//         throw new ApiError(500, error.message || "Failed to assign inventory");
//     } finally {
//         session.endSession();
//     }
// });


export {
    createOneTimeOrder,
    verifyOneTimeOrderPayment,
    createSubscribedUserOrder,
    getMyOrders,
    acceptOrderByMechanic,
    // addSparePartToOrder,
    // removeSparePartFromOrder
}