importScripts(
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js'
);

importScripts(
    'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js'
);


// ============================================================
// FIREBASE CONFIG
// ============================================================

firebase.initializeApp({
    apiKey: "AIzaSyAtpp18r9WTbKsOUz2su6BB3pY-4ZQS-ss",
    authDomain: "the-dukanza.firebaseapp.com",
    projectId: "the-dukanza",
    storageBucket: "the-dukanza.firebasestorage.app",
    messagingSenderId: "567422688243",
    appId: "1:567422688243:web:47dc6a4e67311c02f2d086"
});


// ============================================================
// FIREBASE CLOUD MESSAGING
// ============================================================

const messaging = firebase.messaging();


// ============================================================
// BACKGROUND NOTIFICATIONS
// ============================================================

messaging.onBackgroundMessage((payload) => {
    console.log('[Tijva FCM] Background message:', payload);

    const title =
        payload.data?.title ||
        'Tijva';

    const body =
        payload.data?.body ||
        'You have a new Tijva notification.';

    const options = {
        body: body,

        icon: '/assets/images/logo.png',
        badge: '/assets/images/logo.png',

        data: {
            ...(payload.data || {}),
            url: payload.data?.url || 'https://tijva.com/admin'
        },

        tag: 'tijva-notification',
        renotify: true
    };

    self.registration.showNotification(
        title,
        options
    );
});


// ============================================================
// NOTIFICATION CLICK
// ============================================================

self.addEventListener(
    'notificationclick',
    (event) => {

        event.notification.close();

        const targetUrl =
            event.notification?.data?.url ||
            'https://tijva.com/admin';


        event.waitUntil(

            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })

                .then((clientList) => {

                    // Look for an already-open Tijva admin page
                    for (const client of clientList) {

                        if (
                            client.url.startsWith(
                                'https://tijva.com/admin'
                            ) &&
                            'focus' in client
                        ) {
                            return client.focus();
                        }
                    }


                    // Otherwise open Tijva admin
                    if (clients.openWindow) {
                        return clients.openWindow(
                            targetUrl
                        );
                    }
                })
        );
    }
);