import mongoose from "mongoose";

const oneTimePanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Plan name is required"],
        unique: [true, "Pan name already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    limit: {
        type: Number,
        // required: [true, "Service limit request is required"]
    },
    icon: {
        type: String,
    },
    pricing: {
        type: Map,
        of: Number,
        default: () => new Map()
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
}, { timestamps: true });

export const OneTime = mongoose.model("OneTime", oneTimePanSchema);