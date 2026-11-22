
import mongoose from "mongoose";

const orderSchema = mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },

  idempotencyKey: {
    type: String,
    default: undefined
  },

  requestFingerprint: {
    type: String,
    default: undefined
  },

  email: {
    type: String,
    required: true
  },

  name: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  status: {
    type: String,
    required: true,
    default: "Pending"
  },

  labeledTotal: {
    type: Number,
    required: true
  },

  total: {
    type: Number,
    required: true
  },

  products: [
    {
      productInfo: {
        productId: {
          type: String,
          required: true
        },
        name: {
          type: String,
          required: true
        },
        altName: [{
          type: String
        }],
        description: {
          type: String,
          required: true
        },
        images: [{
          type: String
        }],
        labeledPrice: {
          type: Number,
          required: true
        },
        price: {
          type: Number,
          required: true
        }
      },

      quantity: {
        type: Number,
        required: true
      }
    }
  ],

  date: {
    type: Date,
    default: Date.now
  },

  paymentMethod: {
    type: String,
    default: "Cash on Delivery"
  },

  rejectionReson: {
    type: String,
    default: ""
  }
});

// Unique idempotency key for each customer
orderSchema.index(
  {
    email: 1,
    idempotencyKey: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      idempotencyKey: {
        $type: "string"
      }
    }
  }
);

const Order = mongoose.model("orders", orderSchema);

export default Order;
