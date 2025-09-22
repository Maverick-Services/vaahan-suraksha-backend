import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema({
    service_id: {
        type: String,
        required: [true, "Service name is required"],
        unique: [true, "Service name already exist"]
    },
    name: {
        type: String,
        required: [true, "Service name is required"],
        unique: [true, "Service name already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    images: [{
        type: String,
    }],
    packages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    }],
    plans: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "OneTime"
    }]
}, { timestamps: true });

export const Service = mongoose.model("Service", serviceSchema);