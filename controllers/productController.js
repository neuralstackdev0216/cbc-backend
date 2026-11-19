
import Product from "../models/product.js";
import { isAdmin } from "./userController.js";

// Check whether a query parameter is a valid string
function isValidQueryString(value) {
    return (
        typeof value === "string" &&
        value.trim() !== ""
    );
}

// Escape special characters used in regular expressions
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Validate positive integers for pagination
function isPositiveInteger(value) {
    return (
        typeof value === "string" &&
        /^[1-9]\d*$/.test(value) &&
        Number.isSafeInteger(Number(value))
    );
}

// Validate non-negative price values
function isValidPrice(value) {
    return (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value)) &&
        Number(value) >= 0
    );
}

// GET ALL PRODUCTS
export async function getProducts(req, res) {
    try {
        const filter = {};

        // Validate brand
        if (
            req.query.brand !== undefined &&
            !isValidQueryString(req.query.brand)
        ) {
            return res.status(400).json({
                message: "Brand must be a non-empty string"
            });
        }

        // Validate category
        if (
            req.query.category !== undefined &&
            !isValidQueryString(req.query.category)
        ) {
            return res.status(400).json({
                message: "Category must be a non-empty string"
            });
        }

        // Validate search
        if (req.query.search !== undefined) {
            if (
                !isValidQueryString(req.query.search) ||
                req.query.search.trim().length > 100
            ) {
                return res.status(400).json({
                    message: "Search must be a non-empty string of at most 100 characters"
                });
            }
        }

        // Search products by name
        if (req.query.search !== undefined) {
            const searchTerm = req.query.search.trim();

            filter.name = {
                $regex: escapeRegex(searchTerm),
                $options: "i"
            };
        }

        // Sorting
        const allowedSorts = {
            price_asc: { price: 1, _id: 1 },
            price_desc: { price: -1, _id: 1 }
        };

        const sortBy = req.query.sort ?? "price_asc";

        if (
            typeof sortBy !== "string" ||
            !Object.hasOwn(allowedSorts, sortBy)
        ) {
            return res.status(400).json({
                message: "Invalid sort option"
            });
        }

        const sortOptions = allowedSorts[sortBy];

        // Pagination
        const pageParam = req.query.page ?? "1";
        const limitParam = req.query.limit ?? "10";

        if (
            !isPositiveInteger(pageParam) ||
            !isPositiveInteger(limitParam) ||
            Number(limitParam) > 50
        ) {
            return res.status(400).json({
                message: "Page must be a positive integer and limit must be between 1 and 50"
            });
        }

        const page = Number(pageParam);
        const limit = Number(limitParam);
        const skip = (page - 1) * limit;

        if (!Number.isSafeInteger(skip)) {
            return res.status(400).json({
                message: "Page number is too large"
            });
        }

        // Category filtering
        if (req.query.category) {
            filter.category = req.query.category;
        }

        // Brand filtering
        if (req.query.brand) {
            filter.brand = req.query.brand;
        }

        // Show unavailable products only to admins
        if (!isAdmin(req)) {
            filter.isAvailable = true;
        }

        // PRICE RANGE FILTERING
        const minPrice = req.query.minPrice;
        const maxPrice = req.query.maxPrice;

        // Validate price values
        if (
            (minPrice !== undefined && !isValidPrice(minPrice)) ||
            (maxPrice !== undefined && !isValidPrice(maxPrice))
        ) {
            return res.status(400).json({
                message: "Price must be a valid non-negative number"
            });
        }

        // Validate minimum and maximum range
        if (
            minPrice !== undefined &&
            maxPrice !== undefined &&
            Number(minPrice) > Number(maxPrice)
        ) {
            return res.status(400).json({
                message: "Minimum price cannot exceed maximum price"
            });
        }

        // Build MongoDB price conditions
        if (minPrice !== undefined || maxPrice !== undefined) {
            filter.price = {};

            if (minPrice !== undefined) {
                filter.price.$gte = Number(minPrice);
            }

            if (maxPrice !== undefined) {
                filter.price.$lte = Number(maxPrice);
            }
        }

        // Fetch products and count matching documents
        const [products, totalProducts] = await Promise.all([
            Product.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(limit),

            Product.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        return res.status(200).json({
            products,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                limit,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        });

    } catch (err) {
        console.error("Error fetching products:", err);

        return res.status(500).json({
            message: "Internal server error. Failed to fetch products."
        });
    }
}

// CREATE PRODUCT
export function saveProduct(req, res) {
    if (!isAdmin(req)) {
        res.json({
            message: "You are not authorized to create a product"
        });
        return;
    }

    const product = new Product(req.body);

    product.save()
        .then(() => {
            res.json({
                message: "Product added successfully"
            });
        })
        .catch(() => {
            res.json({
                message: "failed to add the product"
            });
        });
}

// DELETE PRODUCT
export async function deleteProduct(req, res) {
    if (!isAdmin(req)) {
        res.json({
            message: "you are not authorized to delete product"
        });
        return;
    }

    try {
        await Product.deleteOne({
            productId: req.params.productId
        });

        res.json({
            message: "Product delete succesfully"
        });

    } catch (err) {
        res.status(500).json({
            message: "Failed to delete the product",
            error: err
        });
    }
}

// UPDATE PRODUCT
export async function updateProduct(req, res) {
    if (!isAdmin(req)) {
        res.json({
            message: "You are not authorized to update"
        });
        return;
    }

    const productId = req.params.productId;
    const updateData = req.body;

    try {
        await Product.updateOne(
            { productId: productId },
            updateData
        );

        res.json({
            message: "Product Update Successfully"
        });

    } catch (err) {
        res.status(500).json({
            message: "Internal Server Error",
            err: err
        });
    }
}

// GET PRODUCT BY ID
export async function getProductById(req, res) {
    const productId = req.params.productId;

    try {
        const product = await Product.findOne({
            productId: productId
        });

        if (product == null) {
            res.status(404).json({
                message: "Product Not Found"
            });
            return;
        }

        if (product.isAvailable) {
            res.json(product);
        } else {
            if (!isAdmin(req)) {
                res.status(404).json({
                    message: "Product Not Found"
                });
                return;
            } else {
                res.json(product);
            }
        }

    } catch (err) {
        res.status(500).json({
            message: "Internal Server Error",
            err: err
        });
    }
}

// SEARCH PRODUCTS
export async function searchProduct(req, res) {
    const searchQuery = escapeRegex(req.params.searchQuery);

    try {
        const products = await Product.find({
            $or: [
                {
                    name: {
                        $regex: searchQuery,
                        $options: "i"
                    }
                },
                {
                    altName: {
                        $elemMatch: {
                            $regex: searchQuery,
                            $options: "i"
                        }
                    }
                },
                {
                    description: {
                        $regex: searchQuery,
                        $options: "i"
                    }
                },
                {
                    brand: {
                        $regex: searchQuery,
                        $options: "i"
                    }
                }
            ],
            isAvailable: true
        });

        res.json(products);

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}
