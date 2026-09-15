import { auth, db } from './firebase-config.js';

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    doc,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";


// ============================================================
// DOM ELEMENTS
// ============================================================

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const profileBox = document.getElementById('profileBox');
const googleBtn = document.getElementById('googleBtn');
const loadingScreen = document.getElementById('authLoading');

const googleProvider = new GoogleAuthProvider();


// ============================================================
// AUTH STATE
// ============================================================

/*
 * This flag prevents onAuthStateChanged from redirecting
 * while login/register/Google authentication is still
 * doing its Firestore work.
 */
let isAuthenticating = false;


// ============================================================
// PAGE / URL HELPERS
// ============================================================

/*
 * IMPORTANT:
 *
 * Tijva can have both:
 *
 *   /profile
 *   /profile.html
 *
 * With Firebase Hosting + cleanUrls:
 *   /profile
 *
 * may serve:
 *   profile.html
 *
 * But during local development:
 *   /profile
 *
 * usually does NOT work.
 *
 * Therefore:
 * - We DETECT both.
 * - But redirects ALWAYS use profile.html.
 */

function isProfilePage() {
    const path = window.location.pathname
        .replace(/\/+$/, '')
        .toLowerCase();

    return (
        path === '/profile' ||
        path === '/profile.html' ||
        path.endsWith('/profile') ||
        path.endsWith('/profile.html')
    );
}


function goToProfile() {
    /*
     * Relative path intentionally used here.
     *
     * This works locally:
     *   /profile.html
     *
     * And when deployed with Firebase cleanUrls:
     *   /profile.html
     *
     * can still be resolved by Firebase.
     */
    window.location.replace('profile.html');
}


// ============================================================
// UI VALIDATION HELPERS
// ============================================================

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}


function showError(input, message) {
    if (!input) return;

    const parent = input.parentElement;

    let error = parent.querySelector(".form-error");

    if (!error) {
        error = document.createElement("div");

        error.className = "form-error";

        error.style.color = "#ff5a36";
        error.style.fontSize = "12px";
        error.style.marginTop = "5px";

        parent.appendChild(error);
    }

    error.innerText = message;
    error.style.display = "block";

    input.style.borderColor = "#ff5a36";
}


function clearError(input) {
    if (!input) return;

    const parent = input.parentElement;

    const error =
        parent.querySelector(".form-error");

    if (error) {
        error.style.display = "none";
    }

    input.style.borderColor = "";
}


// ============================================================
// UI HELPERS
// ============================================================

function hideForms() {
    if (loginForm) {
        loginForm.style.display = 'none';
    }

    if (registerForm) {
        registerForm.style.display = 'none';
    }

    if (googleBtn) {
        googleBtn.style.display = 'none';
    }

    if (loadingScreen) {
        loadingScreen.style.display = 'block';
    }
}


function showNotification(msg, type = "success") {
    if (window.showNotification) {
        window.showNotification(msg, type);
    } else {
        console.log(
            `${ type.toUpperCase() }: ${ msg } `
        );
    }
}


// ============================================================
// AUTH STATE WATCHER
// ============================================================

onAuthStateChanged(auth, async (user) => {

    // ========================================================
    // USER IS LOGGED IN
    // ========================================================

    if (user) {

        /*
         * Login/register/Google functions are handling
         * their own redirect.
         *
         * Do nothing here until they finish.
         */
        if (isAuthenticating) {
            return;
        }


        /*
         * If the authenticated user is somewhere else
         * (for example login.html), send them to profile.html.
         *
         * BUT:
         *
         * /profile
         * /profile.html
         *
         * are both considered valid profile pages.
         */
        if (!isProfilePage()) {
            goToProfile();
            return;
        }


        /*
         * We are already on a profile page.
         *
         * DO NOT REDIRECT.
         *
         * This is what prevents the cleanUrls reload loop.
         */
        try {

            const userSnap = await getDoc(
                doc(
                    db,
                    "users",
                    user.uid
                )
            );


            if (userSnap.exists()) {

                const userData =
                    userSnap.data();


                showProfile(userData);


                renderCartPreview(
                    userData.cart || []
                );

            } else {

                console.error(
                    "Authenticated user has no Firestore profile."
                );
            }

        } catch (err) {

            console.error(
                "Failed to load user profile:",
                err
            );
        }


        return;
    }


    // ========================================================
    // USER IS NOT LOGGED IN
    // ========================================================

    if (profileBox) {
        profileBox.style.display = 'none';
    }

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    if (loginForm) {
        loginForm.style.display = 'block';
    }

    if (registerForm) {
        registerForm.style.display = 'none';
    }

    if (googleBtn) {
        googleBtn.style.display = 'block';
    }
});


// ============================================================
// GOOGLE SIGN IN
// ============================================================

window.signInWithGoogle = async () => {

    try {

        /*
         * Block the auth observer while we:
         *
         * 1. Sign in
         * 2. Check Firestore
         * 3. Create profile if necessary
         * 4. Redirect
         */
        isAuthenticating = true;

        hideForms();


        const result =
            await signInWithPopup(
                auth,
                googleProvider
            );


        const user = result.user;


        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        const userSnap =
            await getDoc(userRef);


        // ====================================================
        // FIRST-TIME GOOGLE USER
        // ====================================================

        if (!userSnap.exists()) {

            await setDoc(
                userRef,
                {
                    uid: user.uid,

                    name:
                        user.displayName ||
                        "Tijva User",

                    email: user.email,

                    role: "customer",

                    cart: [],
                    wishlist: [],
                    recentlyViewed: [],
                    addresses: [],
                    orderIds: [],

                    createdAt:
                        new Date().toISOString()
                }
            );


            if (typeof gtag === "function") {

                gtag(
                    "event",
                    "sign_up",
                    {
                        method: "Google"
                    }
                );
            }


            showNotification(
                `Welcome to Tijva, ${
    user.displayName ||
        "User"
} !`
            );

        }

        // ====================================================
        // EXISTING GOOGLE USER
        // ====================================================

        else {

            if (typeof gtag === "function") {

                gtag(
                    "event",
                    "login",
                    {
                        method: "Google"
                    }
                );
            }


            showNotification(
                `Welcome back, ${
    user.displayName ||
        "User"
} !`
            );
        }


        /*
         * Everything is finished.
         *
         * Always redirect to profile.html.
         *
         * DO NOT change this to /profile.
         */
        setTimeout(() => {
            goToProfile();
        }, 1000);


    } catch (err) {

        isAuthenticating = false;


        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }

        if (loginForm) {
            loginForm.style.display = 'block';
        }

        if (googleBtn) {
            googleBtn.style.display = 'block';
        }


        console.error(
            "Google Auth Error:",
            err
        );


        showNotification(
            "Google Auth Failed",
            "error"
        );
    }
};


// ============================================================
// REGISTER LOGIC
// ============================================================

if (registerForm) {

    registerForm.addEventListener(
        'submit',
        async (e) => {

            e.preventDefault();


            const nameInput =
                document.getElementById(
                    'regName'
                );

            const emailInput =
                document.getElementById(
                    'regEmail'
                );

            const passInput =
                document.getElementById(
                    'regPass'
                );

            const confirmInput =
                document.getElementById(
                    'regConfirmPass'
                );

            const termsInput =
                registerForm.querySelector(
                    "input[type='checkbox']"
                );


            // =================================================
            // VALIDATION
            // =================================================

            let valid = true;


            [
                nameInput,
                emailInput,
                passInput,
                confirmInput
            ].forEach(clearError);


            if (
                !nameInput ||
                nameInput.value.trim().length < 3
            ) {

                showError(
                    nameInput,
                    "Name too short"
                );

                valid = false;
            }


            if (
                !emailInput ||
                !validateEmail(
                    emailInput.value.trim()
                )
            ) {

                showError(
                    emailInput,
                    "Invalid email"
                );

                valid = false;
            }


            if (
                !passInput ||
                passInput.value.length < 6
            ) {

                showError(
                    passInput,
                    "Password must be 6+ characters"
                );

                valid = false;
            }


            if (
                !confirmInput ||
                passInput.value !==
                    confirmInput.value
            ) {

                showError(
                    confirmInput,
                    "Passwords do not match"
                );

                valid = false;
            }


            if (
                termsInput &&
                !termsInput.checked
            ) {

                showNotification(
                    "Please accept the Terms",
                    "error"
                );

                valid = false;
            }


            if (!valid) {
                return;
            }


            // =================================================
            // CREATE ACCOUNT
            // =================================================

            try {

                isAuthenticating = true;

                hideForms();


                const cred =
                    await createUserWithEmailAndPassword(
                        auth,
                        emailInput.value.trim(),
                        passInput.value
                    );


                const newUserProfile = {

                    uid: cred.user.uid,

                    name:
                        nameInput.value.trim(),

                    email:
                        emailInput.value.trim(),

                    role: "customer",

                    cart: [],
                    wishlist: [],
                    recentlyViewed: [],
                    addresses: [],
                    orderIds: [],

                    createdAt:
                        new Date().toISOString()
                };


                const userDocRef =
                    doc(
                        db,
                        "users",
                        cred.user.uid
                    );


                /*
                 * Make absolutely sure the Firestore
                 * profile exists before redirecting.
                 */
                await setDoc(
                    userDocRef,
                    newUserProfile
                );


                if (typeof gtag === "function") {

                    gtag(
                        "event",
                        "sign_up",
                        {
                            method: "Email"
                        }
                    );
                }


                showNotification(
                    "Account and Profile created successfully!"
                );


                /*
                 * Always redirect to profile.html.
                 */
                setTimeout(() => {
                    goToProfile();
                }, 1000);


            } catch (err) {

                isAuthenticating = false;


                if (registerForm) {
                    registerForm.style.display =
                        'block';
                }

                if (googleBtn) {
                    googleBtn.style.display =
                        'block';
                }

                if (loginForm) {
                    loginForm.style.display =
                        'none';
                }

                if (loadingScreen) {
                    loadingScreen.style.display =
                        'none';
                }


                console.error(
                    "Tijva Registration Error:",
                    err
                );


                showNotification(
                    err.message,
                    "error"
                );
            }
        }
    );
}


// ============================================================
// LOGIN LOGIC
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        'submit',
        async (e) => {

            e.preventDefault();


            const emailInput =
                document.getElementById(
                    'loginEmail'
                );

            const passInput =
                document.getElementById(
                    'loginPass'
                );


            if (
                !emailInput.value ||
                !passInput.value
            ) {

                showNotification(
                    "Please fill in all fields",
                    "error"
                );

                return;
            }


            try {

                isAuthenticating = true;

                hideForms();


                await signInWithEmailAndPassword(
                    auth,
                    emailInput.value.trim(),
                    passInput.value
                );


                if (typeof gtag === "function") {

                    gtag(
                        "event",
                        "login",
                        {
                            method: "Email"
                        }
                    );
                }


                /*
                 * Always use profile.html.
                 *
                 * This works for local testing.
                 */
                goToProfile();


            } catch (err) {

                isAuthenticating = false;


                if (registerForm) {
                    registerForm.style.display =
                        'none';
                }

                if (googleBtn) {
                    googleBtn.style.display =
                        'block';
                }

                if (loginForm) {
                    loginForm.style.display =
                        'block';
                }

                if (loadingScreen) {
                    loadingScreen.style.display =
                        'none';
                }


                console.error(
                    "Login Error:",
                    err.code,
                    err.message
                );


                showNotification(
                    "Login Error: " +
                    err.message,
                    "error"
                );
            }
        }
    );
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

window.forgotPassword = async () => {

    const emailInput =
        document.getElementById(
            'loginEmail'
        );


    const email =
        emailInput
            ? emailInput.value.trim()
            : "";


    if (!email) {

        showNotification(
            "Enter your email first",
            "warning"
        );

        return;
    }


    try {

        await sendPasswordResetEmail(
            auth,
            email
        );


        showNotification(
            "Reset link sent to your inbox!"
        );

    } catch (err) {

        showNotification(
            err.message,
            "error"
        );
    }
};


// ============================================================
// LOGOUT
// ============================================================

window.logout = async () => {

    const confirmLogout =
        await customConfirm(
            "Log Out?",
            "Are you sure you want to log out?"
        );


    if (!confirmLogout) {
        return;
    }


    if (typeof gtag === "function") {
        gtag("event", "logout");
    }


    try {

        await signOut(auth);

        /*
         * Reload whichever profile URL the user is on.
         *
         * /profile      → reloads /profile
         * /profile.html → reloads /profile.html
         *
         * No redirect is necessary.
         */
        window.location.reload();

    } catch (err) {

        console.error(
            "Logout Error:",
            err
        );


        showNotification(
            "Logout failed",
            "error"
        );
    }
};


// ============================================================
// PROFILE UI
// ============================================================

function showProfile(userData) {

    if (loginForm) {
        loginForm.style.display = 'none';
    }

    if (registerForm) {
        registerForm.style.display = 'none';
    }

    if (googleBtn) {
        googleBtn.style.display = 'none';
    }

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }


    if (profileBox) {

        profileBox.style.display = 'block';


        const welcome =
            document.getElementById(
                'welcomeUser'
            );


        const emailDisplay =
            document.getElementById(
                'userEmailDisplay'
            );


        if (welcome) {

            welcome.innerText =
                `Welcome, ${ userData.name } !`;
        }


        if (emailDisplay) {

            emailDisplay.innerText =
                userData.email;
        }


        if (userData.role === 'admin') {
            renderAdminUI();
        }
    }
}


// ============================================================
// ADMIN UI
// ============================================================

function renderAdminUI() {

    if (
        !profileBox ||
        document.getElementById('admin-panel')
    ) {
        return;
    }


    const adminDiv =
        document.createElement('div');


    adminDiv.id = 'admin-panel';

    adminDiv.className =
        'admin-badge';


    adminDiv.innerHTML = `
    < h3 > Admin Mode</h3 >
        <p>Inventory Access Granted</p>
`;


    profileBox.appendChild(adminDiv);
}


// ============================================================
// CART PREVIEW
// ============================================================

async function renderCartPreview(cartArray) {

    const container =
        document.getElementById(
            'cartPreviewGrid'
        );


    if (!container) {
        return;
    }


    const firstThree =
        cartArray.slice(0, 3);


    container.innerHTML =
        firstThree.length === 0
            ? '<p>Your cart is empty.</p>'
            : '';


    for (const item of firstThree) {

        try {

            const pDoc =
                await getDoc(
                    doc(
                        db,
                        "products",
                        String(item.id)
                    )
                );


            if (!pDoc.exists()) {
                continue;
            }


            const p =
                pDoc.data();


            const imgUrl =
                p.images &&
                p.images.length > 0
                    ? p.images[0]
                    : 'assets/images/placeholder.png';


            container.innerHTML += `
    < div class="cart-preview-item" >

        <img
            src="${imgUrl}"
            alt="${p.name}"
            style="
                            width:50px;
                            border-radius:5px;
                        "
        >

            <div>

                <h4>${p.name}</h4>

                <p>
                    Qty: ${item.qty}
                    |
                    Rs. ${p.price}
                </p>

            </div>

        </div>
`;

        } catch (err) {

            console.error(
                "Cart item loading error:",
                err
            );
        }
    }
}


// ============================================================
// LOGIN / REGISTER TOGGLE
// ============================================================

const toReg =
    document.getElementById(
        'toRegister'
    );


const toLog =
    document.getElementById(
        'toLogin'
    );


if (toReg) {

    toReg.onclick = (e) => {

        e.preventDefault();


        if (loginForm) {
            loginForm.style.display = 'none';
        }

        if (registerForm) {
            registerForm.style.display = 'block';
        }
    };
}


if (toLog) {

    toLog.onclick = (e) => {

        e.preventDefault();


        if (registerForm) {
            registerForm.style.display = 'none';
        }

        if (loginForm) {
            loginForm.style.display = 'block';
        }
    };
}
