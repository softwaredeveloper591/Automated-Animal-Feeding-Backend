// push-notification-controller.js
const admin = require("firebase-admin");
const serviceAccount = require("./config/push-notification-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

exports.sendPushNotification = async (req, res, next) => {
  const { fcm_token, title, body, data } = req.body;

  if (!fcm_token) {
    return res.status(400).json({ message: "fcm_token zorunlu." });
  }

  const message = {
    token: fcm_token,
    notification: {
      title: title || "Test Bildirim",
      body: body || "Bildirim içeriği",
    },
    data: data || { orderId: "123", orderDate: "2025-05-06" },
    // Optional: For Android priority
    android: {
      priority: "high"
    },
    // Optional: For iOS
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1
        }
      }
    }
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Bildirim gönderildi:", response);
    res.status(200).json({ message: "Bildirim gönderildi", id: response });
  } catch (err) {
    console.error("Bildirim gönderme hatası:", err);
    res.status(500).json({ message: "Gönderme hatası", error: err.message });
  }
};
