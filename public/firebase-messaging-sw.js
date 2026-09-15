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

    console.log(
        '[Tijva FCM] Background message:',
        payload
    );

    const title =
        payload.notification?.title ||
        'Tijva';

    const options = {

        body:
            payload.notification?.body ||
            'You have a new Tijva notification.',

        icon: '/assets/images/logo.png',

        badge: '/assets/images/logo.png',

        data:
            payload.data || {},

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
            '/admin.html';


        event.waitUntil(

            clients.matchAll({
                type: 'window',
                includeUncontrolled: true
            })

                .then((clientList) => {

                    for (const client of clientList) {

                        if (
                            client.url.includes('/admin') &&
                            'focus' in client
                        ) {

                            return client.focus();
                        }
                    }


                    if (clients.openWindow) {
                        return clients.openWindow(
                            targetUrl
                        );
                    }
                })
        );
    }
);