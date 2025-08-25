import mongoose from "mongoose";

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Brand name is required"],
        unique: [true, "Brand name already exist"]
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