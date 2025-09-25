import mongoose from "mongoose";
import { Brand } from "../models/brand.model.js";
import { CarModel } from "../models/car_model.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Car } from "../models/car.model.js";
import { User } from "../models/user.model.js";
import { ROLES } from "../constants.js";

// Brand Management Controllers
const createBrand = asyncHandler(async (req, res) => {
    const {
        name,
        image,
        active
    } = req.body;

    if (!name || active == undefined || active == null) {
        throw new ApiError(404, "Complete details not found to create brand");
    }

    // const service_id = generateServiceId();

    // if (!service_id) {
    //     throw new ApiError(500, "Could not generate service Id");
    // }

    const newBrand = await Brand.create({
        // service_id,
        name,
        image,
        active
    });

    if (!newBrand) {
        throw new ApiError(500, "Could not create brand");
    }

    return res.status(201).json(
        new ApiResponse(201, newBrand, "Brand created successfully")
    )

});

const updateBrand = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { brandId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in brand");
    }

    if (!brandId) {
        throw new ApiError(500, "Could not find brand Id");
    }

    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(500, "Brand not found");
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
        brandId,
        {
            ...updates,
        },
        { new: true }
    );

    if (!updatedBrand) {
        throw new ApiError(500, "Could not update brand");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedBrand, "brand updated successfully")
    )

});

const getBrands = asyncHandler(async (req, res) => {

    const allBrands = await Brand.find({
        active: true
    }).populate("car_models");

    if (!allBrands) {
        throw new ApiError(500, "Could not get brands");
    }

    return res.status(200).json(
        new ApiResponse(200, allBrands, "Brands fetched successfully")
    )

});

// Model Management Controllers
const createCarModel = asyncHandler(async (req, res) => {
    const {
        brandId,
        name,
        carType,
        image,
        active
    } = req.body;

    if (!brandId || !mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(404, "Valid Brand Id required in model details");
    }

    if (!name || active == undefined || active == null) {
        throw new ApiError(404, "Complete details not found to create car model");
    }

    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(500, "Brand not found");
    }

    const newCarModel = await CarModel.create({
        brand: brandId,
        name,
        carType,
        image,
        active
    });

    if (!newCarModel) {
        throw new ApiError(500, "Could not create car model");
    }

    const updatedBrand = await Brand.findByIdAndUpdate(
        brandId,
        {
            $push: {
                car_models: newCarModel?._id
            }
        },
        { new: true }
    );

    if (!updatedBrand) {
        throw new ApiError(500, "Could not add car model in brand");
    }

    return res.status(201).json(
        new ApiResponse(201, newCarModel, "Car Model created successfully")
    )

});

const updateCarModel = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { carModelId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in car model");
    }

    // if (updates?.brandId && !updates?.carModelId) {
    //     throw new ApiError(400, "Brand and Car Ids are required");
    // }

    if (!carModelId) {
        throw new ApiError(500, "Could not find car model Id");
    }

    const foundCarModel = await CarModel.findById(carModelId);
    if (!foundCarModel) {
        throw new ApiError(500, "Car model not found");
    }

    if (updates?.brandId) {
        const foundBrand = await Brand.findById(updates?.brandId);
        if (!foundBrand) {
            throw new ApiError(500, "Brand does not exist");
        }

        const foundCarModel = await CarModel.findById(updates?.carModelId);
        if (!foundCarModel) {
            throw new ApiError(500, "Car Model does not exist");
        }

        if (foundCarModel?.brand?.toString() != foundBrand?._id?.toString()) {

            const updatedOldBrand = await Brand.findByIdAndUpdate(
                foundCarModel?.brand,
                {
                    $pull: {
                        car_models: foundCarModel?._id
                    }
                },
                { new: true }
            )
            console.log("Old Brand:", updatedOldBrand);

            const updatedNewBrand = await Brand.findByIdAndUpdate(
                foundBrand?._id,
                {
                    $push: {
                        car_models: foundCarModel?._id
                    }
                },
                { new: true }
            )
            console.log("New Brand:", updatedNewBrand);
            // throw new ApiError(404, "Car model not found in brand");
        }
    }

    const updatedCarModel = await CarModel.findByIdAndUpdate(
        carModelId,
        {
            ...updates,
            brand: updates?.brandId,
        },
        { new: true }
    );

    if (!updatedCarModel) {
        throw new ApiError(500, "Could not update car model");
    }

    return res.status(200).json(
        new ApiResponse(200, updatedCarModel, "car model updated successfully")
    )

});

const getCarModelsByBrand = asyncHandler(async (req, res) => {

    const { brandId } = req?.params;

    if (!brandId || !mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(400, "Valid Brand Id required to get car models");
    }

    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(400, "Brand does not exist.");
    }

    const allCarModels = await CarModel.find({
        brand: brandId,
        active: true
    }).populate("brand");

    if (!allCarModels) {
        throw new ApiError(500, "Could not get car models");
    }

    return res.status(200).json(
        new ApiResponse(200, allCarModels, "Car Models fetched successfully")
    )

});

// User Car Management Controllers
const createCar = asyncHandler(async (req, res) => {
    const {
        brandId,
        carModelId,
        // name,
        image,
        transmission,
        fuel
    } = req.body;

    if (!brandId || !mongoose.Types.ObjectId.isValid(brandId)) {
        throw new ApiError(404, "Valid Brand Id required in car details");
    }

    if (!carModelId || !mongoose.Types.ObjectId.isValid(carModelId)) {
        throw new ApiError(404, "Valid Model Id required in car details");
    }

    if (req?.user?.role !== ROLES.USER) {
        throw new ApiError(404, "Only Users can add car");
    }

    if (req?.user?.car) {
        throw new ApiError(403, "Car already added");
    }

    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(500, "Brand not found");
    }

    const foundCarModel = await CarModel.findById(carModelId);
    if (!foundCarModel) {
        throw new ApiError(500, "Car Model not found");
    }

    if (foundCarModel?.brand?.toString() != foundBrand?._id?.toString()) {
        throw new ApiError(404, "Car model not found in brand");
    }

    const newCar = await Car.create({
        brand: brandId,
        car_model: carModelId,
        transmission,
        fuel,
        image,
        userId: req?.user?._id
    });

    if (!newCar) {
        throw new ApiError(500, "Could not create car");
    }

    //update car in user
    const updatedUser = await User.findByIdAndUpdate(
        req?.user?._id,
        {
            car: newCar?._id
        },
        { new: true }
    )
    // .populate("car");

    if (!updatedUser) {
        throw new ApiError(500, "Could not add car in user");
    }

    return res.status(201).json(
        new ApiResponse(201, newCar, "Car added successfully")
    )

});

const updateCar = asyncHandler(async (req, res) => {
    const updates = req.body;
    const { carId } = req?.body;

    if (!updates) {
        throw new ApiError(404, "Nothing found to update in car");
    }

    if (updates?.brandId && !updates?.carModelId) {
        throw new ApiError(400, "Brand and Car Ids are required");
    }

    if (!carId) {
        throw new ApiError(500, "Could not find car Id");
    }

    const foundCar = await Car.findById(carId);
    if (!foundCar) {
        throw new ApiError(500, "Car not found");
    }

    if (updates?.brandId) {
        const foundBrand = await Brand.findById(updates?.brandId);
        if (!foundBrand) {
            throw new ApiError(500, "Brand does not exist");
        }

        const foundCarModel = await CarModel.findById(updates?.carModelId);
        if (!foundCarModel) {
            throw new ApiError(500, "Car Model does not exist");
        }

        if (foundCarModel?.brand?.toString() != foundBrand?._id?.toString()) {
            throw new ApiError(404, "Car model not found in brand");
        }
    }

    const updatedCar = await Car.findByIdAndUpdate(
        carId,
        {
            ...updates,
            brand: updates?.brandId || foundCar?.brand,
            car_model: updates?.carModelId || foundCar?.car_model
        },
        { new: true }
    );

    if (!updatedCar) {
        throw new ApiError(500, "Could not update car");
    }

    return res.status(201).json(
        new ApiResponse(201, updatedCar, "car updated successfully")
    )

});

const deleteCar = asyncHandler(async (req, res) => {
    const { carId } = req?.body;

    if (!carId) {
        throw new ApiError(500, "Could not find car Id");
    }

    const foundCar = await Car.findById(carId);
    if (!foundCar) {
        throw new ApiError(500, "Car not found");
    }

    // delete car
    const deletedCar = await Car.findByIdAndDelete(carId);

    if (!deletedCar) {
        throw new ApiError(500, "Could not delete car");
    }

    //remove car from user
    const updatedUser = await User.findByIdAndUpdate(
        deletedCar?.userId,
        {
            car: null
        },
        { new: true }
    );

    if (!updatedUser) {
        throw new ApiError(500, "Could not remove car from user profile");
    }

    return res.status(200).json(
        new ApiResponse(200, { car: deletedCar, user: updatedUser }, "car deleted successfully")
    )

});

const getCarByUser = asyncHandler(async (req, res) => {

    const userId = req?.user?._id;

    const myCar = await Car.find({
        userId
    }).populate("brand car_model");

    if (!myCar) {
        throw new ApiError(500, "Could not get car");
    }

    return res.status(200).json(
        new ApiResponse(200, myCar, "Car fetched successfully")
    )

})

export {
    createBrand,
    updateBrand,
    getBrands,
    createCarModel,
    updateCarModel,
    getCarModelsByBrand,
    createCar,
    updateCar,
    deleteCar,
    getCarByUser
}