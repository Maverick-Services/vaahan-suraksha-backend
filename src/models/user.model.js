import mongoose from "mongoose";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { itemsSchema } from "./product.model.js";

const billingSchema = new mongoose.Schema({
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    billingDate: {
        type: Date,
        // required: [true, "Service limit request is required"]
    },
    billingAmount: {
        type: Number,
        // required: [true, "Price is required"]
    },
}, { _id: false });

const subscriptionSchema = new mongoose.Schema({
    isVerified: {
        type: Boolean,
        default: false,
    },
    name: {
        type: String,
        required: [true, "Subscription name is required"],
    },
    price: {
        type: Number,
        required: [true, "Price is required"]
    },
    limit: {
        type: Number,
        required: [true, "Service limit request is required"]
    },
    startDate: {
        type: Date,
        // required: [true, "Service limit request is required"]
    },
    nextBillingDate: {
        type: Date,
        // required: [true, "Service limit request is required"]
    },
    upgradeDate: {
        type: Date,
    },
    subscriptionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subscription"
    },
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }],
}, { _id: false })

const userSchema = new mongoose.Schema({
    user_id: {
        type: String,
        unique: [true, "User Id must be unique"]
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: [true, "Email must be unique"]
    },
    phoneNo: {
        type: String,
        unique: [true, "Phone no must be unique"]
    },
    password: {
        type: String,
        trim: true
    },
    active: {
        type: Boolean,
        default: true
    },
    isSubscribed: {
        type: Boolean,
        default: false
    },
    refreshToken: {
        type: String
    },
    role: {
        type: String,
        enum: ["admin", "company", "user", "super-admin", "employee", "rider"]
    },
    type: {
        type: String,
        enum: ["b2b", "b2c"]
    },
    company: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    car: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Car"
    },
    inventory: [itemsSchema],
    stock: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stock',
    }],
    orders: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order"
    }],
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    currentPlan: subscriptionSchema,
    planHistory: [subscriptionSchema],
    billingHistory: [billingSchema],
    services: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Service"
    }]
}, { timestamps: true });

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            name: this.name,
            phoneNo: this.phoneNo,
            permissions: this.permissions,
        },
        process.env.ACCESS_TOKEN_SECRET,
        // {
        //     expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        // }
    )
}

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            permissions: this.permissions,
        },
        process.env.REFRESH_TOKEN_SECRET,
        // {
        //     expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        // }
    )
}

export const User = mongoose.model("User", userSchema);