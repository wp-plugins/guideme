		<script type="text/javascript">
			WebTag.Utils.extend(WebTag.Localization, {
				editButton: {
					openText: '<?php _e( 'Close', 'guideme' ); ?>',
					closeText: '<?php _e( 'Edit', 'guideme' ); ?>'
				},
				btnToggleAll: {
					text: '<?php _e( 'Show all / Hide all', 'guideme' ); ?>'
				},
				btnSave: {
					text: '<?php _e( 'Save', 'guideme' ); ?>'
				},
				btnDelete: {
					text: '<?php _e( 'Delete', 'guideme' ); ?>'
				},
				pinDefaultName: {
					text: '<?php _e( 'Pin Name', 'guideme' ); ?>'
				}
			});
		</script>
		<?php  global $current_page_id; $current_page_id = get_the_ID(); ?>
		<script data-webtag-config='{
			"pinImageSRC": "<?php echo $this->config['pinImageSRC']; ?>",
			"pinInnerOffsetX": <?php echo $this->config['pinInnerOffsetX']; ?>,
			"pinInnerOffsetY": <?php echo $this->config['pinInnerOffsetY']; ?>,
			"defaultFrameSRC": "<?php echo $link; ?>"
		}'></script>

		<div id="titlediv">
		<div id="titlewrap">
			<label class="screen-reader-text" id="title-prompt-text" for="title"><?php _e( 'Enter title here' ); ?></label>
			<input type="text" name="post_title" size="30" value="<?php the_title(); ?>" id="title_gm" autocomplete="off" />
		</div>
		<div class="inside">
		</div>
		</div>
		<div class="guideme" data-webtag>
			<div class="data_column">
				<?php do_action( 'guideme_content' ); ?>
				<p  class="pin_description"><?php _e( 'To add new pin just drag and drop the icon to the page', 'guideme' ); ?> <span data-webtag-pin></span></p>
				<div class="markers" data-webtag-editlist></div>
				<?php echo $submit_button; ?>
			</div>
			<div class="frame_column">
				<iframe data-webtag-frame ></iframe>
			</div>
		<div class="cleare"></div>
		</div>