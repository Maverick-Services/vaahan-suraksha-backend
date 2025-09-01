import mongoose from "mongoose";
import { itemsSchema } from "./product.model.js";

const orderSchema = new mongoose.Schema({
    paidAmount: {
        type: Number,
        required: true,
        default: 0
    },
    serviceCharge: {
        type: Number,
        // required: true,
        default: 0
    },
    orderAmount: {
        type: Number,
        // required: true,
        default: 0
    },
    sparePartsCharge: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        enum: ["oneTime", "monthly"],
        default: "oneTime"
    },

    /****************  ORDER TRACKING  *****************/
    status: {
        type: String,
        enum: ["Pending", "Completed", "Accepted", "Rejected", "In Progress"],
        default: "Pending"
    },
    scheduledOn: {
        type: Date
    },
    location: String,
    name: String,
    phoneNo: String,
    mechanic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    spareParts: [itemsSchema],

    /****************  PAYMENT FIELDS  *****************/
    razorpayOrderId: String,
    razorpayPaymentId: String,
    paymentStatus: {
        type: String,
        enum: ["Paid", "Pending"],
        default: "Pending"
    },

    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    subscriptionName: {
        type: String,
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }
});

export const Order = mongoose.model("Order", orderSchema);