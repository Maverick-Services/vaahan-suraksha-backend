import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
    product_id: {
        type: Number,
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Brand"
    },
    car_model: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "CarModel"
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
    slug: {
        type: String,
        lowercase: true,
        // required: true,
        unique: [true, 'Slug must be unique']
    },
    description: {
        type: String,
        // required: true,
    },
    descriptionPoints: {
        type: [String],
    },
    keyInformation: {
        type: mongoose.Schema.Types.Mixed,
        default: []
    },
    sku: {
        type: String,
    },
    hsn: {
        type: String,
    },
    gst: {
        type: Number,
        default: 0
    },
    totalStock: {
        type: Number,
        default: 0
    },
    stock: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
    }],
    regularPrice: {
        type: Number,
        min: 0,
        set: v => parseFloat(Number(v).toFixed(3)), // Auto-round to 3 decimal places
        validate: {
            validator: function (v) {
                return /^\d+(\.\d{3})?$/.test(v.toFixed(3)); // Ensure exactly 3 decimal places
            },
            message: props => `${props.value} is not valid. Must have exactly 3 decimal places.`
        },
        default: 0
    },
    sellingPrice: {
        type: Number,
        min: 0,
        set: v => parseFloat(Number(v).toFixed(3)), // Auto-round to 3 decimal places
        validate: {
            validator: function (v) {
                return /^\d+(\.\d{3})?$/.test(v.toFixed(3)); // Ensure exactly 3 decimal places
            },
            message: props => `${props.value} is not valid. Must have exactly 3 decimal places.`
        },
        default: 0
    },
    images: [{
        type: String,
    }],
}, { timestamps: true });

export const Product = mongoose.model("Product", productSchema);