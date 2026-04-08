<?php
/**
 * Template: Classic
 *
 * Drop new templates next to this file as `style_2.php`, `style_3.php`, etc.
 * They are auto-discovered by ggl_review_card_get_templates() in the main
 * plugin file. Each file must `return` an associative array.
 *
 * ----- Top-level keys ----------------------------------------------------
 *
 *   id          - unique slug, e.g. 'style_1'
 *   name        - display name shown in the template picker
 *   background  - canvas background colour (CSS colour string)
 *   accent      - accent colour (used by the small picker swatch only)
 *   textColor   - main text colour (used by the small picker swatch only)
 *   canvas      - optional. array('w' => int, 'h' => int) to override the
 *                 default A5 size of 1240x1754 px.
 *   elements    - ordered array of layout elements drawn on the canvas
 *
 * ----- Element format ----------------------------------------------------
 *
 * `elements` is an ordered list (z-order = array order). Each element is an
 * associative array with at minimum a `type`. Coordinates accept:
 *
 *   - integers in pixels (e.g. 90)
 *   - percentage strings of the canvas dimension (e.g. '50%')
 *   - negative integers, which are measured from the right/bottom edge
 *     (e.g. y = -150 means 150 px above the bottom)
 *
 * Common element keys: x, y, align ('left'|'center'|'right'),
 * baseline ('top'|'middle'|'alphabetic'|'bottom').
 *
 * Element types:
 *
 *   rect       - filled rectangle. Keys: w, h, fill.
 *   text       - static text. Keys: content, font, fill, maxWidth,
 *                maxLines, lineHeight.
 *   stars      - rating stars (defaults to 5). Keys: count, font, fill.
 *   business   - dynamic; renders the business name from the form. Same
 *                keys as `text` (content is ignored).
 *   bannerText - dynamic; renders the banner text from the form. Same
 *                keys as `text` (content is ignored).
 *   qr         - QR code rendered from the form's review URL. Keys:
 *                size, anchor ('topLeft'|'topCenter'|'centerLeft'|'center'),
 *                plate (background colour, or false to skip),
 *                framePadding, frame (bool), frameColor, frameWidth.
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

return array(
    'id'         => 'style_1',
    'name'       => __( 'Classic', 'ggl-review-card' ),

    // Used by the small swatch in the template picker.
    'background' => '#ffffff',
    'accent'     => '#4285F4',
    'textColor'  => '#202124',

    'elements' => array(

        // Top accent bar
        array(
            'type' => 'rect',
            'x'    => 0,
            'y'    => 0,
            'w'    => '100%',
            'h'    => 24,
            'fill' => '#4285F4',
        ),

        // Bottom accent bar (negative y = from bottom)
        array(
            'type' => 'rect',
            'x'    => 0,
            'y'    => -24,
            'w'    => '100%',
            'h'    => 24,
            'fill' => '#4285F4',
        ),

        // Stars
        array(
            'type'     => 'stars',
            'count'    => 5,
            'x'        => '50%',
            'y'        => 90,
            'font'     => 'bold 110px Arial, sans-serif',
            'fill'     => '#facc15',
            'align'    => 'center',
            'baseline' => 'top',
        ),

        // "Google Reviews" label
        array(
            'type'     => 'text',
            'content'  => 'Google Reviews',
            'x'        => '50%',
            'y'        => 230,
            'font'     => '600 44px Arial, sans-serif',
            'fill'     => '#5f6368',
            'align'    => 'center',
            'baseline' => 'top',
        ),

        // Business name (dynamic)
        array(
            'type'       => 'business',
            'x'          => '50%',
            'y'          => 310,
            'font'       => 'bold 78px Arial, sans-serif',
            'fill'       => '#202124',
            'align'      => 'center',
            'baseline'   => 'top',
            'maxWidth'   => 1080,
            'maxLines'   => 2,
            'lineHeight' => 88,
        ),

        // Banner text (dynamic)
        array(
            'type'       => 'bannerText',
            'x'          => '50%',
            'y'          => 510,
            'font'       => '500 48px Arial, sans-serif',
            'fill'       => '#202124',
            'align'      => 'center',
            'baseline'   => 'top',
            'maxWidth'   => 1040,
            'maxLines'   => 4,
            'lineHeight' => 64,
        ),

        // QR code
        array(
            'type'         => 'qr',
            'x'            => '50%',
            'y'            => 880,
            'anchor'       => 'topCenter',
            'size'         => 640,
            'plate'        => '#ffffff',
            'framePadding' => 30,
            'frame'        => true,
            'frameColor'   => '#4285F4',
            'frameWidth'   => 8,
        ),

        // Call to action below QR
        array(
            'type'     => 'text',
            'content'  => 'Scan to leave a review',
            'x'        => '50%',
            'y'        => -150,
            'font'     => 'bold 50px Arial, sans-serif',
            'fill'     => '#202124',
            'align'    => 'center',
            'baseline' => 'top',
        ),
    ),
);
