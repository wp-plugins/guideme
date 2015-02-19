<?php
class Walker_PageDropdown_GuideMe extends Walker {
	/**
	 * @see Walker::$tree_type
	 * @since 2.1.0
	 * @var string
	 */
	var $tree_type = 'page';

	/**
	 * @see Walker::$db_fields
	 * @since 2.1.0
	 * @todo Decouple this
	 * @var array
	 */
	var $db_fields = array ( 'parent' => 'post_parent', 'id' => 'ID' );

	/**
	 * @see Walker::start_el()
	 * @since 2.1.0
	 *
	 * @param string $output Passed by reference. Used to append additional content.
	 * @param object $page Page data object.
	 * @param int $depth Depth of page in reference to parent pages. Used for padding.
	 * @param array $args Uses 'selected' argument for selected page to set selected HTML attribute for option element.
	 * @param int $id
	 */
	function start_el( &$output, $page, $depth = 0, $args = array(), $id = 0 ) {
		$pad = str_repeat( '&nbsp;', $depth * 3 );
		
		$args = array(
			'post_type' => 'guideme',
			'meta_query' => array(
				array(
					'key' => '_gm_pgid',
					'value' => $page->ID,
				)
			),
			'posts_per_page' => 1
		 );
		$class = false;
		$disabled = false;
		global $current_page_id;
		$r = new WP_Query( $args );
		if ( $r->have_posts() ) {
			$current_page = get_post_meta( $current_page_id, '_gm_pgid', true );
			if ( $current_page == $page->ID ) {
				$link = add_query_arg( array('gm_id' => $current_page_id, 'hideadmin' => 1, 'pgid' => $page->ID, 'gm_action' => 'new' ), get_permalink( $page->ID ) );
				$page_title = '(' . __( 'Current', 'guideme' ) . ') ' . $page->post_title;
				$class = ' current ';
			} else {
				$link = '#';
				$page_title = '(' . __( 'Selected', 'guideme' ) . ') ' . $page->post_title;
				$class = ' selected ';
				$disabled = 'disabled';
			}
		} else {
			$link = add_query_arg( array( 'gm_id' => $current_page_id, 'hideadmin' => 1, 'pgid' => $page->ID, 'gm_action' => 'new' ), get_permalink( $page->ID ) );
			$page_title = $page->post_title;
		}
		wp_reset_postdata();
		
		$output .= "\t<option class=\"level-$depth $class\" value=\"$link\"";
		if ( $class == ' current ' )
			$output .= ' selected="selected"';
		$output .= ' '.$disabled.'>';
		$title = apply_filters( 'list_pages', $page_title, $page );
		$output .= $pad . esc_html( $title );
		$output .= "</option>\n";
	}
}


class Walker_CategoryDropdown_GuideMe extends Walker {
	/**
	 * @see Walker::$tree_type
	 * @since 2.1.0
	 * @var string
	 */
	var $tree_type = 'category';

	/**
	 * @see Walker::$db_fields
	 * @since 2.1.0
	 * @todo Decouple this
	 * @var array
	 */
	var $db_fields = array ( 'parent' => 'parent', 'id' => 'term_id' );

	/**
	 * @see Walker::start_el()
	 * @since 2.1.0
	 *
	 * @param string $output Passed by reference. Used to append additional content.
	 * @param object $category Category data object.
	 * @param int $depth Depth of category. Used for padding.
	 * @param array $args Uses 'selected' and 'show_count' keys, if they exist.
	 */
	function start_el( &$output, $category, $depth = 0, $args = array(), $id = 0 ) {
		$pad = str_repeat( '&nbsp;', $depth * 3 );
		
		$query_args = array(
			'post_type' => 'guideme',
			'meta_query' => array(
				array(
					'key' => '_gm_txname',
					'value' => $category->taxonomy,
				),
				array(
					'key' => '_gm_trslug',
					'value' => $category->slug,
				),
			),
			'posts_per_page' => 1
		 );
		$disabled = false;
		$class = false;
		$cuurent_item = get_the_ID();
		$r = new WP_Query( $query_args );
		if ( $r->have_posts() ){
			//while ($r->have_posts()) : $r->the_post();
				if ( get_the_ID() == $cuurent_item ) {
					$cat_name = apply_filters( 'list_cats', '(' . __('Current', 'guideme') . ') ' . $category->name, $category );
					$link = add_query_arg( array( 'gm_id' => get_the_ID(), 'hideadmin' => 1, 'trslug' => $category->slug, 'txname' => $category->taxonomy, 'gm_action' => 'new' ), get_term_link( $category->slug, $category->taxonomy ) );
					$class = ' current ';
					
				} else {
					$cat_name = apply_filters( 'list_cats', '(' . __( 'Selected', 'guideme' ) . ') ' . $category->name, $category );
					$link = '#';
					$class = ' selected ';
					$disabled = 'disabled';
				}
			//endwhile;
		} else {
			$cat_name = apply_filters( 'list_cats', $category->name, $category );
			$link = add_query_arg( array( 'gm_id' => get_the_ID(), 'hideadmin' => 1, 'trslug' => $category->slug, 'txname' => $category->taxonomy, 'gm_action' => 'new' ), get_term_link( $category->slug, $category->taxonomy ) );

		}
		wp_reset_postdata();
		
		$output .= "\t<option class=\"level-$depth $class\" value=\"".esc_url($link)."\"";
		if ( $class == ' current ' )
			$output .= ' selected="selected"';
		$output .= ' '.$disabled.'>';
		$output .= $pad.$cat_name;
		if ( $args['show_count'] )
			$output .= '&nbsp;&nbsp;(' . $category->count . ')';
		$output .= "</option>\n";
	}
}