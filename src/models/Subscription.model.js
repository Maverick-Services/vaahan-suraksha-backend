import mongoose from "mongoose";

const pricingSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["b2b", "b2c"],
        // required: [true, "Customer Type is required"]
    },
    price: {
        type: Number,
        // required: [true, "One Time price is required"]
    },
    oneTimePrice: {
        type: Number,
        // required: [true, "One Time price is required"]
    },
    monthlyPrice: {
        type: Number,
        required: [true, "Monthly price is required"]
    },
}, { _id: false });

const subscriptionSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Subscription name is required"],
        unique: [true, "Subscription name already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    limit: {
        type: Number,
        // required: [true, "Service limit request is required"]
    },
    duration: {
        type: Number,
        // required: [true, "Plan duration is required"]
    },
    durationUnit: {
        type: String,
        enum: ["month", "year"],
        default: "year"
        // required: [true, "Specify the unit of duration - month/year"]
    },
    startDate: {
        type: Date,
        // required: [true, "Service limit request is required"]
    },
    endDate: {
        type: Date,
        // required: [true, "Service limit request is required"]
    },
    icon: {
        type: String,
    },
    pricing: {
        type: Map,
        of: pricingSchema,
        default: () => new Map()
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
    currentSubscribers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    pastSubscribers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
}, { timestamps: true });

export const Subscription = mongoose.model("Subscription", subscriptionSchema);