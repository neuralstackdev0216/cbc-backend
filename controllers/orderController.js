
import mongoose from "mongoose";
import { createHash } from "node:crypto";

import Order from "../models/order.js";
import Product from "../models/product.js";
import Counter from "../models/counter.js";
import User from "../models/user.js";
import { isAdmin } from "./userController.js";

// ======================================
// CHECKOUT RECOVERY HELPER
// ======================================

async function findExistingCheckout(
  email,
  idempotencyKey,
  requestFingerprint
) {
  const existingOrder = await Order.findOne({
    email,
    idempotencyKey
  });

  if (!existingOrder) {
    return null;
  }

  if (
    existingOrder.requestFingerprint !==
    requestFingerprint
  ) {
    return {
      status: 409,
      message:
        "This idempotency key was already used for a different checkout"
    };
  }

  return {
    status: 200,
    message: "Existing order returned successfully",
    order: existingOrder
  };
}

// ======================================
// CREATE ORDER
// ======================================

export async function createOrder(req, res) {
  // 1. Check authentication
  if (!req.user) {
    return res.status(403).json({
      message: "Please login and try again"
    });
  }

  const orderInfo = req.body || {};

  // 2. Validate idempotency key
  const idempotencyKey = req.get("Idempotency-Key");

  if (
    !idempotencyKey ||
    !/^[a-zA-Z0-9_-]{8,128}$/.test(idempotencyKey)
  ) {
    return res.status(400).json({
      message: "A valid Idempotency-Key header is required"
    });
  }

  // 3. Validate customer information
  const name = (
    orderInfo.name ||
    `${req.user.firstName || ""} ${req.user.lastName || ""}`
  ).trim();

  const phone = String(orderInfo.phone || "").trim();
  const address = String(orderInfo.address || "").trim();

  if (!name) {
    return res.status(400).json({
      message: "Customer name is required"
    });
  }

  if (!/^07\d{8}$/.test(phone)) {
    return res.status(400).json({
      message: "Enter a valid Sri Lankan mobile number"
    });
  }

  if (address.length < 10) {
    return res.status(400).json({
      message: "Delivery address must contain at least 10 characters"
    });
  }

  // 4. Validate cart
  if (
    !Array.isArray(orderInfo.products) ||
    orderInfo.products.length === 0
  ) {
    return res.status(400).json({
      message: "Order must contain at least one product"
    });
  }

  // Combine duplicate product entries
  const quantities = new Map();

  for (const product of orderInfo.products) {
    const productId = product?.productId;
    const quantity = Number(product?.qty);

    if (
      typeof productId !== "string" ||
      !productId.trim() ||
      !Number.isSafeInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        message: "Invalid product ID or quantity"
      });
    }

    const previous = quantities.get(productId) || 0;
    const combined = previous + quantity;

    if (!Number.isSafeInteger(combined)) {
      return res.status(400).json({
        message: "Product quantity is too large"
      });
    }

    quantities.set(productId, combined);
  }

  // 5. Create a consistent request fingerprint
  const normalizedProducts = [...quantities.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({
      productId,
      quantity
    }));

  const requestFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        email: req.user.email,
        name,
        phone,
        address,
        products: normalizedProducts
      })
    )
    .digest("hex");

  let session;

  try {
    session = await mongoose.startSession();

    let createdOrder;
    let wasExistingOrder = false;

    // 6. Start MongoDB transaction
    await session.withTransaction(async () => {
      const dbUser = await User.findOne({
        email: req.user.email
      }).session(session);

      if (!dbUser || dbUser.isBlocked) {
        const error = new Error(
          "Your account is blocked or unavailable"
        );
        error.statusCode = 403;
        throw error;
      }

      // 7. Check for an existing checkout
      const existingOrder = await Order.findOne({
        email: req.user.email,
        idempotencyKey
      }).session(session);

      if (existingOrder) {
        if (
          existingOrder.requestFingerprint !==
          requestFingerprint
        ) {
          const error = new Error(
            "This idempotency key was already used for a different checkout"
          );
          error.statusCode = 409;
          throw error;
        }

        createdOrder = existingOrder;
        wasExistingOrder = true;
        return;
      }

      let total = 0;
      let labeledTotal = 0;
      const products = [];

      // 8. Validate products and deduct stock
      for (const [productId, quantity] of quantities) {
        const item = await Product.findOne({
          productId
        }).session(session);

        if (!item) {
          const error = new Error(
            `Product ${productId} not found`
          );
          error.statusCode = 404;
          throw error;
        }

        if (!item.isAvailable) {
          const error = new Error(
            `${item.name} is not available`
          );
          error.statusCode = 400;
          throw error;
        }

        if (
          !Number.isSafeInteger(item.stock) ||
          item.stock < quantity
        ) {
          const error = new Error(
            `${item.name} has insufficient stock`
          );
          error.statusCode = 400;
          throw error;
        }

        const result = await Product.updateOne(
          {
            productId,
            isAvailable: true,
            stock: { $gte: quantity }
          },
          {
            $inc: { stock: -quantity }
          },
          { session }
        );

        if (result.matchedCount !== 1) {
          const error = new Error(
            `${item.name} is no longer available in the requested quantity`
          );
          error.statusCode = 409;
          throw error;
        }

        products.push({
          productInfo: {
            productId: item.productId,
            name: item.name,
            altName: item.altName,
            description: item.description,
            images: item.images,
            labeledPrice: item.labeledPrice,
            price: item.price
          },
          quantity
        });

        total += item.price * quantity;
        labeledTotal += item.labeledPrice * quantity;
      }

      // 9. Generate unique order ID
      const counter = await Counter.findOneAndUpdate(
        { _id: "orderId" },
        { $inc: { sequence: 1 } },
        {
          new: true,
          session
        }
      );

      if (!counter) {
        const error = new Error(
          "Order counter is not initialized"
        );
        error.statusCode = 500;
        throw error;
      }

      const orderId =
        "CBC" + String(counter.sequence).padStart(5, "0");

      // 10. Save order and idempotency details
      const order = new Order({
        orderId,
        idempotencyKey,
        requestFingerprint,
        email: req.user.email,
        name,
        phone,
        address,
        products,
        total,
        labeledTotal,
        status: "Pending",
        paymentMethod: "Cash on Delivery"
      });

      await order.save({ session });

      createdOrder = order;
      wasExistingOrder = false;
    });

    // 11. Respond after transaction commits
    return res.status(wasExistingOrder ? 200 : 201).json({
      message: wasExistingOrder
        ? "Existing order returned successfully"
        : "Order Created Successfully",
      order: createdOrder
    });

  } catch (error) {
    console.error("Order creation failed:", error);

    // 12. Recover from competing checkout requests
    if (
      error.code === 11000 ||
      error.hasErrorLabel?.("TransientTransactionError")
    ) {
      try {
        const recovered = await findExistingCheckout(
          req.user.email,
          idempotencyKey,
          requestFingerprint
        );

        if (recovered) {
          return res.status(recovered.status).json({
            message: recovered.message,
            ...(recovered.order
              ? { order: recovered.order }
              : {})
          });
        }
      } catch (lookupError) {
        console.error(
          "Checkout recovery lookup failed:",
          lookupError
        );
      }
    }

    // 13. Handle transaction conflicts
    if (error.hasErrorLabel?.("TransientTransactionError")) {
      return res.status(409).json({
        message:
          "Another order is being processed. Please retry using the same idempotency key."
      });
    }

    // 14. Handle other duplicate-key conflicts
    if (error.code === 11000) {
      return res.status(409).json({
        message:
          "Checkout conflict. Please retry using the same idempotency key."
      });
    }

    // 15. Handle validation and server errors
    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to create order"
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
}

// ======================================
// GET ORDERS
// ======================================

export async function getOrders(req, res) {
  if (!req.user) {
    return res.status(403).json({
      message: "Please Login and try again"
    });
  }

  try {
    let orders;

    if (
      req.user.role === "admin" &&
      req.query.mine !== "true"
    ) {
      orders = await Order.find();
    } else {
      orders = await Order.find({
        email: req.user.email
      });
    }

    return res.status(200).json({
      orders
    });

  } catch (error) {
    console.error("Failed to fetch orders:", error);

    return res.status(500).json({
      message: "Failed to fetch orders"
    });
  }
}

// ======================================
// UPDATE ORDER STATUS
// ======================================

export async function updateOrderStatus(req, res) {
  if (!isAdmin(req)) {
    return res.status(403).json({
      message: "You are not authorized to update order status"
    });
  }

  const orderId = req.params.orderId;
  const newStatus = req.params.status;

  const allowedStatuses = [
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Cancelled"
  ];

  if (!allowedStatuses.includes(newStatus)) {
    return res.status(400).json({
      message: "Invalid order status"
    });
  }

  let session;

  try {
    session = await mongoose.startSession();

    let updatedOrder;

    await session.withTransaction(async () => {
      const order = await Order.findOne({
        orderId
      }).session(session);

      if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
      }

      if (order.status === newStatus) {
        updatedOrder = order;
        return;
      }

      if (order.status === "Cancelled") {
        const error = new Error(
          "A cancelled order cannot be reopened"
        );
        error.statusCode = 400;
        throw error;
      }

      // Restore stock when cancelling
      if (newStatus === "Cancelled") {
        for (const item of order.products) {
          const productId = item.productInfo.productId;
          const quantity = item.quantity;

          const result = await Product.updateOne(
            { productId },
            {
              $inc: { stock: quantity }
            },
            { session }
          );

          if (result.matchedCount !== 1) {
            const error = new Error(
              `Product ${productId} not found`
            );
            error.statusCode = 404;
            throw error;
          }
        }
      }

      order.status = newStatus;
      updatedOrder = await order.save({ session });
    });

    return res.status(200).json({
      message: "Order status updated successfully",
      order: updatedOrder
    });

  } catch (error) {
    console.error("Order status update failed:", error);

    if (error.hasErrorLabel?.("TransientTransactionError")) {
      return res.status(409).json({
        message:
          "Order was updated concurrently. Please refresh and try again."
      });
    }

    return res.status(error.statusCode || 500).json({
      message: error.statusCode
        ? error.message
        : "Failed to update order status"
    });

  } finally {
    if (session) {
      await session.endSession();
    }
  }
}
