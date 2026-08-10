import { db, auth } from './firebase-config.js';

import {
    collection,
    query,
    where,
    limit,
    getDocs,
    doc,
    updateDoc,
    arrayUnion
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";


/* =========================================
   URL / STATE
========================================= */

const params = new URLSearchParams(window.location.search);

const productIdRaw = params.get("id");

let currentImageIndex = 0;
let currentImages = [];

let touchStartX = 0;
let touchEndX = 0;

let selectedVariant = "";


/* =========================================
   VALIDATE PRODUCT ID
========================================= */

if (
    window.location.pathname === "/product" ||
    window.location.pathname === "/product.html"
) {
    if (!productIdRaw) {
        window.location.href = "index.html";
    }
}


const productIdNum = Number(productIdRaw);

if (!Number.isFinite(productIdNum)) {
    window.location.href = "index.html";
}


/* =========================================
   IMAGE NAVIGATION
========================================= */

function nextImage() {

    if (!currentImages.length) return;

    currentImageIndex =
        (currentImageIndex + 1) % currentImages.length;

    changeImage(currentImageIndex);
}


function prevImage() {

    if (!currentImages.length) return;

    currentImageIndex =
        (currentImageIndex - 1 + currentImages.length) %
        currentImages.length;

    changeImage(currentImageIndex);
}


/* =========================================
   LOAD PRODUCT
========================================= */

async function loadProductDetails() {

    console.log("loadProductDetails() started");

    const skeleton =
        document.getElementById("productSkeleton");

    const content =
        document.getElementById("productContent");


    try {

        if (skeleton)
            skeleton.style.display = "block";

        if (content)
            content.style.display = "none";


        /* -------------------------------------
           FETCH PRODUCT
        ------------------------------------- */

        const productsRef =
            collection(db, "products");

        const q = query(
            productsRef,
            where("id", "==", productIdNum)
        );

        const querySnapshot =
            await getDocs(q);


        console.log(
            "Firestore returned",
            querySnapshot.size
        );


        if (querySnapshot.empty) {

            document.body.innerHTML = `
                <h2 style="
                    text-align:center;
                    margin-top:50px;
                ">
                    Product not found
                </h2>
            `;

            return;
        }


        const product =
            querySnapshot.docs[0].data();


        /* =====================================
           BUNDLE DETECTION
        ===================================== */

        const isBundle =
            product.isBundle === true;


        /* =====================================
           IMAGES
        ===================================== */

        if (
            product.imageFolder &&
            product.imageCount
        ) {

            currentImages = Array.from(
                {
                    length: product.imageCount
                },

                (_, i) =>
                    `assets/images/products/${product.imageFolder}/${i + 1}.webp`
            );

        } else {

            currentImages =
                Array.isArray(product.images)
                    ? product.images
                    : product.images
                        ? [product.images]
                        : [];

        }


        currentImageIndex = 0;

        preloadImages(currentImages);


        const counter =
            document.getElementById("galleryCounter");


        if (counter) {

            counter.style.display =
                currentImages.length > 1
                    ? "block"
                    : "none";

        }


        /* =====================================
           STOCK
        ===================================== */

        const stockLabel =
            document.getElementById("stockStatus");


        const stock =
            Number(product.stock || 0);


        if (stockLabel) {

            if (stock > 0) {

                stockLabel.innerHTML = `
                    <i class="fas fa-check-circle"></i>
                    In Stock
                `;

                stockLabel.className =
                    "in-stock";

            } else {

                stockLabel.innerHTML = `
                    <i class="fas fa-times-circle"></i>
                    Out of Stock
                `;

                stockLabel.className =
                    "out-of-stock";


                document.getElementById("addBtn")
                    .disabled = true;

                document.getElementById("buyNowBtn")
                    .disabled = true;

                document.getElementById("qtyInput")
                    .disabled = true;

            }

        }


        /* =====================================
           VARIANT
        ===================================== */

        selectedVariant =
            product.defaultVariant || "";


        /* =====================================
           SEO
        ===================================== */

        document.title =
            `${product.name} | Tijva`;


        const metaDescription =
            document.querySelector(
                'meta[name="description"]'
            );

        if (metaDescription) {

            metaDescription.content =
                product.description || "";

        }


        const canonical =
            document.querySelector(
                'link[rel="canonical"]'
            );

        if (canonical) {

            canonical.href =
                window.location.href;

        }


        const ogTitle =
            document.querySelector(
                'meta[property="og:title"]'
            );

        if (ogTitle) {

            ogTitle.content =
                product.name;

        }


        const ogDescription =
            document.querySelector(
                'meta[property="og:description"]'
            );

        if (ogDescription) {

            ogDescription.content =
                product.description || "";

        }


        const ogUrl =
            document.querySelector(
                'meta[property="og:url"]'
            );

        if (ogUrl) {

            ogUrl.content =
                window.location.href;

        }


        /* =====================================
           BASIC CONTENT
        ===================================== */

        document.getElementById(
            "productName"
        ).innerText =
            product.name;


        document.getElementById(
            "productTitle"
        ).innerText =
            product.name;


        const subEl =
            document.getElementById(
                "productSubtitle"
            );


        if (subEl) {

            subEl.innerText =
                product.subtitle || "";

        }


        document.getElementById(
            "productDescription"
        ).innerText =
            product.description || "";


        const fullDesc =
            document.getElementById(
                "fullDescription"
            );


        if (fullDesc) {

            fullDesc.innerHTML =
                product.fullDescription ||
                product.description ||
                "";

        }


        /* =====================================
           PRICE
        ===================================== */

        document.getElementById(
            "newPrice"
        ).innerText =
            "Rs. " + product.price;


        const oldPriceEl =
            document.getElementById(
                "oldPrice"
            );


        if (
            oldPriceEl &&
            product.oldPrice
        ) {

            oldPriceEl.innerText =
                "Rs. " + product.oldPrice;

        } else if (oldPriceEl) {

            oldPriceEl.innerText = "";

        }


        /* =====================================
           BUNDLE UI
        ===================================== */

        setupBundleUI(product, isBundle);


        /* =====================================
           IMAGE GALLERY
        ===================================== */

        const mainImg =
            document.getElementById(
                "mainProductImage"
            );


        if (
            mainImg &&
            currentImages.length > 0
        ) {

            mainImg.alt =
                product.name;

            changeImage(0);


            const thumbBox =
                document.getElementById(
                    "thumbnailSlider"
                );


            if (thumbBox) {

                thumbBox.innerHTML = "";


                const hasMultiple =
                    currentImages.length > 1;


                document.getElementById(
                    "prevImage"
                ).style.display =
                    hasMultiple
                        ? "flex"
                        : "none";


                document.getElementById(
                    "nextImage"
                ).style.display =
                    hasMultiple
                        ? "flex"
                        : "none";


                currentImages.forEach(
                    (img, index) => {

                        const thumb =
                            document.createElement(
                                "img"
                            );


                        thumb.src = img;

                        thumb.alt =
                            `${product.name} image ${index + 1}`;

                        thumb.className =
                            "thumb-img";


                        if (index === 0) {

                            thumb.classList.add(
                                "active"
                            );

                        }


                        thumb.onclick = () =>
                            changeImage(index);


                        thumbBox.appendChild(
                            thumb
                        );

                    }
                );

            }

        }


        /* =====================================
           VARIANTS
        ===================================== */

        setupVariants(
            product.variants,
            selectedVariant
        );


        /* =====================================
           REVIEWS
        ===================================== */

        setupReviews(
            product.reviews
        );


        /* =====================================
           RELATED PRODUCTS
        ===================================== */

        loadRelatedProducts(
            product.category,
            productIdNum
        );


        /* =====================================
           RECENTLY VIEWED
        ===================================== */

        trackProductView(
            productIdNum
        );


        /* =====================================
           ANALYTICS
        ===================================== */

        gtag("event", "view_item", {

            currency: "PKR",

            value: Number(product.price || 0),

            items: [
                {
                    item_id:
                        String(product.id),

                    item_name:
                        product.name,

                    item_category:
                        product.category,

                    item_variant:
                        selectedVariant || undefined
                }
            ]

        });


        /* =====================================
           ADD TO CART
        ===================================== */

        const addBtn =
            document.getElementById(
                "addBtn"
            );


        if (addBtn) {

            addBtn.onclick = () => {

                const qtyInput =
                    document.getElementById(
                        "qtyInput"
                    );


                const qty =
                    validateQuantity(
                        qtyInput,
                        stock
                    );


                if (!qty)
                    return;


                if (
                    window.addToCart
                ) {

                    window.addToCart(
                        productIdNum,
                        qty,
                        selectedVariant
                    );

                }

            };

        }


        /* =====================================
           BUY NOW
        ===================================== */

        const buyNowBtn =
            document.getElementById(
                "buyNowBtn"
            );


        if (buyNowBtn) {

            buyNowBtn.onclick = () => {

                const qtyInput =
                    document.getElementById(
                        "qtyInput"
                    );


                const qty =
                    validateQuantity(
                        qtyInput,
                        stock
                    );


                if (!qty)
                    return;


                const buyNowItem = {

                    id:
                        productIdNum,

                    qty:
                        qty,

                    variant:
                        selectedVariant

                };


                sessionStorage.setItem(
                    "buyNowItem",
                    JSON.stringify(
                        buyNowItem
                    )
                );


                gtag(
                    "event",
                    "begin_checkout",
                    {

                        currency: "PKR",

                        value:
                            Number(product.price || 0) *
                            qty,

                        items: [
                            {
                                item_id:
                                    String(product.id),

                                item_name:
                                    product.name,

                                quantity:
                                    qty
                            }
                        ]

                    }
                );


                window.location.href =
                    "checkout.html";

            };

        }


        /* =====================================
           WHATSAPP
        ===================================== */

        setupWhatsApp(
            product
        );


        /* =====================================
           WISHLIST
        ===================================== */

        const wishBtn =
            document.getElementById(
                "wishlistBtn"
            );


        if (wishBtn) {

            wishBtn.onclick = () =>
                addToWishlist(
                    productIdNum
                );

        }


        /* =====================================
           SHOW CONTENT
        ===================================== */

        if (skeleton)
            skeleton.style.display = "none";

        if (content)
            content.style.display = "block";


    } catch (error) {

        console.error(
            "❌ Error loading product details:",
            error
        );


        if (skeleton)
            skeleton.style.display = "none";

    }

}


/* =========================================
   BUNDLE UI
========================================= */

function setupBundleUI(product, isBundle) {

    const badge =
        document.getElementById(
            "productBadge"
        );


    const sectionTag =
        document.getElementById(
            "productSectionTag"
        );


    const bundleOffer =
        document.getElementById(
            "bundleOffer"
        );


    const bundleFeatureStrip =
        document.getElementById(
            "bundleFeatureStrip"
        );


    const variantSelector =
        document.getElementById(
            "variantSelector"
        );


    if (isBundle) {

        /* Badge */

        if (badge) {

            badge.innerHTML = `
                <i class="fas fa-fire"></i>
                ${product.badge || "Bundle Deal"}
            `;

        }


        /* Section heading */

        if (sectionTag) {

            sectionTag.innerText =
                "Bundle Deal";

        }


        /* Offer box */

        if (bundleOffer) {

            bundleOffer.classList.add(
                "active"
            );

        }


        /* Feature strip */

        if (bundleFeatureStrip) {

            bundleFeatureStrip.classList.add(
                "active"
            );

        }


        /* Dynamic savings */

        const bundleOldPrice =
            document.getElementById(
                "bundleOldPrice"
            );


        const bundleSave =
            document.getElementById(
                "bundleSave"
            );


        if (bundleOldPrice) {

            bundleOldPrice.innerText =
                `Rs. ${product.oldPrice || 0}`;

        }


        const savings =
            Number(
                product.bundleSavings ||
                (
                    Number(product.oldPrice || 0) -
                    Number(product.price || 0)
                )
            );


        if (bundleSave) {

            bundleSave.innerText =
                `Save Rs. ${savings}`;

        }


        /* Variant label */

        const variantLabel =
            document.querySelector(
                "#variantSelector label"
            );


        if (variantLabel) {

            variantLabel.innerText =
                "Bundle Variant";

        }


    } else {

        if (bundleOffer) {

            bundleOffer.classList.remove(
                "active"
            );

        }


        if (bundleFeatureStrip) {

            bundleFeatureStrip.classList.remove(
                "active"
            );

        }


        if (badge) {

            badge.innerText =
                "Best Deal";

        }


        if (sectionTag) {

            sectionTag.innerText =
                "Product";

        }

    }

}


/* =========================================
   QUANTITY VALIDATION
========================================= */

function validateQuantity(input, stock) {

    if (!input)
        return 1;


    let qty =
        Number(input.value);


    if (!Number.isFinite(qty) || qty < 1) {

        input.value = 1;

        qty = 1;

    }


    qty = Math.floor(qty);


    if (stock > 0 && qty > stock) {

        qty = stock;

        input.value = stock;


        if (
            typeof showNotification ===
            "function"
        ) {

            showNotification(
                `Only ${stock} available.`,
                "warning"
            );

        }

    }


    return qty;

}


/* =========================================
   WHATSAPP
========================================= */

function setupWhatsApp(product) {

    const whatsappBtn =
        document.getElementById(
            "whatsappBtn"
        );


    if (!whatsappBtn)
        return;


    const phone =
        "923006210027";


    const message = `
Assalam-o-Alaikum!

I'm interested in this product.

📦 Product: ${product.name}
🆔 Product ID: ${product.id}
🎨 Variant: ${selectedVariant || "Default"}
💰 Price: Rs. ${product.price}
🔗 ${window.location.href}
`.trim();


    whatsappBtn.href =
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

}


/* =========================================
   VARIANTS
========================================= */

function setupVariants(
    variants,
    defaultVal
) {

    const variantBox =
        document.getElementById(
            "variantBox"
        );


    if (!variantBox)
        return;


    /*
       Your current Firestore examples use
       "Black" / "Blue" strings.

       This supports both:
       "Black"
       and
       ["Black", "Blue"]
    */

    let variantList = [];


    if (Array.isArray(variants)) {

        variantList =
            variants;

    } else if (
        typeof variants === "string" &&
        variants.trim()
    ) {

        variantList =
            variants
                .split(",")
                .map(v => v.trim())
                .filter(Boolean);

    }


    if (variantList.length > 0) {

        variantBox.style.display =
            "flex";

        variantBox.innerHTML = "";


        variantList.forEach(v => {

            const btn =
                document.createElement(
                    "button"
                );


            btn.className =
                "variant-btn" +
                (
                    v === defaultVal
                        ? " active"
                        : ""
                );


            btn.innerText = v;


            btn.onclick = () => {

                document
                    .querySelectorAll(
                        ".variant-btn"
                    )
                    .forEach(
                        b =>
                            b.classList.remove(
                                "active"
                            )
                    );


                btn.classList.add(
                    "active"
                );


                selectedVariant = v;


                updateWhatsAppVariant();

            };


            variantBox.appendChild(
                btn
            );

        });

    } else {

        variantBox.style.display =
            "none";

    }

}


/* =========================================
   UPDATE WHATSAPP VARIANT
========================================= */

function updateWhatsAppVariant() {

    const whatsappBtn =
        document.getElementById(
            "whatsappBtn"
        );


    if (!whatsappBtn)
        return;


    const phone =
        "923006210027";


    const productName =
        document.getElementById(
            "productName"
        )?.innerText || "Product";


    const price =
        document.getElementById(
            "newPrice"
        )?.innerText || "";


    const message = `
Assalam-o-Alaikum!

I'm interested in this product.

📦 Product: ${productName}
🆔 Product ID: ${productIdNum}
🎨 Variant: ${selectedVariant || "Default"}
💰 Price: ${price}
🔗 ${window.location.href}
`.trim();


    whatsappBtn.href =
        `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

}


/* =========================================
   REVIEWS
========================================= */

function setupReviews(reviews) {

    const reviewBox =
        document.getElementById(
            "reviewsBox"
        );


    if (!reviewBox)
        return;


    let reviewList = [];


    /*
       Don't invent customer reviews.

       If Firestore contains actual reviews,
       display them.

       Otherwise show a neutral message.
    */

    if (Array.isArray(reviews)) {

        reviewList =
            reviews;

    }


    if (!reviewList.length) {

        reviewBox.innerHTML = `
            <div class="review-card"
                style="
                    padding: 15px;
                    color: #777;
                ">

                <p>
                    No reviews yet.
                    Be the first to share your experience!
                </p>

            </div>
        `;

        return;

    }


    reviewBox.innerHTML =
        reviewList
            .map(r => `

                <div class="review-card"
                    style="
                        padding: 15px;
                        border-bottom: 1px solid #eee;
                    ">

                    <h4 style="margin:0;">

                        ${escapeHTML(
                r.name || "Customer"
            )}

                        <span
                            style="
                                color:var(--primary-color);
                            "
                        >

                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>
                            <i class="fas fa-star"></i>

                        </span>

                    </h4>

                    <p
                        style="
                            color:#666;
                            margin-top:5px;
                        "
                    >
                        ${escapeHTML(
                r.comment || ""
            )}
                    </p>

                </div>

            `)
            .join("");

}


/* =========================================
   RELATED PRODUCTS
========================================= */

async function loadRelatedProducts(
    category,
    currentId
) {

    const grid =
        document.getElementById(
            "relatedProductsGrid"
        );


    if (!grid)
        return;


    try {

        const q =
            query(
                collection(
                    db,
                    "products"
                ),

                where(
                    "category",
                    "==",
                    category
                ),

                limit(5)
            );


        const snap =
            await getDocs(q);


        grid.innerHTML = "";


        snap.forEach(
            docSnap => {

                const product =
                    docSnap.data();


                if (
                    product.id ===
                    currentId
                ) {

                    return;

                }


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "product-card";


                const imgDefault =
                    product.imageFolder &&
                        product.imageCount > 1

                        ? `assets/images/products/${product.imageFolder}/1.webp`

                        : "assets/images/placeholder.png";


                const imgHover =
                    product.imageFolder &&
                        product.imageCount > 1

                        ? `assets/images/products/${product.imageFolder}/2.webp`

                        : imgDefault;


                item.setAttribute(
                    "onclick",
                    `openProduct('${product.id}')`
                );


                item.innerHTML = `

                    <div class="product-image">

                        <img
                            class="img-default"
                            src="${imgDefault}"
                            alt="${escapeHTML(product.name)}"
                        >

                        <img
                            class="img-hover"
                            src="${imgHover}"
                            alt="${escapeHTML(product.name)}"
                        >

                    </div>

                    <h3>
                        ${escapeHTML(product.name)}
                    </h3>

                    <p
                        style="
                            font-size:0.8rem;
                            color:#666;
                            margin-bottom:5px;
                        "
                    >
                        ${escapeHTML(
                    product.subtitle || ""
                )}
                    </p>

                    <div class="price-box">

                        ${product.oldPrice

                        ? `
                                    <span class="old-price">
                                        Rs. ${product.oldPrice}
                                    </span>
                                  `

                        : ""
                    }

                        <span class="new-price">
                            Rs. ${product.price}
                        </span>

                    </div>

                `;


                const cardBtn =
                    document.createElement(
                        "button"
                    );


                cardBtn.className =
                    "add-btn";


                cardBtn.innerText =
                    "Add to Cart";


                cardBtn.onclick =
                    event => {

                        event.stopPropagation();


                        if (
                            window.addToCart
                        ) {

                            window.addToCart(
                                product.id,
                                1,
                                product.defaultVariant || ""
                            );

                        }

                    };


                item.appendChild(
                    cardBtn
                );


                grid.appendChild(
                    item
                );

            }
        );


    } catch (e) {

        console.warn(
            "Related products failed:",
            e
        );

    }

}


/* =========================================
   RECENTLY VIEWED
========================================= */

async function trackProductView(id) {

    onAuthStateChanged(
        auth,
        async user => {

            if (!user)
                return;


            try {

                const userRef =
                    doc(
                        db,
                        "users",
                        user.uid
                    );


                await updateDoc(
                    userRef,
                    {
                        recentlyViewed:
                            arrayUnion(id)
                    }
                );


            } catch (e) {

                console.warn(
                    "Track view error:",
                    e
                );

            }

        }
    );

}


/* =========================================
   WISHLIST
========================================= */

async function addToWishlist(id) {

    const user =
        auth.currentUser;


    if (!user) {

        if (
            typeof showNotification ===
            "function"
        ) {

            showNotification(
                "Please login to use Wishlist",
                "warning"
            );

        } else {

            alert(
                "Please login to use wishlist"
            );

        }

        return;

    }


    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );


        await updateDoc(
            userRef,
            {
                wishlist:
                    arrayUnion(id)
            }
        );


        gtag(
            "event",
            "add_to_wishlist",
            {
                items: [
                    {
                        item_id:
                            String(id)
                    }
                ]
            }
        );


        if (
            typeof showNotification ===
            "function"
        ) {

            showNotification(
                "Added to Wishlist!",
                "success"
            );

        } else {

            alert(
                "Added to Wishlist!"
            );

        }


    } catch (err) {

        console.error(
            "Wishlist error:",
            err
        );


        if (
            typeof showNotification ===
            "function"
        ) {

            showNotification(
                "Could not add to wishlist",
                "error"
            );

        }

    }

}


/* =========================================
   IMAGE CHANGE
========================================= */

function changeImage(index) {

    if (
        index < 0 ||
        index >= currentImages.length
    ) {

        return;

    }


    currentImageIndex =
        index;


    const img =
        document.getElementById(
            "mainProductImage"
        );


    if (!img)
        return;


    const container =
        img.parentElement;


    container.classList.add(
        "changing"
    );


    setTimeout(() => {

        img.src =
            currentImages[index];

        container.classList.remove(
            "changing"
        );

    }, 180);


    document
        .querySelectorAll(
            ".thumb-img"
        )
        .forEach(
            (thumb, i) => {

                thumb.classList.toggle(
                    "active",
                    i === index
                );

            }
        );


    updateCounter();

}


/* =========================================
   COUNTER
========================================= */

function updateCounter() {

    const counter =
        document.getElementById(
            "galleryCounter"
        );


    if (!counter)
        return;


    counter.textContent =
        `${currentImageIndex + 1} / ${currentImages.length}`;

}


/* =========================================
   PRELOAD
========================================= */

function preloadImages(images) {

    images.forEach(src => {

        const img =
            new Image();

        img.src =
            src;

    });

}


/* =========================================
   BASIC HTML ESCAPE
========================================= */

function escapeHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* =========================================
   TOUCH SWIPE
========================================= */

const gallery =
    document.querySelector(
        ".main-image-wrapper"
    );


if (gallery) {

    gallery.addEventListener(
        "touchstart",
        e => {

            if (
                e.target.closest(
                    ".thumbnail-slider"
                )
            ) {

                return;

            }


            touchStartX =
                e.changedTouches[0].clientX;

        }
    );


    gallery.addEventListener(
        "touchend",
        e => {

            if (
                e.target.closest(
                    ".thumbnail-slider"
                )
            ) {

                return;

            }


            touchEndX =
                e.changedTouches[0].clientX;


            const diff =
                touchStartX -
                touchEndX;


            if (
                Math.abs(diff) < 50
            ) {

                return;

            }


            if (diff > 0) {

                nextImage();

            } else {

                prevImage();

            }

        }
    );

}


/* =========================================
   KEYBOARD
========================================= */

document.addEventListener(
    "keydown",
    e => {

        if (e.key === "ArrowRight")
            nextImage();

        if (e.key === "ArrowLeft")
            prevImage();

    }
);


/* =========================================
   GALLERY BUTTONS
========================================= */

document
    .getElementById("prevImage")
    ?.addEventListener(
        "click",
        prevImage
    );


document
    .getElementById("nextImage")
    ?.addEventListener(
        "click",
        nextImage
    );


/* =========================================
   START
========================================= */

if (
    window.location.pathname.includes(
        "product"
    )
) {

    loadProductDetails();

}