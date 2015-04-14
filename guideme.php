<?php
/*
Plugin Name: GuideMe
Plugin URI: http://www.psd2html.com/blog/introducing-guideme/
Description: GuideMe is a simple and easy to use plugin that allows you to create helpful tips for site admins.
Version: 1.0.6
Author: psd2html.com
Author URI: http://psd2html.com
Text Domain: guideme
*/

$GuideMe = new GuideMe;

class GuideMe {

	public $config;

	function __construct() {
		add_action( 'init', array( $this, 'post_type_init' ), 0 );
		add_action( 'admin_menu', array( $this, 'wpautop_control_menu' ) );
		add_action( 'init', array( &$this, 'init' ) );
		include( dirname(__FILE__) . '/classes/walkers.php' );
		
		$this->config['pinInnerOffsetX']  = '10';
		$this->config['pinInnerOffsetY']  = '24';
		$this->config['pinImageSRC']      = $this->plugin_url() . '/images/pin.svg';
		$this->config['post__not_in']     = array();
		$this->config['terms__not_in']    = array();
		$this->config['posttype__not_in'] = array();
		$this->config['taxonomy__not_in'] = array();
	}
	
	function init() {
		
		if ( isset( $_REQUEST[ 'hideadmin' ] ) ) {
			show_admin_bar( false );
		}
		
		if ( is_admin() ) {
			
			$typenow = false;
			if ( isset( $_GET['post'] ) ) {
				$post = get_post( $_GET['post'] );
				$typenow = $post->post_type;
			}
			
			$post_type = false;
			if ( isset( $_GET['post_type'] ) ) {
				$post_type = $_GET['post_type'] ;
			}
			
			global $pagenow;
			
			wp_enqueue_style( 'guideme_admin_styles',  $this->plugin_url().'/css/admin.css' );
			
			if ( $post_type == 'guideme' ) {
				add_action( 'admin_footer', array( $this, 'psd2html_banner' ) );
				wp_enqueue_style( 'guideme_banner_styles',  $this->plugin_url().'/css/banner.css' );
			}

			if ( ( $pagenow == "post-new.php" && $post_type == 'guideme' ) || $typenow == 'guideme' ) {
				wp_enqueue_style( 'guideme_admin_webtag', $this->plugin_url() . '/css/webtag.css' );
				wp_register_script( 'guideme_webtag_js', $this->plugin_url() . '/js/webtag.js' );
				wp_register_script( 'guideme_webtag_hooks_js', $this->plugin_url() . '/js/webtag-hooks.js' );
				wp_enqueue_script( 'guideme_webtag_js' );
				wp_enqueue_script( 'guideme_webtag_hooks_js' );
			
				add_filter( 'post_updated_messages', array( $this, 'remove_all_messages' ) );
			}

			add_filter( 'manage_edit-guideme_columns', array( $this, 'add_new_guideme_columns' ) );
			
			add_action( 'manage_guideme_posts_custom_column', array( $this, 'manage_guideme_columns' ), 10, 2 );
			add_action( 'add_meta_boxes', array( $this, 'guideme_meta_boxes' ) );
			add_action( 'admin_menu', array( $this, 'guideme_remove_meta_boxes' ) );
			add_action( 'wp_ajax_gm_markers', array( $this, 'markers') );
			
			
			add_action( 'guideme_content', array( $this, 'post_types_select' ) );
			
			global $current_user;
			if ( !function_exists( 'wp_get_current_user' ) ) {
				require_once( ABSPATH . 'wp-includes/pluggable.php' );
			}
			wp_cookie_constants();
			$current_user = wp_get_current_user();
			
			update_user_option( $current_user->ID, "screen_layout_guideme", 1, true );
		}
		
		load_plugin_textdomain( 'guideme', '', dirname( plugin_basename( __FILE__ ) ) . '/lang' );
		
		add_action( 'wp_head', array( $this, 'wp_head' ) );
		
	}
	
	function wp_head() {
		
		$base_url = site_url() . '/wp-admin/admin-ajax.php';
		$link = false;
		if ( isset( $_REQUEST['hideadmin'] )&& $_REQUEST['gm_action'] == 'new' ) {
			if ( isset( $_REQUEST['pgid'] ) ) {
				$link = add_query_arg( array( 'gm_id' => $_REQUEST['gm_id'], 'pgid' => $_REQUEST['pgid'] ), $base_url . '?action=gm_markers' );
			} elseif ( $_REQUEST['trslug'] ) {
				$link = add_query_arg( array( 'gm_id' => $_REQUEST['gm_id'], 'trslug' => $_REQUEST['trslug'], 'txname' => $_REQUEST['txname'] ), $base_url . '?action=gm_markers' );
			}
		} elseif ( isset( $_REQUEST['hideadmin'] ) && $_REQUEST['gm_action'] == 'edit' ) {
			$link = add_query_arg( array( 'gm_id' => $_REQUEST['gm_id'] ), $base_url . '?action=gm_markers' );
		} else {
			global $wp_query;
			
			if ( isset( $wp_query->queried_object ) ) {
				if ( isset( $wp_query->queried_object->term_id ) ) {
					$link = add_query_arg( array( 'gm_txname' => $wp_query->queried_object->taxonomy, 'gm_trslug' => $wp_query->queried_object->slug ), $base_url . '?action=gm_markers' );
				} elseif ( isset( $wp_query->queried_object->ID ) ) {
					$link = add_query_arg( array( 'post_id' => $wp_query->queried_object->ID ), $base_url . '?action=gm_markers' );
				}
			}
		}
		if ( $link ) :
		?>
		<script src="<?php echo $this->plugin_url(); ?>/js/webtag.js" data-webtag-config='{
			"dataURL":"<?php echo $link; ?>",
			"pinImageSRC": "<?php echo $this->config['pinImageSRC']; ?>",
			"pinInnerOffsetX": <?php echo $this->config['pinInnerOffsetX']; ?>,
			"pinInnerOffsetY": <?php echo $this->config['pinInnerOffsetY']; ?>
		}'></script>  	
		<script src="<?php echo $this->plugin_url(); ?>/js/webtag-hooks.js"></script>
		<link rel="stylesheet" href="<?php echo $this->plugin_url(); ?>/css/webtag.css">
		<?php
		endif;
	}
	
	function markers() {
		if ( $_SERVER['REQUEST_METHOD'] == 'GET' ) {
			
			// get markers
			if ( isset( $_REQUEST['gm_id'] ) ) {
				$post_id = intval( $_REQUEST['gm_id'] );
				if ( $post_id ) {
					echo get_post_meta( $post_id, '_gm_markers', true );
					die();
				}
			}
			$args = array();
			if ( isset( $_REQUEST['post_id'] ) ) {
				$args = array(
					'post_type' => 'guideme',
					'meta_query' => array(
						array(
							'key' => '_gm_pgid',
							'value' => $_REQUEST['post_id'],
						)
					),
					'posts_per_page' => -1
				);
			} elseif ( isset( $_REQUEST['gm_cat_name'] ) ) {
				$args = array(
					'post_type' => 'guideme',
					'meta_query' => array(
						array(
							'key' => '_gm_txname',
							'value' => 'category',
						),
						array(
							'key' => '_gm_trslug',
							'value' => $_REQUEST['gm_cat_name'],
						),
					),
					'posts_per_page' => -1
				 );
			}elseif ( isset( $_REQUEST['gm_txname'] ) && isset( $_REQUEST['gm_trslug'] ) ) {
				$args = array(
					'post_type' => 'guideme',
					'meta_query' => array(
						array(
							'key' => '_gm_txname',
							'value' => $_REQUEST['gm_txname'],
						),
						array(
							'key' => '_gm_trslug',
							'value' => $_REQUEST['gm_trslug'],
						),
					),
					'posts_per_page' => -1
				);
			}
			
			$r = new WP_Query( $args );
			if ( $r->have_posts() ) {
				$all_pins = array();
				while ( $r->have_posts() ) {
					$r->the_post(); 
					$pins = json_decode( get_post_meta( get_the_ID(), '_gm_markers', true ) );
					foreach( $pins->pins as $pin ) {
						$all_pins['pins'][] = $pin;
					}
				}
				echo json_encode( $all_pins );
			}
			wp_reset_postdata();
			die();
		} else {
			//save markers
			$post_id = intval( $_REQUEST['gm_id'] );
			$markers = $_POST['json'];
			if ( $post_id ) {
				update_post_meta( $post_id, '_gm_markers', $markers );
				if ( $_REQUEST['pgid'] ) {
					update_post_meta( $post_id, '_gm_pgid', $_REQUEST['pgid'] );
				}
				if ( $_REQUEST['trslug'] ) {
					update_post_meta( $post_id, '_gm_trslug', $_REQUEST['trslug'] );
				}
				if ( $_REQUEST['txname'] ) {
					update_post_meta( $post_id, '_gm_txname', $_REQUEST['txname'] );
				}
			}
			die();
		}
	}	
	
	function export_page() {
		include( dirname(__FILE__) . '/templates/export.php' );
	}

	function guideme_data_box_edit() {
		$content_post = get_post( get_the_ID() );
		$em_pgid      = get_post_meta( $content_post->ID, '_gm_pgid', true );
		$gm_trslug    = get_post_meta( $content_post->ID, '_gm_trslug', true );
		$gm_txname    = get_post_meta( $content_post->ID, '_gm_txname', true );
		
		if ( $em_pgid ) {
			$current_object = get_post_type( $em_pgid );
		}elseif ( $gm_trslug && $gm_txname ) {
			$current_object = $gm_txname;
		}
		
		$link = $this->plugin_url() . '/images/pin.png';
		if ( $em_pgid ) {
			$link = get_permalink( $em_pgid );
		}elseif ( $gm_trslug && $gm_txname ) {
			$link = get_term_link( $gm_trslug, $gm_txname );
		}
		$link = add_query_arg( array( 'hideadmin' => 1, 'gm_id' => get_the_ID(), 'gm_action' => 'edit' ), $link );
		$submit_button = '<input id="publish_em" class="button button-primary button-large" type="submit" value="' . __( 'Update' ) . '" >';
		$content = '';
		$editor_id = 'editor_guideme';
		$settings = array(
			'media_buttons' =>false,
			'textarea_rows' => 4,
			'teeny' => 1,
			'quicktags' => false,
			);
		wp_editor( $content, $editor_id, $settings );
		include( dirname(__FILE__) . '/templates/edit.php' );
	}
	
	function guideme_data_box_new() {
		$link = '';
		$submit_button = '
		<a href="#" id="publish_link" class="button button-primary button-large" >' . __( 'Publish' ) . '</a>
		<input style="display: none;" id="publish" class="button button-primary button-large" type="submit" accesskey="p" value="' . __( 'Publish' ) . '" name="publish">';
		$content = '';
		$editor_id = 'editor_guideme';
		$settings = array(
			'media_buttons' =>false,
			'textarea_rows' => 4,
			'teeny' => 1,
			'quicktags' => false,
			);
		wp_editor( $content, $editor_id, $settings );
		include ( dirname(__FILE__) . '/templates/edit.php' );
	}
	
	function plugin_url() {
		return WP_PLUGIN_URL . '/' . str_replace( '/' . basename( __FILE__), "", plugin_basename(__FILE__) );
	}
	
	function guideme_meta_boxes() {
		$post_type = false;
		if ( isset( $_GET['post_type'] ) ) {
			$post_type = $_GET['post_type'] ;
		}
		
		if ( $post_type == "guideme" ) {
			add_meta_box( 'guideme_data', __( 'GuideMe', 'guideme' ), array( $this, 'guideme_data_box_new' ), 'guideme', 'normal', 'high' );
		} else {
			add_meta_box( 'guideme_data', __( 'GuideMe', 'guideme' ), array( $this, 'guideme_data_box_edit' ), 'guideme', 'normal', 'high' );
		}
	}
	
	function guideme_remove_meta_boxes() {
		remove_meta_box( 'submitdiv', 'guideme', 'normal' );
	}
	
	function post_type_init() {
		$labels = array(
			'name'               => _x( 'GuideMe', 'post type general name', 'guideme' ),
			'singular_name'      => _x( 'Page', 'post type singular name', 'guideme' ),
			'menu_name'          => _x( 'GuideMe', 'admin menu', 'guideme' ),
			'name_admin_bar'     => _x( 'Page', 'add new on admin bar', 'guideme' ),
			'add_new'            => _x( 'Add New', 'page', 'guideme' ),
			'add_new_item'       => __( 'Add New Page', 'guideme' ),
			'new_item'           => __( 'New Page', 'guideme' ),
			'edit_item'          => __( 'Edit Page', 'guideme' ),
			'view_item'          => __( 'View Page', 'guideme' ),
			'all_items'          => __( 'All Pages', 'guideme' ),
			'search_items'       => __( 'Search Pages', 'guideme' ),
			'parent_item_colon'  => __( 'Parent Pages:', 'guideme' ),
			'not_found'          => __( 'No pages found.', 'guideme' ),
			'not_found_in_trash' => __( 'No pages found in Trash.', 'guideme' )
		);
	
		$args = array(
			'labels'              => $labels,
			'public'              => false,
			'publicly_queryable'  => true,
			'show_ui'             => true,
			'show_in_menu'        => true,
			'query_var'           => true,
			'rewrite'             => array( 'slug' => 'guideme' ),
			'capability_type'     => 'post',
			'has_archive'         => true,
			'hierarchical'        => false,
			'menu_position'       => 105,
			'supports'            => false,
			'exclude_from_search' => true,
		);
		
		register_post_type( 'guideme', $args );
	}

	function add_new_guideme_columns( $guideme_columns ) {
		$new_columns['cb']          = $guideme_columns['cb'];
		$new_columns['title']       = _x( 'Title', 'column name' );
		$new_columns['description'] = __( 'Pins' );
		$new_columns['author']      = __( 'Author' );
		$new_columns['date']        = _x( 'Date', 'column name' );
		return $new_columns;
	}
	
	function wpautop_control_menu() {
		add_submenu_page( 'edit.php?post_type=guideme',
				__( 'Export', 'guideme' ),
				__( 'Export', 'guideme' ),
				'manage_options', 'guideme_export',
				array( $this, 'export_page' )
			);
	}
	
	function manage_guideme_columns( $column_name, $id ) {
		switch ( $column_name ) { 
			case 'description':
				if ( $pins = json_decode( get_post_meta( $id, '_gm_markers', true ) ) ) {
					echo count( $pins->pins );
				} else {
					echo 0;
				}
			break;
			default:
			break;
		}
	}	

	function show_object_block_post( $post_type ) {
		$post_type_object = get_post_type_object( $post_type );
		$pages = $this->get_pages( $post_type, __( '- Select ' . $post_type_object->labels->name . ' -', 'guideme' ) );
		if ( $pages ) {
			echo '<li id="' . $post_type . '">';
			echo '<p>' . __( 'Choose', 'guideme' ) . ' ' . strtolower( $post_type_object->labels->name ) . '</p>';
			echo $pages;
			echo '</li>';
		}
	}
	
	function get_pages( $post_type = 'page', $show_option_none = '- Select -' ) {
		$custom_walker = new Walker_PageDropdown_GuideMe;
		$pages = $this->wp_dropdown_pages_gm( array(
							'post_type' => $post_type,
							'show_option_none' => $show_option_none,
							'walker' => $custom_walker )
					);
		return $pages;
	}
	
	function get_terms( $taxonomy = 'category', $show_option_none = '- Select -' ) {
		$term__not_in = implode( ',', $this->remove_terms_from_select() );
		$custom_walker = new Walker_CategoryDropdown_guideme;
		$taxonomy_select = wp_dropdown_categories( array(
							'exclude' => $term__not_in,
							'taxonomy' => $taxonomy,
							'hide_if_empty' => true,
							'echo' => false,
							'show_option_none' => $show_option_none,
							'walker' => $custom_walker
							)
						);
		return str_replace( "value='-1'", "value=''", $taxonomy_select );
	}
	
	function remove_pages_from_select() {
		return apply_filters( 'gm_remove_pages_from_select', $this->config['post__not_in'] );
	}
	
	function remove_terms_from_select() {
		return apply_filters( 'gm_remove_terms_from_select', $this->config['terms__not_in'] );
	}	
	
	function remove_posttype_from_select() {
		return apply_filters( 'gm_remove_posttype_from_select', $this->config['posttype__not_in'] );
	}
	
	function remove_taxonomy_from_select() {
		return apply_filters( 'gm_remove_taxonomy_from_select', $this->config['taxonomy__not_in'] );
	}
	
	function add_select_meta( $content ) {
		return str_replace( '<select', '<select data-webtag-pager ', $content );
	}
	
	function show_object_block_tax( $taxonomy ) {
		add_filter( 'wp_dropdown_cats', array( $this, 'add_select_meta' ) );
		$taxonomy_object = get_taxonomy( $taxonomy );
		$taxonomy_select = $this->get_terms( $taxonomy, __( '- Select ' . $taxonomy_object->labels->name . ' -', 'guideme' ) );
		if ( $taxonomy_select ) {
			echo '<li id="' . $taxonomy . '">';
			echo '<p>' . __( 'Choose', 'guideme' ) . ' ' . strtolower( $taxonomy_object->labels->name ) . '</p>';
			echo $taxonomy_select;
			echo '</li>';
		}
		remove_filter( 'wp_dropdown_cats', array( $this, 'add_select_meta' ) );
	}
	
	function wp_dropdown_pages_gm( $args = '' ) {
		$defaults = array(
			'depth' => 0,
			'child_of' => 0,
			'selected' => 0,
			'echo' => 1,
			'name' => 'page_id',
			'id' => '',
			'show_option_none' => '',
			'show_option_no_change' => '',
			'option_none_value' => '',
			'post_type' => 'post',
		);
	
		$r = wp_parse_args( $args, $defaults );
		extract( $r, EXTR_SKIP );
		$pages = new WP_Query( array(
					'posts_per_page' => -1,
					'no_found_rows' => true,
					'post_status' => 'publish',
					'ignore_sticky_posts' => true,
					'post_type' => $r['post_type'],
					'post__not_in' => $this->remove_pages_from_select()
					)
				);
		$pages = $pages->posts;
		$output = '';
		if ( empty( $id ) )
			$id = $name;
	
		if ( !empty( $pages ) ) {
			$output = "<select data-webtag-pager name='" . esc_attr( $name ) . "' id='" . esc_attr( $id ) . "'>\n";
			if ( $show_option_no_change )
				$output .= "\t<option value=\"-1\">$show_option_no_change</option>";
			if ( $show_option_none )
				$output .= "\t<option value=\"" . esc_attr( $option_none_value ) . "\">$show_option_none</option>\n";
			$output .= walk_page_dropdown_tree( $pages, $depth, $r );
			$output .= "</select>\n";
		}
		$output = apply_filters( 'wp_dropdown_pages', $output );
		return $output;
	}
	
	function post_types_select() {
		$content_post = get_post( get_the_ID() );
		$em_pgid      = get_post_meta( $content_post->ID, '_gm_pgid', true );
		$gm_trslug    = get_post_meta( $content_post->ID, '_gm_trslug', true );
		$gm_txname    = get_post_meta( $content_post->ID, '_gm_txname', true );
		
		if ( $em_pgid ) {
			$current_object = get_post_type( $em_pgid );
		} elseif ( $gm_trslug && $gm_txname ) {
			$current_object = $gm_txname;
		}
	?>
			<p class="strong"><?php _e( 'Choose post type/taxonomy', 'guideme' ); ?></p>
			<?php
			$post_types = get_post_types( array( 'public' => true, 'exclude_from_search' => false ) );
			$taxonomies = get_taxonomies( array( 'public' => true, 'show_ui' => true ), 'names' );
			?>
			<select>
				<option><?php _e( '- Please Select -', 'guideme' ); ?></option>
				<optgroup label="<?php _e( 'Post Types', 'guideme' ); ?>">
				<?php
				$posttype__not_in = $this->remove_posttype_from_select();
				foreach( $post_types as $post_type ) :
					if ( ( array_search( $post_type, $posttype__not_in ) === false ) ) :
						$post_type_object = get_post_type_object( $post_type );
						$pages = $this->get_pages( $post_type, __( '- Select ' . $post_type_object->labels->name . ' -', 'guideme' ) );
						if ( $pages ) :
							if ( $current_object == $post_type ) {
								$selected = ' selected="selected" ';
							} else {
								$selected = '';
							}
						?>
						<option value="<?php echo $post_type; ?>" <?php echo $selected; ?>><?php echo $post_type_object->labels->name; ?></option>
						<?php endif; ?>
					<?php endif; ?>
				<?php endforeach; ?>
				</optgroup>
			
				<optgroup label="<?php _e( 'Taxonomies', 'guideme' ); ?>">
				<?php 
				$taxonomy__not_in = $this->remove_taxonomy_from_select();
				foreach ( $taxonomies as $taxonomy ) :
					if ( ( array_search( $taxonomy, $taxonomy__not_in ) === false ) ) :
						$taxonomy_object = get_taxonomy( $taxonomy );
						$taxonomy_select = $this->get_terms( $taxonomy, __( '- Select ' . $taxonomy_object->labels->name . ' -', 'guideme' ) );
						if ( $taxonomy_select ) :
							if ( $current_object == $taxonomy ) {
								$selected = ' selected="selected" ';
							} else {
								$selected = '';
							}
							
						?>
						<option value="<?php echo $taxonomy; ?>" <?php echo $selected; ?>><?php echo $taxonomy_object->labels->name; ?></option>
						<?php endif; ?>
					<?php  endif; ?>
				<?php endforeach; ?>
				</optgroup>
			</select>
			<ul class="pages_lists">
			<?php
			foreach( $post_types as $post_type ) {
				$this->show_object_block_post( $post_type );
			}
			?>
			<?php
			foreach ( $taxonomies as $taxonomy ) {
				$this->show_object_block_tax( $taxonomy );
			}
			?>
			</ul>
	<?php
	}
	
	function remove_all_messages( $messages ) {
		return array();
	}
	
	function psd2html_banner() {
		include( dirname(__FILE__) . '/templates/p2hbanner.php' );
	}	
}

add_filter( 'gm_remove_pages_from_select', 'remove_logout_woocom' );
function remove_logout_woocom( $pages ) {
	$pages[] = get_option( 'woocommerce_logout_page_id' );
	return $pages;
}