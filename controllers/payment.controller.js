import Product from '../models/product.model.js';
import Coupon from '../models/coupon.model.js';
import Order from '../models/order.model.js';
import { stripe } from '../lib/stripe.js';
import dotenv from 'dotenv';

dotenv.config();

export const createCheckoutSession = async (req, res) => {
    try {
        const { products, couponCode } = req.body;
        if (!Array.isArray(products) || products.length === 0) {
            return res.status(400).json({ message: 'Invalid or empty products array' });
        }

        let totalAmount = 0;
        const lineItems = products.map(product => {
            const amount = Math.round(product.price * 100); // Stripe wants the amount in cents
            totalAmount += amount * product.quantity;
            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.name,
                        images: [product.image],
                    },
                    unit_amount: amount,
                },
                quantity: product.quantity || 1,
            };
        });

        let coupon = null;
        if (couponCode) {
            coupon = await Coupon.findOne({ code: couponCode, userId: req.user._id, isActive: true });
            if (coupon) {
                totalAmount -= Math.round(totalAmount * coupon.percentage / 100);
            }
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${process.env.CLIENT_URL}/purchase-success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.CLIENT_URL}/purchase-cancel`,
            discounts: coupon ? [{ coupon: await createStripeCoupon(coupon.discountPercentage) }] : [],
            metadata: {
                user_id: req.user._id.toString(),
                couponCode: couponCode || "",
                product_ids: JSON.stringify(products.map(product => product._id)), // Store product IDs
            },
        });

        if (totalAmount >= 20000) {
            await createNewCoupon(req.user._id);
        }
        console.log("session is here", session);
        res.json({ id: session.id, totalAmount: totalAmount / 100 });
    } catch (error) {
        console.log("Error in checkout controller", error);
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

export const checkoutSuccess = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === "paid") {
            if (session.metadata.couponCode) {
                await Coupon.findOneAndUpdate(
                    {
                        code: session.metadata.couponCode,
                        userId: session.metadata.user_id,
                    },
                    {
                        isActive: false,
                    }
                );
            }

            // Retrieve and parse product_ids from session metadata
            const productIds = JSON.parse(session.metadata.product_ids);

            // Fetch the products from the database
            const products = await Product.find({ _id: { $in: productIds } });

            // Create a new order with full product details
            const newOrder = new Order({
                user: session.metadata.user_id,
                products: products.map((product) => ({
                    product: product._id,
                    quantity: 1,  // Ensure quantity is retrieved correctly or passed
                    price: product.price,
                })),
                totalAmount: session.amount_total / 100, // Convert from cents to dollars
                stripeSessionId: sessionId,
            });

            await newOrder.save();

            res.status(200).json({
                success: true,
                message: "Payment successful, order created, and coupon deactivated if used.",
                orderId: newOrder._id,
            });
        }
    } catch (error) {
        console.error("Error processing successful checkout:", error);
        res.status(500).json({ message: "Error processing successful checkout", error: error.message });
    }
};

async function createStripeCoupon(discountPercentage) {
    const coupon = await stripe.coupons.create({
        percent_off: discountPercentage,
        duration: 'once',
    });
    return coupon.id;
}

async function createNewCoupon(userId) {
    // Find a coupon for this user that is either valid or expired
    const existingCoupon = await Coupon.findOne({ userId });

    if (existingCoupon && existingCoupon.expirationDate > new Date()) {
        // If the coupon exists and is not expired, return it
        return existingCoupon;
    }

    if (existingCoupon) {
        // If the coupon exists but is expired, update it
        existingCoupon.code = "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase();
        existingCoupon.expirationDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await existingCoupon.save();
        return existingCoupon;
    }

    // Create a new coupon if none exist
    const newCoupon = new Coupon({
        code: "GIFT" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        discountPercentage: 10,
        expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days expiration
        userId: userId,
    });

    await newCoupon.save();
    return newCoupon;
}
