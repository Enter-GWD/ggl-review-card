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
 * Templates available in step 3. Each template defines colours used by the
 * canvas renderer in assets/js/ggl-review-card.js.
 */
function ggl_review_card_get_templates() {
    return array(
        array(
            'id'         => 'classic',
            'name'       => __( 'Classic', 'ggl-review-card' ),
            'background' => '#ffffff',
            'accent'     => '#4285F4',
            'textColor'  => '#202124',
            'subColor'   => '#5f6368',
        ),
        array(
            'id'         => 'midnight',
            'name'       => __( 'Midnight', 'ggl-review-card' ),
            'background' => '#0f172a',
            'accent'     => '#facc15',
            'textColor'  => '#ffffff',
            'subColor'   => '#cbd5f5',
        ),
        array(
            'id'         => 'sunrise',
            'name'       => __( 'Sunrise', 'ggl-review-card' ),
            'background' => '#fff7ed',
            'accent'     => '#ea580c',
            'textColor'  => '#7c2d12',
            'subColor'   => '#9a3412',
        ),
        array(
            'id'         => 'forest',
            'name'       => __( 'Forest', 'ggl-review-card' ),
            'background' => '#ecfdf5',
            'accent'     => '#047857',
            'textColor'  => '#064e3b',
            'subColor'   => '#065f46',
        ),
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
            </fieldset>

            <fieldset class="ggl-rc__step" data-step="4">
                <legend><?php esc_html_e( 'Your A5 banner', 'ggl-review-card' ); ?></legend>
                <p class="ggl-rc__hint"><?php esc_html_e( 'Click "Generate banner" to render your A5 image, then download it.', 'ggl-review-card' ); ?></p>
                <div class="ggl-rc__preview">
                    <canvas data-ggl-canvas width="1240" height="1754" aria-label="<?php esc_attr_e( 'A5 review banner preview', 'ggl-review-card' ); ?>"></canvas>
                </div>
                <a class="ggl-rc__download" href="#" download="google-review-banner-a5.png" hidden>
                    <?php esc_html_e( 'Download A5 image', 'ggl-review-card' ); ?>
                </a>
            </fieldset>

            <div class="ggl-rc__nav">
                <button type="button" class="ggl-rc__btn ggl-rc__btn--ghost" data-action="back" hidden>
                    <?php esc_html_e( 'Back', 'ggl-review-card' ); ?>
                </button>
                <button type="button" class="ggl-rc__btn" data-action="next">
                    <?php esc_html_e( 'Next', 'ggl-review-card' ); ?>
                </button>
                <button type="button" class="ggl-rc__btn ggl-rc__btn--primary" data-action="generate" hidden>
                    <?php esc_html_e( 'Generate banner', 'ggl-review-card' ); ?>
                </button>
            </div>
        </form>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode( 'ggl_review_card', 'ggl_review_card_shortcode' );
