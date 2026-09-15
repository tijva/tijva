const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

setGlobalOptions({
    maxInstances: 10
});

exports.notifyAdminNewOrder = onDocumentCreated(
    "orders/{orderId}",
    async (event) => {
        const orderId = event.params.orderId;
        const order = event.data?.data();

        if (!order) {
            logger.warn("New order event had no data.", { orderId });
            return;
        }

        logger.info("New Tijva order detected.", { orderId });

        // Find all admin users
        const adminsSnapshot = await db
            .collection("users")
            .where("role", "==", "admin")
            .get();

        const tokens = [];

        // Get notification tokens for every admin
        for (const adminDoc of adminsSnapshot.docs) {
            const tokensSnapshot = await adminDoc.ref
                .collection("notificationTokens")
                .get();

            for (const tokenDoc of tokensSnapshot.docs) {
                const tokenData = tokenDoc.data();

                if (tokenData.token) {
                    tokens.push(tokenData.token);
                }
            }
        }

        // Remove duplicate tokens
        const uniqueTokens = [...new Set(tokens)];

        if (uniqueTokens.length === 0) {
            logger.warn("No admin FCM tokens found.", { orderId });
            return;
        }

        const customerName =
            order.customer?.name || "A customer";

        const total =
            order.financials?.total ?? 0;

        const message = {
            notification: {
                title: "🛍️ New Tijva Order!",
                body: `${customerName} placed an order for Rs. ${total}.`
            },

            data: {
                orderId: String(orderId),
                url: "/admin.html"
            },

            tokens: uniqueTokens
        };

        const response =
            await messaging.sendEachForMulticast(message);

        logger.info("Tijva order notifications sent.", {
            orderId,
            successCount: response.successCount,
            failureCount: response.failureCount
        });
    }
);