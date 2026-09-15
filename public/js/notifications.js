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

/**
 * Initialize Tijva admin notifications
 */
export async function setupAdminNotifications() {
    try {
        // Browser support check
        if (!('Notification' in window)) {
            console.warn('[Tijva Notifications] Notifications are not supported.');
            return;
        }

        if (!('serviceWorker' in navigator)) {
            console.warn('[Tijva Notifications] Service workers are not supported.');
            return;
        }

        const user = auth.currentUser;

        if (!user) {
            console.warn('[Tijva Notifications] No authenticated user.');
            return;
        }

        // Ask for notification permission
        let permission = Notification.permission;

        if (permission === 'default') {
            permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') {
            console.warn(
                '[Tijva Notifications] Notification permission was not granted.'
            );
            return;
        }

        // Register Firebase Messaging service worker
        const registration = await navigator.serviceWorker.register(
            '/firebase-messaging-sw.js'
        );

        console.log(
            '[Tijva Notifications] Service worker registered:',
            registration
        );

        // Initialize Firebase Messaging
        messaging = getMessaging(getApp());

        // Get FCM registration token
        const token = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: registration
        });

        if (!token) {
            console.warn('[Tijva Notifications] No FCM token received.');
            return;
        }

        console.log('[Tijva Notifications] FCM token received.');

        // Save token under this admin's user document
        await setDoc(
            doc(db, 'users', user.uid, 'notificationTokens', token),
            {
                token: token,
                platform: 'web',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            },
            { merge: true }
        );

        console.log(
            '[Tijva Notifications] Admin notification token saved.'
        );

        // Handle notifications while admin dashboard is open
        onMessage(messaging, (payload) => {
            console.log(
                '[Tijva Notifications] Foreground message:',
                payload
            );

            const title =
                payload.notification?.title ||
                'Tijva';

            const body =
                payload.notification?.body ||
                'You have a new notification.';

            showForegroundNotification(title, body, payload.data);
        });

    } catch (error) {
        console.error(
            '[Tijva Notifications] Setup failed:',
            error
        );
    }
}


/**
 * Show notification while admin dashboard is open
 */
function showForegroundNotification(title, body, data = {}) {

    // Browser notification
    if (Notification.permission === 'granted') {

        const notification = new Notification(title, {
            body: body,
            icon: '/assets/images/logo.png',
            tag: 'tijva-admin'
        });

        notification.onclick = () => {
            window.focus();

            if (data?.url) {
                window.location.href = data.url;
            }

            notification.close();
        };
    }

    // Also use existing Tijva notification system if available
    if (typeof window.showNotification === 'function') {
        window.showNotification(body, 'info');
    }
}