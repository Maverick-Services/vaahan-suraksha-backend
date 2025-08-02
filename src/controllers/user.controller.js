import { ROLES, USER_TYPE } from "../constants.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { generateOtherIds, generateUsertId } from "../utils/generateId.js";

const createEmployee = asyncHandler(async (req, res) => {
    let {
        name, email, phoneNo,
        role,
        password
    } = req.body;

    if (
        [name, email, phoneNo, password, role].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    name = name?.trim();
    email = email?.trim();
    phoneNo = phoneNo?.trim();
    password = password?.trim();
    role = role?.trim();
    const user_id = generateOtherIds(role);

    if (!user_id) {
        throw new ApiError(404, "Could not generate user Id");
    }

    // if (role === ROLES.EMPLOYEE && (!permissions || !(departments))) {
    //     throw new ApiError(400, "Permissions and departments required for employee")
    // }

    const existedUser = await User.findOne({
        $or: [{ phoneNo }, { email }]
    })

    // console.log(existedUser);
    if (existedUser) {
        throw new ApiError(409, "User with email or phone number already exists")
    }

    const user = await User.create({
        user_id,
        name,
        email,
        phoneNo,
        password,
        role
    })

    if (!user) {
        throw new ApiError(500, `Something went wrong while creating the ${role}`)
    }

    let createdUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .exec();

    if (!createdUser) {
        throw new ApiError(500, `Something went wrong while creating the ${role}`)
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, `${role} registered Successfully`)
    )

});

const createCompany = asyncHandler(async (req, res) => {
    let {
        name, email, phoneNo,
        password
    } = req.body;

    if (
        [name, email, phoneNo, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    name = name?.trim();
    email = email?.trim();
    phoneNo = phoneNo?.trim();
    password = password?.trim();
    const user_id = generateOtherIds(ROLES.COMPANY);

    if (!user_id) {
        throw new ApiError(404, "Could not generate company Id");
    }

    const existedUser = await User.findOne({
        $or: [{ phoneNo }, { email }]
    })

    // console.log(existedUser);
    if (existedUser) {
        throw new ApiError(409, "User with email or phone number already exists")
    }

    const user = await User.create({
        user_id,
        name,
        email,
        phoneNo,
        password,
        role: ROLES.COMPANY,
    })

    if (!user) {
        throw new ApiError(500, `Something went wrong while creating the company`)
    }

    let createdUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .exec();

    if (!createdUser) {
        throw new ApiError(500, `Something went wrong while creating the company`)
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser, `company registered Successfully`)
    )

});

const createUser = asyncHandler(async (req, res) => {
    let {
        name, email, phoneNo,
        password, type,
        company
    } = req.body;

    if (
        [name, email, phoneNo, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    if (type == USER_TYPE.B2B) {
        if (!company)
            throw new ApiError(400, "Company is required for B2B User");
        else {
            const foundCompany = await User.findById(company);
            if (!foundCompany)
                throw new ApiError(404, `Company not found with Id ${company}`);
        }
    }

    name = name?.trim();
    email = email?.trim();
    phoneNo = phoneNo?.trim();
    password = password?.trim();
    const user_id = generateUsertId(type);

    if (!user_id) {
        throw new ApiError(404, "Could not generate user Id");
    }

    const existedUser = await User.findOne({
        $or: [{ phoneNo }, { email }]
    })

    // console.log(existedUser);
    if (existedUser) {
        throw new ApiError(409, "User with email or phone number already exists")
    }

    const user = await User.create({
        user_id,
        name,
        email,
        phoneNo,
        password,
        role: ROLES.USER,
        type
    })

    if (!user) {
        throw new ApiError(500, `Something went wrong while creating the user`)
    }

    //if b2b user then add userId in company's members array
    const foundCompany = await User.findByIdAndUpdate(
        company,
        {
            $push: {
                members: user?._id
            }
        },
        { new: true }
    )

    let createdUser = await User.findById(user._id)
        .select("-password -refreshToken")
        .exec();

    if (!createdUser) {
        throw new ApiError(500, `Something went wrong while creating the user`)
    }

    return res.status(201).json(
        new ApiResponse(201, { user: createdUser, company: foundCompany }, `user registered Successfully`)
    )
});

const generateAccessAndRefereshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating referesh and access token")
    }
}

const loginUser = asyncHandler(async (req, res) => {
    const { role, email, phoneNo, password } = req.body;

    if (!role) {
        throw new ApiError(400, 'Role Not Found');
    }

    if (role != ROLES.USER && (!email || !password)) {
        throw new ApiError(404, "Email password required to login");
    }

    if (role == ROLES.USER) {
        if (!phoneNo && !email && !password)
            throw new ApiError(404, "Either phone number or email, passsword required to login");
        else if (!phoneNo && (!email || !password))
            throw new ApiError(404, "Email and password required for login");
        else if (!email && !phoneNo)
            throw new ApiError(404, "Email not found. phone number required for login")
    }

    let user = null;

    // User Login
    if (role === ROLES.USER) {

        // With Phone no
        if (phoneNo) {
            user = await User.findOne({
                phoneNo
            })

            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            if (user?.role != ROLES.USER) {
                throw new ApiError(400, `${user?.role} account registered with this phone number`);
            }

        }
        // Or with Email 
        else {
            user = await User.findOne({ email: email ? email : "" });
            if (!user) {
                throw new ApiError(404, 'User not found');
            }

            if (user?.role != ROLES.USER) {
                throw new ApiError(400, `${user?.role} account registered with this email`);
            }

            const isPasswordValid = await user.isPasswordCorrect(password)
            if (!isPasswordValid) {
                throw new ApiError(401, "Invalid user credentials")
            }
        }

    }
    // Super-admin, Admin, Employee, Company, Rider Login
    else {
        user = await User.findOne({ email: email ? email : "" });
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        if (role == ROLES.EMPLOYEE && (user?.role != ROLES.ADMIN && user?.role != ROLES.EMPLOYEE)) {
            throw new ApiError(400, `${user?.role} account registered with this email`);
        }

        if (role != ROLES.EMPLOYEE && user?.role != role) {
            throw new ApiError(400, `${user?.role} account registered with this email`);
        }

        const isPasswordValid = await user.isPasswordCorrect(password)
        if (!isPasswordValid) {
            throw new ApiError(401, "Invalid user credentials")
        }
    }

    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(user?._id);

    const loggedInUser = await User.findById(user?._id)
        .select("-password -refreshToken")
        .exec();

    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser, accessToken, refreshToken
                },
                "User logged In Successfully"
            )
        )

})

export {
    createEmployee,
    createCompany,
    createUser,
    loginUser
}