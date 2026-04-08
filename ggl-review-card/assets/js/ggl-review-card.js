(function () {
    'use strict';

    var config = window.gglReviewCardConfig || {};
    var templates = config.templates || [];
    var qrEndpoint = config.qrEndpoint || 'https://api.qrserver.com/v1/create-qr-code/';

    function $ (root, selector) {
        return root.querySelector(selector);
    }
    function $$ (root, selector) {
        return Array.prototype.slice.call(root.querySelectorAll(selector));
    }

    function isValidEmail (value) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    function isValidUrl (value) {
        try {
            var url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (e) {
            return false;
        }
    }

    function findTemplate (id) {
        for (var i = 0; i < templates.length; i++) {
            if (templates[i].id === id) {
                return templates[i];
            }
        }
        return templates[0];
    }

    /**
     * Wrap text on a canvas context, returning the lines that fit within
     * maxWidth. Words longer than maxWidth are kept on their own line.
     */
    function wrapText (ctx, text, maxWidth) {
        var paragraphs = String(text).split(/\r?\n/);
        var lines = [];
        paragraphs.forEach(function (paragraph) {
            var words = paragraph.split(/\s+/);
            var current = '';
            words.forEach(function (word) {
                var candidate = current ? current + ' ' + word : word;
                if (ctx.measureText(candidate).width <= maxWidth) {
                    current = candidate;
                } else {
                    if (current) {
                        lines.push(current);
                    }
                    current = word;
                }
            });
            if (current) {
                lines.push(current);
            }
        });
        return lines;
    }

    /**
     * Load the QR code as an Image. Uses goqr.me public API which supports
     * CORS so the resulting canvas remains exportable.
     */
    function loadQrImage (text, size) {
        return new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () { reject(new Error('QR load failed')); };
            var params = '?size=' + size + 'x' + size + '&margin=0&data=' + encodeURIComponent(text);
            img.src = qrEndpoint + params;
        });
    }

    /**
     * Render the A5 banner onto the canvas. Canvas is sized 1240x1754 px
     * which is A5 at ~150 DPI - good for both screen and print.
     */
    function renderBanner (canvas, data) {
        var ctx = canvas.getContext('2d');
        var W = canvas.width;
        var H = canvas.height;
        var template = findTemplate(data.template);

        // Background
        ctx.fillStyle = template.background;
        ctx.fillRect(0, 0, W, H);

        // Top accent bar
        ctx.fillStyle = template.accent;
        ctx.fillRect(0, 0, W, 24);
        ctx.fillRect(0, H - 24, W, 24);

        // Stars row
        ctx.fillStyle = template.accent;
        ctx.font = 'bold 110px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('\u2605\u2605\u2605\u2605\u2605', W / 2, 90);

        // "Google Reviews" label
        ctx.fillStyle = template.subColor;
        ctx.font = '600 44px Arial, sans-serif';
        ctx.fillText('Google Reviews', W / 2, 230);

        // Business name
        ctx.fillStyle = template.textColor;
        ctx.font = 'bold 78px Arial, sans-serif';
        var businessLines = wrapText(ctx, data.business, W - 160);
        var businessY = 310;
        businessLines.slice(0, 2).forEach(function (line, i) {
            ctx.fillText(line, W / 2, businessY + i * 88);
        });

        // Banner text
        ctx.fillStyle = template.textColor;
        ctx.font = '500 48px Arial, sans-serif';
        var textY = businessY + Math.min(businessLines.length, 2) * 88 + 40;
        var textLines = wrapText(ctx, data.bannerText, W - 200);
        textLines.slice(0, 4).forEach(function (line, i) {
            ctx.fillText(line, W / 2, textY + i * 64);
        });

        // QR code area background (white plate so QR is always readable)
        var qrSize = 640;
        var qrX = (W - qrSize) / 2;
        var qrY = H - qrSize - 220;
        var pad = 30;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);

        // Frame around QR plate
        ctx.strokeStyle = template.accent;
        ctx.lineWidth = 8;
        ctx.strokeRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);

        // Draw QR
        ctx.drawImage(data.qrImage, qrX, qrY, qrSize, qrSize);

        // Call-to-action below QR
        ctx.fillStyle = template.textColor;
        ctx.font = 'bold 50px Arial, sans-serif';
        ctx.fillText('Scan to leave a review', W / 2, H - 150);
    }

    function setStep (root, step) {
        $$(root, '.ggl-rc__step').forEach(function (el) {
            el.classList.toggle('is-active', parseInt(el.dataset.step, 10) === step);
        });
        $$(root, '.ggl-rc__steps li').forEach(function (el) {
            var idx = parseInt(el.dataset.stepIndicator, 10);
            el.classList.toggle('is-active', idx === step);
            el.classList.toggle('is-complete', idx < step);
        });

        var backBtn = $(root, '[data-action="back"]');
        var nextBtn = $(root, '[data-action="next"]');
        var generateBtn = $(root, '[data-action="generate"]');

        backBtn.hidden = step === 1;
        nextBtn.hidden = step >= 4;
        generateBtn.hidden = step !== 4;
    }

    function validateStep (root, step) {
        var errorEl = $(root, '.ggl-rc__step.is-active .ggl-rc__error');
        if (errorEl) errorEl.textContent = '';

        if (step === 1) {
            var email = $(root, '[name="email"]').value.trim();
            if (!isValidEmail(email)) {
                if (errorEl) errorEl.textContent = config.i18n.invalidEmail;
                return false;
            }
        }

        if (step === 2) {
            var business = $(root, '[name="business"]').value.trim();
            var url = $(root, '[name="reviewUrl"]').value.trim();
            var bannerText = $(root, '[name="bannerText"]').value.trim();
            if (!business || !bannerText) {
                if (errorEl) errorEl.textContent = config.i18n.required;
                return false;
            }
            if (!isValidUrl(url)) {
                if (errorEl) errorEl.textContent = config.i18n.invalidUrl;
                return false;
            }
        }

        return true;
    }

    function collectData (root) {
        return {
            email: $(root, '[name="email"]').value.trim(),
            business: $(root, '[name="business"]').value.trim(),
            reviewUrl: $(root, '[name="reviewUrl"]').value.trim(),
            bannerText: $(root, '[name="bannerText"]').value.trim(),
            template: $(root, '[name="template"]:checked').value
        };
    }

    function generate (root) {
        var canvas = $(root, '[data-ggl-canvas]');
        var downloadLink = $(root, '.ggl-rc__download');
        var generateBtn = $(root, '[data-action="generate"]');
        var data = collectData(root);

        generateBtn.disabled = true;
        generateBtn.textContent = '...';

        loadQrImage(data.reviewUrl, 640).then(function (qrImage) {
            data.qrImage = qrImage;
            renderBanner(canvas, data);
            try {
                downloadLink.href = canvas.toDataURL('image/png');
                downloadLink.hidden = false;
            } catch (err) {
                downloadLink.hidden = true;
            }
        }).catch(function () {
            alert('Could not generate QR code. Please check the review URL and try again.');
        }).then(function () {
            generateBtn.disabled = false;
            generateBtn.textContent = config.i18n.generate;
        });
    }

    function init (root) {
        var step = 1;
        setStep(root, step);

        $(root, '[data-action="next"]').addEventListener('click', function () {
            if (!validateStep(root, step)) return;
            step = Math.min(step + 1, 4);
            setStep(root, step);
        });

        $(root, '[data-action="back"]').addEventListener('click', function () {
            step = Math.max(step - 1, 1);
            setStep(root, step);
        });

        $(root, '[data-action="generate"]').addEventListener('click', function () {
            generate(root);
        });

        // Pressing Enter in inputs advances to the next step instead of
        // submitting the form (the form has no submit handler anyway).
        $(root, '.ggl-rc__form').addEventListener('submit', function (e) {
            e.preventDefault();
        });
        $(root, '.ggl-rc__form').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (step < 4) {
                    if (validateStep(root, step)) {
                        step += 1;
                        setStep(root, step);
                    }
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        $$(document, '[data-ggl-review-card]').forEach(init);
    });
})();
