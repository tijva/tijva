import { auth, db } from './firebase-config.js';

import {
    getMessaging,
    getToken,
    onMessage
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import { getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";


const VAPID_KEY =
    "BFwt-PYHnJjNjBSQoxo8if0HktntI14vSOH2RnCnolNPUDZA5tSsINn1LPSdtW1lyozlLExhzOhLhGJh_I7fYM4";


let messaging = null;


// ============================================================
// INITIALIZE TIJVA ADMIN NOTIFICATIONS
// ============================================================

export async function setupAdminNotifications() {

    try {

        // --------------------------------------------------------
        // Browser support
        // --------------------------------------------------------

        if (!('Notification' in window)) {

            console.warn(
                '[Tijva Notifications] Notifications are not supported.'
            );

            return;
        }


        if (!('serviceWorker' in navigator)) {

            console.warn(
                '[Tijva Notifications] Service workers are not supported.'
            );

            return;
        }


        // --------------------------------------------------------
        // Authentication
        // --------------------------------------------------------

        const user = auth.currentUser;

        if (!user) {

            console.warn(
                '[Tijva Notifications] No authenticated user.'
            );

            return;
        }


        // --------------------------------------------------------
        // Notification permission
        // --------------------------------------------------------

        let permission = Notification.permission;

        if (permission === 'default') {

            permission =
                await Notification.requestPermission();
        }


        if (permission !== 'granted') {

            console.warn(
                '[Tijva Notifications] Notification permission was not granted.'
            );

            return;
        }


        // --------------------------------------------------------
        // Register Firebase Messaging service worker
        // --------------------------------------------------------

        const registration =
            await navigator.serviceWorker.register(
                '/firebase-messaging-sw.js'
            );

        console.log(
            '[Tijva Notifications] Service worker registered:',
            registration
        );


        // --------------------------------------------------------
        // Initialize Firebase Messaging
        // --------------------------------------------------------

        messaging = getMessaging(getApp());


        // --------------------------------------------------------
        // Get FCM registration token
        // --------------------------------------------------------

        const token = await getToken(
            messaging,
            {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            }
        );


        if (!token) {

            console.warn(
                '[Tijva Notifications] No FCM token received.'
            );

            return;
        }


        console.log(
            '[Tijva Notifications] FCM token received.'
        );


        // --------------------------------------------------------
        // Save token to Firestore
        // --------------------------------------------------------

        await setDoc(

            doc(
                db,
                'users',
                user.uid,
                'notificationTokens',
                token
            ),

            {
                token: token,

                platform: 'web',

                createdAt:
                    serverTimestamp(),

                updatedAt:
                    serverTimestamp()
            },

            {
                merge: true
            }
        );


        console.log(
            '[Tijva Notifications] Admin notification token saved.'
        );


        // --------------------------------------------------------
        // FOREGROUND MESSAGES
        // --------------------------------------------------------

        onMessage(
            messaging,
            (payload) => {

                console.log(
                    '[Tijva Notifications] Foreground message:',
                    payload
                );


                // IMPORTANT:
                // Cloud Function sends a DATA-ONLY message,
                // therefore title/body are inside payload.data

                const title =
                    payload.data?.title ||
                    'Tijva';


                const body =
                    payload.data?.body ||
                    'You have a new notification.';


                showForegroundNotification(
                    title,
                    body,
                    payload.data || {}
                );
            }
        );


    } catch (error) {

        console.error(
            '[Tijva Notifications] Setup failed:',
            error
        );
    }
}


// ============================================================
// SHOW FOREGROUND NOTIFICATION
// ============================================================

function showForegroundNotification(
    title,
    body,
    data = {}
) {

    // --------------------------------------------------------
    // Browser notification
    // --------------------------------------------------------

    if (
        'Notification' in window &&
        Notification.permission === 'granted'
    ) {

        const notification =
            new Notification(
                title,
                {
                    body: body,

                    icon:
                        '/assets/images/logo.png',

                    tag:
                        'tijva-admin',

                    data: {
                        ...data,

                        url:
                            data?.url ||
                            'https://tijva.com/admin'
                    }
                }
            );


        notification.onclick = () => {

            window.focus();


            const targetUrl =
                data?.url ||
                'https://tijva.com/admin';


            window.location.href =
                targetUrl;


            notification.close();
        };
    }


    // --------------------------------------------------------
    // Existing Tijva notification system
    // --------------------------------------------------------

    if (
        typeof window.showNotification ===
        'function'
    ) {

        window.showNotification(
            body,
            'info'
        );
    }
}