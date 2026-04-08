(function () {
    'use strict';

    var config = window.gglReviewCardConfig || {};
    var templates = config.templates || [];
    var qrEndpoint = config.qrEndpoint || 'https://api.qrserver.com/v1/create-qr-code/';
    var html2canvasUrl = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';

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

    var ENTITY_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function escapeHtml (s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return ENTITY_MAP[c];
        });
    }

    /**
     * Substitute {{placeholder}} tokens in the raw template HTML with
     * form data. All values are HTML-escaped so they are safe in both
     * text content and attribute values.
     *
     * Supported tokens:
     *   {{business_name}}  -> business name from the form
     *   {{banner_text}}    -> banner text from the form
     *   {{review_url}}     -> review URL (href attribute)
     *   {{email}}          -> email from step 1
     *   {{qr_code}}        -> URL of a QR code image for {{review_url}}
     */
    function substituteTemplate (html, data) {
        var qrUrl = isValidUrl(data.reviewUrl)
            ? qrEndpoint + '?size=800x800&margin=0&data=' + encodeURIComponent(data.reviewUrl)
            : '';

        var vars = {
            business_name: data.business || '',
            banner_text:   data.bannerText || '',
            review_url:    isValidUrl(data.reviewUrl) ? data.reviewUrl : '#',
            email:         data.email || '',
            qr_code:       qrUrl
        };

        return html.replace(/\{\{\s*(\w+)\s*\}\}/g, function (match, key) {
            if (!(key in vars)) { return match; }
            return escapeHtml(vars[key]);
        });
    }

    /**
     * Lazy-load html2canvas from the CDN on first download.
     */
    var html2canvasPromise = null;
    function loadHtml2Canvas () {
        if (html2canvasPromise) { return html2canvasPromise; }
        if (typeof window.html2canvas === 'function') {
            html2canvasPromise = Promise.resolve(window.html2canvas);
            return html2canvasPromise;
        }
        html2canvasPromise = new Promise(function (resolve, reject) {
            var script = document.createElement('script');
            script.src = html2canvasUrl;
            script.crossOrigin = 'anonymous';
            script.onload = function () {
                if (typeof window.html2canvas === 'function') {
                    resolve(window.html2canvas);
                } else {
                    html2canvasPromise = null;
                    reject(new Error('html2canvas did not register'));
                }
            };
            script.onerror = function () {
                html2canvasPromise = null;
                reject(new Error('Failed to load html2canvas from CDN'));
            };
            document.head.appendChild(script);
        });
        return html2canvasPromise;
    }

    function whenIframeLoaded (iframe) {
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            if (doc && doc.readyState === 'complete' && doc.body && doc.body.firstChild) {
                resolve();
                return;
            }
            function handler () {
                iframe.removeEventListener('load', handler);
                resolve();
            }
            iframe.addEventListener('load', handler);
        });
    }

    /**
     * Wait until every <img> inside the iframe has either loaded or
     * errored. html2canvas will happily snapshot partial images
     * otherwise, which shows up as a missing QR code.
     */
    function waitForImages (doc) {
        var imgs = doc ? Array.prototype.slice.call(doc.images || []) : [];
        if (!imgs.length) { return Promise.resolve(); }
        return Promise.all(imgs.map(function (img) {
            if (img.complete && img.naturalHeight !== 0) { return null; }
            return new Promise(function (resolve) {
                img.addEventListener('load', resolve, { once: true });
                img.addEventListener('error', resolve, { once: true });
            });
        }));
    }

    function resizePreviewIframe (state, tpl) {
        var iframe = state.iframe;
        var wrap   = state.iframeWrap;
        if (!iframe || !wrap) { return; }

        iframe.style.width  = tpl.width  + 'px';
        iframe.style.height = tpl.height + 'px';

        var available = wrap.clientWidth || 320;
        var scale = available / tpl.width;
        if (scale > 1) { scale = 1; }

        iframe.style.transform = 'scale(' + scale + ')';
        wrap.style.height = (tpl.height * scale) + 'px';

        state.currentScale = scale;
    }

    function updatePreview (state) {
        var data = collectData(state.root);
        var tpl = findTemplate(data.template);
        if (!tpl || !state.iframe) { return; }

        resizePreviewIframe(state, tpl);

        var statusEl = $(state.root, '[data-preview-status]');
        if (statusEl) {
            statusEl.textContent = isValidUrl(data.reviewUrl)
                ? ''
                : (config.i18n && config.i18n.invalidUrl) || '';
        }

        state.iframe.srcdoc = substituteTemplate(tpl.html, data);
    }

    function downloadImage (state) {
        var data = collectData(state.root);
        var tpl  = findTemplate(data.template);
        if (!tpl) { return; }

        var statusEl = $(state.root, '[data-preview-status]');
        var downloadBtn = $(state.root, '[data-action="download"]');
        var iframe = state.iframe;

        if (statusEl) { statusEl.textContent = 'Rendering...'; }
        if (downloadBtn) { downloadBtn.disabled = true; }

        whenIframeLoaded(iframe)
            .then(function () {
                return waitForImages(iframe.contentDocument);
            })
            .then(function () {
                return loadHtml2Canvas();
            })
            .then(function (html2canvas) {
                var doc = iframe.contentDocument;
                if (!doc || !doc.body) {
                    throw new Error('Preview not ready');
                }
                return html2canvas(doc.body, {
                    width:        tpl.width,
                    height:       tpl.height,
                    windowWidth:  tpl.width,
                    windowHeight: tpl.height,
                    scale:        1,
                    useCORS:      true,
                    allowTaint:   false,
                    backgroundColor: null
                });
            })
            .then(function (canvas) {
                var dataUrl = canvas.toDataURL('image/png');
                var a = document.createElement('a');
                a.href = dataUrl;
                a.download = 'google-review-banner-' + (tpl.id || 'style') + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                if (statusEl) { statusEl.textContent = ''; }
            })
            .catch(function (err) {
                console.error('[ggl-review-card]', err);
                if (statusEl) {
                    statusEl.textContent = 'Could not generate image: ' + (err && err.message ? err.message : 'unknown error');
                }
            })
            .then(function () {
                if (downloadBtn) { downloadBtn.disabled = false; }
            });
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
        if (errorEl) { errorEl.textContent = ''; }

        if (step === 1) {
            var email = $(root, '[name="email"]').value.trim();
            if (!isValidEmail(email)) {
                if (errorEl) { errorEl.textContent = config.i18n.invalidEmail; }
                return false;
            }
        }

        if (step === 2) {
            var business   = $(root, '[name="business"]').value.trim();
            var url        = $(root, '[name="reviewUrl"]').value.trim();
            var bannerText = $(root, '[name="bannerText"]').value.trim();
            if (!business || !bannerText) {
                if (errorEl) { errorEl.textContent = config.i18n.required; }
                return false;
            }
            if (!isValidUrl(url)) {
                if (errorEl) { errorEl.textContent = config.i18n.invalidUrl; }
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

    function schedulePreview (state) {
        state.debouncedRender();
    }

    function init (root) {
        var state = {
            root:        root,
            step:        1,
            iframe:      $(root, '[data-ggl-iframe]'),
            iframeWrap:  $(root, '[data-iframe-wrap]')
        };
        state.debouncedRender = debounce(function () { updatePreview(state); }, 200);

        setStep(state, 1);

        $(root, '[data-action="next"]').addEventListener('click', function () {
            if (!validateStep(root, state.step)) { return; }
            setStep(state, Math.min(state.step + 1, 4));
        });
        $(root, '[data-action="back"]').addEventListener('click', function () {
            setStep(state, Math.max(state.step - 1, 1));
        });
        $(root, '[data-action="download"]').addEventListener('click', function () {
            downloadImage(state);
        });

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

        window.addEventListener('resize', debounce(function () {
            var tpl = findTemplate(collectData(root).template);
            if (tpl && state.iframe && !$(root, '[data-live-preview]').hidden) {
                resizePreviewIframe(state, tpl);
            }
        }, 150));
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (!templates.length) { return; }
        $$(document, '[data-ggl-review-card]').forEach(init);
    });
})();
