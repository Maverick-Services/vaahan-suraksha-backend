import { Brand } from "../models/brand.model.js";
import { CarModel } from "../models/car_model.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateServiceId } from "../utils/generateId.js";

const createProduct = asyncHandler(async (req, res) => {
    let {
        name, brandId, carModelId, description,
        price, categoryId,
        slug, active, images,
        descriptionPoints,
        keyInformation,
        sellingPrice, regularPrice,
        sku, hsn
    } = req.body;

    //TODO: Add Images to it

    //Validate details
    if (
        !slug ||
        !name || !brandId || !carModelId || !description ||
        !price || !categoryId
    ) {
        throw new ApiError(400, "Complete details not found to create Product");
    }

    name = name.trim()
    fullName = fullName.trim()
    description = description.trim()

    // Validate brand Id
    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(409, `Brand not found`);
    }

    // Validate car model Id
    const foundCarModel = await CarModel.findById(carModelId);
    if (!foundCarModel) {
        throw new ApiError(409, `Car model not found`);
    }

    //create new product
    const newProduct = await Product.create({
        name, description,
        slug, active,
        brand: brandId,
        car_model: carModelId,
        images: images ? images : [],
        keyInformation,
        descriptionPoints,
        sku, hsn,
        sellingPrice: sellingPrice || 0,
        regularPrice: regularPrice || 0
    });
    if (!newProduct) {
        throw new ApiError(409, "Could not create product");
    }

    //add the product in subCategory
    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
        { _id: categoryId },
        {
            $push: {
                products: newProduct?._id
            }
        },
        { new: true }
    ).populate("parentCategory products").exec();
    console.log("Sub Category: ", updatedSubCategory);

    //return response
    return res.status(201).json(
        new ApiResponse(201, newProduct, "Product created Successfully")
    )
});

export {
}