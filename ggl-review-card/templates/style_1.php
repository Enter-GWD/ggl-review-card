<?php
/**
 * Template: Classic
 *
 * Drop new templates next to this file as `style_2.php`, `style_3.php`, etc.
 * They are auto-discovered by ggl_review_card_get_templates() in the main
 * plugin file. Each file must `return` an associative array.
 *
 * Available keys (all consumed by the canvas renderer in
 * assets/js/ggl-review-card.js):
 *
 *   id          - unique slug, e.g. 'style_1'
 *   name        - display name shown in the template picker
 *   background  - canvas background colour (CSS colour string)
 *   accent      - accent colour for stars, frames, dividers
 *   textColor   - main text colour (business name + body copy)
 *   subColor    - secondary text colour ("Google Reviews" label)
 *   titleFont   - canvas font shorthand for the business name
 *   bodyFont    - canvas font shorthand for the banner text
 *   labelFont   - canvas font shorthand for the "Google Reviews" label
 *   ctaFont     - canvas font shorthand for the call-to-action under the QR
 *   layout      - layout id consumed by the renderer ('centered' is built-in)
 *   qrSize      - QR code size in canvas px
 *   qrFrame     - true to draw an accent border around the QR plate
 *   bars        - true to draw top + bottom accent bars
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

return array(
    'id'         => 'style_1',
    'name'       => __( 'Classic', 'ggl-review-card' ),
    'background' => '#ffffff',
    'accent'     => '#4285F4',
    'textColor'  => '#202124',
    'subColor'   => '#5f6368',
    'titleFont'  => 'bold 78px Arial, sans-serif',
    'bodyFont'   => '500 48px Arial, sans-serif',
    'labelFont'  => '600 44px Arial, sans-serif',
    'ctaFont'    => 'bold 50px Arial, sans-serif',
    'layout'     => 'centered',
    'qrSize'     => 640,
    'qrFrame'    => true,
    'bars'       => true,
);
