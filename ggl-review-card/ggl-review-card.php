<?php
/**
 * Plugin Name: GGL Review Card
 * Description: Multi-step form (shortcode) that generates an A5 Google Review banner with QR code.
 * Version:     1.0.0
 * Author:      Enter-GWD
 * License:     GPL-2.0-or-later
 * Text Domain: ggl-review-card
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'GGL_REVIEW_CARD_VERSION', '1.0.0' );
define( 'GGL_REVIEW_CARD_PATH', plugin_dir_path( __FILE__ ) );
define( 'GGL_REVIEW_CARD_URL', plugin_dir_url( __FILE__ ) );

/**
 * Register front-end assets. They are only printed on pages that actually
 * use the [ggl_review_card] shortcode (see ggl_review_card_shortcode()).
 */
function ggl_review_card_register_assets() {
    wp_register_style(
        'ggl-review-card',
        GGL_REVIEW_CARD_URL . 'assets/css/ggl-review-card.css',
        array(),
        GGL_REVIEW_CARD_VERSION
    );

    wp_register_script(
        'ggl-review-card',
        GGL_REVIEW_CARD_URL . 'assets/js/ggl-review-card.js',
        array(),
        GGL_REVIEW_CARD_VERSION,
        true
    );

    wp_localize_script(
        'ggl-review-card',
        'gglReviewCardConfig',
        array(
            'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
            'nonce'     => wp_create_nonce( 'ggl_review_card' ),
            'qrEndpoint' => 'https://api.qrserver.com/v1/create-qr-code/',
            'templates' => ggl_review_card_get_templates(),
            'i18n'      => array(
                'next'      => __( 'Next', 'ggl-review-card' ),
                'back'      => __( 'Back', 'ggl-review-card' ),
                'generate'  => __( 'Generate banner', 'ggl-review-card' ),
                'download'  => __( 'Download A5 image', 'ggl-review-card' ),
                'invalidEmail' => __( 'Please enter a valid email address.', 'ggl-review-card' ),
                'required'  => __( 'This field is required.', 'ggl-review-card' ),
                'invalidUrl' => __( 'Please enter a valid Google review URL.', 'ggl-review-card' ),
            ),
        )
    );
}
add_action( 'init', 'ggl_review_card_register_assets' );

/**
 * Discover templates by scanning `templates/style_*.html`.
 *
 * Each template is a full HTML document (with its own <head>, <style>
 * and <body>) that gets rendered inside an iframe on the front-end.
 * To add a new layout, copy `templates/style_1.html` to
 * `templates/style_2.html` (or any other `style_*.html` filename) and
 * edit the HTML/CSS.
 *
 * Filter `ggl_review_card_templates` to add/remove templates programmatically.
 */
function ggl_review_card_get_templates() {
    static $cached = null;
    if ( null !== $cached ) {
        return $cached;
    }

    $templates = array();
    $files     = glob( GGL_REVIEW_CARD_PATH . 'templates/style_*.html' );

    if ( $files ) {
        sort( $files );
        foreach ( $files as $file ) {
            $tpl = ggl_review_card_load_template_file( $file );
            if ( $tpl ) {
                $tpl['_file'] = basename( $file );
                $templates[]  = $tpl;
            }
        }
    }

    /**
     * Filter the list of templates returned to the front-end.
     *
     * @param array $templates List of template config arrays.
     */
    $cached = apply_filters( 'ggl_review_card_templates', $templates );

    return $cached;
}

/**
 * Read one HTML template file. Metadata (id, name, canvas size, picker
 * swatch colours) comes from <meta name="..." content="..."> tags in
 * the <head>. The raw HTML body is passed through to the JS side as-is
 * and rendered inside an iframe after placeholder substitution.
 *
 * Returns null if the file is unreadable or empty.
 */
function ggl_review_card_load_template_file( $file ) {
    $content = file_get_contents( $file );
    if ( false === $content || '' === trim( $content ) ) {
        return null;
    }

    $default_id = preg_replace( '/[^a-z0-9_-]/i', '', basename( $file, '.html' ) );

    $meta = array(
        'template-id'       => $default_id,
        'template-name'     => ucwords( str_replace( array( '_', '-' ), ' ', $default_id ) ),
        'canvas-width'      => '1240',
        'canvas-height'     => '1754',
        'swatch-background' => '#ffffff',
        'swatch-accent'     => '#4285F4',
        'swatch-text'       => '#202124',
    );

    // Grab every <meta name="..." content="..."> tag. Allow either
    // attribute order so authors can write whichever feels natural.
    if ( preg_match_all(
        '/<meta\b[^>]*\bname=["\']([^"\']+)["\'][^>]*\bcontent=["\']([^"\']*)["\']/i',
        $content,
        $matches,
        PREG_SET_ORDER
    ) ) {
        foreach ( $matches as $m ) {
            $meta[ strtolower( $m[1] ) ] = $m[2];
        }
    }
    if ( preg_match_all(
        '/<meta\b[^>]*\bcontent=["\']([^"\']*)["\'][^>]*\bname=["\']([^"\']+)["\']/i',
        $content,
        $matches,
        PREG_SET_ORDER
    ) ) {
        foreach ( $matches as $m ) {
            $meta[ strtolower( $m[2] ) ] = $m[1];
        }
    }

    return array(
        'id'         => $meta['template-id'],
        'name'       => $meta['template-name'],
        'background' => $meta['swatch-background'],
        'accent'     => $meta['swatch-accent'],
        'textColor'  => $meta['swatch-text'],
        'width'      => max( 100, (int) $meta['canvas-width'] ),
        'height'     => max( 100, (int) $meta['canvas-height'] ),
        'html'       => $content,
    );
}

/**
 * Render the multi-step form. Usage: [ggl_review_card]
 */
function ggl_review_card_shortcode( $atts ) {
    wp_enqueue_style( 'ggl-review-card' );
    wp_enqueue_script( 'ggl-review-card' );

    $templates = ggl_review_card_get_templates();

    ob_start();
    ?>
    <div class="ggl-rc" data-ggl-review-card>
        <ol class="ggl-rc__steps" aria-label="<?php esc_attr_e( 'Form progress', 'ggl-review-card' ); ?>">
            <li class="is-active" data-step-indicator="1"><span>1</span><?php esc_html_e( 'Email', 'ggl-review-card' ); ?></li>
            <li data-step-indicator="2"><span>2</span><?php esc_html_e( 'Business', 'ggl-review-card' ); ?></li>
            <li data-step-indicator="3"><span>3</span><?php esc_html_e( 'Template', 'ggl-review-card' ); ?></li>
            <li data-step-indicator="4"><span>4</span><?php esc_html_e( 'Download', 'ggl-review-card' ); ?></li>
        </ol>

        <form class="ggl-rc__form" novalidate>

            <fieldset class="ggl-rc__step is-active" data-step="1">
                <legend><?php esc_html_e( 'Your email', 'ggl-review-card' ); ?></legend>
                <label class="ggl-rc__field">
                    <span><?php esc_html_e( 'Email address', 'ggl-review-card' ); ?> *</span>
                    <input type="email" name="email" required autocomplete="email" placeholder="you@example.com">
                </label>
                <p class="ggl-rc__error" data-error-for="email"></p>
            </fieldset>

            <fieldset class="ggl-rc__step" data-step="2">
                <legend><?php esc_html_e( 'Business details', 'ggl-review-card' ); ?></legend>
                <label class="ggl-rc__field">
                    <span><?php esc_html_e( 'Business name', 'ggl-review-card' ); ?> *</span>
                    <input type="text" name="business" required maxlength="80" placeholder="Acme Coffee Co.">
                </label>
                <label class="ggl-rc__field">
                    <span><?php esc_html_e( 'Google review link', 'ggl-review-card' ); ?> *</span>
                    <input type="url" name="reviewUrl" required placeholder="https://g.page/r/...">
                </label>
                <label class="ggl-rc__field">
                    <span><?php esc_html_e( 'Banner text', 'ggl-review-card' ); ?> *</span>
                    <textarea name="bannerText" required maxlength="140" rows="3" placeholder="<?php esc_attr_e( 'Loved your visit? Scan to leave a review!', 'ggl-review-card' ); ?>"></textarea>
                </label>
                <p class="ggl-rc__error" data-error-for="business"></p>
            </fieldset>

            <fieldset class="ggl-rc__step" data-step="3">
                <legend><?php esc_html_e( 'Choose a template', 'ggl-review-card' ); ?></legend>
                <?php if ( empty( $templates ) ) : ?>
                    <p class="ggl-rc__error"><?php esc_html_e( 'No templates found in templates/. Add a style_*.html file.', 'ggl-review-card' ); ?></p>
                <?php else : ?>
                    <div class="ggl-rc__templates" role="radiogroup">
                        <?php foreach ( $templates as $index => $template ) : ?>
                            <label class="ggl-rc__template" style="--ggl-bg: <?php echo esc_attr( $template['background'] ); ?>; --ggl-accent: <?php echo esc_attr( $template['accent'] ); ?>; --ggl-text: <?php echo esc_attr( $template['textColor'] ); ?>;">
                                <input type="radio" name="template" value="<?php echo esc_attr( $template['id'] ); ?>" <?php checked( 0, $index ); ?>>
                                <span class="ggl-rc__template-preview">
                                    <span class="ggl-rc__template-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                                    <span class="ggl-rc__template-name"><?php echo esc_html( $template['name'] ); ?></span>
                                </span>
                            </label>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </fieldset>

            <fieldset class="ggl-rc__step" data-step="4">
                <legend><?php esc_html_e( 'Your review banner', 'ggl-review-card' ); ?></legend>
                <p class="ggl-rc__hint"><?php esc_html_e( 'The preview on the right updates live as you edit. Click the button below to render and download a high-resolution PNG.', 'ggl-review-card' ); ?></p>
                <button type="button" class="ggl-rc__btn ggl-rc__btn--primary" data-action="download">
                    <?php esc_html_e( 'Download PNG', 'ggl-review-card' ); ?>
                </button>
            </fieldset>

            <div class="ggl-rc__nav">
                <button type="button" class="ggl-rc__btn ggl-rc__btn--ghost" data-action="back" hidden>
                    <?php esc_html_e( 'Back', 'ggl-review-card' ); ?>
                </button>
                <button type="button" class="ggl-rc__btn" data-action="next">
                    <?php esc_html_e( 'Next', 'ggl-review-card' ); ?>
                </button>
            </div>
        </form>

        <aside class="ggl-rc__live-preview" data-live-preview hidden aria-live="polite">
            <h3 class="ggl-rc__live-preview-title"><?php esc_html_e( 'Live preview', 'ggl-review-card' ); ?></h3>
            <div class="ggl-rc__iframe-wrap" data-iframe-wrap>
                <iframe data-ggl-iframe title="<?php esc_attr_e( 'Review banner preview', 'ggl-review-card' ); ?>" sandbox="allow-same-origin"></iframe>
            </div>
            <p class="ggl-rc__preview-status" data-preview-status></p>
        </aside>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'ggl_review_card', 'ggl_review_card_shortcode' );
