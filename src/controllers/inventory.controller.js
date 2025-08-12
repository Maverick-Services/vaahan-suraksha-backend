import { Brand } from "../models/brand.model.js";
import { CarModel } from "../models/car_model.model.js";
import { Product } from "../models/product.model.js";
import { Stock } from "../models/stock.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createProduct = asyncHandler(async (req, res) => {
    let {
        name, vendor, brandId, carModelId, description,
        slug, active, images,
        descriptionPoints,
        keyInformation,
        sellingPrice, regularPrice,
        sku, hsn
    } = req.body;

    //TODO: Add Images to it

    //Validate details
    if (
        !name || !description
        // !slug ||
        // || !sellingPrice
    ) {
        throw new ApiError(400, "Complete details not found to create Product");
    }

    if (!brandId) {
        throw new ApiError(400, "Brand Id not found");
    }

    name = name?.trim()
    vendor = vendor?.trim()
    description = description?.trim()

    // Validate brand Id
    const foundBrand = await Brand.findById(brandId);
    if (!foundBrand) {
        throw new ApiError(409, `Brand not found`);
    }

    // Validate car model Id
    if (carModelId) {
        let foundCarModel = null;
        foundCarModel = await CarModel.findById(carModelId);
        if (!foundCarModel) {
            throw new ApiError(409, `Car model not found`);
        }

        if (foundCarModel?.brand?.toString() != foundBrand?._id?.toString()) {
            throw new ApiError(404, "Car model not found in brand");
        }
    }

    //create new product
    const newProduct = await Product.create({
        name, vendor, description,
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

    //add the product in car model
    let updatedCarModel = null;
    if (carModelId) {
        updatedCarModel = await CarModel.findByIdAndUpdate(
            carModelId,
            {
                $push: {
                    products: newProduct?._id
                }
            },
            { new: true }
        ).populate("brand products").exec();
        if (!updatedCarModel) {
            throw new ApiError(409, "Could not add product in car model");
        }
    }

    //return response
    return res.status(201).json(
        new ApiResponse(201, {
            model: updatedCarModel,
            product: newProduct
        }, "Product created Successfully")
    )
});

const updateProduct = asyncHandler(async (req, res) => {
    const { productId } = req.body;
    const updates = req.body;

    //Validations
    if (
        !productId
    ) {
        throw new ApiError(400, "Product Id not found");
    }

    const foundProduct = await Product.findById(productId);
    if (!foundProduct) {
        throw new ApiError(409, `Product not found`);
    }

    // Validate brand Id
    if (updates?.brandId) {
        const foundBrand = await Brand.findById(updates?.brandId);
        if (!foundBrand) {
            throw new ApiError(409, `Brand not found`);
        }

        // Validate car model Id
        if (updates?.carModelId) {
            let foundCarModel = null;
            foundCarModel = await CarModel.findById(updates?.carModelId);
            if (!foundCarModel) {
                throw new ApiError(409, `Car model not found`);
            }

            if (foundCarModel?.brand?.toString() != foundBrand?._id?.toString()) {
                throw new ApiError(404, "Car model not found in brand");
            }
        }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        {
            ...updates,
            brand: updates?.brandId || foundProduct?.brand,
            car_model: updates?.carModelId
        },
        { new: true }
    ).populate("brand car_model").exec();
    if (!updatedProduct) {
        throw new ApiError(409, "Could not update product");
    }

    // update car model products array if model updated
    if (updates?.carModelId) {
        if (foundProduct?.car_model !== updatedProduct?.car_model?._id) {
            //Remove product in old sub category
            const oldCarModel = await CarModel.findByIdAndUpdate(
                { _id: foundProduct?.car_model },
                {
                    $pull: {
                        products: foundProduct?._id
                    }
                },
                { new: true }
            ).populate("products brand").exec();
            // console.log("Old Car Model: ", oldCarModel);

            //add the product in new sub category
            const newCarModel = await CarModel.findByIdAndUpdate(
                { _id: updatedProduct?.car_model?._id },
                {
                    $push: {
                        products: updatedProduct?._id
                    }
                },
                { new: true }
            ).populate("products brand").exec();
            // console.log("New Car Model: ", newCarModel);
        }
    }

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product updated Successfully")
    )
});

const updateProductStock = asyncHandler(async (req, res) => {
    let {
        purchasePrice,
        quantity,
        productId
    } = req.body;


    if (quantity === undefined || !productId) {
        throw new ApiError(400, "All stock details are required");
    }

    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity)) {
        throw new ApiError(400, "Quantity must be a valid number");
    }

    if (parsedQuantity == 0) {
        throw new ApiError(400, "Quantity cannot be 0");
    }

    // Fetch product
    const existingProduct = await Product.findById(productId)
        .populate("brand car_model stock")
        .exec();

    if (!existingProduct) {
        throw new ApiError(409, "Product not found");
    }

    const currentTotalStock = existingProduct?.totalStock || 0;
    const updatedTotalStock = currentTotalStock + parsedQuantity;

    // Prevent going below zero
    if (updatedTotalStock < 0) {
        throw new ApiError(400, "Insufficient stock for this operation");
    }

    // Create stock entry (even for deduction)
    const newProductStock = await Stock.create({
        purchasePrice,
        quantity: parsedQuantity,
        productId
    });

    if (!newProductStock) {
        throw new ApiError(500, "Could not create stock entry");
    }

    // Update product
    existingProduct.totalStock = updatedTotalStock;
    existingProduct.stock.push(newProductStock._id);

    const updatedProduct = await Product.findByIdAndUpdate(
        existingProduct._id,
        {
            totalStock: updatedTotalStock,
            stock: existingProduct.stock
        },
        { new: true }
    )
        .populate("brand car_model stock")
        .exec();

    return res.status(200).json(
        new ApiResponse(200, updatedProduct, "Product stock updated successfully")
    );
});

const getProducts = asyncHandler(async (req, res) => {

    const allProducts = await Product.find({
        active: true
    }).populate("brand car_model stock");

    if (!allProducts) {
        throw new ApiError(500, "Could not get products");
    }

    return res.status(200).json(
        new ApiResponse(200, allProducts, "Products fetched successfully")
    )

});

export {
    createProduct,
    updateProduct,
    updateProductStock,
    getProducts
}