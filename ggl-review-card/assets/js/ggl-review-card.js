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
     * Coordinate resolvers. Templates can specify coordinates as:
     *  - integer pixels
     *  - percentage strings ('50%')
     *  - negative pixels (measured from the right/bottom edge)
     */
    function resolveCoord (value, total) {
        if (typeof value === 'string' && value.indexOf('%') !== -1) {
            return (parseFloat(value) / 100) * total;
        }
        if (typeof value === 'number' && value < 0) {
            return total + value;
        }
        return value || 0;
    }

    function resolveSize (value, total) {
        if (typeof value === 'string' && value.indexOf('%') !== -1) {
            return (parseFloat(value) / 100) * total;
        }
        return value || 0;
    }

    function applyTextStyle (ctx, el) {
        ctx.fillStyle    = el.fill || '#000000';
        ctx.font         = el.font || '24px sans-serif';
        ctx.textAlign    = el.align || 'left';
        ctx.textBaseline = el.baseline || 'top';
    }

    function drawTextBlock (ctx, text, x, y, el) {
        applyTextStyle(ctx, el);

        var lineHeight = el.lineHeight || (parseFloat(el.font) || 24) * 1.2;
        var lines;
        if (el.maxWidth) {
            lines = wrapText(ctx, text, el.maxWidth);
        } else {
            lines = String(text || '').split(/\r?\n/);
        }
        var max = el.maxLines || lines.length;
        for (var i = 0; i < Math.min(lines.length, max); i++) {
            ctx.fillText(lines[i], x, y + i * lineHeight);
        }
    }

    function drawQrElement (ctx, x, y, el, data) {
        var size = el.size || 640;
        var pad  = el.framePadding || 0;
        var anchor = el.anchor || 'topLeft';

        var qrX = x;
        var qrY = y;
        if (anchor === 'center') {
            qrX = x - size / 2;
            qrY = y - size / 2;
        } else if (anchor === 'topCenter') {
            qrX = x - size / 2;
        } else if (anchor === 'centerLeft') {
            qrY = y - size / 2;
        }

        // Plate background
        if (el.plate !== false) {
            ctx.fillStyle = el.plate || '#ffffff';
            ctx.fillRect(qrX - pad, qrY - pad, size + pad * 2, size + pad * 2);
        }

        // Optional accent frame
        if (el.frame) {
            ctx.strokeStyle = el.frameColor || '#000000';
            ctx.lineWidth   = el.frameWidth || 8;
            ctx.strokeRect(qrX - pad, qrY - pad, size + pad * 2, size + pad * 2);
        }

        if (data.qrImage) {
            ctx.drawImage(data.qrImage, qrX, qrY, size, size);
        } else {
            ctx.fillStyle = '#e2e8f0';
            ctx.fillRect(qrX, qrY, size, size);
            ctx.fillStyle    = '#94a3b8';
            ctx.font         = '500 32px Arial, sans-serif';
            ctx.textAlign    = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('QR loading...', qrX + size / 2, qrY + size / 2);
        }
    }

    /**
     * Element renderer. Each template's `elements` array is iterated in
     * order; new element types can be added here without touching templates.
     */
    function renderElement (ctx, el, W, H, data) {
        if (!el || !el.type) { return; }

        var x = resolveCoord(el.x, W);
        var y = resolveCoord(el.y, H);

        switch (el.type) {
            case 'rect':
                ctx.fillStyle = el.fill || '#000000';
                ctx.fillRect(
                    x,
                    y,
                    resolveSize(el.w, W),
                    resolveSize(el.h, H)
                );
                break;

            case 'text':
                drawTextBlock(ctx, el.content || '', x, y, el);
                break;

            case 'stars':
                var count = el.count || 5;
                var stars = '';
                for (var i = 0; i < count; i++) { stars += '\u2605'; }
                drawTextBlock(ctx, stars, x, y, el);
                break;

            case 'business':
                drawTextBlock(ctx, data.business || '\u00a0', x, y, el);
                break;

            case 'bannerText':
                drawTextBlock(ctx, data.bannerText || '', x, y, el);
                break;

            case 'qr':
                drawQrElement(ctx, x, y, el, data);
                break;
        }
    }

    /**
     * Find the largest QR size declared in a template, so we fetch one
     * image big enough for every QR element. Defaults to 640.
     */
    function getQrFetchSize (template) {
        var max = 0;
        var els = template.elements || [];
        for (var i = 0; i < els.length; i++) {
            if (els[i].type === 'qr') {
                max = Math.max(max, els[i].size || 640);
            }
        }
        return max || 640;
    }

    function renderBanner (canvas, data, template) {
        var ctx = canvas.getContext('2d');

        // Optional canvas size override per template.
        if (template.canvas && (template.canvas.w || template.canvas.h)) {
            var w = template.canvas.w || canvas.width;
            var h = template.canvas.h || canvas.height;
            if (canvas.width !== w)  { canvas.width  = w; }
            if (canvas.height !== h) { canvas.height = h; }
        }

        var W = canvas.width;
        var H = canvas.height;

        // Background
        ctx.fillStyle = template.background || '#ffffff';
        ctx.fillRect(0, 0, W, H);

        // Render elements in declared order
        var elements = template.elements || [];
        for (var i = 0; i < elements.length; i++) {
            renderElement(ctx, elements[i], W, H, data);
        }
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
        var qrSize = getQrFetchSize(template);
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
