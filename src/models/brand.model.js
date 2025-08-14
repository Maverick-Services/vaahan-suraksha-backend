import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Service name is required"],
        unique: [true, "Service name already exist"]
    },
    active: {
        type: Boolean,
        default: true
    },
    image: {
        type: String,
    },
    car_models: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "CarModel"
    }]
});

export const Brand = mongoose.model("Brand", brandSchema);