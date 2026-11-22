
const API_URL = "http://localhost:5000/api/orders";

// Use a fresh token from your test account.
// Do not commit this token to GitHub.
const TOKEN = process.env.TEST_JWT;

if (!TOKEN) {
  throw new Error("Set TEST_JWT before running this test.");
}

const productId = "ABC";

const orderBody = {
  products: [
    {
      productId,
      qty: 1
    }
  ],
  phone: "0712345678",
  address: "Test Delivery Address, Sri Lanka"
};

async function sendOrder(number) {
  const key = `concurrent_${crypto.randomUUID()}`;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
        "Idempotency-Key": key
      },
      body: JSON.stringify(orderBody)
    });

    const data = await response.json();

    return {
      request: number,
      status: response.status,
      message: data.message,
      orderId: data.order?.orderId || null
    };
  } catch (error) {
    return {
      request: number,
      error: error.message
    };
  }
}

const results = await Promise.all([
  sendOrder(1),
  sendOrder(2)
]);

console.table(results);
