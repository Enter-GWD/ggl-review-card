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

    function debounce (fn, wait) {
        var t;
        return function () {
            var args = arguments, ctx = this;
            clearTimeout(t);
            t = setTimeout(function () { fn.apply(ctx, args); }, wait);
        };
    }

    /**
     * Wrap text on a canvas context, returning the lines that fit within
     * maxWidth. Words longer than maxWidth are kept on their own line.
     */
    function wrapText (ctx, text, maxWidth) {
        var paragraphs = String(text || '').split(/\r?\n/);
        var lines = [];
        paragraphs.forEach(function (paragraph) {
            var words = paragraph.split(/\s+/).filter(Boolean);
            if (!words.length) { return; }
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
     * QR cache: key = URL string, value = Promise<HTMLImageElement>.
     * Avoids re-fetching when only the template/text changes.
     */
    var qrCache = {};

    function loadQrImage (text, size) {
        var key = size + '|' + text;
        if (qrCache[key]) {
            return qrCache[key];
        }
        qrCache[key] = new Promise(function (resolve, reject) {
            var img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = function () { resolve(img); };
            img.onerror = function () {
                delete qrCache[key];
                reject(new Error('QR load failed'));
            };
            var params = '?size=' + size + 'x' + size + '&margin=0&data=' + encodeURIComponent(text);
            img.src = qrEndpoint + params;
        });
        return qrCache[key];
    }

    /**
     * Layouts. Add new layout ids by extending this object - templates pick
     * one via the `layout` key in their style_*.php file.
     */
    var layouts = {
        centered: function (ctx, W, H, data, template) {
            // Background
            ctx.fillStyle = template.background || '#ffffff';
            ctx.fillRect(0, 0, W, H);

            // Optional accent bars
            if (template.bars !== false) {
                ctx.fillStyle = template.accent || '#4285F4';
                ctx.fillRect(0, 0, W, 24);
                ctx.fillRect(0, H - 24, W, 24);
            }

            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';

            // Stars
            ctx.fillStyle = template.accent || '#facc15';
            ctx.font = 'bold 110px Arial, sans-serif';
            ctx.fillText('\u2605\u2605\u2605\u2605\u2605', W / 2, 90);

            // Label
            ctx.fillStyle = template.subColor || '#5f6368';
            ctx.font = template.labelFont || '600 44px Arial, sans-serif';
            ctx.fillText('Google Reviews', W / 2, 230);

            // Business name
            ctx.fillStyle = template.textColor || '#202124';
            ctx.font = template.titleFont || 'bold 78px Arial, sans-serif';
            var businessLines = wrapText(ctx, data.business || '\u00a0', W - 160);
            var businessY = 310;
            businessLines.slice(0, 2).forEach(function (line, i) {
                ctx.fillText(line, W / 2, businessY + i * 88);
            });

            // Banner text
            ctx.fillStyle = template.textColor || '#202124';
            ctx.font = template.bodyFont || '500 48px Arial, sans-serif';
            var textY = businessY + Math.min(businessLines.length, 2) * 88 + 40;
            var textLines = wrapText(ctx, data.bannerText || '', W - 200);
            textLines.slice(0, 4).forEach(function (line, i) {
                ctx.fillText(line, W / 2, textY + i * 64);
            });

            // QR plate
            var qrSize = template.qrSize || 640;
            var qrX = (W - qrSize) / 2;
            var qrY = H - qrSize - 220;
            var pad = 30;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);

            if (template.qrFrame !== false) {
                ctx.strokeStyle = template.accent || '#4285F4';
                ctx.lineWidth = 8;
                ctx.strokeRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2);
            }

            if (data.qrImage) {
                ctx.drawImage(data.qrImage, qrX, qrY, qrSize, qrSize);
            } else {
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(qrX, qrY, qrSize, qrSize);
                ctx.fillStyle = '#94a3b8';
                ctx.font = '500 32px Arial, sans-serif';
                ctx.fillText('QR loading...', W / 2, qrY + qrSize / 2 - 16);
            }

            // CTA
            ctx.fillStyle = template.textColor || '#202124';
            ctx.font = template.ctaFont || 'bold 50px Arial, sans-serif';
            ctx.fillText('Scan to leave a review', W / 2, H - 150);
        }
    };

    function renderBanner (canvas, data, template) {
        var ctx = canvas.getContext('2d');
        var draw = layouts[template.layout] || layouts.centered;
        draw(ctx, canvas.width, canvas.height, data, template);
    }

    function setStep (state, step) {
        var root = state.root;
        $$(root, '.ggl-rc__step').forEach(function (el) {
            el.classList.toggle('is-active', parseInt(el.dataset.step, 10) === step);
        });
        $$(root, '.ggl-rc__steps li').forEach(function (el) {
            var idx = parseInt(el.dataset.stepIndicator, 10);
            el.classList.toggle('is-active', idx === step);
            el.classList.toggle('is-complete', idx < step);
        });

        $(root, '[data-action="back"]').hidden = step === 1;
        $(root, '[data-action="next"]').hidden = step >= 4;

        // Show live preview from step 3 onwards.
        var preview = $(root, '[data-live-preview]');
        var showPreview = step >= 3;
        preview.hidden = !showPreview;
        root.dataset.hasPreview = showPreview ? 'true' : 'false';

        if (showPreview) {
            schedulePreview(state);
        }

        state.step = step;
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
        var templateInput = $(root, '[name="template"]:checked');
        return {
            email:      $(root, '[name="email"]').value.trim(),
            business:   $(root, '[name="business"]').value.trim(),
            reviewUrl:  $(root, '[name="reviewUrl"]').value.trim(),
            bannerText: $(root, '[name="bannerText"]').value.trim(),
            template:   templateInput ? templateInput.value : (templates[0] && templates[0].id)
        };
    }

    /**
     * Render the live preview. Pulls fresh data from the form, renders
     * immediately with whatever QR (if any) is cached, then re-renders once
     * the QR for the current URL has loaded.
     */
    function renderPreview (state) {
        var data = collectData(state.root);
        var template = findTemplate(data.template);
        if (!template) { return; }

        var canvas = $(state.root, '[data-ggl-canvas]');
        var statusEl = $(state.root, '[data-preview-status]');
        var downloadLink = $(state.root, '.ggl-rc__download');

        // Initial render without QR (or with whatever's already cached).
        renderBanner(canvas, data, template);

        if (!isValidUrl(data.reviewUrl)) {
            if (statusEl) statusEl.textContent = config.i18n.invalidUrl;
            downloadLink.hidden = true;
            return;
        }

        if (statusEl) statusEl.textContent = '...';
        var qrSize = template.qrSize || 640;
        var requestId = ++state.requestId;

        loadQrImage(data.reviewUrl, qrSize).then(function (qrImage) {
            // Discard if a newer request superseded this one.
            if (requestId !== state.requestId) { return; }
            data.qrImage = qrImage;
            renderBanner(canvas, data, template);
            try {
                downloadLink.href = canvas.toDataURL('image/png');
                downloadLink.hidden = false;
                if (statusEl) statusEl.textContent = '';
            } catch (err) {
                downloadLink.hidden = true;
                if (statusEl) statusEl.textContent = 'Preview ready (download blocked by canvas security).';
            }
        }).catch(function () {
            if (requestId !== state.requestId) { return; }
            if (statusEl) statusEl.textContent = 'Could not load QR code for that URL.';
            downloadLink.hidden = true;
        });
    }

    function schedulePreview (state) {
        state.debouncedRender();
    }

    function init (root) {
        var state = {
            root: root,
            step: 1,
            requestId: 0
        };
        state.debouncedRender = debounce(function () { renderPreview(state); }, 200);

        setStep(state, 1);

        $(root, '[data-action="next"]').addEventListener('click', function () {
            if (!validateStep(root, state.step)) return;
            setStep(state, Math.min(state.step + 1, 4));
        });

        $(root, '[data-action="back"]').addEventListener('click', function () {
            setStep(state, Math.max(state.step - 1, 1));
        });

        // Auto-render on any field/template change once the preview is visible.
        $(root, '.ggl-rc__form').addEventListener('input', function () {
            if (state.step >= 3) { schedulePreview(state); }
        });
        $(root, '.ggl-rc__form').addEventListener('change', function () {
            if (state.step >= 3) { schedulePreview(state); }
        });

        $(root, '.ggl-rc__form').addEventListener('submit', function (e) {
            e.preventDefault();
        });
        $(root, '.ggl-rc__form').addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault();
                if (state.step < 4 && validateStep(root, state.step)) {
                    setStep(state, state.step + 1);
                }
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!templates.length) { return; }
        $$(document, '[data-ggl-review-card]').forEach(init);
    });
})();
